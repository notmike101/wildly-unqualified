import type { ReserveBlueprint } from './world/world.ts';
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Pose = { position: Vec3; rotation: Quat };
export type Box = { id: string; min: Vec3; max: Vec3 };
export type CrewSlot = 0 | 1 | 2 | 3;
export type Habitat = 'woodland' | 'clearing' | 'wetland';
export type Species
    = | 'raccoon'
        | 'deer'
        | 'heron'
        | 'fox'
        | 'rabbit'
        | 'squirrel'
        | 'beaver'
        | 'otter'
        | 'badger'
        | 'owl'
        | 'woodpecker'
        | 'mallard';
export type Behavior
    = | 'wander'
        | 'approach'
        | 'inspect'
        | 'carry'
        | 'investigate'
        | 'feed'
        | 'alert'
        | 'retreat'
        | 'settle'
        | 'display'
        | 'graze'
        | 'wash'
        | 'hat-reach'
        | 'preen'
        | 'pounce'
        | 'nibble'
        | 'cache'
        | 'gnaw'
        | 'groom'
        | 'dig'
        | 'roost'
        | 'tap'
        | 'dabble'
        | 'stalk'
        | 'passage'
        | 'freeze'
        | 'bound'
        | 'climb'
        | 'descend'
        | 'perch'
        | 'fly'
        | 'swim'
        | 'surface'
        | 'sniff';
export type Assignment
    = | 'raccoon-inspect'
        | 'heron-display'
        | 'pond-pair'
        | 'raccoon-wash'
        | 'deer-graze'
        | 'deer-decoy'
        | 'heron-preen';
export type WorldConfig = {
    content: 'forest-mvp-1';
    seed: number;
    sites: Record<Habitat, 0 | 1>;
    assignments: Assignment[];
};
export type FieldProperty = {
    id: string;
    kind: 'case' | 'plank' | 'screen' | 'decoy';
    pose: Pose;
    velocity: Vec3;
    angularVelocity: Vec3;
    holders: [string | null, string | null];
    placed: boolean;
    open: boolean;
    spillUntilTick: number;
};
export type PropertyDefinition = {
    bounds: [Vec3, Vec3];
    solids: { center: Vec3; size: Vec3 }[];
    handles: Vec3[];
    usePoints?: { part: 'lid' | 'bait-cup'; point: Vec3 }[];
};
export type EquipmentTarget = {
    propId: string;
    handle: number | undefined;
    part: 'handle' | 'lid' | 'bait-cup';
    point: Vec3;
};
export type RouteState = {
    crossing: 'left' | 'right' | null;
    gateOpen: boolean;
};
export type FixtureState = Record<
    string,
    { open: boolean; seat: string | null }
>;
export type Spill = {
    id: string;
    position: Vec3;
    portions: number;
    untilTick: number;
};
export type CrewHat = {
    owner: string;
    carrier: 'owner' | 'ground' | `animal:${string}`;
    position: Vec3;
    untilTick: number;
    protectedUntilTick: number;
};
export type Walkable = {
    id: string;
    min: Vec3;
    max: Vec3;
    axis: 0 | 2;
    heightStart: number;
    heightEnd: number;
};
export type Input = {
    seq: number;
    x: number;
    z: number;
    yaw: number;
    pitch: number;
    run: boolean;
    crouch: boolean;
};
export type Player = {
    id: string;
    name: string;
    slot: CrewSlot;
    position: Vec3;
    yaw: number;
    pitch: number;
    lastSeq: number;
    connected: boolean;
    lastInput?: Input;
    inputTick: number;
};
export type Animal = {
    id: string;
    species: Species;
    behavior: Behavior;
    pose: Pose;
    remaining: number;
    target: Vec3;
};
export type Tin = {
    pose: Pose;
    velocity: Vec3;
    angularVelocity: Vec3;
    holder: string | null;
    portions: number;
    open: boolean;
};
export type PhotoFrame = {
    id: string;
    tick: number;
    photographer: string;
    camera: { position: Vec3; yaw: number; pitch: number; fov: number };
    players: Player[];
    animals: Animal[];
    tin: Tin;
    worldId: string;
    props: FieldProperty[];
    route: FixtureState;
    spills: Spill[];
    hats: CrewHat[];
};
export type PhotoVerdict = { credits: string[]; reason: string };
export const ALBUM_LIMITS = { total: 64, extras: 56 } as const;
export type PhotoRecord = {
    id: string;
    photographer: string;
    tick: number;
    credits: string[];
    assists: string[];
    favorites: string[];
    incident: 'spill' | 'hat' | null;
    thumbnail: 'pending' | 'ready';
};
export type Snapshot = {
    version: 3;
    tick: number;
    seconds: number;
    phase: 'camp' | 'outing' | 'exhibition';
    paused: boolean;
    pauseReason: string;
    players: Player[];
    animals: Animal[];
    tin: Tin;
    worldId: string;
    props: FieldProperty[];
    route: FixtureState;
    spills: Spill[];
    hats: CrewHat[];
    spareBait: number;
    baitPatches: Record<string, number>;
    observations: string[];
    completed: string[];
    album: PhotoRecord[];
    ready: string[];
    pings: { player: string; point: Vec3; until: number }[];
};
export type ClientMessage = { worldId: string } & (
    | { type: 'input'; value: Input }
    | {
        type:
            | 'interact'
            | 'use'
            | 'photo'
            | 'recover'
            | 'drop'
            | 'start'
            | 'pause'
            | 'resume'
            | 'ready-end'
            | 'finish'
            | 'save-and-stop';
        seq: number;
    }
    | { type: 'ping'; seq: number; point: Vec3 }
    | { type: 'favorite'; seq: number; photoId: string; selected: boolean }
);
export type ServerMessage
    = | { type: 'world'; id: string; hash: string; blueprint: ReserveBlueprint }
        | { type: 'snapshot'; value: Snapshot }
        | { type: 'photo'; frame: PhotoFrame; verdict: PhotoVerdict; retained: boolean }
        | { type: 'notice'; text: string }
        | { type: 'welcome'; playerId: string; host: boolean }
        | {
            type: 'cue';
            worldId: string;
            id: string;
            kind: 'whistle' | 'rattle' | 'shutter' | 'impact' | 'alert';
            source: string;
            position: Vec3;
        };

/**
 * Measure Euclidean distance in three dimensions.
 *
 * @param a - First point
 * @param b - Second point
 * @returns Distance in world metres.
 */
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Create an identity-rotation pose with a copied position.
 *
 * @param position - World-space position
 * @returns A new pose.
 */
export const pose = (position: Vec3): Pose => ({
    position: [...position],
    rotation: [0, 0, 0, 1],
});

/**
 * Rotate a local point by an XYZW quaternion and translate it into world space.
 *
 * @param point - Prop-local point
 * @param value - Prop world pose with a unit quaternion
 * @returns Transformed world point.
 */
export const propertyPoint = (point: Vec3, value: Pose): Vec3 => {
    const [x, y, z, w] = value.rotation,
        tx = 2 * (y * point[2] - z * point[1]),
        ty = 2 * (z * point[0] - x * point[2]),
        tz = 2 * (x * point[1] - y * point[0]);

    return [
        value.position[0] + point[0] + w * tx + y * tz - z * ty,
        value.position[1] + point[1] + w * ty + z * tx - x * tz,
        value.position[2] + point[2] + w * tz + x * ty - y * tx,
    ];
};

/**
 * Find the first field prop whose holder slots contain a player.
 *
 * @param playerId - Player ID
 * @param properties - Current field props
 * @returns The existing held prop, or undefined.
 */
export function heldProperty(playerId: string, properties: FieldProperty[]) {
    return properties.find((property) => property.holders.includes(playerId));
}

/**
 * Find the nearest visible equipment handle or bait-cup use point within two metres of the
 * player's eye. Excludes occupied handles and placed props from pickup.
 *
 * @param player - Interacting player
 * @param properties - Current field props
 * @param definitions - Equipment geometry catalog
 * @param occluders - World and fixture sight blockers
 * @param parts - Select pickup handles or use points
 * @returns Nearest eligible target, or undefined.
 */
function closestTarget(
    player: Player,
    properties: FieldProperty[],
    definitions: Record<FieldProperty['kind'], PropertyDefinition>,
    occluders: Box[],
    parts: 'handles' | 'usePoints',
): EquipmentTarget | undefined {
    const choices: EquipmentTarget[] = [];

    for (const property of properties) {
        const definition = definitions[property.kind];

        if (!definition || (parts === 'handles' && property.placed)) continue;
        if (parts === 'handles') {
            for (const [handle, point] of definition.handles.entries()) {
                if (property.holders[handle] === null)
                    choices.push({
                        propId: property.id,
                        handle,
                        part: 'handle',
                        point: propertyPoint(point, property.pose),
                    });
            }
        } else {
            const usePoints = definition.usePoints?.filter(
                ({ part }) => part === 'bait-cup',
            ) ?? [];

            for (const { part, point } of usePoints)
                choices.push({
                    propId: property.id,
                    handle: undefined,
                    part,
                    point: propertyPoint(point, property.pose),
                });
        }
    }

    return (
        choices
            .filter(
                (target) => distance(eye(player), target.point) <= 2
                    && !isRayBlocked(eye(player), target.point, [
                        ...occluders,
                        ...properties.flatMap((property) => propertyBoxes(property, definitions[property.kind]).filter(
                            (box) => property.id !== target.propId
                                || target.point.some(
                                    (value, axis) => !(value >= box.min[axis] && value <= box.max[axis]),
                                ),
                        ),
                        ),
                    ]),
            )
            .toSorted(
                (a, b) => distance(eye(player), a.point) - distance(eye(player), b.point),
            )[0] ?? undefined
    );
}

/**
 * Find the nearest unoccupied, visible equipment handle within interaction range.
 *
 * @param player - Interacting player
 * @param properties - Current field props
 * @param definitions - Equipment geometry catalog
 * @param occluders - World and fixture sight blockers
 * @returns Pickup target, or undefined.
 */
export function equipmentTarget(
    player: Player,
    properties: FieldProperty[],
    definitions: Record<FieldProperty['kind'], PropertyDefinition>,
    occluders: Box[],
) {
    return closestTarget(player, properties, definitions, occluders, 'handles');
}

/**
 * Find a visible bait-cup use point only when the player is not holding equipment.
 *
 * @param player - Interacting player
 * @param properties - Current field props
 * @param definitions - Equipment geometry catalog
 * @param occluders - World and fixture sight blockers
 * @returns Use target, or undefined when hands are occupied or no point qualifies.
 */
export function equipmentUseTarget(
    player: Player,
    properties: FieldProperty[],
    definitions: Record<FieldProperty['kind'], PropertyDefinition>,
    occluders: Box[],
) {
    if (heldProperty(player.id, properties)) return;

    return closestTarget(player, properties, definitions, occluders, 'usePoints');
}

/**
 * Find the nearest visible hat or unexpired spill within interaction range. Equipment
 * holders cannot recover incidents, and spills require spare-bait capacity.
 *
 * @param player - Interacting player
 * @param state - Current equipment and incident state
 * @param definitions - Equipment geometry catalog
 * @param walls - World and fixture sight blockers
 * @returns Incident kind, ID, and world point, or undefined.
 */
export function recoveryTarget(
    player: Player,
    state: Pick<Snapshot, 'props' | 'spills' | 'hats' | 'spareBait' | 'tick'>,
    definitions: Record<FieldProperty['kind'], PropertyDefinition>,
    walls: Box[],
): { kind: 'hat' | 'spill'; id: string; point: Vec3 } | undefined {
    if (heldProperty(player.id, state.props)) return undefined;
    const candidates = [
        ...state.hats
            .filter((h) => h.carrier !== 'owner')
            .map((h) => ({ kind: 'hat' as const, id: h.owner, point: h.position })),
        ...state.spills
            .filter(
                (s) => state.spareBait < 8 && s.portions > 0 && s.untilTick > state.tick,
            )
            .map((s) => ({ kind: 'spill' as const, id: s.id, point: s.position })),
    ];

    return (
        candidates
            .filter(
                (c) => distance(eye(player), c.point) <= 2
                    && !isRayBlocked(eye(player), c.point, walls)
                    && !propertyRayBlocked(eye(player), c.point, state.props, definitions),
            )
            .toSorted(
                (a, b) => distance(eye(player), a.point) - distance(eye(player), b.point),
            )[0] ?? undefined
    );
}

/**
 * Enclose each rotated prop solid in a world-space axis-aligned box.
 *
 * @param property - Prop world pose and identity
 * @param definition - Local equipment solid definitions
 * @returns New world-space collision boxes.
 */
export function propertyBoxes(property: FieldProperty, definition: PropertyDefinition): Box[] {
    const [x, y, z, w] = property.pose.rotation,
        matrix = [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ];

    return definition.solids.map((solid, index) => {
        const center = propertyPoint(solid.center, property.pose),
            half = solid.size.map((value) => value / 2) as Vec3,
            extent = matrix.map((row) => row.reduce((sum, value, axis) => sum + Math.abs(value) * half[axis], 0),
            ) as Vec3;

        return {
            id: `${property.id}-solid-${index}`,
            min: center.map((value, axis) => value - extent[axis]) as Vec3,
            max: center.map((value, axis) => value + extent[axis]) as Vec3,
        };
    });
}

/**
 * Test a sight segment against oriented prop solids by transforming it into each prop's
 * local coordinates.
 *
 * @param from - World-space segment start
 * @param to - World-space segment end
 * @param properties - Current field props
 * @param definitions - Local equipment geometry catalog
 * @returns Whether any equipment solid blocks the segment.
 */
export function propertyRayBlocked(
    from: Vec3,
    to: Vec3,
    properties: FieldProperty[],
    definitions: Record<FieldProperty['kind'], PropertyDefinition>,
) {
    return properties.some((property) => {
        const [x, y, z, w] = property.pose.rotation;

        /**
         * Inverse-transform a world point into the current prop's coordinates.
         *
         * @param point - World-space point
         * @returns Prop-local point.
         */
        const local = (point: Vec3) => propertyPoint(point.map((v, index) => v - property.pose.position[index]) as Vec3, {
            position: [0, 0, 0],
            rotation: [-x, -y, -z, w],
        });

        return isRayBlocked(
            local(from),
            local(to),
            definitions[property.kind].solids.map((solid, index) => ({
                id: `${property.id}-${index}`,
                min: solid.center.map((v, a) => v - solid.size[a] / 2) as Vec3,
                max: solid.center.map((v, a) => v + solid.size[a] / 2) as Vec3,
            })),
        );
    });
}

/**
 * Resolve movement speed from crouch/run input and equipment holder count. Heavy solo and
 * paired carries override ordinary movement speed.
 *
 * @param playerId - Moving player ID
 * @param input - Current movement input
 * @param properties - Current field props
 * @returns Speed limit in metres per second.
 */
export function playerSpeed(
    playerId: string,
    input: Input,
    properties: FieldProperty[],
) {
    const held = heldProperty(playerId, properties);

    if (held && held.kind !== 'decoy')
        return held.holders.filter(Boolean).length === 2 ? 2 : 0.8;

    return input.crouch ? 1.4 : (input.run ? 5 : 3);
}

/**
 * Offset the player's foot position to standing or crouched eye height using lastInput.
 *
 * @param p - Player whose camera origin is needed
 * @returns New eye position in world coordinates.
 */
export function eye(p: Player): Vec3 {
    return [
        p.position[0],
        p.position[1] + (p.lastInput?.crouch ? 0.9 : 1.6),
        p.position[2],
    ];
}

/**
 * Convert view angles to a unit forward vector with negative Z as the neutral heading.
 *
 * @param yaw - Yaw in radians
 * @param pitch - Pitch in radians, default 0
 * @returns Unit direction vector.
 */
export function forward(yaw: number, pitch = 0): Vec3 {
    return [
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch),
    ];
}

/**
 * Require a non-null, non-array object at the message boundary.
 *
 * @param v - Untrusted message value
 * @returns The original object as a record.
 * @throws {Error} The value is not an object.
 */
function object(v: unknown): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        throw new Error('Expected object');

    return v as Record<string, unknown>;
}

/**
 * Require exactly the allowed object fields, rejecting missing and unknown keys.
 *
 * @param v - Message record to inspect
 * @param allowed - Exact required field names
 * @throws {Error} Object keys do not match the schema.
 */
function keys(v: Record<string, unknown>, allowed: string[]) {
    if (
        Object.keys(v).length !== allowed.length
        || Object.keys(v).some((k) => !allowed.includes(k))
    )
        throw new Error('Unexpected fields');
}

/**
 * Validate a finite number within inclusive bounds without coercion.
 *
 * @param v - Untrusted numeric value
 * @param min - Inclusive minimum
 * @param max - Inclusive maximum
 * @returns The accepted number.
 * @throws {Error} The value is nonnumeric, nonfinite, or outside the range.
 */
function number(v: unknown, min: number, max: number): number {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
        throw new Error('Invalid number');

    return v;
}

/**
 * Validate a client message's exact shape, command, sequence, world identifier, and
 * command-specific values. Does not authorize the command or mutate gameplay.
 *
 * @param value - Untrusted decoded network value
 * @returns A detached validated client message.
 * @throws {Error} Any message field or command variant is invalid.
 */
export function parseMessage(value: unknown): ClientMessage {
    const m = object(value);

    if (typeof m.worldId !== 'string' || !/^[-_a-zA-Z0-9]{1,64}$/.test(m.worldId))
        throw new Error('Invalid world ID');
    if (m.type === 'input') {
        keys(m, ['type', 'worldId', 'value']);
        const v = object(m.value);

        keys(v, ['seq', 'x', 'z', 'yaw', 'pitch', 'run', 'crouch']);
        number(v.seq, 1, Number.MAX_SAFE_INTEGER);
        if (!Number.isSafeInteger(v.seq)) throw new Error('Invalid sequence');
        number(v.x, -1, 1);
        number(v.z, -1, 1);
        number(v.yaw, -Math.PI * 4, Math.PI * 4);
        number(v.pitch, -1.45, 1.45);
        if (typeof v.run !== 'boolean' || typeof v.crouch !== 'boolean')
            throw new Error('Invalid buttons');
    } else {
        const names = [
            'interact',
            'use',
            'photo',
            'recover',
            'drop',
            'start',
            'pause',
            'resume',
            'ready-end',
            'finish',
            'save-and-stop',
            'ping',
            'favorite',
        ];

        if (typeof m.type !== 'string' || !names.includes(m.type))
            throw new Error('Unknown command');
        keys(
            m,
            m.type === 'ping'
                ? ['type', 'worldId', 'seq', 'point']
                : (m.type === 'favorite'
                        ? ['type', 'worldId', 'seq', 'photoId', 'selected']
                        : ['type', 'worldId', 'seq']),
        );
        number(m.seq, 1, Number.MAX_SAFE_INTEGER);
        if (!Number.isSafeInteger(m.seq)) throw new Error('Invalid sequence');
        if (m.type === 'favorite') {
            if (
                typeof m.photoId !== 'string'
                || !/^[-_a-zA-Z0-9]{1,80}$/.test(m.photoId)
            )
                throw new Error('Invalid photo ID');
            if (typeof m.selected !== 'boolean')
                throw new Error('Invalid favorite selection');
        } else if (m.type === 'ping') {
            if (!Array.isArray(m.point) || m.point.length !== 3)
                throw new Error('Invalid point');
            for (const n of m.point) number(n, -512, 512);
        }
    }

    return structuredClone(value) as ClientMessage;
}

/**
 * Intersect a finite segment with axis-aligned boxes using slab intervals, ignoring
 * contacts only at the near or far endpoint tolerances.
 *
 * @param from - Segment start
 * @param to - Segment end
 * @param boxes - World-space blockers
 * @returns Whether an interior portion of the segment intersects a box.
 */
export function isRayBlocked(from: Vec3, to: Vec3, boxes: Box[]): boolean {
    return boxes.some((b) => {
        let low = 0,
            high = 1;

        for (let index = 0; index < 3; index++) {
            const d = to[index] - from[index];

            if (Math.abs(d) < 1e-9) {
                if (from[index] < b.min[index] || from[index] > b.max[index]) return false;
                continue;
            }
            let a = (b.min[index] - from[index]) / d,
                c = (b.max[index] - from[index]) / d;

            if (a > c) [a, c] = [c, a];
            low = Math.max(low, a);
            high = Math.min(high, c);
            if (low > high) return false;
        }

        return high > 0.001 && low < 0.995;
    });
}

/**
 * Interpolate a walkable surface's height along its slope axis within inclusive X/Z bounds.
 *
 * @param surface - Walkable surface definition
 * @param x - World X coordinate
 * @param z - World Z coordinate
 * @returns Height in metres, or undefined outside the surface footprint.
 */
export function surfaceHeight(
    surface: Walkable,
    x: number,
    z: number,
): number | undefined {
    if (
        x < surface.min[0]
        || x > surface.max[0]
        || z < surface.min[2]
        || z > surface.max[2]
    )
        return undefined;
    const start = surface.min[surface.axis],
        length = surface.max[surface.axis] - start,
        t = length ? ((surface.axis === 0 ? x : z) - start) / length : 0;

    return surface.heightStart + (surface.heightEnd - surface.heightStart) * t;
}

/**
 * Integrate input into a copied player, normalizing diagonal movement and clamping elapsed
 * time to 0.25 seconds. Swept axis steps preserve wall clearance and the 45 cm terrain step
 * limit; existing overlaps may be escaped.
 *
 * @param player - Starting player state
 * @param input - Movement axes, view angles, and buttons
 * @param dt - Elapsed seconds, clamped to 0–0.25
 * @param walls - World-space movement blockers
 * @param surfaces - Walkable surfaces providing ground support
 * @param speedLimit - Optional speed override in metres per second
 * @returns Updated player with a detached position; unrelated fields retain their
 * references.
 */
export function movePlayer(
    player: Player,
    input: Input,
    dt: number,
    walls: Box[],
    surfaces: Walkable[] = [],
    speedLimit?: number,
): Player {
    const p = {
        ...player,
        position: [...player.position] as Vec3,
        yaw: input.yaw,
        pitch: input.pitch,
    };
    const length = Math.max(1, Math.hypot(input.x, input.z));
    const speed = speedLimit ?? (input.crouch ? 1.4 : (input.run ? 5 : 3));
    const x
        = ((input.x * Math.cos(input.yaw) + input.z * Math.sin(input.yaw)) / length)
            * speed;
    const z
        = ((-input.x * Math.sin(input.yaw) + input.z * Math.cos(input.yaw)) / length)
            * speed;

    /**
     * Measure horizontal penetration into a player-expanded box when the player's vertical span
     * overlaps it.
     *
     * @param point - Candidate foot position
     * @param height - Player collision height in metres
     * @param box - World-space collision box
     * @returns Minimum horizontal penetration, or negative infinity without vertical overlap.
     */
    const penetration = (point: Vec3, height: number, box: Box) => {
        if (box.max[1] <= height + 0.15 || box.min[1] >= height + 1.8)
            return -Infinity;

        return Math.min(
            point[0] - (box.min[0] - 0.35),
            box.max[0] + 0.35 - point[0],
            point[2] - (box.min[2] - 0.35),
            box.max[2] + 0.35 - point[2],
        );
    };
    const time = Math.max(0, Math.min(0.25, dt)),
        steps = Math.max(1, Math.ceil((speed * time) / 0.1));

    for (let n = 0; n < steps; n++)
        for (const axis of [0, 2]) {
            const next = p.position[axis] + ((axis === 0 ? x : z) * time) / steps;
            const point = [...p.position];

            point[axis] = next;
            const heights = surfaces
                .map((surface) => surfaceHeight(surface, point[0], point[2]))
                .filter((height): height is number => height !== undefined)
                .filter((height) => height <= p.position[1] + 0.45);
            const height = heights.length > 0 ? Math.max(...heights) : undefined;

            if (
                (height !== undefined || surfaces.length === 0)
                && !walls.some((box) => {
                    const next = penetration(point as Vec3, height ?? p.position[1], box);

                    if (next <= 0) return false;
                    const current = penetration(p.position, p.position[1], box);

                    if (current <= 0) return true;
                    const centerX = (box.min[0] + box.max[0]) / 2,
                        centerZ = (box.min[2] + box.max[2]) / 2,

                        /**
                         * Measure squared X/Z separation from the current wall's center for overlap-escape
                         * comparison.
                         *
                         * @param value - Candidate player position
                         * @returns Squared horizontal distance.
                         */
                        distance = (value: number[]) => (value[0] - centerX) ** 2 + (value[2] - centerZ) ** 2;

                    return distance(point) <= distance(p.position) + 1e-9;
                })
            ) {
                p.position[axis] = next;
                if (height !== undefined) p.position[1] = height;
            }
        }

    return p;
}
