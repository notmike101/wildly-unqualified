/**
Preserved deterministic MVP forest layout, paths, and route geometry.
 */
import type { Box, RouteState, Vec3, Walkable } from '../shared.ts';
import {
    type WorldPlacement,
    type NavNode,
    FOREST_MODELS,
    worldBox,
    placement,
} from './forest-models.ts';
import {
    CAMP,
    WOODLAND,
    WASHOUT,
    CLEARING,
    WETLAND,
    WATER_BOUNDS,
    HABITAT_SITES,
    WOODLAND_WASH_SITES,
    STASH,
    PLANK_PLACEMENTS,
} from './level-data.ts';

/**
 * Construct a catalog tree placement for the retained MVP layout. The old height argument
 * is intentionally unused.
 *
 * @param id - Placement ID
 * @param model - Forest model name
 * @param position - World position
 * @param _height - Legacy height argument, retained for call compatibility
 * @param yaw - Yaw in radians, default 0
 * @returns Authored world placement.
 */
const tree = (
    id: string,
    model: string,
    position: Vec3,
    _height: number,
    yaw = 0,
) => placement(id, model, position, yaw);
const FEATURE_PLACEMENTS: WorldPlacement[] = [
    placement('camp-table', 'CampTable', [-53, 0, 44]),
    placement('camp-bench', 'Bench', [-53, 0, 46], Math.PI),
    placement('camp-supplies', 'SupplyCrate', [-53.8, 0, 45.2]),
    placement('pine-a', 'MaturePineA', [-70, 0, 34], 0),
    placement('pine-b', 'MaturePineB', [-70, 0, 7], 0),
    placement('cedar-a', 'MatureCedarA', [-54, 0, -24], 0),
    placement('cedar-b', 'MatureCedarB', [-35, 0, -31], 0),
    placement('oak-a', 'MatureOakA', [8, 0, 40], 0),
    placement('oak-b', 'MatureOakB', [35, 0, 36], 0),
    placement('alder-a', 'MatureAlderA', [55, 0, -10], 0),
    placement('alder-b', 'MatureAlderB', [58, 0, -46], 0),
    placement('snag-tall', 'SnagTall', [-57, 0, 20], 0),
    placement('snag-forked', 'SnagForked', [-43, 0, -10], 0),
    placement('fallen-log', 'FallenLogWhole', [-30, 0, 25], 0),
    placement('hollow-log', 'HollowLog', [8, 0, 29], 0.35),
    placement('root-plate', 'RootPlate', [49, 0, -17], 0),
    placement('moss-boulder-a', 'MossBoulderA', [-30, 0, 1], 0),
    placement('moss-boulder-b', 'MossBoulderB', [-2, 0, 20], 0),
    placement('boulder-cluster', 'BoulderCluster', [15, 0, -5], 0),
    placement('root-arch', 'RootArch', [-8, 0, -14], 0),
    placement('wet-bank', 'WetBankShelf', [38, 0, -39], 0),
    placement('dry-bank', 'DryBankSlope', [-4, 0, 30], 0),
    placement('fern-a', 'FernLargeA', [-41, 0, 4], 0),
    placement('fern-b', 'FernLargeB', [27, 0, 22], 0),
    placement('leaf-mat', 'LeafMat', [-35, 0.01, 18], 0),
    placement('needle-mat', 'NeedleMat', [-52, 0.01, 31], 0),
    placement('root-spread', 'RootSpread', [44, 0.01, -22], 0),
    placement('reed-bed', 'ReedBed', [47, -0.25, -29], 0),
    placement('lily-patch', 'LilyPatch', [42, -0.3, -39], 0),
    placement('sedge-clump', 'SedgeClump', [34, 0, -34], 0),
    placement('forest-gate', 'ForestGate', [-44.8, 0, 31], -0.3805063771123649),
    placement('trail-board', 'TrailBoard', [-36, 0, 23], 0),
];

export const WALKABLES: Walkable[] = [
    {
        id: 'terrain-west',
        min: [-78, 0, -68],
        max: [-21.5, 0, 68],
        axis: 0,
        heightStart: 0,
        heightEnd: 0,
    },
    {
        id: 'terrain-east',
        min: [-6.5, 0, -68],
        max: [78, 0, 68],
        axis: 0,
        heightStart: 0,
        heightEnd: 0,
    },
    {
        id: 'terrain-north',
        min: [-22, 0, 8],
        max: [-6, 0, 68],
        axis: 0,
        heightStart: 0,
        heightEnd: 0,
    },
    {
        id: 'terrain-south',
        min: [-22, 0, -68],
        max: [-6, 0, -10],
        axis: 0,
        heightStart: 0,
        heightEnd: 0,
    },
    {
        id: 'dry-detour',
        min: [-22, 0, -10],
        max: [-6, 0, -4],
        axis: 0,
        heightStart: 0,
        heightEnd: 0,
    },
    {
        id: 'washout-west-bank',
        min: [-22, -1, -2],
        max: [-14, 0, 6],
        axis: 0,
        heightStart: 0,
        heightEnd: -1,
    },
    {
        id: 'washout-east-bank',
        min: [-11.2, -1, -2],
        max: [-6, 0, 6],
        axis: 0,
        heightStart: -1,
        heightEnd: 0,
    },
];
for (const bank of FEATURE_PLACEMENTS) {
    if (bank.model !== 'WetBankShelf' && bank.model !== 'DryBankSlope') continue;
    const [min, max] = FOREST_MODELS[bank.model].bounds;

    WALKABLES.push({
        id: bank.id + '-ramp',
        min: [
            bank.position[0] + min[0],
            bank.position[1],
            bank.position[2] + min[2],
        ],
        max: [
            bank.position[0] + max[0],
            bank.position[1] + max[1],
            bank.position[2] + max[2],
        ],
        axis: 2,
        heightStart: bank.position[1] + 0.12,
        heightEnd: bank.position[1] + max[1],
    });
}
export const TRAILS: { id: string; points: Vec3[]; width: number }[] = [
    {
        id: 'main-route',
        points: [
            CAMP,
            [-46, 0, 34],
            WOODLAND,
            [-22, 0, 2],
            WASHOUT,
            [-11.2, -1, 2],
            [-6, 0, 2],
            CLEARING,
            [30, 0, 0],
            WETLAND,
        ],
        width: 4,
    },
    {
        id: 'dry-washout-detour',
        points: [
            [-22, 0, 2],
            [-22, 0, -6],
            [-6, 0, -6],
            [-6, 0, 2],
        ],
        width: 4,
    },
    {
        id: 'west-return',
        points: [
            WETLAND,
            [12, 0, -47],
            [-24, 0, -48],
            [-56, 0, -34],
            [-66, 0, 0],
            [-59, 0, 28],
            CAMP,
        ],
        width: 4,
    },
];

/**
 * Find the shortest horizontal distance from a point to a finite segment, including
 * degenerate segments.
 *
 * @param point - World point
 * @param a - Segment start
 * @param b - Segment end
 * @returns Distance in metres.
 */
const segmentDistance = (point: Vec3, a: Vec3, b: Vec3) => {
    const dx = b[0] - a[0],
        dz = b[2] - a[2],
        t = Math.max(
            0,
            Math.min(
                1,
                ((point[0] - a[0]) * dx + (point[2] - a[2]) * dz)
                / (dx * dx + dz * dz || 1),
            ),
        ),
        x = a[0] + dx * t,
        z = a[2] + dz * t;

    return Math.hypot(point[0] - x, point[2] - z);
};

/**
 * Exclude retained MVP clearings, water margins, and trail corridors from tree placement.
 *
 * @param point - Proposed tree position
 * @returns Whether the horizontal location permits a tree.
 */
const clearForTree = (point: Vec3) => {
    const clearings: [Vec3, number][] = [
        [CAMP, 10],
        [WOODLAND, 7],
        [HABITAT_SITES.woodland[1], 7],
        [WASHOUT, 8],
        [CLEARING, 10],
        [HABITAT_SITES.clearing[1], 7],
        [WETLAND, 8],
        [HABITAT_SITES.wetland[1], 7],
    ];

    return (
        clearings.every(
            ([center, radius]) => Math.hypot(point[0] - center[0], point[2] - center[2]) > radius,
        )
        && !(
            point[0] > WATER_BOUNDS.min[0] - 3
            && point[0] < WATER_BOUNDS.max[0] + 3
            && point[2] > WATER_BOUNDS.min[2] - 3
            && point[2] < WATER_BOUNDS.max[2] + 3
        )
        && TRAILS.every((trail) => trail.points
            .slice(1)
            .every(
                (end, index) => segmentDistance(point, trail.points[index], end)
                    > trail.width / 2 + 2.2,
            ),
        )
    );
};
const STAND_TREES: WorldPlacement[] = [];

for (let z = -60, row = 0; z <= 60; z += 9, row++)
    for (let x = -70, column = 0; x <= 70; x += 9, column++) {
        const point: Vec3 = [
            x + ((row * 5 + column * 3) % 5) - 2,
            0,
            z + ((row * 3 + column * 7) % 5) - 2,
        ];

        if (clearForTree(point)) {
            const isOak = (row + column) % 5 === 0;
            const variants
                = point[2] < -20 && point[0] > 25
                    ? ['MatureAlderA', 'MatureAlderB', 'MatureCedarA']
                    : (point[0] > 0
                            ? ['MatureOakA', 'MatureOakB', 'MaturePineB']
                            : ['MaturePineA', 'MaturePineB', 'MatureCedarA', 'MatureCedarB']);

            STAND_TREES.push(
                tree(
                    `stand-${String(STAND_TREES.length + 1).padStart(3, '0')}`,
                    variants[(row + column * 3) % variants.length],
                    point,
                    isOak ? 24 : 29,
                    (((row * 11 + column * 7) % 24) * Math.PI) / 12,
                ),
            );
        }
    }
const FLOOR_PLACEMENTS: WorldPlacement[] = [];

for (const [index, t] of STAND_TREES.entries()) {
    FLOOR_PLACEMENTS.push(
        placement(
            'floor-' + index,
            t.model.includes('Oak') ? 'LeafMat' : 'NeedleMat',
            [t.position[0], 0.01, t.position[2]],
            t.yaw,
        ),
    );
    for (const n of [0, 1]) {
        const angle = index * 2.4 + n * 2.1;
        const p: Vec3 = [
            t.position[0] + Math.cos(angle) * 3.5,
            0,
            t.position[2] + Math.sin(angle) * 3.5,
        ];

        if (clearForTree(p))
            FLOOR_PLACEMENTS.push(
                placement(
                    'fern-' + index + '-' + n,
                    (index + n) % 2 ? 'FernLargeA' : 'FernLargeB',
                    p,
                    angle,
                ),
            );
    }
}
for (let index = 0; index < 14; index++) {
    FLOOR_PLACEMENTS.push(
        placement(
            'water-edge-' + index,
            index % 2 ? 'ReedBed' : 'SedgeClump',
            [43 + index * 1.35, -0.05, -46],
            index,
        ),
    );
    if (index % 3 === 0)
        FLOOR_PLACEMENTS.push(
            placement('lilies-' + index, 'LilyPatch', [45 + index, -0.05, -40], index),
        );
}
export const WORLD_PLACEMENTS: WorldPlacement[] = [
    ...FEATURE_PLACEMENTS,
    ...STAND_TREES,
    ...FLOOR_PLACEMENTS,
];

// Follow every authored trail corner; short local links connect the two encounter sites.

export const NAV_NODES: NavNode[] = [];
for (const trail of TRAILS) {
    let previous: NavNode | undefined;

    for (const point of trail.points) {
        let node = NAV_NODES.find((n) => n.position.every((v, index) => v === point[index]),
        );

        if (!node) {
            node = {
                id: `trail-${NAV_NODES.length}`,
                position: [...point],
                links: [],
            };
            NAV_NODES.push(node);
        }
        if (previous) {
            if (!previous.links.includes(node.id)) previous.links.push(node.id);
            if (!node.links.includes(previous.id)) node.links.push(previous.id);
        }
        previous = node;
    }
}
for (const [id, position] of [
    ['woodland', HABITAT_SITES.woodland[0]],
    ['woodland-alt', HABITAT_SITES.woodland[1]],
    ['clearing', HABITAT_SITES.clearing[0]],
    ['clearing-alt', HABITAT_SITES.clearing[1]],
    ['wetland', HABITAT_SITES.wetland[0]],
    ['wetland-alt', HABITAT_SITES.wetland[1]],
    ['woodland-wash', WOODLAND_WASH_SITES[0]],
    ['woodland-wash-alt', WOODLAND_WASH_SITES[1]],
    ['stash', STASH],
    ['crossing-right-west', [-14, -1, 5]],
    ['crossing-right-east', [-11.2, -1, 5]],
] as [string, Vec3][]) {
    const node: NavNode = { id, position, links: [] };

    for (const other of NAV_NODES)
        if (
            Math.hypot(
                position[0] - other.position[0],
                position[2] - other.position[2],
            ) <= 12
        ) {
            node.links.push(other.id);
            other.links.push(id);
        }
    NAV_NODES.push(node);
}

/**
 * Resolve the retained MVP's movable route collision geometry.
 *
 * @param route - Legacy route state
 * @returns Active legacy gate/crossing collision boxes.
 */
export function routeBoxes(route: RouteState): Box[] {
    const gate = FEATURE_PLACEMENTS.find((p) => p.model === 'ForestGate')!;
    const angle = route.gateOpen ? Math.PI / 2 : 0,
        hinge: Vec3 = [-2.2, 0.9, 0],
        offset: Vec3 = [2.2 * Math.cos(angle), -0.05, -2.2 * Math.sin(angle)],
        center: Vec3 = [
            gate.position[0]
            + (hinge[0] + offset[0]) * Math.cos(gate.yaw)
            + (hinge[2] + offset[2]) * Math.sin(gate.yaw),
            gate.position[1] + hinge[1] + offset[1],
            gate.position[2]
            - (hinge[0] + offset[0]) * Math.sin(gate.yaw)
            + (hinge[2] + offset[2]) * Math.cos(gate.yaw),
        ];

    return [
        worldBox(
            'gate-leaf',
            center,
            gate.yaw + angle,
            [-2.15, -0.6, -0.06],
            [2.15, 0.6, 0.06],
        ),
    ];
}

/**
 * Resolve the retained MVP gate's latch for its current hinge state.
 *
 * @param route - Legacy route state
 * @returns World-space latch position.
 */
export function gateLatch(route: RouteState): Vec3 {
    const gate = FEATURE_PLACEMENTS.find((p) => p.model === 'ForestGate')!,
        angle = route.gateOpen ? Math.PI / 2 : 0,
        hinge: Vec3 = [-2.2, 0.9, 0],
        local: Vec3 = [4.35, 0.35, -0.08],
        rotated: Vec3 = [
            local[0] * Math.cos(angle) + local[2] * Math.sin(angle),
            local[1],
            -local[0] * Math.sin(angle) + local[2] * Math.cos(angle),
        ],
        point: Vec3 = [
            hinge[0] + rotated[0],
            hinge[1] + rotated[1],
            hinge[2] + rotated[2],
        ];

    return [
        gate.position[0]
        + point[0] * Math.cos(gate.yaw)
        + point[2] * Math.sin(gate.yaw),
        gate.position[1] + point[1],
        gate.position[2]
        - point[0] * Math.sin(gate.yaw)
        + point[2] * Math.cos(gate.yaw),
    ];
}

/**
 * Resolve walking surfaces enabled by the retained MVP crossing state.
 *
 * @param route - Legacy route state
 * @returns Active legacy crossing surfaces.
 */
export function routeSurfaces(route: RouteState): Walkable[] {
    if (!route.crossing) return [];
    const z = PLANK_PLACEMENTS[route.crossing].position[2];

    return [
        {
            id: `crossing-${route.crossing}`,
            min: [-14, -0.855, z - 0.325],
            max: [-11.2, -0.855, z + 0.325],
            axis: 0,
            heightStart: -0.855,
            heightEnd: -0.855,
        },
    ];
}

const BOUNDARIES: Box[] = [
    { id: 'world-north', min: [-79, -3, 68], max: [79, 36, 69] },
    { id: 'world-south', min: [-79, -3, -69], max: [79, 36, -68] },
    { id: 'world-west', min: [-79, -3, -69], max: [-78, 36, 69] },
    { id: 'world-east', min: [78, -3, -69], max: [79, 36, 69] },
];

export const WALLS: Box[] = [
    ...WORLD_PLACEMENTS.flatMap((p) => p.solids),
    WATER_BOUNDS,
    ...BOUNDARIES,
];

// ponytail: 10cm strips approximate ramps within 1.3cm; use native convex ramps if this becomes visible in larger physics props.

const TERRAIN_BOXES: Box[] = WALKABLES.flatMap((s) => {
    const count
        = s.heightStart === s.heightEnd
            ? 1
            : Math.ceil((s.max[s.axis] - s.min[s.axis]) / 0.1);

    return Array.from({ length: count }, (_, index) => {
        const height
            = s.heightStart + ((s.heightEnd - s.heightStart) * (index + 0.5)) / count;
        const min: Vec3 = [s.min[0], height - 1, s.min[2]],
            max: Vec3 = [s.max[0], height, s.max[2]];

        min[s.axis] = s.min[s.axis] + ((s.max[s.axis] - s.min[s.axis]) * index) / count;
        max[s.axis]
            = s.min[s.axis] + ((s.max[s.axis] - s.min[s.axis]) * (index + 1)) / count;

        return { id: count === 1 ? s.id : `${s.id}-${index}`, min, max };
    });
});

export const PHYSICS_BOXES: Box[] = [...TERRAIN_BOXES, ...WALLS];
