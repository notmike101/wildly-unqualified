import type {
  Animal,
  Box,
  Habitat,
  FieldProp,
  FixtureState,
  Pose,
  PropDefinition,
  RouteState,
  Species,
  Vec3,
  Walkable,
} from "./shared.ts";
import type { Fixture } from "./world.ts";

function fixtureState(fixture: Fixture, states: FixtureState) {
  const state = states[fixture.id];
  if (
    !state ||
    typeof state.open !== "boolean" ||
    (fixture.kind === "gate"
      ? state.seat !== null
      : state.open
        ? typeof state.seat !== "string" ||
          !Object.hasOwn(fixture.seats, state.seat)
        : state.seat !== null)
  )
    throw Error(`Invalid fixture state: ${fixture.id}`);
  return state;
}

export function fixtureBoxes(fixtures: Fixture[], states: FixtureState): Box[] {
  return fixtures.flatMap((fixture) => {
    if (!fixtureState(fixture, states).open) return fixture.closedBoxes;
    if (fixture.kind !== "gate") return [];
    // The exported gate rotates around its local left hinge at X -2.2.
    const local: Vec3 = [-2.2, 0, -2.2],
      center: Vec3 = [
        fixture.position[0] +
          local[0] * Math.cos(fixture.yaw) +
          local[2] * Math.sin(fixture.yaw),
        fixture.position[1],
        fixture.position[2] -
          local[0] * Math.sin(fixture.yaw) +
          local[2] * Math.cos(fixture.yaw),
      ];
    return [
      worldBox(
        `${fixture.id}-leaf`,
        center,
        fixture.yaw + Math.PI / 2,
        [-2.15, 0.25, -0.06],
        [2.15, 1.45, 0.06],
      ),
    ];
  });
}

export function fixtureSurfaces(
  fixtures: Fixture[],
  states: FixtureState,
): Walkable[] {
  return fixtures.flatMap((fixture) =>
    fixtureState(fixture, states).open ? fixture.openSurfaces : [],
  );
}

export type WorldPlacement = {
  id: string;
  model: string;
  position: Vec3;
  yaw: number;
  scale: Vec3;
  solids: Box[];
  occluders: Box[];
};
export type NavNode = { id: string; position: Vec3; links: string[] };

export const CONTENT_VERSION = "forest-mvp-1" as const;
export const WORLD_BOUNDS: Box = {
  id: "world-bounds",
  min: [-78, -3, -68],
  max: [78, 36, 68],
};
export const CAMP: Vec3 = [-48, 0, 45];
export const WOODLAND: Vec3 = [-38, 0, 14];
export const WASHOUT: Vec3 = [-14, -1, 2];
export const CLEARING: Vec3 = [21, 0, 14];
export const WETLAND: Vec3 = [39, 0, -30];
export const WATER_BOUNDS: Box = {
  id: "pond",
  min: [41, -2, -47],
  max: [64, 0.5, -33],
};
export const HABITAT_SITES: Record<Habitat, [Vec3, Vec3]> = {
  woodland: [WOODLAND, [-31, 0, 7]],
  clearing: [CLEARING, [30, 0, 18]],
  wetland: [WETLAND, [47, 0, -30]],
};
export const WOODLAND_WASH_SITES: [Vec3, Vec3] = [
  [-36, 0, 11],
  [-29, 0, 7],
];
export const PATCH: Vec3 = [...WETLAND];
export const PERCHES: Vec3[] = [WETLAND, HABITAT_SITES.wetland[1]];
export const STASH: Vec3 = [35, 0, -28];
export const TIN_START: Vec3 = [-48, 0.109, 42];
export const TIN_HALF: Vec3 = [0.147, 0.109, 0.147];
export const PROP_CENTER_HEIGHT = {
  case: 0.325,
  plank: 0.095,
  screen: 0.97,
  decoy: 0.5,
} as const;
// Manifest model-root measurements converted once to body-local coordinates.
export const PROP_DEFINITIONS: Record<FieldProp["kind"], PropDefinition> = {
  case: {
    bounds: [
      [-0.778, -0.325, -0.3505],
      [0.778, 0.335, 0.325],
    ],
    solids: [{ center: [0, 0, 0], size: [1.3, 0.65, 0.65] }],
    handles: [
      [-0.75, 0.065, 0],
      [0.75, 0.065, 0],
    ],
    usePoints: [{ part: "lid", point: [0, 0.255, 0.325] }],
  },
  plank: {
    bounds: [
      [-1.6, -0.095, -0.325],
      [1.6, 0.093, 0.325],
    ],
    solids: [
      { center: [0, 0, 0], size: [3.2, 0.1, 0.65] },
      { center: [-1.48, -0.05, 0], size: [0.14, 0.09, 0.65] },
      { center: [1.48, -0.05, 0], size: [0.14, 0.09, 0.65] },
    ],
    handles: [
      [-1.43, 0.07, 0],
      [1.43, 0.07, 0],
    ],
  },
  screen: {
    bounds: [
      [-1.272, -0.97, -0.325],
      [1.272, 0.97, 0.325],
    ],
    solids: [
      { center: [0, -0.27, 0], size: [2.4, 1.02, 0.07] },
      { center: [0, 0.895, 0], size: [2.4, 0.15, 0.07] },
      { center: [-0.87, 0.53, 0], size: [0.66, 0.64, 0.07] },
      { center: [0.87, 0.53, 0], size: [0.66, 0.64, 0.07] },
      { center: [-1.1, -0.93, 0], size: [0.12, 0.08, 0.65] },
      { center: [-0.12, -0.93, 0], size: [0.12, 0.08, 0.65] },
      { center: [0.12, -0.93, 0], size: [0.12, 0.08, 0.65] },
      { center: [1.1, -0.93, 0], size: [0.12, 0.08, 0.65] },
    ],
    handles: [
      [-1.25, 0.08, 0.08],
      [1.25, 0.08, 0.08],
    ],
  },
  decoy: {
    bounds: [
      [-0.52, -0.5, -0.34],
      [0.45, 0.5, 0.3],
    ],
    solids: [{ center: [0, 0, 0], size: [0.8, 1, 0.55] }],
    handles: [[0, -0.05, 0.15]],
    usePoints: [{ part: "bait-cup", point: [0.28, -0.2, -0.23] }],
  },
};
export const PLANK_PLACEMENTS: Record<"left" | "right", Pose> = {
  left: { position: [-12.6, -0.905, 2], rotation: [0, 0, 0, 1] },
  right: { position: [-12.6, -0.905, 5], rotation: [0, 0, 0, 1] },
};
const propPose = (position: Vec3): Pose => ({
  position,
  rotation: [0, 0, 0, 1],
});
export const PROP_RECOVERY_POINTS: Record<FieldProp["kind"], Pose[]> = {
  case: (
    [
      [-46, 0.325, 43],
      [-20, 0.325, -6],
      [16, 0.325, 10],
      [33, 0.325, -25],
    ] as Vec3[]
  ).map(propPose),
  plank: [
    {
      position: [-20, -0.155, 3.5],
      rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
    },
    { position: [-20, 0.095, -6], rotation: [0, 0, 0, 1] },
    { position: [16, 0.095, 10], rotation: [0, 0, 0, 1] },
    { position: [33, 0.095, -25], rotation: [0, 0, 0, 1] },
  ],
  screen: (
    [
      [-46, 0.97, 47],
      [-20, 0.97, -6],
      [16, 0.97, 10],
      [33, 0.97, -25],
    ] as Vec3[]
  ).map(propPose),
  decoy: (
    [
      [-50, 0.5, 47],
      [-20, 0.5, -6],
      [16, 0.5, 10],
      [33, 0.5, -25],
    ] as Vec3[]
  ).map(propPose),
};

// Measured model-root proxies from assets/manifest-v3.json, validated against the exported GLBs.
export const FOREST_MODELS: Record<
  string,
  { bounds: [Vec3, Vec3]; solids: [Vec3, Vec3][] }
> = {
  // Retained v2 furniture; measured bounds from manifest-v2.json.
  CampTable: {
    bounds: [
      [-1.09, 0, -0.60054],
      [1.09, 0.83447, 0.60054],
    ],
    solids: [
      [
        [-1.09, 0, -0.60054],
        [1.09, 0.83447, 0.60054],
      ],
    ],
  },
  Bench: {
    bounds: [
      [-0.84, 0, -0.225],
      [0.84, 1.0496, 0.36212],
    ],
    solids: [
      [
        [-0.84, 0, -0.225],
        [0.84, 1.0496, 0.36212],
      ],
    ],
  },
  SupplyCrate: {
    bounds: [
      [-0.3485, 0, -0.2885],
      [0.3485, 0.5205, 0.2805],
    ],
    solids: [
      [
        [-0.3485, 0, -0.2885],
        [0.3485, 0.5205, 0.2805],
      ],
    ],
  },
  BoulderCluster: {
    bounds: [
      [-2.37621, 0, -1.03586],
      [2.5, 1.9, 1.73586],
    ],
    solids: [
      [
        [-2.5, 0, -0.95],
        [0, 1.8, 1.55],
      ],
      [
        [-1.25, 0, -0.95],
        [1.25, 1.8, 1.55],
      ],
      [
        [0, 0, -0.95],
        [2.5, 1.8, 1.55],
      ],
    ],
  },
  DryBankSlope: {
    bounds: [
      [-3.5, 0, -2],
      [3.5, 1.02, 1.8],
    ],
    solids: [],
  },
  FallenLogWhole: {
    bounds: [
      [-4.216, 0, -0.63993],
      [4.231, 1.95301, 0.63993],
    ],
    solids: [
      [
        [-4.2, 0, -0.5900000000000001],
        [4.2, 1.3, 0.71],
      ],
    ],
  },
  FernLargeA: {
    bounds: [
      [-1.21631, 0, -1.31615],
      [1.35, 1.12952, 1.31615],
    ],
    solids: [],
  },
  FernLargeB: {
    bounds: [
      [-1.16161, 0, -1.13608],
      [1.10709, 1.3479, 1.15185],
    ],
    solids: [],
  },
  ForestGate: {
    bounds: [
      [-2.465, 0, -0.12],
      [2.465, 2.1, 0.12],
    ],
    solids: [
      [
        [-2.4650000000000003, 0, -0.12],
        [-2.235, 2.1, 0.12],
      ],
      [
        [2.235, 0, -0.12],
        [2.4650000000000003, 2.1, 0.12],
      ],
    ],
  },
  HollowLog: {
    bounds: [
      [-3.9, 0, -0.723],
      [3.93, 1.97206, 0.723],
    ],
    solids: [
      [
        [-3.9, 0, -0.72],
        [3.9, 1.44, 0.72],
      ],
    ],
  },
  LeafMat: {
    bounds: [
      [-1.48871, 0, -1.45013],
      [1.4439, 0.047, 1.81265],
    ],
    solids: [],
  },
  LilyPatch: {
    bounds: [
      [-1.96751, 0, -1.8102],
      [2.17713, 0.018, 1.39579],
    ],
    solids: [],
  },
  MatureAlderA: {
    bounds: [
      [-8.05363, 0, -7.48881],
      [5.88685, 21, 7.32212],
    ],
    solids: [
      [
        [-0.8, 0, -0.8],
        [0.8, 6, 0.8],
      ],
    ],
  },
  MatureAlderB: {
    bounds: [
      [-6.021, 0, -6.7593],
      [7.65928, 23, 7.47797],
    ],
    solids: [
      [
        [-0.8, 0, -0.8],
        [0.8, 6, 0.8],
      ],
    ],
  },
  MatureCedarA: {
    bounds: [
      [-7.50991, 0, -5.1548],
      [7.35939, 26, 6.95867],
    ],
    solids: [
      [
        [-1.1, 0, -1.1],
        [1.1, 6, 1.1],
      ],
    ],
  },
  MatureCedarB: {
    bounds: [
      [-5.32338, 0, -5.14131],
      [7.15607, 28, 5.72729],
    ],
    solids: [
      [
        [-1.1, 0, -1.1],
        [1.1, 6, 1.1],
      ],
    ],
  },
  MatureOakA: {
    bounds: [
      [-7.08316, 0, -8.08326],
      [7.06575, 24, 6.86592],
    ],
    solids: [
      [
        [-1.1, 0, -1.1],
        [1.1, 6, 1.1],
      ],
    ],
  },
  MatureOakB: {
    bounds: [
      [-7.98466, 0, -7.57401],
      [8.98935, 27, 5.92975],
    ],
    solids: [
      [
        [-1.1, 0, -1.1],
        [1.1, 6, 1.1],
      ],
    ],
  },
  MaturePineA: {
    bounds: [
      [-5.8019, 0, -5.45898],
      [5.86158, 29, 4.47797],
    ],
    solids: [
      [
        [-0.8, 0, -0.8],
        [0.8, 6, 0.8],
      ],
    ],
  },
  MaturePineB: {
    bounds: [
      [-5.95787, 0, -5.87802],
      [5.83622, 32, 6.36844],
    ],
    solids: [
      [
        [-0.8, 0, -0.8],
        [0.8, 6, 0.8],
      ],
    ],
  },
  MossBoulderA: {
    bounds: [
      [-1.59748, 0, -1.42305],
      [1.7, 1.9, 1.42305],
    ],
    solids: [
      [
        [-1.7, 0, -1.7],
        [1.7, 1.8, 1.7],
      ],
    ],
  },
  MossBoulderB: {
    bounds: [
      [-1.12621, 0, -1.03586],
      [1.25, 1.9, 1.03586],
    ],
    solids: [
      [
        [-1.25, 0, -1.25],
        [1.25, 1.8, 1.25],
      ],
    ],
  },
  NeedleMat: {
    bounds: [
      [-1.59296, 0, -1.36317],
      [1.49783, 0.027, 1.73899],
    ],
    solids: [],
  },
  ReedBed: {
    bounds: [
      [-1.27887, 0, -0.60714],
      [1.22197, 2.30002, 0.92971],
    ],
    solids: [],
  },
  RootArch: {
    bounds: [
      [-2.93945, 0, -0.8296],
      [2.93945, 4.0043, 0.8296],
    ],
    solids: [
      [
        [-2.9, 0, -0.5],
        [-1.9, 2.4, 0.5],
      ],
      [
        [1.9, 0, -0.5],
        [2.9, 2.4, 0.5],
      ],
    ],
  },
  RootPlate: {
    bounds: [
      [-0.45563, 0, -2.57922],
      [2.72155, 3.5707, 2.57922],
    ],
    solids: [
      [
        [-0.5, 0, -1.8],
        [0.5, 3, 1.8],
      ],
    ],
  },
  RootSpread: {
    bounds: [
      [-2.20265, 0, -1.80329],
      [1.80344, 0.23397, 2.20248],
    ],
    solids: [],
  },
  SedgeClump: {
    bounds: [
      [-0.77573, 0, -0.27044],
      [0.74965, 0.9514, 0.57989],
    ],
    solids: [],
  },
  SnagForked: {
    bounds: [
      [-1.61099, 0, -2.01011],
      [2.60776, 11.84, 1.67077],
    ],
    solids: [
      [
        [-0.8, 0, -0.8],
        [0.8, 6, 0.8],
      ],
    ],
  },
  SnagTall: {
    bounds: [
      [-1.61099, 0, -2.01011],
      [2.10776, 13.03312, 1.67078],
    ],
    solids: [
      [
        [-0.8, 0, -0.8],
        [0.8, 6, 0.8],
      ],
    ],
  },
  TrailBoard: {
    bounds: [
      [-1.12, 0, -0.3],
      [1.12, 2.42, 0.26],
    ],
    solids: [
      [
        [-1, 0, -0.15],
        [1, 2.4, 0.15],
      ],
    ],
  },
  WetBankShelf: {
    bounds: [
      [-3, 0, -2],
      [3, 1.02, 1.8],
    ],
    solids: [],
  },
};
export function worldBox(
  id: string,
  position: Vec3,
  yaw: number,
  min: Vec3,
  max: Vec3,
): Box {
  const corners = [min[0], max[0]].flatMap((x) =>
    [min[2], max[2]].map((z) => [
      position[0] + x * Math.cos(yaw) + z * Math.sin(yaw),
      position[2] - x * Math.sin(yaw) + z * Math.cos(yaw),
    ]),
  );
  return {
    id,
    min: [
      Math.min(...corners.map((p) => p[0])),
      position[1] + min[1],
      Math.min(...corners.map((p) => p[1])),
    ],
    max: [
      Math.max(...corners.map((p) => p[0])),
      position[1] + max[1],
      Math.max(...corners.map((p) => p[1])),
    ],
  };
}
export function placement(
  id: string,
  model: string,
  position: Vec3,
  yaw = 0,
): WorldPlacement {
  const p = FOREST_MODELS[model];
  const solids = p.solids.map(([min, max], i) =>
    worldBox(id + "-solid-" + i, position, yaw, min, max),
  );
  const occluders: Box[] = [];
  if (
    model.startsWith("Mature") ||
    model.startsWith("Snag") ||
    model === "RootArch"
  )
    occluders.push(
      worldBox(
        id + "-crown",
        position,
        yaw,
        [p.bounds[0][0], model === "RootArch" ? 2.4 : 6, p.bounds[0][2]],
        p.bounds[1],
      ),
    );
  return { id, model, position, yaw, scale: [1, 1, 1], solids, occluders };
}
const tree = (
  id: string,
  model: string,
  position: Vec3,
  _height: number,
  yaw = 0,
) => placement(id, model, position, yaw);
const FEATURE_PLACEMENTS: WorldPlacement[] = [
  placement("camp-table", "CampTable", [-53, 0, 44]),
  placement("camp-bench", "Bench", [-53, 0, 46], Math.PI),
  placement("camp-supplies", "SupplyCrate", [-53.8, 0, 45.2]),
  placement("pine-a", "MaturePineA", [-70, 0, 34], 0),
  placement("pine-b", "MaturePineB", [-70, 0, 7], 0),
  placement("cedar-a", "MatureCedarA", [-54, 0, -24], 0),
  placement("cedar-b", "MatureCedarB", [-35, 0, -31], 0),
  placement("oak-a", "MatureOakA", [8, 0, 40], 0),
  placement("oak-b", "MatureOakB", [35, 0, 36], 0),
  placement("alder-a", "MatureAlderA", [55, 0, -10], 0),
  placement("alder-b", "MatureAlderB", [58, 0, -46], 0),
  placement("snag-tall", "SnagTall", [-57, 0, 20], 0),
  placement("snag-forked", "SnagForked", [-43, 0, -10], 0),
  placement("fallen-log", "FallenLogWhole", [-30, 0, 25], 0),
  placement("hollow-log", "HollowLog", [8, 0, 29], 0.35),
  placement("root-plate", "RootPlate", [49, 0, -17], 0),
  placement("moss-boulder-a", "MossBoulderA", [-30, 0, 1], 0),
  placement("moss-boulder-b", "MossBoulderB", [-2, 0, 20], 0),
  placement("boulder-cluster", "BoulderCluster", [15, 0, -5], 0),
  placement("root-arch", "RootArch", [-8, 0, -14], 0),
  placement("wet-bank", "WetBankShelf", [38, 0, -39], 0),
  placement("dry-bank", "DryBankSlope", [-4, 0, 30], 0),
  placement("fern-a", "FernLargeA", [-41, 0, 4], 0),
  placement("fern-b", "FernLargeB", [27, 0, 22], 0),
  placement("leaf-mat", "LeafMat", [-35, 0.01, 18], 0),
  placement("needle-mat", "NeedleMat", [-52, 0.01, 31], 0),
  placement("root-spread", "RootSpread", [44, 0.01, -22], 0),
  placement("reed-bed", "ReedBed", [47, -0.25, -29], 0),
  placement("lily-patch", "LilyPatch", [42, -0.3, -39], 0),
  placement("sedge-clump", "SedgeClump", [34, 0, -34], 0),
  placement("forest-gate", "ForestGate", [-44.8, 0, 31], -0.3805063771123649),
  placement("trail-board", "TrailBoard", [-36, 0, 23], 0),
];

export const WALKABLES: Walkable[] = [
  {
    id: "terrain-west",
    min: [-78, 0, -68],
    max: [-21.5, 0, 68],
    axis: 0,
    heightStart: 0,
    heightEnd: 0,
  },
  {
    id: "terrain-east",
    min: [-6.5, 0, -68],
    max: [78, 0, 68],
    axis: 0,
    heightStart: 0,
    heightEnd: 0,
  },
  {
    id: "terrain-north",
    min: [-22, 0, 8],
    max: [-6, 0, 68],
    axis: 0,
    heightStart: 0,
    heightEnd: 0,
  },
  {
    id: "terrain-south",
    min: [-22, 0, -68],
    max: [-6, 0, -10],
    axis: 0,
    heightStart: 0,
    heightEnd: 0,
  },
  {
    id: "dry-detour",
    min: [-22, 0, -10],
    max: [-6, 0, -4],
    axis: 0,
    heightStart: 0,
    heightEnd: 0,
  },
  {
    id: "washout-west-bank",
    min: [-22, -1, -2],
    max: [-14, 0, 6],
    axis: 0,
    heightStart: 0,
    heightEnd: -1,
  },
  {
    id: "washout-east-bank",
    min: [-11.2, -1, -2],
    max: [-6, 0, 6],
    axis: 0,
    heightStart: -1,
    heightEnd: 0,
  },
];
for (const bank of FEATURE_PLACEMENTS.filter(
  (p) => p.model === "WetBankShelf" || p.model === "DryBankSlope",
)) {
  const [min, max] = FOREST_MODELS[bank.model].bounds;
  WALKABLES.push({
    id: bank.id + "-ramp",
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
    id: "main-route",
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
    id: "dry-washout-detour",
    points: [
      [-22, 0, 2],
      [-22, 0, -6],
      [-6, 0, -6],
      [-6, 0, 2],
    ],
    width: 4,
  },
  {
    id: "west-return",
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
const segmentDistance = (point: Vec3, a: Vec3, b: Vec3) => {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    t = Math.max(
      0,
      Math.min(
        1,
        ((point[0] - a[0]) * dx + (point[2] - a[2]) * dz) /
          (dx * dx + dz * dz || 1),
      ),
    ),
    x = a[0] + dx * t,
    z = a[2] + dz * t;
  return Math.hypot(point[0] - x, point[2] - z);
};
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
      ([center, radius]) =>
        Math.hypot(point[0] - center[0], point[2] - center[2]) > radius,
    ) &&
    !(
      point[0] > WATER_BOUNDS.min[0] - 3 &&
      point[0] < WATER_BOUNDS.max[0] + 3 &&
      point[2] > WATER_BOUNDS.min[2] - 3 &&
      point[2] < WATER_BOUNDS.max[2] + 3
    ) &&
    TRAILS.every((trail) =>
      trail.points
        .slice(1)
        .every(
          (end, i) =>
            segmentDistance(point, trail.points[i], end) >
            trail.width / 2 + 2.2,
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
      const oak = (row + column) % 5 === 0;
      const variants =
        point[2] < -20 && point[0] > 25
          ? ["MatureAlderA", "MatureAlderB", "MatureCedarA"]
          : point[0] > 0
            ? ["MatureOakA", "MatureOakB", "MaturePineB"]
            : ["MaturePineA", "MaturePineB", "MatureCedarA", "MatureCedarB"];
      STAND_TREES.push(
        tree(
          `stand-${String(STAND_TREES.length + 1).padStart(3, "0")}`,
          variants[(row + column * 3) % variants.length],
          point,
          oak ? 24 : 29,
          (((row * 11 + column * 7) % 24) * Math.PI) / 12,
        ),
      );
    }
  }
const FLOOR_PLACEMENTS: WorldPlacement[] = [];
for (const [i, t] of STAND_TREES.entries()) {
  FLOOR_PLACEMENTS.push(
    placement(
      "floor-" + i,
      t.model.includes("Oak") ? "LeafMat" : "NeedleMat",
      [t.position[0], 0.01, t.position[2]],
      t.yaw,
    ),
  );
  for (const n of [0, 1]) {
    const angle = i * 2.4 + n * 2.1;
    const p: Vec3 = [
      t.position[0] + Math.cos(angle) * 3.5,
      0,
      t.position[2] + Math.sin(angle) * 3.5,
    ];
    if (clearForTree(p))
      FLOOR_PLACEMENTS.push(
        placement(
          "fern-" + i + "-" + n,
          (i + n) % 2 ? "FernLargeA" : "FernLargeB",
          p,
          angle,
        ),
      );
  }
}
for (let i = 0; i < 14; i++) {
  FLOOR_PLACEMENTS.push(
    placement(
      "water-edge-" + i,
      i % 2 ? "ReedBed" : "SedgeClump",
      [43 + i * 1.35, -0.05, -46],
      i,
    ),
  );
  if (i % 3 === 0)
    FLOOR_PLACEMENTS.push(
      placement("lilies-" + i, "LilyPatch", [45 + i, -0.05, -40], i),
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
    let node = NAV_NODES.find((n) =>
      n.position.every((v, i) => v === point[i]),
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
  ["woodland", HABITAT_SITES.woodland[0]],
  ["woodland-alt", HABITAT_SITES.woodland[1]],
  ["clearing", HABITAT_SITES.clearing[0]],
  ["clearing-alt", HABITAT_SITES.clearing[1]],
  ["wetland", HABITAT_SITES.wetland[0]],
  ["wetland-alt", HABITAT_SITES.wetland[1]],
  ["woodland-wash", WOODLAND_WASH_SITES[0]],
  ["woodland-wash-alt", WOODLAND_WASH_SITES[1]],
  ["stash", STASH],
  ["crossing-right-west", [-14, -1, 5]],
  ["crossing-right-east", [-11.2, -1, 5]],
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

export function routeBoxes(route: RouteState): Box[] {
  const gate = FEATURE_PLACEMENTS.find((p) => p.model === "ForestGate")!;
  const angle = route.gateOpen ? Math.PI / 2 : 0,
    hinge: Vec3 = [-2.2, 0.9, 0],
    offset: Vec3 = [2.2 * Math.cos(angle), -0.05, -2.2 * Math.sin(angle)],
    center: Vec3 = [
      gate.position[0] +
        (hinge[0] + offset[0]) * Math.cos(gate.yaw) +
        (hinge[2] + offset[2]) * Math.sin(gate.yaw),
      gate.position[1] + hinge[1] + offset[1],
      gate.position[2] -
        (hinge[0] + offset[0]) * Math.sin(gate.yaw) +
        (hinge[2] + offset[2]) * Math.cos(gate.yaw),
    ];
  return [
    worldBox(
      "gate-leaf",
      center,
      gate.yaw + angle,
      [-2.15, -0.6, -0.06],
      [2.15, 0.6, 0.06],
    ),
  ];
}
export function gateLatch(route: RouteState): Vec3 {
  const gate = FEATURE_PLACEMENTS.find((p) => p.model === "ForestGate")!,
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
    gate.position[0] +
      point[0] * Math.cos(gate.yaw) +
      point[2] * Math.sin(gate.yaw),
    gate.position[1] + point[1],
    gate.position[2] -
      point[0] * Math.sin(gate.yaw) +
      point[2] * Math.cos(gate.yaw),
  ];
}
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
  { id: "world-north", min: [-79, -3, 68], max: [79, 36, 69] },
  { id: "world-south", min: [-79, -3, -69], max: [79, 36, -68] },
  { id: "world-west", min: [-79, -3, -69], max: [-78, 36, 69] },
  { id: "world-east", min: [78, -3, -69], max: [79, 36, 69] },
];
export const WALLS: Box[] = [
  ...WORLD_PLACEMENTS.flatMap((p) => p.solids),
  WATER_BOUNDS,
  ...BOUNDARIES,
];
// ponytail: 10cm strips approximate ramps within 1.3cm; use native convex ramps if this becomes visible in larger physics props.
const TERRAIN_BOXES: Box[] = WALKABLES.flatMap((s) => {
  const count =
    s.heightStart === s.heightEnd
      ? 1
      : Math.ceil((s.max[s.axis] - s.min[s.axis]) / 0.1);
  return Array.from({ length: count }, (_, i) => {
    const height =
      s.heightStart + ((s.heightEnd - s.heightStart) * (i + 0.5)) / count;
    const min: Vec3 = [s.min[0], height - 1, s.min[2]],
      max: Vec3 = [s.max[0], height, s.max[2]];
    min[s.axis] = s.min[s.axis] + ((s.max[s.axis] - s.min[s.axis]) * i) / count;
    max[s.axis] =
      s.min[s.axis] + ((s.max[s.axis] - s.min[s.axis]) * (i + 1)) / count;
    return { id: count === 1 ? s.id : `${s.id}-${i}`, min, max };
  });
});
export const PHYSICS_BOXES: Box[] = [...TERRAIN_BOXES, ...WALLS];

export const ASSIGNMENTS = {
  "raccoon-inspect": "Caught in the act",
  "heron-display": "A little dignity",
  "pond-pair": "An unlikely friendship",
  "raccoon-wash": "Waterside wash",
  "deer-graze": "Quiet grazer",
  "deer-decoy": "Double take",
  "heron-preen": "Feather maintenance",
} as const;
export const RULES = {
  lureRadius: 12,
  inspectSeconds: 4,
  quietSeconds: 5,
  displaySeconds: 6,
  noiseRadius: 8,
  shyRadius: 3,
  whistleCooldown: 3,
  lureCommitSeconds: 2,
  photoCooldown: 1,
};
export const SUBJECT_POINTS: Record<Species, Vec3[]> = {
  raccoon: [
    [-0.15, 0.35, -0.2],
    [0.15, 0.35, -0.2],
    [0, 0.6, -0.4],
  ],
  heron: [
    [0, 0.2, 0],
    [0, 0.9, -0.05],
    [0, 1.45, -0.1],
  ],
  deer: [
    [0, 1.12, 0.1],
    [0, 1.64, -0.83],
  ],
};
export const SUBJECT_HEIGHT: Record<Species, number> = {
  raccoon: 0.703,
  heron: 1.56,
  deer: 1.9,
};
export const CLUES: {
  id: string;
  title: string;
  position: Vec3;
  text: string;
}[] = [
  {
    id: "tracks",
    title: "Little muddy fingerprints",
    position: [-41, 0, 18],
    text: "These tracks lead into the woodland. Rattle and place the open tin. The raccoon inspects for four seconds before stealing it.",
  },
  {
    id: "notebook",
    title: "An abandoned field notebook",
    position: [-27, 0, -6],
    text: "A previous crew followed their stolen supplies to a woodland stash. The same tin can be reclaimed there.",
  },
  {
    id: "nest",
    title: "Feathers by an empty nest",
    position: [44, 0, -33],
    text: "Herons settle after five quiet seconds. Put bait near the wetland; running, whistles and a nearby raccoon interrupt them.",
  },
  {
    id: "blind",
    title: "The observation shelter",
    position: [30, 0, -2],
    text: "This angle fits the wetland and clearing. Keep the raccoon three to eight metres from the displaying heron for the shared portrait.",
  },
];

export function animalArticulation(animal: Animal, tick: number) {
  const time = tick / 60;
  return {
    neckX:
      animal.species === "deer" && animal.behavior === "graze"
        ? -0.7 + 0.035 * Math.sin(time * 3)
        : 0,
    headX:
      (animal.species === "raccoon" &&
        ["inspect", "wash"].includes(animal.behavior)) ||
      (animal.species === "heron" && animal.behavior === "feed")
        ? -(0.2 + 0.12 * Math.sin(time * 3))
        : animal.species === "raccoon" && animal.behavior === "hat-reach"
          ? 0.3
          : 0,
    headY:
      animal.behavior === "alert" ||
      (animal.species === "deer" && animal.behavior === "settle")
        ? 0.3 * Math.sin(time * 1.5)
        : animal.species === "heron" && animal.behavior === "preen"
          ? 0.65 + 0.12 * Math.sin(time * 2)
          : 0,
  };
}
export function subjectPoints(animal: Animal, tick: number): Vec3[] {
  const points = SUBJECT_POINTS[animal.species].map((p) => [...p] as Vec3);
  if (animal.species !== "deer") {
    const pivot: Vec3 =
        animal.species === "raccoon" ? [0, 0.45, -0.26] : [0, 1.446, -0.3],
      p = points[2],
      { headX, headY } = animalArticulation(animal, tick),
      x = p[0] - pivot[0],
      y = p[1] - pivot[1],
      z = p[2] - pivot[2],
      rx = x * Math.cos(headY) + z * Math.sin(headY),
      rz = -x * Math.sin(headY) + z * Math.cos(headY);
    p[0] = pivot[0] + rx;
    p[1] = pivot[1] + y * Math.cos(headX) - rz * Math.sin(headX);
    p[2] = pivot[2] + y * Math.sin(headX) + rz * Math.cos(headX);
  }
  if (animal.species === "deer") {
    const { neckX, headY } = animalArticulation(animal, tick),
      p = points[1],
      head: Vec3 = [0, 1.6, -0.74],
      neck: Vec3 = [0, 1.2, -0.46],
      x = p[0] - head[0],
      z = p[2] - head[2];
    p[0] = head[0] + x * Math.cos(headY) + z * Math.sin(headY);
    p[2] = head[2] - x * Math.sin(headY) + z * Math.cos(headY);
    const y = p[1] - neck[1],
      nz = p[2] - neck[2];
    p[1] = neck[1] + y * Math.cos(neckX) - nz * Math.sin(neckX);
    p[2] = neck[2] + y * Math.sin(neckX) + nz * Math.cos(neckX);
  }
  return points;
}
