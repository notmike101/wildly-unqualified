/**
Validate complete saved runs, frozen photos, and JPEG payloads before restoration.
 */
import type { RunState } from '../simulation/game.ts';
import { distance } from '../../shared/shared.ts';
import {
    validateReserve,
    type ReserveBlueprint,
} from '../../shared/world/world.ts';
import {
    obj as object,
    text,
    id,
    num as number_,
    integer,
    bool,
    one,
    list,
    position,
    player,
    tin,
    residentInventory,
    carrier,
    stateBounds,
    props as properties,
    route,
    plankRoute,
    spills,
    hats,
    incidents,
} from './save-values.ts';

/**
 * Validate a frozen pending frame's camera, crew slots, residents, equipment, and incidents
 * against the saved crew and world. Album metadata is validated separately by validateRun.
 *
 * @param value - Untrusted frozen photo frame
 * @param crew - Saved crew IDs mapped to their stable slot numbers
 * @param world - Validated reserve blueprint
 * @throws {Error} Frame fields, geometry, or crew/world references are invalid.
 */
function photo(
    value: unknown,
    crew: Map<string, number>,
    world: ReserveBlueprint,
) {
    const v = object(value, [
        'id',
        'tick',
        'photographer',
        'camera',
        'players',
        'animals',
        'tin',
        'worldId',
        'props',
        'route',
        'spills',
        'hats',
    ]);

    id(v.id);
    integer(v.tick);
    id(v.photographer);
    const c = object(v.camera, ['position', 'yaw', 'pitch', 'fov']);

    position(c.position);
    number_(c.yaw, -Math.PI * 4, Math.PI * 4);
    number_(c.pitch, -1.45, 1.45);
    number_(c.fov, 1, 179);
    list(v.players, 4, player);
    residentInventory(v.animals, world);
    tin(v.tin);
    const ids = new Set<string>(v.players.map((p) => p.id));

    if (
        ids.size !== v.players.length
        || new Set(v.players.map((p) => p.slot)).size !== v.players.length
        || v.players.some((p) => crew.get(p.id) !== p.slot)
    )
        throw new Error('Invalid saved frame crew identity or slot');
    carrier(v.tin.holder, ids, world);
    if (!ids.has(v.photographer)) throw new Error('Missing saved frame photographer');
    if (v.worldId !== world.id || !v.id.startsWith(world.id + '-photo-'))
        throw new Error('Saved frame world mismatch');
    properties(v.props, ids, world);
    route(v.route, world);
    plankRoute(v.props, v.route, world);
    spills(v.spills);
    hats(v.hats, ids, world);
    const entities = {
        tick: v.tick, players: v.players, animals: v.animals, tin: v.tin,
        props: v.props, route: v.route, spills: v.spills, hats: v.hats,
    };

    incidents(entities, world);
    stateBounds(entities, world);
}

/**
 * Check the 64 KiB JPEG limit, supported frame dimensions, segment structure, a scan header,
 * and the final end marker. Does not decode pixels or validate the entropy-coded scan.
 *
 * @param bytes - Encoded JPEG bytes
 * @returns Whether the bytes satisfy the stored-photo JPEG contract.
 */
export function validJPEG(bytes: Uint8Array) {
    if (
        bytes.length < 8
        || bytes.length > 65_536
        || bytes[0] !== 255
        || bytes[1] !== 216
        || bytes.at(-2) !== 255
        || bytes.at(-1) !== 217
    )
        return false;

    /**
     * Read a big-endian unsigned 16-bit word from the JPEG buffer.
     *
     * @param offset - Byte offset, the caller must have checked the buffer bounds
     * @returns Decoded segment word.
     */
    const word = (offset: number) => bytes[offset] * 256 + bytes[offset + 1];
    let offset = 2,
        isFrame = false;

    while (offset < bytes.length - 2) {
        if (bytes[offset++] !== 255) return false;
        while (bytes[offset] === 255) offset++;
        const marker = bytes[offset++],
            length = word(offset);

        if (
            !Number.isFinite(length)
            || length < 2
            || offset + length > bytes.length - 2
        )
            return false;
        if (marker === 218)
            return isFrame && length >= 6 && offset + length < bytes.length - 2;
        if ([192, 193, 194].includes(marker)) {
            const height = word(offset + 3),
                width = word(offset + 5),
                components = bytes[offset + 7];

            if (
                isFrame
                || bytes[offset + 2] !== 8
                || ![1, 3].includes(components)
                || length !== 8 + 3 * components
                || width < 1
                || width > 640
                || height < 1
                || height > 360
            )
                return false;
            isFrame = true;
        }
        offset += length;
    }

    return false;
}

/**
 * Validate the complete versioned run and cross-check blueprint, entities, incidents,
 * album, pending frames, and image ownership. Blueprint validation freezes its graph.
 *
 * @param value - Untrusted saved run
 * @param images - Decoded JPEG buffers indexed by photo ID
 * @returns The validated run object, retaining its input identity.
 * @throws {Error} Any run field, reference, image, or cross-entity invariant is invalid.
 */
function validateRun(
    value: unknown,
    images: Map<string, Uint8Array>,
): RunState {
    const v = object(value, [
        'version',
        'tick',
        'seconds',
        'phase',
        'paused',
        'pauseReason',
        'players',
        'animals',
        'tin',
        'world',
        'worldId',
        'props',
        'route',
        'spills',
        'hats',
        'spareBait',
        'baitPatches',
        'observations',
        'completed',
        'album',
        'ready',
        'pings',
        'pendingPhotos',
        'hostId',
        'events',
        'cooldowns',
        'animalMemory',
        'decisionSeconds',
        'nextPhoto',
        'tinRevision',
        'lastImpactTick',
        'failedSetups',
    ]);

    if (v.version !== 3)
        throw new Error('Unsupported run version; expected version 3');
    const world = validateReserve(v.world),
        assignments = world.commissions.map((c) => c.id);

    v.world = world;
    if (v.worldId !== world.id) throw new Error('Saved run world mismatch');
    integer(v.tick);
    number_(v.seconds, 0);
    one(v.phase, ['camp', 'outing', 'exhibition']);
    bool(v.paused);
    text(v.pauseReason, 256);
    list(v.players, 4, player);
    const ids = new Set<string>(v.players.map((p) => p.id));

    if (ids.size !== v.players.length) throw new Error('Duplicate saved players');
    if (new Set(v.players.map((p) => p.slot)).size !== v.players.length)
        throw new Error('Duplicate saved crew slots');
    residentInventory(v.animals, world);
    tin(v.tin);

    properties(v.props, ids, world);
    route(v.route, world);
    plankRoute(v.props, v.route, world);
    spills(v.spills);
    hats(v.hats, ids, world);
    const entities = {
        tick: v.tick, players: v.players, animals: v.animals, tin: v.tin,
        props: v.props, route: v.route, spills: v.spills, hats: v.hats,
    };

    incidents(entities, world);
    stateBounds(entities, world);
    integer(v.spareBait, 0, 8);
    const patches = object(
        v.baitPatches,
        world.pockets.flatMap((p) => p.anchors.filter((a) => a.kind === 'feed').map((a) => a.id),
        ),
    );

    for (const portions of Object.values(patches)) integer(portions, 0, 4);
    list(v.observations, 128, (x) => text(x, 256));
    list(v.completed, 8, (x): asserts x is string => one(x, assignments));
    const completed = v.completed;

    if (new Set(v.completed).size !== v.completed.length)
        throw new Error('Duplicate completed assignments');
    if (v.completed.some((id: string) => !assignments.includes(id)))
        throw new Error('Completed assignment was not selected');
    if (
        v.phase === 'exhibition'
        && world.commissions
            .filter((c) => c.required)
            .some((c) => !completed.includes(c.id))
    )
        throw new Error('Exhibition requires every selected assignment');
    list(v.ready, 4, id);
    if (v.ready.some((playerId: string) => !ids.has(playerId)))
        throw new Error('Missing saved ready player');
    carrier(v.tin.holder, ids, world);
    if (v.hostId !== null) {
        id(v.hostId);
        if (!ids.has(v.hostId)) throw new Error('Missing saved host');
    }
    list(v.pings, 32, (x) => {
        const p = object(x, ['player', 'point', 'until']);

        id(p.player);
        if (!ids.has(p.player)) throw new Error('Missing saved ping player');
        position(p.point);
        number_(p.until);
    });
    list(v.events, 128, (x) => {
        const event = object(x, ['kind', 'player', 'point', 'tick']);

        one(event.kind, [
            'rattle',
            'whistle',
            'noise',
            'impact',
            'bait',
            'recover',
            'place',
        ]);
        id(event.player);
        if (event.player !== 'tin' && !ids.has(event.player))
            throw new Error('Missing saved event player');
        position(event.point);
        integer(event.tick);
    });
    const cooldowns = object(v.cooldowns);

    if (Object.keys(cooldowns).length > 4) throw new Error('Too many cooldowns');
    for (const [key, c] of Object.entries(cooldowns)) {
        id(key);
        if (!ids.has(key)) throw new Error('Missing saved cooldown player');
        const cooldown = object(c, ['use', 'photo']);

        number_(cooldown.use);
        number_(cooldown.photo);
    }
    const memories = object(
        v.animalMemory,
        v.animals.map((a) => a.id),
    );

    for (const [name, rawMemory] of Object.entries(memories)) {
        const memory = object(rawMemory, [
            'goal',
            'recentGoals',
            'interestPoint',
            'interestUntilTick',
            'habituatedUntilTick',
            'hatTarget',
        ]);

        text(memory.goal, 80);
        list(memory.recentGoals, 4, (x) => text(x, 80));
        if (memory.interestPoint !== null) position(memory.interestPoint);
        integer(memory.interestUntilTick, 0, v.tick + 1800);
        integer(memory.habituatedUntilTick, 0, v.tick + 1800);
        if (memory.hatTarget !== null) id(memory.hatTarget);

        // The exact memory keys above match the validated resident inventory.

        const resident = entities.animals.find((a) => a.id === name)!;
        const isReaching = resident.behavior === 'hat-reach';

        if (
            isReaching !== (memory.hatTarget !== null)
            || (memory.hatTarget !== null
                && (world.residents.find((r) => r.id === name)?.species !== 'raccoon'
                    || !ids.has(memory.hatTarget)))
        )
            throw new Error('Invalid saved hat target');
        if (
            isReaching
            && v.players.every(
                (p) => !(p.id === memory.hatTarget
                    && p.connected
                    && distance(
                        p.position,
                        resident.target,
                    ) < 0.8
                    && entities.hats.some(
                        (h) => h.owner === p.id
                            && h.carrier === 'owner'
                            && h.protectedUntilTick <= entities.tick,
                    )),
            )
        )
            throw new Error('Saved hat reach owner disagrees with target');
    }
    number_(v.decisionSeconds, 0);
    integer(v.nextPhoto);
    integer(v.tinRevision);
    number_(v.lastImpactTick);
    integer(v.failedSetups);
    const pending = object(v.pendingPhotos);

    if (Object.keys(pending).length > 64) throw new Error('Too many pending photos');
    for (const [key, f] of Object.entries(pending)) {
        id(key);
        photo(f, new Map(v.players.map((p) => [p.id, p.slot])), world);
        if (object(f).id !== key) throw new Error('Invalid pending photo id');
    }
    const albumIds = new Set<string>();

    list(v.album, 64, (x) => {
        const p = object(x, [
            'id',
            'photographer',
            'tick',
            'credits',
            'assists',
            'favorites',
            'incident',
            'thumbnail',
        ]);

        id(p.id);
        if (!p.id.startsWith(world.id + '-photo-'))
            throw new Error('Saved photo world mismatch');
        id(p.photographer);
        if (!ids.has(p.photographer)) throw new Error('Missing saved photographer');
        integer(p.tick);
        list(p.credits, 8, (a): asserts a is string => one(a, assignments));
        if (
            new Set(p.credits).size !== p.credits.length
                || p.credits.some((id: string) => !assignments.includes(id))
        )
            throw new Error('Invalid photo credit selection');
        list(p.assists, 4, id);
        if (p.assists.some((playerId: string) => !ids.has(playerId)))
            throw new Error('Missing saved assisting player');
        list(p.favorites, 4, id);
        if (new Set(p.favorites).size !== p.favorites.length)
            throw new Error('Duplicate saved favorite player');
        if (p.favorites.some((playerId: string) => !ids.has(playerId)))
            throw new Error('Missing saved favorite player');
        if (p.incident !== null) one(p.incident, ['spill', 'hat']);
        one(p.thumbnail, ['pending', 'ready']);
        if (albumIds.has(p.id)) throw new Error('Duplicate photo');
        albumIds.add(p.id);
        const frame = pending[p.id];

        if (p.thumbnail === 'ready' && (frame || !images.has(p.id)))
            throw new Error('Missing image or stale pending frame');
        if (p.thumbnail === 'pending' && (!frame || images.has(p.id)))
            throw new Error('Missing pending frame or unexpected image');
        if (
            frame
            && (object(frame).photographer !== p.photographer
                || object(frame).tick !== p.tick)
        )
            throw new Error('Pending capture does not match its album record');
    });
    for (const key of [...images.keys(), ...Object.keys(pending)])
        if (!albumIds.has(key)) throw new Error('Orphan saved image or frame');

    return v as RunState;
}

/**
 * Parse the version-3 save envelope, decode bounded base64 JPEGs, and validate the run.
 * Older versions are rejected without migration.
 *
 * @param raw - UTF-8 JSON save contents
 * @returns Validated run and decoded image map.
 * @throws {Error} JSON, save version, image encoding, or run validation fails.
 */
export function decodeSave(raw: string) {
    const data = object(JSON.parse(raw));

    if (data.version === 1 || data.version === 2)
        throw new Error(
            `Incompatible save version ${data.version}; expected version 3`,
        );
    if (data.version !== 3)
        throw new Error('Unsupported save version; expected version 3');
    object(data, ['version', 'run', 'images']);
    const imageData = object(data.images);

    if (Object.keys(imageData).length > 64) throw new Error('Too many saved images');
    const images = new Map<string, Uint8Array>();

    for (const [key, value] of Object.entries(imageData)) {
        id(key);
        if (
            typeof value !== 'string'
            || value.length > 87_384
            || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
                value,
            )
        )
            throw new Error('Invalid image encoding');
        const bytes = Buffer.from(value, 'base64');

        if (!validJPEG(bytes)) throw new Error('Invalid saved image');
        images.set(key, bytes);
    }

    return { run: validateRun(data.run, images), images };
}
