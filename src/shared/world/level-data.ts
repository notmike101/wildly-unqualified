/** Equipment dimensions, game constants, and retained MVP landmarks. */
import type {
  Box,
  Habitat,
  FieldProp,
  Pose,
  PropDefinition,
  Vec3,
} from "../shared.ts";
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
/**
 * Create an identity-rotation equipment pose for the retained level catalog.
 *
 * @param position - World position
 * @returns Equipment pose retaining the supplied position reference.
 */
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
