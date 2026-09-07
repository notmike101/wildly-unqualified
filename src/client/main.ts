import { renderReassign, installJoinForm } from './session/client-admission.ts';
import { renderHud } from './ui/hud.ts';
import { settings, setupSettings } from './session/client-settings.ts';
import { api } from './session/client-api.ts';
import { interpolateSnapshot } from './rendering/client-interpolation.ts';
import { initializeGraphics } from './rendering/client-graphics.ts';
import { renderNotebook, drawMap } from './ui/notebook.ts';
import * as THREE from 'three/webgpu';
import {
    createView,
    capturePhoto,
    alignLocalCarry,
    playSound,
    CREW_COLORS,
} from './rendering/view.ts';
import {
    PROP_DEFINITIONS,
    fixtureBoxes,
    fixtureSurfaces,
} from '../shared/world/level.ts';
import {
    validateReserve,
    reserveHash,
    type ReserveBlueprint,
} from '../shared/world/world.ts';
import {
    distance,
    eye,
    forward,
    movePlayer,
    playerSpeed,
    propertyBoxes,
    type ClientMessage,
    type Input,
    type PhotoFrame,
    type PhotoVerdict,
    type Player,
    type ServerMessage,
    type Snapshot,
    type Vec3,
} from '../shared/shared.ts';
import './ui/style.css';
class Client {
    crouch = false;
    yaw = 0;
    pitch = 0;
    seq = 0;
    localId = '';
    isHost = false;
    closing = false;
    socket?: WebSocket;
    world?: ReserveBlueprint;
    worldReady = false;
    installEpoch = 0;
    installingId = '';
    queuedSnapshot?: Snapshot;
    latest?: Snapshot;
    prior?: Snapshot;
    latestAt = 0;
    predicted?: Player;
    predTick = 0;
    rtt = 70;
    stepDistance = 0;
    viewfinder = false;
    view!: Awaited<ReturnType<typeof createView>>;
    renderer!: THREE.WebGPURenderer;
    scene!: THREE.Scene;
    camera!: THREE.PerspectiveCamera;
    noticeTimer?: NodeJS.Timeout;
    photoTimer?: NodeJS.Timeout;
    lastImageUrl = '';
    photoChain = Promise.resolve();
    retryTimer?: NodeJS.Timeout;
    reconnectAttempt = 0;
    adapterInfo: unknown;
}
const client = new Client();

declare global {
    interface Window {
        readonly wildly: {
            snapshot: Snapshot | undefined;
            world: ReserveBlueprint | undefined;
            playerId: string;
            backend: string;
            adapter: unknown;
            assetErrors: string[];
            camera: number[];
            rtt: number;
            p95: number;
            render: {
                drawCalls: number;
                triangles: number;
                geometries: number;
                textures: number;
                estimatedBytes: number;
            } | undefined;
        };
    }
}

/**
 * Look up a required page element using the caller's expected element type. The page markup
 * must supply this ID.
 *
 * @template T - Expected DOM element subtype; the markup must satisfy this assertion.
 * @param id - Required element ID
 * @returns The existing DOM element; no runtime null or type check is performed.
 */
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector(`#${id}`) as T;
const pressed = new Set<string>();

/**
 * Resolve a commission's display title from the installed world.
 *
 * @param id - Commission ID
 * @returns Commission title, or the supplied ID if no match exists.
 */
const commissionTitle = (id: string) => client.world?.commissions.find((c) => c.id === id)?.title ?? id;
const history = new Map<number, Input>(),
    sent = new Map<number, number>();
const pendingFrames = new Map<
        string,
        { frame: PhotoFrame; verdict: PhotoVerdict }
    >(),
    frameTimes: number[] = [];
const assetErrors: string[] = [];
const heard = new Set<string>();

Object.defineProperty(globalThis, 'wildly', {

    /**
     * Expose read-only diagnostic values for the acceptance driver, copying mutable
     * snapshot/error data and reporting renderer/frame metrics.
     *
     * @returns Diagnostic state; the world reference is the installed frozen blueprint.
     */
    get: () => ({
        snapshot: client.latest ? structuredClone(client.latest) : undefined,
        world: client.world ?? undefined,
        playerId: client.localId,
        backend: 'WebGPU',
        adapter: client.adapterInfo,
        assetErrors: [...assetErrors],
        camera: client.camera?.position.toArray(),
        rtt: client.rtt,
        render: client.renderer
            ? {
                    drawCalls: client.renderer.info.render.drawCalls,
                    triangles: client.renderer.info.render.triangles,
                    geometries: client.renderer.info.memory.geometries,
                    textures: client.renderer.info.memory.textures,
                    estimatedBytes: client.renderer.info.memory.total,
                }
            : undefined,
        p95:
      frameTimes.toSorted((a, b) => a - b)[
          Math.floor(frameTimes.length * 0.95)
      ] ?? 0,
    }),
});

/**
 * Replace the transient notice text and restart its 6.5-second dismissal timer.
 *
 * @param message - User-facing message
 */
function notify(message: string) {
    $('notice').textContent = message;
    clearTimeout(client.noticeTimer);
    client.noticeTimer = globalThis.setTimeout(() => ($('notice').textContent = ''), 6500);
}

/**
 * Allocate a sequence number and send a simple gameplay command for the installed world.
 *
 * @param type - Command kind without input, ping, or favorite-specific fields
 */
function command(
    type: Exclude<ClientMessage['type'], 'input' | 'ping' | 'favorite'>,
) {
    send({ type, seq: ++client.seq });
}
type WithoutWorld<T> = T extends { worldId: string }
    ? Omit<T, 'worldId'>
    : never;

/**
 * Attach the installed world ID and send only while the world and socket are ready. Tracks
 * recent input timestamps for RTT estimation.
 *
 * @param message - Client message without its world ID
 */
function send(message: WithoutWorld<ClientMessage>) {
    if (!client.worldReady || !client.world || client.socket?.readyState !== WebSocket.OPEN) return;
    client.socket.send(JSON.stringify({ ...message, worldId: client.world.id }));
    if (message.type === 'input') {
        sent.set(message.value.seq, performance.now());
        if (sent.size > 100) sent.delete(sent.keys().next().value!);
    }
}

/**
 * Read current key state and view angles into the wire input shape without incrementing the
 * sequence.
 *
 * @returns Fresh input object using the current sequence.
 */
function input(): Input {
    return {
        seq: client.seq,
        x:
      (pressed.has(settings.keys.right) ? 1 : 0)
      - (pressed.has(settings.keys.left) ? 1 : 0),
        z:
      (pressed.has(settings.keys.back) ? 1 : 0)
      - (pressed.has(settings.keys.forward) ? 1 : 0),
        yaw: client.yaw,
        pitch: client.pitch,
        run: pressed.has(settings.keys.run),
        crouch: client.crouch,
    };
}

/**
 * Clear pressed movement keys and, when connected, send an updated input sequence so the
 * server stops stale movement.
 */
function neutralize() {
    pressed.clear();
    if (client.socket?.readyState === WebSocket.OPEN)
        send({ type: 'input', value: { ...input(), seq: ++client.seq } });
}

/**
 * Apply one 1/60-second movement step using the installed world's geometry and snapshot
 * equipment limits.
 *
 * @param p - Starting predicted player
 * @param held - Held input for this tick
 * @param state - Snapshot supplying route and prop state
 * @returns New predicted player state.
 */
function predictStep(p: Player, held: Input, state: Snapshot): Player {
    return movePlayer(
        p,
        held,
        1 / 60,
        [
            ...client.world!.walls,
            ...fixtureBoxes(client.world!.fixtures, state.route),
            ...state.props
                .filter((property) => !property.holders.includes(p.id) && !property.placed)
                .flatMap((property) => propertyBoxes(property, PROP_DEFINITIONS[property.kind])),
        ],
        [...client.world!.walkables, ...fixtureSurfaces(client.world!.fixtures, state.route)],
        playerSpeed(p.id, held, state.props),
    );
}

/**
 * Clear movement, release pointer lock, and open a page dialog. Refreshes notebook or
 * host-reassignment content when applicable.
 *
 * @param id - Dialog element ID
 */
function showDialog(id: string) {
    neutralize();
    document.exitPointerLock();
    const d = $<HTMLDialogElement>(id);

    if (!d.open) d.showModal();
    if (id === 'notebook') {
        renderNotebook(client.latest, client.localId, commissionTitle, toggleFavorite);
        drawMap(client.latest, client.world, CREW_COLORS);
    } else if (id === 'settings')
        void renderReassign(() => ({ isHost: client.isHost, latest: client.latest }), notify);
}

/**
 * Toggle viewfinder mode and update camera controls and reticle visibility.
 */
function toggleCamera() {
    client.viewfinder = !client.viewfinder;
    document.body.classList.toggle('camera-view', client.viewfinder);
    $('viewfinder').hidden = !client.viewfinder;
    $('reticle').hidden = client.viewfinder;
    $('camera-button').textContent = client.viewfinder ? 'Lower camera' : 'Viewfinder';
}

/**
 * Send current view input before requesting an authoritative shutter frame. Does nothing
 * before admission.
 */
function takePhoto() {
    if (!client.localId) return;
    send({ type: 'input', value: { ...input(), seq: ++client.seq } });
    command('photo');
}

/**
 * Request pointer lock on the renderer canvas after admission.
 */
function lookAround() {
    if (!client.localId) return;
    void client.renderer.domElement.requestPointerLock();
}

/**
 * Install the admitted identity and host controls. Pending sessions poll for slot
 * assignment; active sessions reveal the HUD and connect the socket.
 *
 * @param session - Public admission identity returned by the server
 * @param session.playerId - Stable admitted player identifier
 * @param session.host - Whether the player owns the host role
 * @param session.pending - Whether host slot reassignment is still required
 */
async function acceptSession(session: {
    playerId: string;
    host: boolean;
    pending?: boolean;
}) {
    sessionStorage.removeItem('wu-left');
    client.localId = session.playerId;
    client.isHost = session.host;
    if (session.pending) {
        $('join-status').textContent
            = 'Waiting for the host to assign your returning field slot…';
        client.retryTimer = globalThis.setTimeout(
            () => void api('/api/session')
                .then(acceptSession)
                .catch(() => {
                    $('join-status').textContent
                        = 'Waiting for the server to restore your field slot…';
                    scheduleReconnect();
                }),
            1500,
        );

        return;
    }
    $('join').hidden = true;
    $('hud').hidden = false;
    $('invite-button').hidden = !client.isHost;
    $('stop-button').hidden = !client.isHost;
    openSocket();
}

/**
 * Validate the blueprint identity/hash and asynchronously replace the scene. Epoch checks
 * discard obsolete loads; failures dispose the candidate view and notify the player.
 *
 * @param message - Server world message containing blueprint, ID, and digest
 */
async function installWorld(
    message: Extract<ServerMessage, { type: 'world' }>,
) {
    const epoch = ++client.installEpoch;

    client.installingId = message.id;
    client.worldReady = false;
    client.latest = undefined;
    client.prior = undefined;
    client.predicted = undefined;
    history.clear();
    sent.clear();
    heard.clear();
    pressed.clear();
    client.queuedSnapshot = undefined;
    for (const [id, pending] of pendingFrames)
        if (pending.frame.worldId !== message.id) pendingFrames.delete(id);
    $('connection').textContent = 'Loading reserve...';
    let nextView: Awaited<ReturnType<typeof createView>> | undefined;

    try {
        const blueprint = validateReserve(message.blueprint);

        if (
            message.id !== blueprint.id
            || (await reserveHash(blueprint)) !== message.hash
        )
            throw new Error('Reserve digest or identity mismatch');
        if (epoch !== client.installEpoch) return;
        const nextScene = new THREE.Scene();

        nextView = await createView(nextScene, blueprint);
        if (epoch !== client.installEpoch) {
            nextView.dispose();

            return;
        }
        if (nextView.errors.length > 0) throw new Error(nextView.errors.join('; '));
        client.view?.dispose();
        client.view = nextView;
        client.scene = nextScene;
        client.world = blueprint;
        client.worldReady = true;
        client.reconnectAttempt = 0;
        client.camera.position.set(
            blueprint.camp[0],
            blueprint.camp[1] + 1.6,
            blueprint.camp[2],
        );
        document.body.dataset.world = blueprint.id;
        const pending = client.queuedSnapshot;

        client.queuedSnapshot = undefined;
        if (pending) receive(pending);
        for (const { frame, verdict } of pendingFrames.values())
            if (frame.worldId === blueprint.id) queuePhoto(frame, verdict);
    } catch (error) {
        nextView?.dispose();
        if (epoch !== client.installEpoch) return;
        client.worldReady = false;
        assetErrors.push(String(error));
        notify(
            `Reserve could not be loaded. Refreshing connection: ${String(error)}`,
        );
        client.socket?.close();
    }
}

/**
 * Connect to the same-origin game socket and install handlers for identity, worlds,
 * snapshots, cues, and photo frames. Stale socket callbacks cannot replace newer connection
 * state.
 */
function openSocket() {
    if (client.closing) return;
    clearTimeout(client.retryTimer);
    client.socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`,
    );

    /**
  Show transport connection before the server supplies crew and world state.
     */
    client.socket.addEventListener('open', () => {
        $('connection').textContent = 'Connected · finding crew';
    });
    const connection = client.socket;

    /**
     * Dispatch a server message only while this socket remains the active connection.
     * Parsing failures become user notices rather than escaping the event handler.
     *
     * @param event - WebSocket message carrying server JSON
     */
    client.socket.addEventListener('message', (event) => {
        if (client.socket !== connection) return;
        try {
            const m = JSON.parse(event.data) as ServerMessage;

            switch (m.type) {
                case 'welcome': {
                    client.localId = m.playerId;
                    client.isHost = m.host;

                    break;
                }
                case 'world': {
                    void installWorld(m);
                    break;
                }
                case 'notice': {
                    notify(m.text);
                    break;
                }
            }
            if (
                m.type === 'cue'
                && client.worldReady
                && m.worldId === client.world?.id
                && !heard.has(m.id)
            ) {
                heard.add(m.id);
                if (heard.size > 128) heard.delete(heard.values().next().value!);
                const d = client.predicted ? distance(eye(client.predicted), m.position) : 0;

                playSound(m.kind, settings.volume * Math.max(0.05, 1 - d / 24));
                const who
                    = client.latest?.players.find((p) => p.id === m.source)?.name
                        ?? (m.kind === 'impact' ? 'Field equipment' : 'Wildlife');

                if (m.kind !== 'shutter')
                    notify(`${who} · ${m.kind === 'impact' ? 'clatter' : m.kind}`);
            }
            if (m.type === 'photo' && m.frame.worldId === client.installingId) {
                pendingFrames.set(m.frame.id, { frame: m.frame, verdict: m.verdict });
                if (client.worldReady) queuePhoto(m.frame, m.verdict);
            }
            if (m.type === 'snapshot') receive(m.value);
        } catch (error) {
            notify(`Connection data could not be read: ${String(error)}`);
        }
    });

    /**
  Invalidate world loads and prediction after disconnection, then schedule restoration.
     */
    client.socket.addEventListener('close', () => {
        if (client.socket !== connection) return;
        ++client.installEpoch;
        client.worldReady = false;
        client.predicted = undefined;
        client.latest = undefined;
        client.prior = undefined;
        neutralize();
        history.clear();
        $('connection').textContent = client.closing ? 'Server stopped' : 'Reconnecting…';
        if (!client.closing) {
            notify('Connection interrupted. The crew can pause while you return.');
            scheduleReconnect();
        }
    });

    /**
  Show a transport error; the close handler owns reconnection scheduling.
     */
    client.socket.addEventListener('error', () => {
        $('connection').textContent = 'Connection unavailable';
    });
}

/**
 * Schedule session restoration with bounded exponential backoff. Authorization failures
 * return to admission; transient failures retry.
 */
function scheduleReconnect() {
    if (client.closing) return;
    clearTimeout(client.retryTimer);
    client.retryTimer = globalThis.setTimeout(
        () => void api('/api/session')
            .then(acceptSession)
            .catch((error) => {
                if ([401, 403].includes(error.status)) {
                    client.localId = '';
                    $('join').hidden = false;
                    $('hud').hidden = true;
                    $('join-status').textContent
                        = 'Reconnect with your invitation or host key.';
                } else {
                    $('connection').textContent = 'Waiting for the server…';
                    scheduleReconnect();
                }
            }),
        Math.min(10_000, 1000 * 2 ** Math.min(4, client.reconnectAttempt++)),
    );
}

/**
 * Accept snapshots for the installing world, queue them during loading, and reconcile
 * prediction against authoritative sequences. Updates feedback, RTT, HUD, and exhibition
 * dialog state.
 *
 * @param state - Incoming authoritative snapshot
 */
function receive(state: Snapshot) {
    if (state.version !== 3 || state.worldId !== client.installingId) {
        client.worldReady = false;
        client.predicted = undefined;
        client.socket?.close();

        return;
    }
    if (!client.worldReady || state.worldId !== client.world?.id) {
        client.queuedSnapshot = state;

        return;
    }
    if (client.latest && state.observations.length > client.latest.observations.length)
        notify(state.observations.at(-1)!);
    client.prior = client.latest;
    client.latest = state;
    client.latestAt = performance.now();
    const p = state.players.find((p) => p.id === client.localId);

    if (p) {
        const before = client.prior?.players.find((p) => p.id === client.localId);
        const moved = before ? distance(before.position, p.position) : 0;

        if (state.paused || moved > 2) client.stepDistance = 0;
        else client.stepDistance += moved;
        if (client.stepDistance >= (p.lastInput?.run ? 1.35 : 0.9)) {
            playSound(
                'footstep',
                settings.volume * (p.lastInput?.crouch ? 0.15 : 0.4),
            );
            client.stepDistance = 0;
        }
        client.seq = Math.max(client.seq, p.lastSeq);
        const stamp = sent.get(p.lastSeq);

        if (stamp !== undefined)
            client.rtt = 0.8 * client.rtt + 0.2 * (performance.now() - stamp);
        for (const k of sent.keys()) if (k <= p.lastSeq) sent.delete(k);
        const end = client.predTick;

        client.predicted = structuredClone(p);
        client.predTick = state.tick;
        if (state.paused || end - state.tick > 120 || end < state.tick) {
            history.clear();
        } else {
            for (const k of history.keys()) if (k <= state.tick) history.delete(k);
            while (client.predTick < end) {
                const held
                    = history.get(client.predTick + 1)
                        ?? (client.predTick - p.inputTick < 15 ? p.lastInput : undefined);

                if (held) client.predicted = predictStep(client.predicted, held, state);
                client.predTick++;
            }
        }
        if (!client.prior) {
            client.yaw = p.yaw;
            client.pitch = p.pitch;
        }
    }
    updateHud();
    if (state.phase === 'exhibition' && client.prior?.phase !== 'exhibition')
        showDialog('notebook');
}

/**
 * Render HUD state and refresh notebook/map content only while the notebook is open.
 */
function updateHud() {
    renderHud(client.latest, client.world, client.localId, client.isHost, client.rtt, settings);
    if ($<HTMLDialogElement>('notebook').open) {
        renderNotebook(client.latest, client.localId, commissionTitle, toggleFavorite);
        drawMap(client.latest, client.world, CREW_COLORS);
    }
}

/**
 * Request the inverse of the local player's current favorite selection for an existing
 * album record.
 *
 * @param photoId - Photo ID in the current album
 */
function toggleFavorite(photoId: string) {
    const current = client.latest?.album.find((p) => p.id === photoId);

    if (current)
        send({
            type: 'favorite',
            seq: ++client.seq,
            photoId,
            selected: !current.favorites.includes(client.localId),
        });
}

/**
 * Serialize frozen-frame capture and upload, restoring live rendering after each capture.
 * Drops obsolete world completions and retains pending frames on failure for retry.
 *
 * @param frame - Frozen server-authorized shutter frame
 * @param verdict - Server scoring result shown beside the preview
 */
function queuePhoto(frame: PhotoFrame, verdict: PhotoVerdict) {
    client.photoChain = (async () => {
        try {
            await client.photoChain;
            if (!client.latest || !client.worldReady || !client.world || frame.worldId !== client.world.id)
                return;
            const captureEpoch = client.installEpoch;
            const start = performance.now();
            const blob = await capturePhoto(
                client.renderer,
                client.scene,
                frame,
                client.world,
                () => {
                    client.view.centerShadows(frame.camera.position);
                    client.view.update(
                        {
                            ...client.latest!,
                            tick: frame.tick,
                            players: frame.players,
                            animals: frame.animals,
                            tin: frame.tin,
                            worldId: frame.worldId,
                            props: frame.props,
                            route: frame.route,
                            spills: frame.spills,
                            hats: frame.hats,
                        },
                        frame.photographer,
                        true,
                    );
                },
                () => {
                    if (!(client.latest && client.worldReady)) {
                        return;
                    }

                    client.view.update(client.latest, client.localId);
                    client.view.centerShadows(client.camera.position.toArray() as Vec3);
                },
            );

            if (captureEpoch !== client.installEpoch || frame.worldId !== client.world?.id) return;
            if (client.lastImageUrl) URL.revokeObjectURL(client.lastImageUrl);
            client.lastImageUrl = URL.createObjectURL(blob);
            $<HTMLImageElement>('photo-preview').src = client.lastImageUrl;
            $('photo-result').textContent = verdict.credits.length > 0
                ? verdict.credits.map((c) => commissionTitle(c)).join(' · ')
                : verdict.reason;
            $('photo-toast').hidden = false;
            clearTimeout(client.photoTimer);
            client.photoTimer = globalThis.setTimeout(
                () => ($('photo-toast').hidden = true),
                8000,
            );
            const response = await fetch(
                `/api/photos/${encodeURIComponent(frame.id)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'image/jpeg' },
                    body: blob,
                },
            );

            if (!response.ok)
                throw new Error(
                    `Image upload failed (${response.status}). Credit is safe; retry in notebook.`,
                );
            pendingFrames.delete(frame.id);
            $('photo-toast').dataset.latency = String(
                Math.round(performance.now() - start),
            );
        } catch (error) {
            notify(String(error));
        }
    })();
}

/**
 * Initialize WebGPU and the render/prediction loop, consume invite fragments, and try
 * restoring a session. Rendering owns the resize listener for the page lifetime.
 *
 * @throws {Error} Graphics initialization fails; the startup caller displays the failure.
 */
async function start() {
    const graphics = await initializeGraphics(notify, neutralize);

    client.renderer = graphics.renderer;
    client.scene = graphics.scene;
    client.camera = graphics.camera;
    client.adapterInfo = graphics.adapterInfo;
    const { resize } = graphics;
    let last = performance.now();

    client.renderer.setAnimationLoop(() => {
        const now = performance.now(),
            dt = Math.min(0.1, (now - last) / 1000);

        frameTimes.push(now - last);
        if (frameTimes.length > 1200) frameTimes.shift();
        last = now;
        if (document.pointerLockElement || !$<HTMLDialogElement>('settings').open) {
            if (pressed.has('ArrowLeft')) client.yaw += dt * 1.6;
            if (pressed.has('ArrowRight')) client.yaw -= dt * 1.6;
            if (pressed.has('ArrowUp')) client.pitch = Math.min(1.45, client.pitch + dt);
            if (pressed.has('ArrowDown')) client.pitch = Math.max(-1.45, client.pitch - dt);
        }
        client.yaw = Math.atan2(Math.sin(client.yaw), Math.cos(client.yaw));
        if (client.latest && client.worldReady && client.view?.worldId === client.latest.worldId) {
            if (client.predicted && !client.latest.paused && client.latest.phase !== 'exhibition') {
                const target
                    = client.latest.tick
                        + Math.floor((now - client.latestAt + Math.min(150, client.rtt / 2)) / (1000 / 60));
                let count = 0;

                while (client.predTick < target && count++ < 15) {
                    const held = input();

                    client.predicted = predictStep(client.predicted, held, client.latest);
                    history.set(++client.predTick, held);
                }
                for (const k of history.keys())
                    if (k < client.predTick - 120) history.delete(k);
            }
            const renderState = interpolateSnapshot(
                client.latest,
                client.prior,
                Math.min(1, (now - client.latestAt) / 100),
            );

            if (client.predicted) alignLocalCarry(renderState, client.localId, client.predicted.position);
            client.view.update(renderState, client.localId);
            if (client.predicted) {
                client.camera.position.set(...eye({ ...client.predicted, lastInput: input() }));
                client.camera.rotation.set(client.pitch, client.yaw, 0, 'YXZ');
            }
        }
        if (client.worldReady) client.view.centerShadows(client.camera.position.toArray() as Vec3);
        client.renderer.render(client.scene, client.camera);
    });
    window.addEventListener('resize', resize);
    const fragment = new URLSearchParams(location.hash.slice(1));

    if (fragment.has('key')) {
        $<HTMLInputElement>('secret').value = fragment.get('key')!;
        historyReplace();
    }
    if (sessionStorage.getItem('wu-left') !== '1')
        try {
            await acceptSession(await api('/api/session'));
        } catch {
            /*
            A fresh visitor enters an invitation normally.
            */
        }
}

/**
 * Remove the invite fragment from the current history entry while preserving the path and
 * query.
 */
function historyReplace() {
    globalThis.history.replaceState(undefined, '', location.pathname + location.search);
}
installJoinForm(acceptSession);
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-close]'))

/**
 * Close the dialog identified by this button's data-close attribute.
 *
 * @returns No value after requesting dialog closure.
 */
    b.addEventListener('click', () => $<HTMLDialogElement>(b.dataset.close!).close());

/**
 * Open and refresh the notebook from the toolbar.
 *
 * @returns No value after opening the dialog.
 */
$('notebook-button').addEventListener('click', () => showDialog('notebook'));

/**
 * Open settings and refresh host admission controls from the toolbar.
 *
 * @returns No value after opening the dialog.
 */
$('settings-button').addEventListener('click', () => showDialog('settings'));
$('enter-controls').addEventListener('click', lookAround);

/**
Enter pointer-look controls when an admitted player clicks the unlocked viewport.
 */
$('viewport').addEventListener('click', () => {
    if (client.localId && !document.pointerLockElement) lookAround();
});
$('camera-button').addEventListener('click', toggleCamera);
$('shutter-button').addEventListener('click', takePhoto);
for (const [id, type] of [
    ['start-button', 'start'],
    ['pause-button', 'pause'],
    ['resume-button', 'resume'],
    ['ready-button', 'ready-end'],
    ['finish-button', 'finish'],
    ['recover-button', 'recover'],
] as const)

/**
 * Send the gameplay command associated with this toolbar button.
 *
 * @returns No value after attempting command dispatch.
 */
    $(id).addEventListener('click', () => command(type));

/**
Request the host's save-and-stop action and show immediate progress feedback.
 */
$('stop-button').addEventListener('click', () => {
    command('save-and-stop');
    notify('Saving the outing and stopping the server…');
});

/**
Record an intentional departure, stop reconnect attempts, and reload into admission.
 */
$('leave-button').addEventListener('click', () => {
    client.closing = true;
    sessionStorage.setItem('wu-left', '1');
    clearTimeout(client.retryTimer);
    neutralize();
    client.socket?.close();
    location.reload();
});

/**
 * Copy the host's private invitation link, reporting request or clipboard failures.
 *
 * @returns No value; request and clipboard failures are displayed asynchronously.
 */
$('invite-button').addEventListener('click', () => void api('/api/invite')
    .then(async (info) => {
        await navigator.clipboard.writeText(
            `${location.origin}/#key=${encodeURIComponent(info.secret)}`,
        );
        notify('Private invitation copied. Share it with your crew.');
    })
    .catch((error) => notify(String(error))));

/**
Retry locally retained photo frames or explain how to recover saved pending captures.
 */
$('retry-photos').addEventListener('click', () => {
    for (const p of pendingFrames.values()) queuePhoto(p.frame, p.verdict);
    if (pendingFrames.size === 0)
        notify(
            'No local pending frames. Rejoining also restores saved pending photos.',
        );
});
setupSettings();
globalThis.addEventListener('keydown', (event) => {
    if (
        !client.localId
        || event.target instanceof HTMLInputElement
        || document.querySelector('dialog[open]')
    )
        return;
    if (
        Object.values(settings.keys).includes(event.code)
        || event.code.startsWith('Arrow')
    )
        event.preventDefault();
    pressed.add(event.code);
    if (event.repeat) return;
    if (event.code === settings.keys.crouch) client.crouch = !client.crouch;
    if (event.code === settings.keys.interact) command('interact');
    if (event.code === settings.keys.drop) command('drop');
    if (event.code === settings.keys.use) command('use');
    if (event.code === settings.keys.notebook) showDialog('notebook');
    if (event.code === settings.keys.ping && client.predicted) {
        const p = eye(client.predicted),
            f = forward(client.yaw, client.pitch);
        const t = f[1] < -0.05 ? Math.min(30, -p[1] / f[1]) : 12;

        send({
            type: 'ping',
            seq: ++client.seq,
            point: [p[0] + f[0] * t, 0, p[2] + f[2] * t],
        });
    }
    if (event.code === 'Escape') showDialog('settings');
});
globalThis.addEventListener('keyup', (event) => pressed.delete(event.code));
window.addEventListener('blur', neutralize);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) neutralize();
});
globalThis.addEventListener('mousemove', (event) => {
    if (!document.pointerLockElement) {
        return;
    }

    client.yaw -= event.movementX * 0.002 * settings.sensitivity;
    client.pitch = Math.max(
        -1.45,
        Math.min(
            1.45,
            client.pitch
            - event.movementY
            * 0.002
            * settings.sensitivity
            * (settings.invert ? -1 : 1),
        ),
    );
    client.yaw = Math.atan2(Math.sin(client.yaw), Math.cos(client.yaw));
});
globalThis.addEventListener('mousedown', (event) => {
    if (!document.pointerLockElement) {
        return;
    }

    if (event.button === 0) takePhoto();
    else if (event.button === 2) toggleCamera();
});
globalThis.addEventListener('contextmenu', (event) => {
    if (client.localId) event.preventDefault();
});
document.addEventListener('pointerlockchange', () => {
    $('enter-controls').hidden = !!document.pointerLockElement;
    if (!document.pointerLockElement) neutralize();
});
setInterval(() => {
    if (client.localId && client.socket?.readyState === WebSocket.OPEN)
        send({ type: 'input', value: { ...input(), seq: ++client.seq } });
}, 50);
void start().catch((error) => {
    $('join-status').textContent = String(error);
    console.error(error);
});
