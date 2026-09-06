/** Authored model collision catalog and world placement transforms. */
import type { Box, Vec3 } from "./shared.ts";
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
/**
 * Transform local box corners by yaw and translation and enclose them in a
 * world-axis-aligned box.
 *
 * @param id - Box identifier
 * @param position - Placement translation
 * @param yaw - Yaw in radians
 * @param min - Local minimum corner
 * @param max - Local maximum corner
 * @returns New world-space bounding box.
 */
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
/**
 * Resolve a known forest catalog model into a placement with collision solids and
 * applicable crown/arch occluders.
 *
 * @param id - Placement ID
 * @param model - Existing forest catalog model name
 * @param position - World position
 * @param yaw - Yaw in radians, default 0
 * @returns Placement retaining the supplied position reference.
 */
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
