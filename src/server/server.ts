import { reserveHash } from '../shared/world/world.ts';
import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
} from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, realpath, stat, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
    createRun,
    addPlayer,
    disconnectPlayer,
    applyCommand,
    advanceRun,
    snapshot,
    attachPhysics,
} from './simulation/game.ts';
import {
    parseMessage,
    distance,
    type ServerMessage,
} from '../shared/shared.ts';
import {
    loadConfig,
    loadRoom,
    saveRoom,
    loadRun,
    saveRun,
    within,
    validJPEG,
    type ServerConfig,
    type RoomCredentials,
} from './persistence/save.ts';
import {
    HTTPError,
    sameSecret,
    mime,
    json,
    body,
    fields,
    token,
    safePath,
} from './server-http.ts';

/**
 * Load private room/run state, attach physics, and start the authoritative HTTP/WebSocket
 * service and timers. Restored outings remain paused; callers must await close to persist
 * and release resources.
 *
 * @param options - Validated server settings, port 0 requests an ephemeral listener for
 * tests
 * @returns Listening URL and an asynchronous, retryable shutdown method.
 * @throws {Error} Configuration, public build, private storage, saved state, physics, or
 * listener initialization fails.
 */
export async function startServer(
    options: ServerConfig,
): Promise<{ url: string; close(): Promise<void> }> {
    const config = loadConfig({
        WU_BIND_HOST: options.host,
        WU_PORT: String(options.port || 4310),
        WU_PUBLIC_ORIGIN: options.origin,
        WU_DATA_DIR: options.dataDir,
        WU_WEB_DIR: options.webDir,
    });

    if (
        !Number.isSafeInteger(options.port)
        || options.port < 0
        || options.port > 65_535
    )
        throw new Error('Invalid port');
    let webRoot: string;

    try {
        webRoot = await realpath(config.webDir);
        const index = await stat(nodePath.resolve(webRoot, 'index.html'));

        if (!index.isFile()) throw new Error('index.html is missing from the web root');
    } catch {
        throw new Error('Built game is missing: build the game or set WU_WEB_DIR.');
    }
    await mkdir(config.dataDir, { recursive: true, mode: 0o700 });
    const dataRoot = await realpath(config.dataDir);

    if (within(webRoot, dataRoot) || within(dataRoot, webRoot))
        throw new Error(
            'Private data and public web directories must not overlap, including symlinks',
        );
    await access(dataRoot, constants.W_OK);
    let room = await loadRoom(dataRoot);
    const loaded = await loadRun(dataRoot),
        run
            = loaded?.run ?? createRun(randomBytes(4).readUInt32LE(0), randomUUID()),
        images = loaded?.images ?? new Map<string, Uint8Array>();

    if (!loaded && room.hostId !== null)
        throw new Error(
            'The established world save is missing. Restore the complete private data directory.',
        );
    if (loaded && run.hostId !== room.hostId)
        throw new Error('Room credentials do not match the saved host');
    if (loaded) {
        for (const player of run.players) disconnectPlayer(run, player.id);
        run.paused = true;
        run.pauseReason = 'Server restarted; reconnect and resume when ready.';
        for (const player of run.players) {
            player.connected = false;
            delete player.lastInput;
        }
    }
    const physics = await attachPhysics(run);
    const sockets = new Map<string, WebSocket>(),
        alive = new WeakSet<WebSocket>();
    const rates = new Map<string, { start: number; count: number }>();

    /**
     * Build a stable event key for cue deduplication within the current world.
     *
     * @param event - Authoritative run event
     * @returns Tick/kind/source/position key.
     */
    const eventId = (event: (typeof run.events)[number]) => `${event.tick}:${event.kind}:${event.player}:${event.point.join(',')}`;
    const heard = new Set(
        run.events.map((event) => `${run.worldId}-${eventId(event)}`),
    );
    let alerting = new Set(
        run.animals
            .filter((animal) => animal.behavior === 'alert')
            .map((animal) => animal.id),
    );
    let isStopping = false,
        isAdmissionBusy = false,
        closed: Promise<void> | undefined,
        mutations = Promise.resolve();

    /**
     * Persist replacement credentials before making them visible to admission; always clear the
     * admission-busy flag.
     *
     * @param next - Next complete private room state
     * @throws {Error} Credential validation or persistence fails.
     */
    async function commitRoom(next: RoomCredentials) {
        isAdmissionBusy = true;
        try {
            await saveRoom(dataRoot, next);
            room = next;
        } finally {
            isAdmissionBusy = false;
        }
    }

    /**
     * Consume a request from a fixed-window rate bucket, keeping at most 1,024 buckets.
     *
     * @param key - Rate bucket key
     * @param limit - Maximum requests per window
     * @param windowMs - Window duration in milliseconds, default 1,000
     * @returns Whether this request remains within the bucket limit.
     */
    function rate(key: string, limit: number, windowMs = 1000) {
        const now = Date.now(),
            entry = rates.get(key);

        if (!entry || now - entry.start >= windowMs) {
            rates.delete(key);
            rates.set(key, { start: now, count: 1 });
            if (rates.size > 1024) rates.delete(rates.keys().next().value!);

            return true;
        }

        return ++entry.count <= limit;
    }
    const worldMessage = {
        type: 'world' as const,
        id: run.worldId,
        hash: await reserveHash(run.world),
        blueprint: run.world,
    };

    /**
     * Serialize a server message to an open socket. Terminates clients with more than 4 MiB
     * queued to bound backpressure.
     *
     * @param socket - Destination WebSocket
     * @param message - Server message to serialize
     */
    function send(socket: WebSocket, message: ServerMessage) {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (socket.bufferedAmount > 4 * 1024 * 1024) {
            socket.terminate();

            return;
        }
        socket.send(JSON.stringify(message));
    }

    /**
     * Create one detached public snapshot and send it to every connected socket.
     */
    function broadcast() {
        const message: ServerMessage = { type: 'snapshot', value: snapshot(run) };

        for (const socket of sockets.values()) send(socket, message);
    }

    /**
     * Send a spatial cue only to crew within its hearing radius, with a shorter radius for
     * shutters.
     *
     * @param message - World-scoped cue and source position
     */
    function cue(message: Extract<ServerMessage, { type: 'cue' }>) {
        for (const player of run.players) {
            const socket = sockets.get(player.id);

            if (
                socket
                && distance(player.position, message.position)
                <= (message.kind === 'shutter' ? 12 : 22)
            )
                send(socket, message);
        }
    }

    /**
     * Emit newly observed action and animal-alert cues, retaining bounded event deduplication
     * and the previous alert set.
     */
    function emitCues() {
        for (const event of run.events) {
            const id = `${run.worldId}-${eventId(event)}`;

            if (heard.has(id)) continue;
            heard.add(id);
            if (heard.size > 128) heard.delete(heard.values().next().value!);
            const kind = eventCueKind(event);

            if (kind)
                cue({
                    type: 'cue',
                    worldId: run.worldId,
                    id,
                    kind,
                    source: event.player,
                    position: event.point,
                });
        }
        const next = new Set<string>();

        for (const animal of run.animals)
            if (animal.behavior === 'alert') {
                next.add(animal.id);
                if (!alerting.has(animal.id))
                    cue({
                        type: 'cue',
                        worldId: run.worldId,
                        id: `${run.worldId}-alert-${run.tick}-${animal.id}`,
                        kind: 'alert',
                        source: animal.id,
                        position: animal.pose.position,
                    });
            }
        alerting = next;
    }

    /**
     * Send a user-facing notice to all connected crew.
     *
     * @param text - Client-safe notice text
     */
    function notice(text: string) {
        for (const socket of sockets.values())
            send(socket, { type: 'notice', text });
    }

    /**
     * Remove image buffers absent from the album and persist the current run and remaining
     * images.
     *
     * @returns Completion of the serialized run save.
     * @throws {Error} Run validation or persistence fails.
     */
    function flush() {
        const kept = new Set(run.album.map((p) => p.id));

        for (const id of images.keys()) if (!kept.has(id)) images.delete(id);

        return saveRun(dataRoot, run, images);
    }

    /**
     * Start a save and notify crew on failure while keeping the server available for storage
     * repair.
     */
    function reportSave() {
        void flush().catch(() => notice(
            'Save failed. Keep this server running and check the private data directory.',
        ),
        );
    }

    /**
     * Authenticate the request cookie against the private room session table.
     *
     * @param request - Incoming request
     * @returns The private session record; do not send it directly to clients.
     * @throws {HTTPError} The session is unknown; status is 401.
     */
    function session(request: IncomingMessage) {
        const value = room.sessions[token(request)];

        if (!value) throw new HTTPError(401, 'Join the room first');

        return value;
    }

    /**
     * Shape a private session into the limited admission identity exposed to clients.
     *
     * @param s - Authenticated private session
     * @returns Player ID, host flag, and optional pending flag.
     */
    function identity(s: ReturnType<typeof session>) {
        return {
            playerId: s.playerId,
            host: s.playerId === room.hostId,
            ...(s.pending && { pending: true }),
        };
    }

    /**
     * Require an authenticated, nonpending host session.
     *
     * @param request - Incoming request
     * @returns The authenticated private host session.
     * @throws {HTTPError} Session is missing (401), or the session is pending or not the host
     * (403).
     */
    function host(request: IncomingMessage) {
        const s = session(request);

        if (s.pending || s.playerId !== room.hostId)
            throw new HTTPError(403, 'Host access required');

        return s;
    }

    /**
     * Require the request Origin header to exactly match the configured public origin.
     *
     * @param request - Incoming mutating request or upgrade
     * @throws {HTTPError} Origin differs from the configured origin; status is 403.
     */
    function origin(request: IncomingMessage) {
        if (request.headers.origin !== config.origin)
            throw new HTTPError(403, 'Incorrect Origin');
    }

    /**
     * Serialize asynchronous room mutations. A failed operation rejects its own caller without
     * poisoning subsequent queued operations.
     *
     * @template T - Result type of the queued operation.
     * @param operation - Asynchronous mutation to run exclusively
     * @returns This operation's result after earlier mutations settle.
     * @throws {HTTPError} Shutdown has started; status is 503. Errors from the operation also
     * propagate.
     */
    async function mutate<T>(operation: () => Promise<T>): Promise<T> {
        await mutations;
        if (isStopping) throw new HTTPError(503, 'Server is saving and stopping');
        const next = operation();

        mutations = (async () => {
            try {
                await next;
            } catch {
                // A failed operation must not poison queued operations

            }
        })();

        return next;
    }
    const http = createServer((request, response) => {
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Referrer-Policy', 'no-referrer');
        response.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        );
        void route(request, response).catch((error) => {
            if (response.headersSent) {
                response.destroy();

                return;
            }
            const status = error instanceof HTTPError ? error.status : 500;

            if (status === 413) response.setHeader('Connection', 'close');
            json(response, status, {
                error:
          error instanceof HTTPError
              ? error.message
              : 'Operation failed; the previous save remains available.',
            });
        });
    });

    http.requestTimeout = 10_000;
    http.headersTimeout = 10_000;
    http.keepAliveTimeout = 5000;
    http.maxRequestsPerSocket = 1000;

    /**
     * Dispatch admission, session, photo, and static-file HTTP requests with endpoint-specific
     * authorization, limits, and path containment checks. Writes the response on success.
     *
     * @param request - Incoming HTTP request
     * @param response - Response to complete
     * @throws {HTTPError} Request validation, authorization, rate limits, or resource lookup
     * fails. Storage failures propagate to the outer response handler.
     */
    async function route(request: IncomingMessage, response: ServerResponse) {
        if (isStopping) throw new HTTPError(503, 'Server is saving and stopping');
        const path = safePath(request),
            method = request.method;

        if (path === '/healthz' && method === 'GET') {
            json(response, 200, {
                ready: true,
                build: run.world.content,
                schema: run.version,
            });

            return;
        }
        if (path === '/api/session' && method === 'GET') {
            json(response, 200, identity(session(request)));

            return;
        }
        if (path === '/api/invite' && method === 'GET') {
            host(request);
            json(response, 200, {
                secret: room.joinSecret,
                pending: Object.values(room.sessions)
                    .filter((s) => s.pending)
                    .map((s) => ({ id: s.playerId, name: s.name })),
            });

            return;
        }
        if (path === '/api/join' && method === 'POST') {
            origin(request);
            if (!rate('join:' + request.socket.remoteAddress, 20, 60_000))
                throw new HTTPError(429, 'Too many admission attempts; wait a minute');
            const value = await fields(request, ['name', 'secret']);

            if (
                typeof value.name !== 'string'
                || !value.name.trim()
                || value.name.length > 256
                || typeof value.secret !== 'string'
                || value.secret.length > 128
            )
                throw new HTTPError(400, 'Invalid name or credential');
            const name = value.name.trim().slice(0, 24),
                secret = value.secret;

            await mutate(async () => {
                const isHost = sameSecret(secret, room.hostSecret);

                if (!isHost && !sameSecret(secret, room.joinSecret))
                    throw new HTTPError(403, 'Incorrect room credential');
                const existing = room.sessions[token(request)];

                if (existing && (!isHost || existing.playerId === room.hostId)) {
                    json(response, existing.pending ? 202 : 200, identity(existing));

                    return;
                }
                if (!isHost && !room.hostId)
                    throw new HTTPError(409, 'The host must open the room first');
                if (isHost && room.hostId && sockets.has(room.hostId))
                    throw new HTTPError(409, 'The host is already connected');
                const isFull = run.players.length >= 4,
                    recovering = isHost && room.hostId !== null;
                const isPending = isFull && !recovering;

                if (isPending && (!run.paused || run.players.every((p) => p.connected)))
                    throw new HTTPError(409, 'All four player slots are reserved');
                if (
                    isPending
                    && Object.values(room.sessions).filter((s) => s.pending).length >= 4
                )
                    throw new HTTPError(409, 'Pending admission list is full');
                const playerId = recovering ? room.hostId! : randomUUID(),
                    newToken = randomBytes(32).toString('hex');
                const next = structuredClone(room);

                for (const [key, s] of Object.entries(next.sessions))
                    if (s.playerId === playerId) delete next.sessions[key];
                next.sessions[newToken] = { playerId, name, pending: isPending };
                if (isHost) next.hostId = playerId;
                await commitRoom(next);
                if (!isPending) {
                    addPlayer(run, playerId, name);
                    const player = run.players.find((p) => p.id === playerId)!;

                    player.connected = false;
                    delete player.lastInput;
                    run.hostId = room.hostId;
                    if (sockets.size === 0) {
                        run.paused = true;
                        run.pauseReason ||= 'Waiting for crew';
                    }
                    await flush();
                }
                response.setHeader(
                    'Set-Cookie',
                    `wu_session=${newToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${config.origin.startsWith('https:') ? '; Secure' : ''}`,
                );
                json(response, isPending ? 202 : 200, identity(next.sessions[newToken]));
            });

            return;
        }
        if (path === '/api/reassign' && method === 'POST') {
            origin(request);
            host(request);
            const value = await fields(request, ['slotId', 'admittedPlayerId']);

            await mutate(async () => {
                host(request);
                if (
                    typeof value.slotId !== 'string'
                    || typeof value.admittedPlayerId !== 'string'
                )
                    throw new HTTPError(400, 'Invalid reassignment');
                const slot = run.players.find((p) => p.id === value.slotId);

                if (
                    !slot
                    || !run.paused
                    || slot.connected
                    || sockets.has(slot.id)
                    || slot.id === room.hostId
                )
                    throw new HTTPError(
                        409,
                        'Choose a disconnected guest slot while paused',
                    );
                const entry = Object.entries(room.sessions).find(
                    ([, s]) => s.pending && s.playerId === value.admittedPlayerId,
                );

                if (!entry) throw new HTTPError(404, 'Pending guest not found');
                const next = structuredClone(room);

                for (const [key, s] of Object.entries(next.sessions))
                    if (s.playerId === slot.id) delete next.sessions[key];
                next.sessions[entry[0]] = {
                    playerId: slot.id,
                    name: entry[1].name,
                    pending: false,
                };
                await commitRoom(next);
                slot.name = entry[1].name;
                delete slot.lastInput;
                await flush();
                json(response, 200, { playerId: slot.id });
                broadcast();
            });

            return;
        }
        const photo = /^\/api\/photos\/([-_a-zA-Z0-9]{1,80})$/.exec(path);

        if (photo) {
            const s = session(request);

            if (s.pending) throw new HTTPError(403, 'Waiting for a player slot');
            const record = run.album.find((p) => p.id === photo[1]);

            if (!record) throw new HTTPError(404, 'Photo not found');
            if (method === 'GET') {
                const bytes = images.get(record.id);

                if (!bytes) throw new HTTPError(404, 'Image is still pending');
                response.writeHead(200, {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': bytes.length,
                });
                response.end(bytes);

                return;
            }
            if (method === 'POST') {
                origin(request);
                if (record.photographer !== s.playerId)
                    throw new HTTPError(
                        403,
                        'Only the photographer can upload this photo',
                    );
                if (!rate('photo:' + s.playerId, 6, 10_000))
                    throw new HTTPError(429, 'Too many image uploads');
                if (request.headers['content-type'] !== 'image/jpeg')
                    throw new HTTPError(415, 'Expected image/jpeg');
                const bytes = await body(request, 65_536);

                if (!validJPEG(bytes))
                    throw new HTTPError(400, 'Invalid JPEG thumbnail');
                await mutate(async () => {
                    if (session(request).playerId !== record.photographer)
                        throw new HTTPError(403, 'Photographer session changed');
                    const current = run.album.find((p) => p.id === record.id);

                    if (!current)
                        throw new HTTPError(404, 'Photo was removed from the album');
                    const existing = images.get(record.id);

                    if (existing) {
                        if (!Buffer.from(existing).equals(bytes))
                            throw new HTTPError(409, 'Photo already has an image');
                        json(response, 200, { ready: true });

                        return;
                    }
                    const frame = run.pendingPhotos[record.id];

                    if (!frame)
                        throw new HTTPError(409, 'No capture frame awaits this image');
                    images.set(record.id, bytes);
                    current.thumbnail = 'ready';
                    delete run.pendingPhotos[record.id];
                    try {
                        await flush();
                    } catch (error) {
                        if (run.album.includes(current)) {
                            images.delete(record.id);
                            current.thumbnail = 'pending';
                            run.pendingPhotos[record.id] = frame;
                        }
                        throw error;
                    }
                    json(response, 200, { ready: true });
                    broadcast();
                });

                return;
            }
        }
        if (method !== 'GET' && method !== 'HEAD')
            throw new HTTPError(405, 'Method not allowed');
        const filename = path === '/' ? 'index.html' : path.slice(1),
            extension = nodePath.extname(filename);

        if (
            !Object.hasOwn(mime, extension)
            || (extension === '.html' && filename !== 'index.html')
        )
            throw new HTTPError(404, 'Not found');
        const candidate = nodePath.resolve(webRoot, filename);

        if (!within(webRoot, candidate)) throw new HTTPError(404, 'Not found');
        let real: string;

        try {
            real = await realpath(candidate);
            const file = await stat(real);

            if (!within(webRoot, real) || !file.isFile())
                throw new Error('Not a regular file');
        } catch {
            throw new HTTPError(404, 'Not found');
        }
        const bytes = await readFile(real);

        response.writeHead(200, {
            'Content-Type': mime[extension],
            'Content-Length': bytes.length,
        });
        response.end(method === 'HEAD' ? undefined : bytes);
    }
    const wss = new WebSocketServer({
        noServer: true,
        maxPayload: 16_384,
        perMessageDeflate: false,
    });

    http.on('upgrade', (request, socket, head) => {
        socket.on('error', () => {});
        try {
            if (isStopping) throw new HTTPError(503, 'Stopping');
            origin(request);
            if (safePath(request) !== '/ws') throw new HTTPError(404, 'Not found');
            if (isAdmissionBusy)
                throw new HTTPError(409, 'Admission is changing; reconnect shortly');
            const s = session(request);

            if (s.pending) throw new HTTPError(403, 'Waiting for a slot');
            if (run.players.every((p) => p.id !== s.playerId))
                throw new HTTPError(403, 'Player slot not found');
            if (sockets.has(s.playerId))
                throw new HTTPError(409, 'Player already connected');
            if (!rate('upgrade:' + request.socket.remoteAddress, 30, 60_000))
                throw new HTTPError(429, 'Too many connections');
            wss.handleUpgrade(request, socket, head, (ws) => {
                sockets.set(s.playerId, ws);
                alive.add(ws);
                addPlayer(run, s.playerId, s.name);
                ws.on('error', () => {});
                ws.on('pong', () => alive.add(ws));
                send(ws, { type: 'welcome', ...identity(s) });
                send(ws, worldMessage);
                send(ws, { type: 'snapshot', value: snapshot(run) });
                for (const frame of Object.values(run.pendingPhotos))
                    if (frame.photographer === s.playerId)
                        send(ws, {
                            type: 'photo',
                            frame,
                            retained: true,
                            verdict: {
                                credits:
                  run.album.find((p) => p.id === frame.id)?.credits ?? [],
                                reason: 'Restored saved capture',
                            },
                        });
                ws.on('message', (data, binary) => {
                    if (isStopping) return;
                    if (binary || !rate('command:' + s.playerId, 90)) {
                        ws.close(1008, 'Command limit exceeded');

                        return;
                    }
                    try {
                        const command = parseMessage(JSON.parse(data.toString()));
                        const previous
                                = run.players.find((p) => p.id === s.playerId)?.lastSeq ?? 0,
                            result = applyCommand(run, s.playerId, command);

                        if (result) {
                            send(ws, { type: 'photo', ...result });
                            cue({
                                type: 'cue',
                                worldId: run.worldId,
                                id: result.frame.id,
                                kind: 'shutter',
                                source: s.playerId,
                                position: result.frame.camera.position,
                            });
                        }
                        if (
                            command.type === 'save-and-stop'
                            && s.playerId === room.hostId
                            && (run.players.find((p) => p.id === s.playerId)?.lastSeq ?? 0)
                            > previous
                        ) {
                            void close().catch(() => notice(
                                'Save failed. Server remains paused; repair storage before retrying.',
                            ),
                            );

                            return;
                        }
                        if (
                            result
                            || [
                                'pause',
                                'resume',
                                'finish',
                                'ready-end',
                                'start',
                                'favorite',
                            ].includes(command.type)
                        ) {
                            reportSave();
                            broadcast();
                        }
                    } catch (error) {
                        send(ws, {
                            type: 'notice',
                            text:
                error instanceof Error
                    ? error.message.slice(0, 200)
                    : 'Command rejected',
                        });
                    }
                });
                ws.on('close', () => {
                    if (sockets.get(s.playerId) !== ws) return;
                    sockets.delete(s.playerId);
                    disconnectPlayer(run, s.playerId);
                    if (!isStopping) {
                        reportSave();
                        broadcast();
                    }
                });
                broadcast();
            });
        } catch (error) {
            const status = error instanceof HTTPError ? error.status : 400;

            socket.end(
                `HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
            );
        }
    });
    let last = performance.now(),
        accumulator = 0,
        count = 0;
    const tick = setInterval(() => {
        const now = performance.now();

        accumulator += Math.min(0.25, (now - last) / 1000);
        last = now;
        while (accumulator >= 1 / 60) {
            advanceRun(run, 1 / 60);
            physics.step(1 / 60);
            emitCues();
            accumulator -= 1 / 60;
            if (++count % 6 === 0) broadcast();
        }
    }, 1000 / 60);
    const autosave = setInterval(() => reportSave(), 10_000);
    const heartbeat = setInterval(() => {
        for (const ws of sockets.values()) {
            if (!alive.has(ws)) {
                ws.terminate();
                continue;
            }
            alive.delete(ws);
            ws.ping();
        }
    }, 15_000);

    /**
     * Pause input, drain mutations, and save before closing sockets, timers, HTTP, and physics.
     * Concurrent calls share shutdown; save failure leaves the server available for a retry.
     *
     * @throws {Error} Saving or server shutdown fails.
     * @returns Completion of the shared shutdown attempt.
     */
    async function close() {
        if (closed) return closed;
        closed = (async () => {
            isStopping = true;
            run.paused = true;
            run.pauseReason = 'Saved and stopped';
            for (const p of run.players) delete p.lastInput;
            try {
                await mutations;
                await flush();
            } catch (error) {
                isStopping = false;
                closed = undefined;
                run.pauseReason = 'Save failed; repair storage and retry';
                throw error;
            }
            notice('Saved. Server is stopping.');
            clearInterval(tick);
            clearInterval(autosave);
            clearInterval(heartbeat);
            for (const ws of sockets.values()) ws.terminate();
            await new Promise<void>((resolve) => wss.close(() => resolve()));
            await new Promise<void>((resolve, reject) => http.close((error) => (error ? reject(error) : resolve())),
            );
            http.closeAllConnections();
            physics.dispose();
        })();

        return closed;
    }
    try {
        await new Promise<void>((resolve, reject) => {
            http.once('error', reject);
            http.listen(options.port, config.host, () => {
                http.off('error', reject);
                resolve();
            });
        });
    } catch (error) {
        clearInterval(tick);
        clearInterval(autosave);
        clearInterval(heartbeat);
        wss.close();
        physics.dispose();
        throw error;
    }
    const address = http.address() as { port: number };

    return {
        url: `http://${config.host.includes(':') ? `[${config.host.replaceAll(/[[\]]/g, '')}]` : config.host}:${address.port}`,
        close,
    };
}

/**
 * Map audible game events to cue kinds, recognizing tin-origin noise as an impact.
 *
 * @param event - Event kind and source identifier
 * @param event.kind - Authoritative action kind
 * @param event.player - Source player ID, or tin for physical tin noise
 * @returns Whistle, rattle, impact, or undefined for a silent event.
 */
export function eventCueKind(event: {
    kind: string;
    player: string;
}): 'whistle' | 'rattle' | 'impact' | undefined {
    if (event.kind === 'whistle' || event.kind === 'rattle') return event.kind;

    return event.kind === 'impact'
        || (event.kind === 'noise' && event.player === 'tin')
        ? 'impact'
        : undefined;
}

/**
 * Start the configured server and register graceful shutdown for command-line launches.
 * Startup failures set the process exit code; failed saves keep the room paused.
 *
 * @returns Resolves after startup or after reporting a startup failure.
 */
export async function runServer(): Promise<void> {
    try {
        const config = loadConfig(process.env),
            server = await startServer(config);

        console.log(
            `Wildly Unqualified ready at ${config.origin}. Credentials are in the private data directory.`,
        );
        let isExiting = false;

        for (const signal of ['SIGINT', 'SIGTERM'] as const)
            process.on(signal, () => {
                if (isExiting) return;
                isExiting = true;
                void server.close()
                    .then(() => {
                        process.exitCode = 0;
                    })
                    .catch(() => {
                        isExiting = false;
                        console.error(
                            'Save failed; server remains paused. Repair storage and stop again.',
                        );
                    });
            });
    } catch (error) {
        console.error(
            error instanceof Error ? error.message : 'Server startup failed',
        );
        process.exitCode = 1;
    }
}

if (
    process.argv[1]
    && import.meta.url === pathToFileURL(nodePath.resolve(process.argv[1])).href
)
    await runServer();
