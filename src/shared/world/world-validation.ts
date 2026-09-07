/**
Validate and freeze complete reserve data at generation, network, and save boundaries.
 */
import type { Box, Vec3, Walkable } from '../shared.ts';
import { isRayBlocked } from '../shared.ts';
import {
    FOREST_MODELS,
    worldBox,
    PROP_CENTER_HEIGHT,
    TIN_HALF,
} from './level.ts';
import {
    RESERVE_SPECIES,
    type ReserveBlueprint,
    type Commission,
    type Resident,
    BLUEPRINT_LIMIT,
    RESERVE_ROUTINES,
    PAIRS,
} from './world-data.ts';
import {
    point,
    distance,
    check,
    placed,
    contains,
    corridorBlocked,
    reserveApproaches,
    commissionRequirements,
    reserveCameraFits,
    reserveCanopyCoverage,
    boundaries,
    waterBeds,
    ground,
    terrain,
    archContacts,
    fixture,
} from './world-geometry.ts';

/**
 * Validate the blueprint, freezing it, then hash its JSON serialization with SHA-256.
 * Property serialization order remains significant.
 *
 * @param world - Reserve blueprint to validate and hash
 * @returns Lowercase hexadecimal digest.
 * @throws {Error} Blueprint validation or digest computation fails.
 */
export async function reserveHash(world: ReserveBlueprint): Promise<string> {
    const bytes = new TextEncoder().encode(
        JSON.stringify(validateReserve(world)),
    );

    return Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (b) => b.toString(16).padStart(2, '0'),
    ).join('');
}

/**
 * Check blueprint size, schema, identities, geometry, routes, and commission feasibility,
 * then recursively freeze the accepted object. Does not regenerate data from its seed.
 *
 * @param value - Untrusted blueprint object
 * @returns The same validated blueprint, deeply frozen at runtime.
 * @throws {Error} Serialization or any structural, geometric, or gameplay-reference
 * invariant fails.
 */
export function validateReserve(value: unknown): ReserveBlueprint {
    check(value !== null && typeof value === 'object', 'object');
    const json = JSON.stringify(value);

    check(
        new TextEncoder().encode(json).length <= BLUEPRINT_LIMIT,
        'blueprint exceeds 1 MiB',
    );
    const w = value as ReserveBlueprint;

    /**
     * Require a non-array object with exactly the listed fields.
     *
     * @param v - Candidate object
     * @param expected - Space-separated required field names
     * @returns No value when the field set is valid.
     * @throws {Error} Object shape or fields do not match.
     */
    const keys = (v: object, expected: string) => check(
        v !== null
        && typeof v === 'object'
        && !Array.isArray(v)
        && Object.keys(v).toSorted((a, b) => a.localeCompare(b)).join(' ')
        === expected.split(' ').toSorted((a, b) => a.localeCompare(b)).join(' '),
        'object fields',
    );

    const pockets = w.pockets ?? [],
        stations = w.stations ?? [],
        density = w.density ?? [],
        navNodes = w.navNodes ?? [],
        trails = w.trails ?? [],
        residents = w.residents ?? [],
        commissions = w.commissions ?? [],
        fixtures = w.fixtures ?? [],
        properties = w.props ?? [];

    keys(
        w,
        'id content seed attempt bounds camp tinStart pockets stations density placements walkables waters trails navNodes walls physicsBoxes fixtures residents commissions props',
    );
    for (const p of pockets) {
        keys(p, 'id habitat position anchors');
        const anchors = p.anchors ?? [];

        for (const a of anchors) keys(a, 'id point kind links');
    }
    for (const s of stations) keys(s, 'id position recover');
    for (const d of density) keys(d, 'id min max kind');
    for (const n of navNodes) keys(n, 'id position links');
    for (const t of trails) keys(t, 'id points width');
    for (const r of residents)
        keys(r, 'id species home spawn anchors group');
    for (const c of commissions)
        keys(
            c,
            'id required kind subjects pocket anchor landmark behavior title instructions',
        );
    for (const f of fixtures)
        keys(
            f,
            'id kind position yaw closedBoxes openSurfaces seats plankId latch',
        );
    for (const p of properties) keys(p, 'id kind pose');
    check(w.content === 'forest-expedition-1', 'content');
    check(typeof w.id === 'string' && /^[\w-]{1,96}$/.test(w.id), 'world id');
    check(
        Number.isSafeInteger(w.seed) && w.seed >= 0 && w.seed <= 0xFF_FF_FF_FF,
        'seed',
    );
    check(
        Number.isSafeInteger(w.attempt) && w.attempt >= 0 && w.attempt < 8,
        'attempt',
    );

    /**
     * Walk JSON values to enforce finite numbers, bounded strings/arrays, and a nesting limit.
     *
     * @param v - Value to inspect recursively
     * @param depth - Current depth, default 0
     * @throws {Error} A value exceeds the limits or is not JSON-compatible.
     */
    const visit = (v: unknown, depth = 0): void => {
        check(depth < 12, 'nesting');
        if (typeof v === 'number') check(Number.isFinite(v), 'finite numbers');
        else if (typeof v === 'string') check(v.length <= 256, 'string length');
        else if (Array.isArray(v)) {
            check(v.length <= 8192, 'array length');
            for (const a of v) visit(a, depth + 1);
        } else if (v && typeof v === 'object')
            for (const a of Object.values(v)) visit(a, depth + 1);
        else check(v === null || typeof v === 'boolean', 'JSON value');
    };

    visit(w);
    for (const key of [
        'pockets',
        'stations',
        'density',
        'placements',
        'walkables',
        'waters',
        'trails',
        'navNodes',
        'walls',
        'physicsBoxes',
        'fixtures',
        'residents',
        'commissions',
        'props',
    ] as const)
        check(Array.isArray(w[key]), key);

    /**
     * Require exactly three finite numeric coordinates.
     *
     * @param p - Untrusted vector
     * @returns No value when the vector is valid.
     * @throws {Error} Vector shape or a component is invalid.
     */
    const vec = (p: unknown) => check(
        Array.isArray(p)
        && p.length === 3
        && p.every((n) => typeof n === 'number' && Number.isFinite(n)),
        'vector',
    );

    /**
     * Require a 1–96 character reserve ID consisting of word characters or hyphens.
     *
     * @param s - Untrusted identifier
     * @returns No value when the identifier is valid.
     * @throws {Error} Identifier type, length, or characters are invalid.
     */
    const id = (s: unknown) => check(typeof s === 'string' && /^[\w-]{1,96}$/.test(s), 'id');

    /**
     * Validate each ID and reject duplicates within a collection.
     *
     * @param a - Records with identifiers
     * @throws {Error} An ID is invalid or repeated.
     */
    const unique = (a: { id: string }[]) => {
        const ids = new Set<string>();

        for (const item of a) {
            id(item.id);
            check(!ids.has(item.id), `duplicate ${item.id}`);
            ids.add(item.id);
        }
    };

    /**
     * Validate box fields, identifier, vectors, and min/max ordering.
     *
     * @param b - Candidate box
     * @param extra - Additional space-separated fields permitted by the subtype
     * @throws {Error} Box shape, identifier, vectors, or coordinate ordering is invalid.
     */
    const box = (b: Box, extra = '') => {
        keys(b, 'id min max' + (extra ? ' ' + extra : ''));
        id(b.id);
        vec(b.min);
        vec(b.max);
        check(
            b.min.every((v, index) => v <= b.max[index]),
            'box order',
        );
    };

    box(w.bounds);
    check(
        JSON.stringify(w.bounds)
        === JSON.stringify({
            id: 'bounds',
            min: [-192, -4, -160],
            max: [192, 36, 160],
        }),
        'bounds',
    );

    /**
     * Validate a point and require it to lie within the reserve's horizontal and vertical
     * bounds.
     *
     * @param p - Candidate world point
     * @throws {Error} The point is malformed or outside reserve bounds.
     */
    const inside = (p: Vec3) => {
        vec(p);
        check(contains(w.bounds, p) && p[1] >= -4 && p[1] <= 36, 'out of bounds');
    };

    /**
     * Validate a box and require both corners to lie inside reserve bounds.
     *
     * @param b - Candidate box
     * @param extra - Additional space-separated subtype fields
     * @throws {Error} Box validation or corner containment fails.
     */
    const inBox = (b: Box, extra = '') => {
        box(b, extra);
        inside(b.min);
        inside(b.max);
    };

    /**
     * Validate a walkable box, slope axis, and finite endpoint heights.
     *
     * @param s - Candidate walkable surface
     * @throws {Error} Surface shape, bounds, axis, or heights are invalid.
     */
    const surface = (s: Walkable) => {
        inBox(s, 'axis heightStart heightEnd');
        check(
            (s.axis === 0 || s.axis === 2)
            && typeof s.heightStart === 'number'
            && Number.isFinite(s.heightStart)
            && typeof s.heightEnd === 'number'
            && Number.isFinite(s.heightEnd),
            'walkable fields',
        );
    };

    inside(w.camp);
    inside(w.tinStart);
    check(w.camp[1] === 0 && ground(w, w.camp), 'camp support');
    check(
        w.tinStart[1] === TIN_HALF[1]
        && ground(
            w,
            point(w.tinStart[0], w.tinStart[1] - TIN_HALF[1], w.tinStart[2]),
        ),
        'tin support',
    );
    check(distance(w.camp, w.tinStart) < 8, 'tin start');
    for (const a of [
        w.pockets,
        w.stations,
        w.density,
        w.placements,
        w.walkables,
        w.waters,
        w.trails,
        w.navNodes,
        w.walls,
        w.physicsBoxes,
        w.fixtures,
        w.residents,
        w.commissions,
        w.props,
    ])
        unique(a);
    check(
        w.pockets.length === 8 && w.stations.length === 2,
        'habitat/station count',
    );
    for (const b of [...w.waters, ...w.walls, ...w.physicsBoxes]) inBox(b);
    for (const s of w.walkables) {
        surface(s);
        check(
            (s.axis === 0 || s.axis === 2)
            && s.heightStart === s.heightEnd
            && s.heightStart === 0,
            'terrain surface',
        );
    }
    check(
        JSON.stringify(w.walkables) === JSON.stringify(terrain(w.waters)),
        'terrain/water seams',
    );
    for (const p of w.placements) {
        inside(p.position);
        check(Object.hasOwn(FOREST_MODELS, p.model), 'unknown model');
        check(
            [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].includes(p.yaw),
            'quarter turn',
        );
        check(
            JSON.stringify(p)
            === JSON.stringify(placed(p.id, p.model, p.position, p.yaw)),
            'placement geometry',
        );
        const b = worldBox(
            p.id,
            p.position,
            p.yaw,
            ...FOREST_MODELS[p.model].bounds,
        );

        inside(b.min);
        inside(b.max);
    }
    check(
        JSON.stringify(w.walls)
        === JSON.stringify([
            ...w.placements.flatMap((p) => p.solids),
            ...w.waters,
            ...boundaries(),
        ]),
        'movement geometry',
    );
    check(
        JSON.stringify(w.physicsBoxes)
        === JSON.stringify([
            ...w.walkables.map((s) => ({
                id: s.id,
                min: point(s.min[0], s.heightStart - 1, s.min[2]),
                max: point(s.max[0], s.heightStart, s.max[2]),
            })),
            ...waterBeds(w.waters),
            ...w.walls,
        ]),
        'physics geometry',
    );
    const placementSolids = w.placements.flatMap((p) => p.solids),
        photoBoxes = [...w.walls, ...w.placements.flatMap((p) => p.occluders)];
    const obstacles = [...w.walls, ...w.fixtures.flatMap((f) => f.closedBoxes)];

    for (const n of w.navNodes) {
        inside(n.position);
        check(
            ground(w, n.position)
            && !corridorBlocked(n.position, n.position, obstacles),
            `blocked node ${n.id}`,
        );
        check(
            Array.isArray(n.links)
            && n.links.length > 0
            && new Set(n.links).size === n.links.length,
            'links',
        );
        for (const link of n.links) {
            const target = w.navNodes.find((m) => m.id === link);

            check(target && target.links.includes(n.id), 'navigation reference');
            check(
                !corridorBlocked(n.position, target.position, obstacles),
                `blocked corridor ${n.id}/${target.id}`,
            );
        }
    }
    const reached = new Set<string>(),
        queue = [w.navNodes.find((n) => n.id === 'camp')!];

    check(
        queue[0] && queue[0].position.every((v, index) => v === w.camp[index]),
        'camp node',
    );
    while (queue.length > 0) {
        const n = queue.pop()!;

        if (reached.has(n.id)) continue;
        reached.add(n.id);
        for (const link of n.links)
            queue.push(w.navNodes.find((m) => m.id === link)!);
    }
    check(reached.size === w.navNodes.length, 'disconnected graph');
    check(
        w.navNodes.reduce((n, v) => n + v.links.length, 0) / 2
        - w.navNodes.length
        + 1
        >= 2,
        'return loops',
    );
    for (const trail of w.trails) {
        check(
            trail.width >= 4 && trail.width <= 8 && trail.points.length === 2,
            'trail corridor',
        );
        for (const p of trail.points) inside(p);
        check(
            !corridorBlocked(trail.points[0], trail.points[1], obstacles),
            'blocked trail',
        );
    }
    for (const n of w.navNodes)
        for (const link of n.links) {
            const m = w.navNodes.find((m) => m.id === link)!;

            check(
                w.trails.some(
                    (t) => (t.points[0].every((v, index) => v === n.position[index])
                        && t.points[1].every((v, index) => v === m.position[index]))
                    || (t.points[1].every((v, index) => v === n.position[index])
                        && t.points[0].every((v, index) => v === m.position[index])),
                ),
                'missing trail',
            );
        }
    const anchors = w.pockets.flatMap((p) => p.anchors);

    unique(anchors);
    for (const p of w.pockets) {
        inside(p.position);
        check(ground(w, p.position), 'pocket support');
        check(['woodland', 'clearing', 'wetland'].includes(p.habitat), 'habitat');
        check(
            Array.isArray(p.anchors)
            && p.anchors.length >= 3
            && p.anchors.length <= 32,
            'anchors',
        );
        const cameras = reserveApproaches(w, p.id);

        check(
            cameras.every(Boolean)
            && distance(cameras[0].position, cameras[1].position) >= 8,
            'alternate camera approach',
        );
        for (const a of p.anchors) {
            inside(a.point);
            check(distance(a.point, p.position) < 24, 'anchor home');
            check(
                Array.isArray(a.links)
                && a.links.length > 0
                && a.links.every((id) => p.anchors.some((b) => b.id === id && b !== a)),
                'anchor links',
            );
            check(
                Object.values(RESERVE_ROUTINES).some((r) => r.kinds.includes(a.kind)),
                'anchor kind',
            );
            if (a.kind === 'water')
                check(
                    w.waters.some((b) => contains(b, a.point) && a.point[1] === b.max[1]),
                    'water anchor',
                );
            else if (a.kind === 'perch')
                check(
                    w.placements.some(
                        (t) => ((t.model === 'RootArch'
                            && archContacts(t).some((p) => p.every((v, index) => Math.abs(v - a.point[index]) < 0.00001),
                            ))
                            || (t.model === 'SnagTall'
                                && distance(t.position, a.point) <= 1))
                            && a.point[1] >= 2
                            && a.point[1] < 6,
                    ),
                    'perch tree',
                );
            else
                check(
                    ground(w, a.point)
                    && !corridorBlocked(a.point, a.point, w.walls, 0.4, 2),
                    'ground anchor',
                );
            check(
                cameras.some(
                    (c) => distance(c.position, a.point) >= 4
                        && distance(c.position, a.point) <= 30,
                ),
                'camera range',
            );
        }
    }
    check(w.residents.length >= 36 && w.residents.length <= 48, 'resident count');
    check(
        new Set(w.residents.map((r) => r.species)).size === 12,
        'species diversity',
    );
    for (const r of w.residents) {
        check(RESERVE_SPECIES.includes(r.species), 'species');
        const p = w.pockets.find((p) => p.id === r.home);

        check(p, 'resident home');
        inside(r.spawn);
        check(
            reserveApproaches(w, r.home).some((n) => reserveCameraFits(n.position, r.spawn, r.species),
            ),
            'resident photograph size',
        );
        check(
            Array.isArray(r.anchors)
            && r.anchors.length >= 3
            && r.anchors.every((id) => p.anchors.some(
                (a) => a.id === id && RESERVE_ROUTINES[r.species].kinds.includes(a.kind),
            ),
            ),
            'resident anchors',
        );
        check(
            r.anchors.some(
                (id) => anchors.find((a) => a.id === id)!.kind
                    === RESERVE_ROUTINES[r.species].anchor,
            ),
            'routine opportunity',
        );
        check(
            r.anchors.some((id) => anchors
                .find((a) => a.id === id)!
                .point.every((v, index) => v === r.spawn[index]),
            ),
            'resident spawn',
        );
        check(
            r.group === null || (typeof r.group === 'string' && r.group.length <= 96),
            'group',
        );

        /**
         * Check a box against the current resident's 28-metre habitat neighborhood.
         *
         * @param b - Candidate scenery box
         * @returns Whether the box overlaps the local habitat search footprint.
         */
        const isNearby = (b: Box) => b.min[0] < p.position[0] + 28
            && b.max[0] > p.position[0] - 28
            && b.min[2] < p.position[2] + 28
            && b.max[2] > p.position[2] - 28;
        const landBoxes = w.walls.filter((b) => isNearby(b)),
            swimBoxes = placementSolids.filter((b) => isNearby(b));
        const local = p.anchors.filter((a) => r.anchors.includes(a.id)),
            seen = new Set<string>(),
            pending = [local.find((a) => a.point.every((v, index) => v === r.spawn[index]))!];

        while (pending.length > 0) {
            const a = pending.pop()!;

            if (!seen.has(a.id)) {
                seen.add(a.id);
                const linked = local.filter((b) => a.links.includes(b.id));

                for (const b of linked) {
                    const boxes
                        = a.kind === 'water' || b.kind === 'water' ? swimBoxes : landBoxes;

                    check(
                        a.kind === 'perch'
                        || b.kind === 'perch'
                        || !corridorBlocked(a.point, b.point, boxes, 0.35, 1.8),
                        'blocked animal transition',
                    );
                    pending.push(b);
                }
            }
        }
        check(seen.size === local.length, 'unreachable animal routine');
    }
    for (const s of w.stations) {
        inside(s.position);
        inside(s.recover);
        check(
            ground(w, s.position)
            && w.navNodes.some((n) => n.position.every((v, index) => v === s.position[index]),
            )
            && ground(w, s.recover)
            && !corridorBlocked(s.position, s.recover, obstacles, 2.5),
            'station recovery',
        );
    }
    for (const property of w.props) {
        check(
            ['case', 'plank', 'screen', 'decoy'].includes(property.kind),
            'prop kind',
        );
        keys(property.pose, 'position rotation');
        inside(property.pose.position);
        check(
            property.pose.position[1] === PROP_CENTER_HEIGHT[property.kind],
            'prop support height',
        );
        check(
            Array.isArray(property.pose.rotation)
            && property.pose.rotation.length === 4
            && property.pose.rotation.every(
                (n) => typeof n === 'number' && Number.isFinite(n),
            )
            && Math.abs(Math.hypot(...property.pose.rotation) - 1) < 1e-6,
            'prop rotation',
        );
        const p = point(property.pose.position[0], 0, property.pose.position[2]);

        check(
            ground(w, p) && !corridorBlocked(p, p, obstacles, 2),
            'prop handling',
        );
        check(
            w.navNodes.some(
                (n) => distance(n.position, p) < 8
                    && !corridorBlocked(n.position, p, obstacles),
            ),
            'prop approach',
        );
    }
    for (const kind of ['case', 'screen', 'decoy'])
        check(w.props.filter((p) => p.kind === kind).length === 1, 'shared tool');
    for (const f of w.fixtures) {
        inside(f.position);
        check(
            [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].includes(f.yaw),
            'fixture rotation',
        );
        check(
            f.seats && typeof f.seats === 'object' && !Array.isArray(f.seats),
            'seats',
        );
        for (const seat of Object.values(f.seats)) {
            keys(seat, 'position rotation');
            inside(seat.position);
            check(
                Array.isArray(seat.rotation)
                && seat.rotation.length === 4
                && seat.rotation.every(
                    (n) => typeof n === 'number' && Number.isFinite(n),
                )
                && Math.abs(Math.hypot(...seat.rotation) - 1) < 1e-6,
                'seat rotation',
            );
            check(distance(seat.position, f.position) < 4, 'seat position');
        }
        check(f.kind === 'gate' || f.kind === 'crossing', 'fixture kind');
        check(f.position[1] === 0, 'fixture datum');
        check(
            JSON.stringify(f)
            === JSON.stringify(fixture(f.id, f.kind, f.position, f.yaw, f.plankId)),
            'fixture geometry',
        );
        if (f.kind === 'gate')
            check(
                w.placements.some(
                    (p) => p.id === f.id + '-posts'
                        && p.model === 'ForestGate'
                        && p.yaw === f.yaw
                        && p.position.every((v, index) => v === f.position[index]),
                ),
                'gate posts',
            );
        for (const b of f.closedBoxes) inBox(b);
        if (f.kind === 'crossing') {
            check(
                w.props.some(
                    (p) => p.id === f.plankId
                        && p.kind === 'plank'
                        && distance(p.pose.position, f.position) < 8,
                ),
                'local plank',
            );
            check(
                f.openSurfaces.length > 0 && Object.keys(f.seats).length > 0,
                'crossing seats',
            );
            for (const s of f.openSurfaces) {
                surface(s);
                check(
                    s.heightStart === s.heightEnd
                    && s.heightStart
                    > w.waters.find((b) => contains(b, f.position))!.max[1],
                    'crossing surface',
                );
            }
        } else {
            check(f.latch !== null && f.plankId === null, 'gate latch');
            inside(f.latch!);
        }
    }
    check(
        new Set(
            w.fixtures.filter((f) => f.kind === 'crossing').map((f) => f.plankId),
        ).size === w.props.filter((p) => p.kind === 'plank').length,
        'individual planks',
    );
    check(
        w.commissions.length === 8
        && w.commissions.filter((c) => c.required).length === 6,
        'commission count',
    );
    const required = w.commissions.filter((c) => c.required),
        kinds = required.map((c) => c.kind).toSorted((a, b) => a.localeCompare(b));

    check(
        JSON.stringify(kinds)
        === JSON.stringify([
            'behavior',
            'behavior',
            'composition',
            'pair',
            'passage',
            'setup',
        ]),
        'commission mix',
    );

    /**
     * Check the kind-specific prerequisite of behavior, passage, and pair commissions.
     *
     * @param c - Commission under validation
     * @param r - Primary subject resident
     * @param subjects - All subject residents, unresolved ids included
     * @throws {Error} The kind prerequisite fails.
     */
    const checkKindPrerequisite = (
        c: Commission,
        r: Resident,
        subjects: (Resident | undefined)[],
    ) => {
        switch (c.kind) {
            case 'behavior': {
                check(
                    c.behavior === RESERVE_ROUTINES[r.species].behavior
                    && c.anchor
                    === `${r.home}-${r.species === 'woodpecker' ? 'woodpecker-perch' : RESERVE_ROUTINES[r.species].anchor}`,
                    'behavior prerequisite',
                );
                break;
            }
            case 'passage': {
                check(
                    ['deer', 'fox', 'badger'].includes(r.species)
                    && c.anchor === `${r.home}-passage`
                    && c.behavior === 'passage',
                    'passage prerequisite',
                );
                break;
            }
            case 'pair': {
                check(
                    PAIRS.some((pair) => pair.every((s) => subjects.some((x) => x!.species === s)),
                    ) && c.anchor === `${r.home}-feed`,
                    'compatible pair',
                );
                break;
            }
        }
    };

    for (const c of w.commissions) {
        check(
            typeof c.required === 'boolean'
            && [
                'behavior',
                'setup',
                'composition',
                'passage',
                'pair',
                'cameo',
                'incident',
            ].includes(c.kind),
            'commission kind',
        );
        check(
            typeof c.title === 'string'
            && c.title.length > 0
            && typeof c.instructions === 'string'
            && c.instructions.length > 0,
            'commission text',
        );
        check(
            c.behavior === null || typeof c.behavior === 'string',
            'commission behavior type',
        );
        check(
            c.subjects.length === (c.kind === 'pair' ? 2 : 1)
            && new Set(c.subjects).size === c.subjects.length,
            'subjects',
        );
        const subjects = c.subjects.map((id) => w.residents.find((r) => r.id === id),
        );

        check(
            subjects.every((r) => r && r.home === c.pocket),
            'subject reference',
        );
        const r = subjects[0]!;

        check(
            anchors.some((a) => a.id === c.anchor)
            && c.anchor?.startsWith(c.pocket + '-'),
            'commission anchor',
        );
        const target = anchors.find((a) => a.id === c.anchor)!;

        check(
            subjects.every((r) => r!.anchors.includes(target.id)),
            'commission target unreachable by subject',
        );
        check(
            reserveApproaches(w, c.pocket).some(
                (n) => subjects.every((r) => reserveCameraFits(n.position, target.point, r!.species),
                )
                && !isRayBlocked(
                    point(n.position[0], 1.6, n.position[2]),
                    point(target.point[0], target.point[1] + 0.4, target.point[2]),
                    photoBoxes,
                ),
            ),
            'camera sight line',
        );
        checkKindPrerequisite(c, r, subjects);
        if (c.kind === 'composition')
            check(
                c.landmark === `${r.home}-landmark`
                && w.placements.some(
                    (p) => p.id === c.landmark
                        && distance(
                            p.position,
                            anchors.find((a) => a.id === c.anchor)!.point,
                        ) < 12,
                ),
                'landmark prerequisite',
            );
        else check(c.landmark === null, 'unexpected landmark');
        if (c.kind === 'setup')
            check(
                ['raccoon', 'deer', 'heron', 'rabbit', 'mallard'].includes(r.species)
                && c.anchor === `${r.home}-feed`,
                'setup prerequisite',
            );
        for (const tool of commissionRequirements(w, c).tools)
            check(
                tool === 'tin' || w.props.some((p) => p.kind === tool),
                'missing tool',
            );
    }
    check(new Set(required.map((c) => c.pocket)).size >= 5, 'commission pockets');
    const used = new Set(
        required
            .flatMap((c) => c.subjects)
            .map((id) => w.residents.find((r) => r.id === id)!.species),
    );

    check(
        used.size >= 5
        && [...used].filter((s) => !['raccoon', 'deer', 'heron'].includes(s))
            .length >= 2,
        'commission species',
    );
    check(
        w.commissions
            .filter((c) => !c.required)
            .every((c) => c.kind === 'cameo' || c.kind === 'incident'),
        'optional mix',
    );
    check(w.density.length === 3, 'density zones');
    check(
        w.density.some((d) => d.kind === 'open' && contains(d, w.camp)),
        'open camp',
    );
    let area = 0;

    for (const d of w.density) {
        inBox(d, 'kind');
        check(['dense', 'light', 'open'].includes(d.kind), 'density kind');
        area += (d.max[0] - d.min[0]) * (d.max[2] - d.min[2]);
    }
    check(Math.abs(area - 384 * 320) < 0.01, 'density area');
    for (let index = 0; index < 3; index++)
        for (let index_ = index + 1; index_ < 3; index_++)
            check(
                Math.min(w.density[index].max[0], w.density[index_].max[0])
                <= Math.max(w.density[index].min[0], w.density[index_].min[0])
                || Math.min(w.density[index].max[2], w.density[index_].max[2])
                <= Math.max(w.density[index].min[2], w.density[index_].min[2]),
                'density overlap',
            );
    for (const [kind, min, max] of [
        ['dense', 0.65, 0.75],
        ['light', 0.15, 0.25],
        ['open', 0.05, 0.15],
    ] as const) {
        const a
            = w.density
                .filter((d) => d.kind === kind)
                .reduce(
                    (n, d) => n + (d.max[0] - d.min[0]) * (d.max[2] - d.min[2]),
                    0,
                )
                / (384 * 320);

        check(a >= min && a <= max, 'density ratio');
    }
    const coverage = reserveCanopyCoverage(w);

    check(coverage >= 0.7 && coverage <= 0.9, `canopy coverage ${coverage}`);
    const seen = new WeakSet<object>();

    /**
     * Recursively freeze the accepted blueprint graph in place. Requires the already validated
     * acyclic JSON structure.
     *
     * @param v - Validated object or nested value to freeze
     */
    const freeze = (v: unknown): void => {
        if (!(v && typeof v === 'object') || seen.has(v)) {
            return;
        }

        seen.add(v);
        for (const nested of Object.values(v)) freeze(nested);
        Object.freeze(v);
    };

    freeze(w);

    return w;
}
