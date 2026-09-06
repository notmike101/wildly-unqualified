import type { Box, Pose, Vec3, Walkable } from "./shared.ts";
import { rayBlocked } from "./shared.ts";
import {
  FOREST_MODELS,
  placement,
  worldBox,
  PROP_CENTER_HEIGHT,
  PROP_DEFINITIONS,
  TIN_HALF,
  type NavNode,
  type WorldPlacement,
} from "./level.ts";

export const RESERVE_SPECIES = [
  "raccoon",
  "deer",
  "heron",
  "fox",
  "rabbit",
  "squirrel",
  "beaver",
  "otter",
  "badger",
  "owl",
  "woodpecker",
  "mallard",
] as const;
export type ReserveSpecies = (typeof RESERVE_SPECIES)[number];
export type Anchor = {
  id: string;
  point: Vec3;
  kind:
    | "ground"
    | "water"
    | "perch"
    | "wash"
    | "feed"
    | "rest"
    | "retreat"
    | "passage"
    | "cache"
    | "den";
  links: string[];
};
export type Resident = {
  id: string;
  species: ReserveSpecies;
  home: string;
  spawn: Vec3;
  anchors: string[];
  group: string | null;
};
export type Commission = {
  id: string;
  required: boolean;
  kind:
    | "behavior"
    | "setup"
    | "composition"
    | "passage"
    | "pair"
    | "cameo"
    | "incident";
  subjects: string[];
  pocket: string;
  anchor: string | null;
  landmark: string | null;
  behavior: string | null;
  title: string;
  instructions: string;
};
export type Fixture = {
  id: string;
  kind: "gate" | "crossing";
  position: Vec3;
  yaw: number;
  closedBoxes: Box[];
  openSurfaces: Walkable[];
  seats: Record<string, Pose>;
  plankId: string | null;
  latch: Vec3 | null;
};
export type ReserveBlueprint = {
  id: string;
  content: "forest-expedition-1";
  seed: number;
  attempt: number;
  bounds: Box;
  camp: Vec3;
  tinStart: Vec3;
  pockets: {
    id: string;
    habitat: "woodland" | "clearing" | "wetland";
    position: Vec3;
    anchors: Anchor[];
  }[];
  stations: { id: string; position: Vec3; recover: Vec3 }[];
  density: {
    id: string;
    min: Vec3;
    max: Vec3;
    kind: "dense" | "light" | "open";
  }[];
  placements: WorldPlacement[];
  walkables: Walkable[];
  waters: Box[];
  trails: { id: string; points: Vec3[]; width: number }[];
  navNodes: NavNode[];
  walls: Box[];
  physicsBoxes: Box[];
  fixtures: Fixture[];
  residents: Resident[];
  commissions: Commission[];
  props: {
    id: string;
    kind: "case" | "plank" | "screen" | "decoy";
    pose: Pose;
  }[];
};
export const BLUEPRINT_LIMIT = 1024 * 1024;
// Versioned, species-specific repeatable routines, also consumed by encounters.
export const RESERVE_ROUTINES: Record<
  ReserveSpecies,
  { behavior: string; anchor: Anchor["kind"]; kinds: Anchor["kind"][] }
> = {
  raccoon: {
    behavior: "wash",
    anchor: "wash",
    kinds: ["ground", "feed", "wash", "retreat"],
  },
  deer: {
    behavior: "graze",
    anchor: "feed",
    kinds: ["ground", "feed", "passage", "retreat"],
  },
  heron: {
    behavior: "preen",
    anchor: "rest",
    kinds: ["ground", "water", "feed", "rest", "retreat"],
  },
  fox: {
    behavior: "pounce",
    anchor: "passage",
    kinds: ["ground", "passage", "rest", "retreat"],
  },
  rabbit: {
    behavior: "nibble",
    anchor: "feed",
    kinds: ["ground", "feed", "rest", "retreat"],
  },
  squirrel: {
    behavior: "cache",
    anchor: "cache",
    kinds: ["ground", "perch", "cache", "retreat"],
  },
  beaver: {
    behavior: "gnaw",
    anchor: "feed",
    kinds: ["ground", "water", "feed", "den", "retreat"],
  },
  otter: {
    behavior: "groom",
    anchor: "rest",
    kinds: ["ground", "water", "rest", "retreat"],
  },
  badger: {
    behavior: "dig",
    anchor: "den",
    kinds: ["ground", "den", "passage", "retreat"],
  },
  owl: {
    behavior: "roost",
    anchor: "perch",
    kinds: ["perch", "rest", "retreat"],
  },
  woodpecker: {
    behavior: "tap",
    anchor: "perch",
    kinds: ["perch", "rest", "retreat"],
  },
  mallard: {
    behavior: "dabble",
    anchor: "water",
    kinds: ["ground", "water", "feed", "rest", "retreat"],
  },
};
const PAIRS: ReserveSpecies[][] = [
  ["raccoon", "heron"],
  ["deer", "rabbit"],
  ["beaver", "mallard"],
];
const round = (n: number) => Math.round(n * 100000) / 100000;
const point = (x: number, y: number, z: number): Vec3 => [
  round(x),
  round(y),
  round(z),
];
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const pose = (position: Vec3, yaw = 0): Pose => ({
  position,
  rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
});
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Invalid reserve: ${message}`);
}
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function placed(id: string, model: string, p: Vec3, yaw = 0) {
  const v = placement(id, model, p, yaw);
  for (const box of [...v.solids, ...v.occluders]) {
    box.min = box.min.map(round) as Vec3;
    box.max = box.max.map(round) as Vec3;
  }
  return v;
}
function contains(box: Pick<Box, "min" | "max">, p: Vec3, margin = 0) {
  return (
    p[0] >= box.min[0] + margin &&
    p[0] <= box.max[0] - margin &&
    p[2] >= box.min[2] + margin &&
    p[2] <= box.max[2] - margin
  );
}
// Slab intersection against an expanded AABB checks the whole swept equipment box, including corners.
export function corridorBlocked(
  a: Vec3,
  b: Vec3,
  boxes: Box[],
  halfWidth = 2,
  height = 6,
): boolean {
  return boxes.some((box) => {
    if (
      box.max[1] <= Math.min(a[1], b[1]) + 0.01 ||
      box.min[1] >= Math.max(a[1], b[1]) + height
    )
      return false;
    let lo = 0,
      hi = 1;
    for (const axis of [0, 2] as const) {
      const d = b[axis] - a[axis],
        min = box.min[axis] - halfWidth,
        max = box.max[axis] + halfWidth;
      if (Math.abs(d) < 1e-9) {
        if (a[axis] <= min || a[axis] >= max) return false;
      } else {
        const u = (min - a[axis]) / d,
          v = (max - a[axis]) / d;
        lo = Math.max(lo, Math.min(u, v));
        hi = Math.min(hi, Math.max(u, v));
        if (lo >= hi) return false;
      }
    }
    return lo < hi;
  });
}
export function reserveApproaches(
  world: ReserveBlueprint,
  pocket: string,
): NavNode[] {
  return world.navNodes.filter((n) => n.id.startsWith(`${pocket}-camera-`));
}
export function commissionRequirements(world: ReserveBlueprint, c: Commission) {
  const species = world.residents.find((r) => r.id === c.subjects[0])?.species;
  const tools: ("tin" | "screen" | "decoy")[] =
    c.kind === "setup"
      ? ["tin", "screen", "decoy"]
      : c.kind === "behavior" && species === "raccoon"
        ? ["tin"]
        : [];
  return {
    tools,
    cameraNodes: reserveApproaches(world, c.pocket)
      .filter((n) => {
        const a = world.pockets
          .flatMap((p) => p.anchors)
          .find((a) => a.id === c.anchor);
        return a && species && reserveCameraFits(n.position, a.point, species);
      })
      .map((n) => n.id),
    renewableAt: world.stations.map((s) => s.id),
  };
}
// Neutral exported heights from manifest-v3 and the v4 wildlife manifest (2b5c444).
export const RESERVE_SUBJECT_HEIGHT: Record<ReserveSpecies, number> = {
  raccoon: 0.703,
  deer: 1.9,
  heron: 1.56,
  fox: 0.965,
  rabbit: 0.77,
  squirrel: 0.7,
  beaver: 0.555,
  otter: 0.385,
  badger: 0.551,
  owl: 0.79043,
  woodpecker: 0.485,
  mallard: 0.623,
};
export function reserveCameraFits(
  camera: Vec3,
  target: Vec3,
  species: ReserveSpecies,
): boolean {
  const horizontal = distance(camera, target),
    height = RESERVE_SUBJECT_HEIGHT[species],
    dy = target[1] + height / 2 - (camera[1] + 1.6),
    pitch = Math.atan2(dy, horizontal);
  const projected = [0, height].map((y) => {
    const vertical = target[1] + y - (camera[1] + 1.6);
    return (
      (-horizontal * Math.sin(pitch) + vertical * Math.cos(pitch)) /
      ((horizontal * Math.cos(pitch) + vertical * Math.sin(pitch)) *
        Math.tan(Math.PI / 6))
    );
  });
  return horizontal >= 3 && Math.abs(projected[1] - projected[0]) / 2 >= 0.03;
}
export function reserveCanopyCoverage(world: ReserveBlueprint): number {
  const crowns = world.placements
    .filter((p) => p.model.startsWith("Mature"))
    .flatMap((p) => p.occluders);
  let land = 0,
    covered = 0;
  // ponytail: four-metre sampling of catalog crown proxies; rendered crown silhouettes remain a visual acceptance gate.
  for (let z = world.bounds.min[2] + 2; z < world.bounds.max[2]; z += 4)
    for (let x = world.bounds.min[0] + 2; x < world.bounds.max[0]; x += 4) {
      const p: Vec3 = [x, 0, z];
      if (
        !world.density.some((d) => d.kind === "dense" && contains(d, p)) ||
        world.waters.some((w) => contains(w, p))
      )
        continue;
      land++;
      if (crowns.some((c) => contains(c, p))) covered++;
    }
  return covered / land;
}
function boundaries(): Box[] {
  return [
    { id: "boundary-west", min: [-192, -4, -160], max: [-191.8, 36, 160] },
    { id: "boundary-east", min: [191.8, -4, -160], max: [192, 36, 160] },
    { id: "boundary-south", min: [-192, -4, -160], max: [192, 36, -159.8] },
    { id: "boundary-north", min: [-192, -4, 159.8], max: [192, 36, 160] },
  ];
}
function waterBeds(waters: Box[]): Box[] {
  return waters.map((b) => ({
    id: b.id + "-bed",
    min: point(b.min[0], b.min[1] - 1, b.min[2]),
    max: point(b.max[0], b.min[1], b.max[2]),
  }));
}
function ground(world: ReserveBlueprint, p: Vec3, margin = 0) {
  return world.walkables.some(
    (s) =>
      contains(s, p, margin) &&
      Math.abs(p[1] - s.heightStart) < 1e-6 &&
      s.heightStart === s.heightEnd,
  );
}
function terrain(waters: Box[]): Walkable[] {
  const xs = [
      ...new Set([-192, 192, ...waters.flatMap((w) => [w.min[0], w.max[0]])]),
    ].sort((a, b) => a - b),
    result: Walkable[] = [];
  for (let i = 1; i < xs.length; i++) {
    const ponds = waters
      .filter((w) => w.min[0] < xs[i] && w.max[0] > xs[i - 1])
      .sort((a, b) => a.min[2] - b.min[2]);
    let z = -160;
    for (const pond of [...ponds, { min: [0, 0, 160], max: [0, 0, 160] }]) {
      if (pond.min[2] > z)
        result.push({
          id: `ground-${result.length}`,
          min: [xs[i - 1], 0, z],
          max: [xs[i], 0, pond.min[2]],
          axis: 0,
          heightStart: 0,
          heightEnd: 0,
        });
      z = Math.max(z, pond.max[2]);
    }
  }
  return result;
}
function transformPoint(position: Vec3, yaw: number, p: Vec3): Vec3 {
  return point(
    position[0] + p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw),
    position[1] + p[1],
    position[2] - p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw),
  );
}
// Measured downward contacts on forest-kit-v3.glb RootArch, SHA-256 fa56fdf272282db3de69a9b1910b9a8d82d465022a8b308855bf60f5cafc63d4.
// These are curved exported surfaces, not the catalog AABB top. The mesh regression checks all quarter turns.
const ROOT_ARCH_CONTACTS: Vec3[] = [
  [-0.9, 3.72163, 0.35],
  [-0.3, 3.84199, 0.35],
  [0.3, 3.86264, 0.35],
  [0.9, 3.57587, 0.35],
];
function archContacts(p: WorldPlacement): Vec3[] {
  return ROOT_ARCH_CONTACTS.map((c) => transformPoint(p.position, p.yaw, c));
}
function fixture(
  id: string,
  kind: Fixture["kind"],
  position: Vec3,
  yaw: number,
  plankId: string | null,
): Fixture {
  if (kind === "gate")
    return {
      id,
      kind,
      position,
      yaw,
      closedBoxes: [
        worldBox(
          id + "-leaf",
          position,
          yaw,
          [-2.15, 0.25, -0.06],
          [2.15, 1.45, 0.06],
        ),
      ],
      openSurfaces: [],
      seats: {},
      plankId: null,
      latch: transformPoint(position, yaw, [2, 1.25, 0]),
    };
  const seat = pose(transformPoint(position, yaw, [0, 0.105, 0]), yaw),
    [min, max] = PROP_DEFINITIONS.plank.bounds;
  const deck = worldBox(
    id + "-deck",
    seat.position,
    yaw,
    [min[0], max[1], min[2]],
    max,
  );
  return {
    id,
    kind,
    position,
    yaw,
    closedBoxes: [],
    openSurfaces: [
      {
        ...deck,
        axis: Math.abs(Math.cos(yaw)) > 0.5 ? 0 : 2,
        heightStart: deck.min[1],
        heightEnd: deck.max[1],
      },
    ],
    seats: { left: seat },
    plankId,
    latch: null,
  };
}
function build(seed: number, id: string, attempt: number): ReserveBlueprint {
  const random = rng(seed ^ Math.imul(attempt, 0x9e3779b9)),
    w: ReserveBlueprint = {
      id,
      content: "forest-expedition-1",
      seed,
      attempt,
      bounds: { id: "bounds", min: [-192, -4, -160], max: [192, 36, 160] },
      camp: [seed & 1 ? -174 : 174, 0, 32],
      tinStart: [seed & 1 ? -174 : 174, 0.109, 35],
      pockets: [],
      stations: [],
      density: [],
      placements: [],
      walkables: [],
      waters: [],
      trails: [],
      navNodes: [],
      walls: [],
      physicsBoxes: [],
      fixtures: [],
      residents: [],
      commissions: [],
      props: [],
    };
  const cells: Vec3[] = [
    [-128, 0, -96],
    [0, 0, -96],
    [128, 0, -96],
    [128, 0, 32],
    [128, 0, 96],
    [0, 0, 96],
    [-128, 0, 96],
    [-128, 0, 32],
  ];
  cells[1][0] = (Math.floor(random() * 3) - 1) * 64;
  cells[5][0] = (Math.floor(random() * 3) - 1) * 64;
  cells[3][2] = random() < 0.5 ? -32 : 32;
  cells[7][2] = random() < 0.5 ? -32 : 32;
  const families = shuffle<ReserveSpecies[]>(
    [
      ...PAIRS,
      ["fox"],
      ["squirrel"],
      ["otter"],
      ["badger"],
      ["owl", "woodpecker"],
    ],
    random,
  );
  const addNode = (id: string, p: Vec3) => {
    w.navNodes.push({ id, position: p, links: [] });
    return id;
  };
  const link = (a: string, b: string) => {
    const n = w.navNodes.find((n) => n.id === a)!,
      m = w.navNodes.find((n) => n.id === b)!;
    if (!n.links.includes(b)) {
      n.links.push(b);
      m.links.push(a);
      w.trails.push({
        id: `path-${w.trails.length}`,
        points: [n.position, m.position],
        width: 4,
      });
    }
  };
  addNode("camp", w.camp);
  for (let i = 0; i < 8; i++) {
    const c = cells[i],
      p = point(
        c[0] + Math.floor(random() * 13) - 6,
        0,
        c[2] + Math.floor(random() * 13) - 6,
      ),
      yaw = (Math.floor(random() * 4) * Math.PI) / 2;
    const local = (x: number, y: number, z: number) =>
      point(
        p[0] + x * Math.cos(yaw) + z * Math.sin(yaw),
        y,
        p[2] - x * Math.sin(yaw) + z * Math.cos(yaw),
      );
    const home = `p${i}`,
      species = families[i],
      wet = species.some((s) =>
        ["raccoon", "heron", "beaver", "mallard", "otter"].includes(s),
      );
    const pocket: ReserveBlueprint["pockets"][number] = {
      id: home,
      habitat: wet
        ? "wetland"
        : species.includes("deer")
          ? "clearing"
          : "woodland",
      position: p,
      anchors: [],
    };
    w.pockets.push(pocket);
    addNode(`${home}-camera-a`, p);
    addNode(`${home}-camera-b`, local(10, 0, 0));
    addNode(`${home}-entrance`, local(-10, 0, 0));
    link(`${home}-entrance`, `${home}-camera-a`);
    link(`${home}-camera-a`, `${home}-camera-b`);
    w.placements.push(
      placed(
        `${home}-landmark`,
        i % 2 ? "HollowLog" : "MossBoulderA",
        local(-7, 0, -13),
        yaw,
      ),
    );
    const perch = local(3, 0, -11);
    if (species.some((s) => ["squirrel", "owl", "woodpecker"].includes(s)))
      w.placements.push(placed(`${home}-perch-arch`, "RootArch", perch, yaw));
    if (species.includes("woodpecker"))
      w.placements.push(
        placed(`${home}-cling-tree`, "SnagTall", local(7, 0, -11), yaw),
      );
    const offsets: Record<Anchor["kind"], Vec3> = {
      ground: [0, 0, -9],
      feed: [-2, 0, -9],
      rest: [2, 0, -8],
      retreat: [-4, 0, -11],
      passage: [-3, 0, -7],
      cache: [1, 0, -9],
      den: [-4, 0, -10],
      wash: [7, 0, -9],
      water: [12, 0.12, -10],
      perch: [
        3 + ROOT_ARCH_CONTACTS[2][0],
        ROOT_ARCH_CONTACTS[2][1],
        -11 + ROOT_ARCH_CONTACTS[2][2],
      ],
    };
    if (wet) {
      const a = local(9, -1.5, -13),
        b = local(15, 0.12, -7);
      w.waters.push({
        id: `${home}-water`,
        min: point(Math.min(a[0], b[0]), -1.5, Math.min(a[2], b[2])),
        max: point(Math.max(a[0], b[0]), 0.12, Math.max(a[2], b[2])),
      });
    }
    for (const kind of [
      ...new Set(species.flatMap((s) => RESERVE_ROUTINES[s].kinds)),
    ])
      pocket.anchors.push({
        id: `${home}-${kind}`,
        kind,
        point: local(...offsets[kind]),
        links: [],
      });
    if (species.some((s) => ["deer", "fox", "badger"].includes(s)))
      for (const [n, x, z] of [
        [1, -1, -16],
        [2, -2, -21],
      ])
        pocket.anchors.push({
          id: `${home}-passage-${n}`,
          kind: "passage",
          point: local(x, 0, z),
          links: [],
        });
    if (species.includes("woodpecker"))
      pocket.anchors.push({
        id: home + "-woodpecker-perch",
        kind: "perch",
        point: local(7, 2.5, -10.15),
        links: [],
      });
    for (const speciesName of species) {
      const kind = RESERVE_ROUTINES[speciesName].anchor,
        offset =
          speciesName === "woodpecker" ? [7, 2.5, -10.15] : offsets[kind];
      const camera = local(offset[0], 0, offset[2] + 5);
      if (
        !w.navNodes.some((n) => n.position.every((v, i) => v === camera[i]))
      ) {
        addNode(home + "-camera-" + speciesName, camera);
        link(home + "-camera-a", home + "-camera-" + speciesName);
      }
    }
    for (const s of species)
      for (let n = 0, count = 3 + Math.floor(random() * 2); n < count; n++) {
        const anchors = pocket.anchors.filter(
          (a) =>
            RESERVE_ROUTINES[s].kinds.includes(a.kind) &&
            (a.kind !== "perch" ||
              (s === "woodpecker"
                ? a.id.includes("woodpecker")
                : !a.id.includes("woodpecker"))),
        );
        const base = anchors.find(
          (a) => a.kind === RESERVE_ROUTINES[s].anchor,
        )!;
        const localBase: Vec3 =
          s === "woodpecker" ? [7, 2.5, -10.15] : offsets[base.kind];
        const spawn =
          base.kind === "perch" && s !== "woodpecker"
            ? archContacts(
                w.placements.find((p) => p.id === home + "-perch-arch")!,
              )[n]
            : local(
                localBase[0] + (s === "woodpecker" ? 0 : (n - 1.5) * 0.65),
                base.kind === "perch"
                  ? s === "woodpecker"
                    ? 2.5 + n * 0.45
                    : 3.95
                  : localBase[1],
                localBase[2] +
                  (base.kind === "perch" ? 0 : species.indexOf(s) * 0.7),
              );
        const spawnAnchor: Anchor = {
          id: `${home}-${s}-${n}-start`,
          kind: base.kind,
          point: spawn,
          links: [],
        };
        pocket.anchors.push(spawnAnchor);
        w.residents.push({
          id: `${home}-${s}-${n}`,
          species: s,
          home,
          spawn,
          anchors: [...anchors.map((a) => a.id), spawnAnchor.id],
          group: count > 1 ? `${home}-${s}` : null,
        });
      }
    for (const anchor of pocket.anchors)
      anchor.links = pocket.anchors
        .filter(
          (a) =>
            a !== anchor &&
            (anchor.kind === "perch" ||
              a.kind === "perch" ||
              !corridorBlocked(
                anchor.point,
                a.point,
                w.placements.flatMap((p) => p.solids),
                0.35,
                1.8,
              )) &&
            (anchor.kind === "water" ||
              a.kind === "water" ||
              !corridorBlocked(anchor.point, a.point, w.waters, 0.35, 1.8)),
        )
        .map((a) => a.id);
  }
  for (let i = 0; i < 8; i++)
    link(`p${i}-camera-b`, `p${(i + 1) % 8}-entrance`);
  link("camp", "p1-camera-a");
  link("camp", "p5-camera-a");
  for (const i of [1, 5]) {
    const p = w.pockets[i].position;
    w.stations.push({ id: `station-${i}`, position: [...p], recover: [...p] });
  }
  for (const kind of ["case", "screen", "decoy"] as const)
    w.props.push({
      id: kind,
      kind,
      pose: pose(
        point(
          w.camp[0] + (["case", "screen", "decoy"].indexOf(kind) - 1) * 3,
          PROP_CENTER_HEIGHT[kind],
          w.camp[2] + 4,
        ),
      ),
    });
  // The primary loops stay usable with every fixture closed. Each small brook shortcut has its own plank.
  for (const i of [0, 4]) {
    const p = w.pockets[i].position,
      z = p[2] + 28,
      x = p[0];
    w.waters.push({
      id: `brook-${i}`,
      min: [x - 1.4, -1.5, z - 4],
      max: [x + 1.4, 0.12, z + 4],
    });
    const plankId = `plank-${i}`;
    w.props.push({ id: plankId, kind: "plank", pose: pose([x - 5, 0.095, z]) });
    w.fixtures.push(
      fixture(`crossing-${i}`, "crossing", [x, 0, z], 0, plankId),
    );
    addNode(`crossing-${i}-west`, [x - 5, 0, z]);
    addNode(`crossing-${i}-east`, [x + 5, 0, z]);
    link(`p${i}-camera-a`, `crossing-${i}-west`);
    link(`p${i}-camera-a`, `crossing-${i}-east`);
  }
  const gp = point(w.camp[0] + 12, 0, w.camp[2]);
  w.fixtures.push(fixture("gate", "gate", gp, 0, null));
  w.placements.push(placed("gate-posts", "ForestGate", gp));
  addNode("gate-near", point(gp[0], 0, gp[2] + 5));
  addNode("gate-far", point(gp[0], 0, gp[2] - 5));
  link("camp", "gate-near");
  link("camp", "gate-far");
  w.walkables = terrain(w.waters);
  routeTrails(w);
  // Broad connected bands vary in extent and direction; they are not alternating cell labels.
  const dense = 0.68 + random() * 0.04,
    light = 0.18 + random() * 0.04,
    flip = w.camp[0] < 0;
  let start = -192;
  for (const [kind, fraction] of [
    ["dense", dense],
    ["light", light],
    ["open", 1 - dense - light],
  ] as const) {
    const end = kind === "open" ? 192 : round(start + 384 * fraction);
    w.density.push({
      id: kind,
      kind,
      min: [flip ? -end : start, 0, -160],
      max: [flip ? -start : end, 36, 160],
    });
    start = end;
  }
  bindCommissions(w, random);
  const protectedPoints = [
    w.camp,
    ...w.props.map((p) => point(p.pose.position[0], 0, p.pose.position[2])),
    ...w.stations.map((s) => s.recover),
    ...w.pockets.flatMap((p) =>
      p.anchors
        .filter((a) => a.kind !== "perch" && a.kind !== "water")
        .map((a) => a.point),
    ),
  ];
  const obstacles = [
    ...w.waters,
    ...w.placements.flatMap((p) => p.solids),
    ...w.fixtures.flatMap((f) => f.closedBoxes),
  ];
  // Jittered stands retain overlapping mature crowns without putting roots inside carrying/camera corridors.
  for (let z = -151; z < 152; z += 11)
    for (let x = -183; x < 184; x += 11) {
      const p = point(x + (random() - 0.5) * 6, 0, z + (random() - 0.5) * 6),
        zone = w.density.find((d) => contains(d, p))!;
      if (zone.kind === "open" || (zone.kind === "light" && random() < 0.65))
        continue;
      const model = shuffle(
        ["MatureOakA", "MatureOakB", "MaturePineB", "MatureCedarA"],
        random,
      )[0];
      const t = placed(
        `t${w.placements.length}`,
        model,
        p,
        (Math.floor(random() * 4) * Math.PI) / 2,
      );
      const bounds = worldBox("tree", p, t.yaw, ...FOREST_MODELS[model].bounds);
      if (
        !contains(w.bounds, bounds.min) ||
        !contains(w.bounds, bounds.max) ||
        protectedPoints.some((q) => corridorBlocked(q, q, t.solids, 2.5)) ||
        w.trails.some((path) =>
          corridorBlocked(path.points[0], path.points[1], t.solids),
        ) ||
        corridorBlocked(p, p, obstacles, 1.5)
      )
        continue;
      if (
        w.pockets.some((pocket) =>
          pocket.anchors.some((a) =>
            a.links.some((id) => {
              const b = pocket.anchors.find((b) => b.id === id)!;
              return corridorBlocked(a.point, b.point, t.solids, 0.35, 1.8);
            }),
          ),
        )
      )
        continue;
      if (
        w.pockets.some((pocket) =>
          reserveApproaches(w, pocket.id).some((camera) =>
            pocket.anchors.some((a) =>
              rayBlocked(
                point(camera.position[0], 1.6, camera.position[2]),
                point(a.point[0], a.point[1] + 0.4, a.point[2]),
                [...t.solids, ...t.occluders],
              ),
            ),
          ),
        )
      )
        continue;
      w.placements.push(t);
      if (w.placements.length % 4 === 0)
        w.placements.push(
          placed(
            `floor${w.placements.length}`,
            w.placements.length % 8 ? "LeafMat" : "NeedleMat",
            point(p[0], 0.01, p[2]),
            t.yaw,
          ),
        );
    }
  w.walls = [
    ...w.placements.flatMap((p) => p.solids),
    ...w.waters,
    ...boundaries(),
  ];
  w.physicsBoxes = [
    ...w.walkables.map((s) => ({
      id: s.id,
      min: point(s.min[0], s.heightStart - 1, s.min[2]),
      max: point(s.max[0], s.heightStart, s.max[2]),
    })),
    ...waterBeds(w.waters),
    ...w.walls,
  ];
  return w;
}
function routeTrails(w: ReserveBlueprint) {
  const obstacles = [
    ...w.waters,
    ...w.placements.flatMap((p) => p.solids),
    ...w.fixtures.flatMap((f) => f.closedBoxes),
  ];
  const edges = w.trails.map((t) => t.points),
    originals = [...w.navNodes];
  w.trails = [];
  for (const n of w.navNodes) n.links = [];
  const nodes = new Map(w.navNodes.map((n) => [n.position.join(","), n]));
  const node = (p: Vec3) => {
    const key = p.join(",");
    let n = nodes.get(key);
    if (!n) {
      n = { id: `junction-${nodes.size}`, position: p, links: [] };
      nodes.set(key, n);
      w.navNodes.push(n);
    }
    return n;
  };
  const connect = (a: NavNode, b: NavNode) => {
    if (a === b || a.links.includes(b.id)) return;
    a.links.push(b.id);
    b.links.push(a.id);
    w.trails.push({
      id: `path-${w.trails.length}`,
      points: [a.position, b.position],
      width: 4,
    });
  };
  const grid = new Map<string, Vec3>();
  for (let z = -152; z <= 152; z += 4)
    for (let x = -184; x <= 184; x += 4) {
      const p: Vec3 = [x, 0, z];
      if (!corridorBlocked(p, p, obstacles)) grid.set(`${x},${z}`, p);
    }
  const nearest = (p: Vec3) => {
    const candidates = [...grid.values()]
      .filter((q) => distance(p, q) < 16 && !corridorBlocked(p, q, obstacles))
      .sort((a, b) => distance(p, a) - distance(p, b));
    check(candidates[0], "equipment entrance");
    return candidates[0];
  };
  const ends = new Map(
    originals.map((n) => [n.position.join(","), nearest(n.position)]),
  );
  for (const [start, end] of edges) {
    const a = ends.get(start.join(","))!,
      b = ends.get(end.join(","))!,
      key = (p: Vec3) => `${p[0]},${p[2]}`;
    const open = [a],
      scores = new Map([[key(a), 0]]),
      parents = new Map<string, Vec3>();
    let found = false;
    while (open.length) {
      open.sort(
        (p, q) =>
          scores.get(key(q))! +
          distance(q, b) -
          (scores.get(key(p))! + distance(p, b)),
      );
      const current = open.pop()!;
      if (key(current) === key(b)) {
        found = true;
        break;
      }
      for (const [dx, dz] of [
        [4, 0],
        [-4, 0],
        [0, 4],
        [0, -4],
      ]) {
        const next = grid.get(`${current[0] + dx},${current[2] + dz}`);
        if (!next || corridorBlocked(current, next, obstacles)) continue;
        const cost = scores.get(key(current))! + 4;
        if (cost < (scores.get(key(next)) ?? Infinity)) {
          scores.set(key(next), cost);
          parents.set(key(next), current);
          if (!open.includes(next)) open.push(next);
        }
      }
    }
    check(found, "equipment route");
    const path = [b];
    while (key(path[path.length - 1]) !== key(a))
      path.push(parents.get(key(path[path.length - 1]))!);
    path.reverse();
    const all = [start, ...path, end];
    for (let i = 1; i < all.length; i++)
      connect(node(all[i - 1]), node(all[i]));
  }
}
function bindCommissions(w: ReserveBlueprint, random: () => number) {
  const choices = shuffle(
    w.residents.filter((r) => r.id.endsWith("-0")),
    random,
  );
  for (const a of choices)
    for (const b of choices)
      for (const setup of choices.filter((r) =>
        ["raccoon", "deer", "heron", "rabbit", "mallard"].includes(r.species),
      ))
        for (const composition of choices)
          for (const passage of choices.filter((r) =>
            ["deer", "fox", "badger"].includes(r.species),
          ))
            for (const pair of shuffle(PAIRS, random)) {
              const duo = pair.map((s) =>
                choices.find((r) => r.species === s)!,
              );
              const subjects = [a, b, setup, composition, passage, ...duo];
              if (
                a === b ||
                new Set(subjects.map((r) => r.species)).size < 5 ||
                new Set(
                  [a, b, setup, composition, passage, duo[0]].map(
                    (r) => r.home,
                  ),
                ).size < 5 ||
                new Set(
                  subjects
                    .filter(
                      (r) => !["raccoon", "deer", "heron"].includes(r.species),
                    )
                    .map((r) => r.species),
                ).size < 2
              )
                continue;
              const bindings: [Commission["kind"], Resident[]][] = [
                ["behavior", [a]],
                ["behavior", [b]],
                ["setup", [setup]],
                ["composition", [composition]],
                ["passage", [passage]],
                ["pair", duo],
                ["cameo", [choices[0]]],
                ["incident", [choices.find((r) => r.species === "raccoon")!]],
              ];
              w.commissions = bindings.map(([kind, rs], i) => {
                const r = rs[0],
                  routine = RESERVE_ROUTINES[r.species],
                  anchor =
                    kind === "passage"
                      ? "passage"
                      : kind === "setup" || kind === "pair"
                        ? "feed"
                        : routine.anchor;
                return {
                  id: `commission-${i}`,
                  required: i < 6,
                  kind,
                  subjects: rs.map((r) => r.id),
                  pocket: r.home,
                  anchor: `${r.home}-${anchor === "perch" && r.species === "woodpecker" ? "woodpecker-perch" : anchor}`,
                  landmark:
                    kind === "composition" ? `${r.home}-landmark` : null,
                  behavior:
                    kind === "behavior"
                      ? routine.behavior
                      : kind === "passage"
                        ? "passage"
                        : null,
                  title: `${r.species}: ${kind}`,
                  instructions:
                    kind === "setup"
                      ? "Bring the tin, screen and decoy; prepare cover and photograph the feeding setup."
                      : kind === "passage"
                        ? "Follow the local passage anchors and frame the repeatable route."
                        : `Photograph ${rs.map((r) => r.species).join(" and ")} at ${r.home} during ${kind}.`,
                };
              });
              return;
            }
  throw new Error("No compatible commissions");
}
export function generateReserve(
  seed: number,
  worldId: string,
): ReserveBlueprint {
  check(
    Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff,
    "seed must be uint32",
  );
  check(
    typeof worldId === "string" && /^[\w-]{1,96}$/.test(worldId),
    "world id",
  );
  let error: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return validateReserve(build(seed, worldId, attempt));
    } catch (e) {
      error = e;
    }
  }
  throw new Error(`Reserve generation exhausted 8 attempts: ${String(error)}`);
}
export async function reserveHash(world: ReserveBlueprint): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify(validateReserve(world)),
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function validateReserve(value: unknown): ReserveBlueprint {
  check(value !== null && typeof value === "object", "object");
  const json = JSON.stringify(value);
  check(
    new TextEncoder().encode(json).length <= BLUEPRINT_LIMIT,
    "blueprint exceeds 1 MiB",
  );
  const w = value as ReserveBlueprint;
  const keys = (v: object, expected: string) =>
    check(
      v !== null &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        Object.keys(v).sort().join(" ") ===
          expected.split(" ").sort().join(" "),
      "object fields",
    );
  keys(
    w,
    "id content seed attempt bounds camp tinStart pockets stations density placements walkables waters trails navNodes walls physicsBoxes fixtures residents commissions props",
  );
  for (const p of w.pockets ?? []) {
    keys(p, "id habitat position anchors");
    for (const a of p.anchors ?? []) keys(a, "id point kind links");
  }
  for (const s of w.stations ?? []) keys(s, "id position recover");
  for (const d of w.density ?? []) keys(d, "id min max kind");
  for (const n of w.navNodes ?? []) keys(n, "id position links");
  for (const t of w.trails ?? []) keys(t, "id points width");
  for (const r of w.residents ?? [])
    keys(r, "id species home spawn anchors group");
  for (const c of w.commissions ?? [])
    keys(
      c,
      "id required kind subjects pocket anchor landmark behavior title instructions",
    );
  for (const f of w.fixtures ?? [])
    keys(
      f,
      "id kind position yaw closedBoxes openSurfaces seats plankId latch",
    );
  for (const p of w.props ?? []) keys(p, "id kind pose");
  check(w.content === "forest-expedition-1", "content");
  check(typeof w.id === "string" && /^[\w-]{1,96}$/.test(w.id), "world id");
  check(
    Number.isInteger(w.seed) && w.seed >= 0 && w.seed <= 0xffffffff,
    "seed",
  );
  check(
    Number.isInteger(w.attempt) && w.attempt >= 0 && w.attempt < 8,
    "attempt",
  );
  const visit = (v: unknown, depth = 0): void => {
    check(depth < 12, "nesting");
    if (typeof v === "number") check(Number.isFinite(v), "finite numbers");
    else if (typeof v === "string") check(v.length <= 256, "string length");
    else if (Array.isArray(v)) {
      check(v.length <= 8192, "array length");
      for (const a of v) visit(a, depth + 1);
    } else if (v && typeof v === "object")
      for (const a of Object.values(v)) visit(a, depth + 1);
    else check(v === null || typeof v === "boolean", "JSON value");
  };
  visit(w);
  for (const key of [
    "pockets",
    "stations",
    "density",
    "placements",
    "walkables",
    "waters",
    "trails",
    "navNodes",
    "walls",
    "physicsBoxes",
    "fixtures",
    "residents",
    "commissions",
    "props",
  ] as const)
    check(Array.isArray(w[key]), key);
  const vec = (p: unknown) =>
    check(
      Array.isArray(p) &&
        p.length === 3 &&
        p.every((n) => typeof n === "number" && Number.isFinite(n)),
      "vector",
    );
  const id = (s: unknown) =>
    check(typeof s === "string" && /^[\w-]{1,96}$/.test(s), "id");
  const unique = (a: { id: string }[]) => {
    const ids = new Set<string>();
    for (const item of a) {
      id(item.id);
      check(!ids.has(item.id), `duplicate ${item.id}`);
      ids.add(item.id);
    }
  };
  const box = (b: Box, extra = "") => {
    keys(b, "id min max" + (extra ? " " + extra : ""));
    id(b.id);
    vec(b.min);
    vec(b.max);
    check(
      b.min.every((v, i) => v <= b.max[i]),
      "box order",
    );
  };
  box(w.bounds);
  check(
    JSON.stringify(w.bounds) ===
      JSON.stringify({
        id: "bounds",
        min: [-192, -4, -160],
        max: [192, 36, 160],
      }),
    "bounds",
  );
  const inside = (p: Vec3) => {
    vec(p);
    check(contains(w.bounds, p) && p[1] >= -4 && p[1] <= 36, "out of bounds");
  };
  const inBox = (b: Box, extra = "") => {
    box(b, extra);
    inside(b.min);
    inside(b.max);
  };
  const surface = (s: Walkable) => {
    inBox(s, "axis heightStart heightEnd");
    check(
      (s.axis === 0 || s.axis === 2) &&
        typeof s.heightStart === "number" &&
        Number.isFinite(s.heightStart) &&
        typeof s.heightEnd === "number" &&
        Number.isFinite(s.heightEnd),
      "walkable fields",
    );
  };
  inside(w.camp);
  inside(w.tinStart);
  check(w.camp[1] === 0 && ground(w, w.camp), "camp support");
  check(
    w.tinStart[1] === TIN_HALF[1] &&
      ground(
        w,
        point(w.tinStart[0], w.tinStart[1] - TIN_HALF[1], w.tinStart[2]),
      ),
    "tin support",
  );
  check(distance(w.camp, w.tinStart) < 8, "tin start");
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
    "habitat/station count",
  );
  for (const b of [...w.waters, ...w.walls, ...w.physicsBoxes]) inBox(b);
  for (const s of w.walkables) {
    surface(s);
    check(
      (s.axis === 0 || s.axis === 2) &&
        s.heightStart === s.heightEnd &&
        s.heightStart === 0,
      "terrain surface",
    );
  }
  check(
    JSON.stringify(w.walkables) === JSON.stringify(terrain(w.waters)),
    "terrain/water seams",
  );
  for (const p of w.placements) {
    inside(p.position);
    check(Object.hasOwn(FOREST_MODELS, p.model), "unknown model");
    check(
      [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].includes(p.yaw),
      "quarter turn",
    );
    check(
      JSON.stringify(p) ===
        JSON.stringify(placed(p.id, p.model, p.position, p.yaw)),
      "placement geometry",
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
    JSON.stringify(w.walls) ===
      JSON.stringify([
        ...w.placements.flatMap((p) => p.solids),
        ...w.waters,
        ...boundaries(),
      ]),
    "movement geometry",
  );
  check(
    JSON.stringify(w.physicsBoxes) ===
      JSON.stringify([
        ...w.walkables.map((s) => ({
          id: s.id,
          min: point(s.min[0], s.heightStart - 1, s.min[2]),
          max: point(s.max[0], s.heightStart, s.max[2]),
        })),
        ...waterBeds(w.waters),
        ...w.walls,
      ]),
    "physics geometry",
  );
  const placementSolids = w.placements.flatMap((p) => p.solids),
    photoBoxes = [...w.walls, ...w.placements.flatMap((p) => p.occluders)];
  const obstacles = [...w.walls, ...w.fixtures.flatMap((f) => f.closedBoxes)];
  for (const n of w.navNodes) {
    inside(n.position);
    check(
      ground(w, n.position) &&
        !corridorBlocked(n.position, n.position, obstacles),
      `blocked node ${n.id}`,
    );
    check(
      Array.isArray(n.links) &&
        n.links.length > 0 &&
        new Set(n.links).size === n.links.length,
      "links",
    );
    for (const link of n.links) {
      const target = w.navNodes.find((m) => m.id === link);
      check(target && target.links.includes(n.id), "navigation reference");
      check(
        !corridorBlocked(n.position, target.position, obstacles),
        `blocked corridor ${n.id}/${target.id}`,
      );
    }
  }
  const reached = new Set<string>(),
    queue = [w.navNodes.find((n) => n.id === "camp")!];
  check(
    queue[0] && queue[0].position.every((v, i) => v === w.camp[i]),
    "camp node",
  );
  while (queue.length) {
    const n = queue.pop()!;
    if (reached.has(n.id)) continue;
    reached.add(n.id);
    for (const link of n.links)
      queue.push(w.navNodes.find((m) => m.id === link)!);
  }
  check(reached.size === w.navNodes.length, "disconnected graph");
  check(
    w.navNodes.reduce((n, v) => n + v.links.length, 0) / 2 -
      w.navNodes.length +
      1 >=
      2,
    "return loops",
  );
  for (const trail of w.trails) {
    check(
      trail.width >= 4 && trail.width <= 8 && trail.points.length === 2,
      "trail corridor",
    );
    for (const p of trail.points) inside(p);
    check(
      !corridorBlocked(trail.points[0], trail.points[1], obstacles),
      "blocked trail",
    );
  }
  for (const n of w.navNodes)
    for (const link of n.links) {
      const m = w.navNodes.find((m) => m.id === link)!;
      check(
        w.trails.some(
          (t) =>
            (t.points[0].every((v, i) => v === n.position[i]) &&
              t.points[1].every((v, i) => v === m.position[i])) ||
            (t.points[1].every((v, i) => v === n.position[i]) &&
              t.points[0].every((v, i) => v === m.position[i])),
        ),
        "missing trail",
      );
    }
  const anchors = w.pockets.flatMap((p) => p.anchors);
  unique(anchors);
  for (const p of w.pockets) {
    inside(p.position);
    check(ground(w, p.position), "pocket support");
    check(["woodland", "clearing", "wetland"].includes(p.habitat), "habitat");
    check(
      Array.isArray(p.anchors) &&
        p.anchors.length >= 3 &&
        p.anchors.length <= 32,
      "anchors",
    );
    const cameras = reserveApproaches(w, p.id);
    check(
      cameras.every(Boolean) &&
        distance(cameras[0].position, cameras[1].position) >= 8,
      "alternate camera approach",
    );
    for (const a of p.anchors) {
      inside(a.point);
      check(distance(a.point, p.position) < 24, "anchor home");
      check(
        Array.isArray(a.links) &&
          a.links.length > 0 &&
          a.links.every((id) => p.anchors.some((b) => b.id === id && b !== a)),
        "anchor links",
      );
      check(
        Object.values(RESERVE_ROUTINES).some((r) => r.kinds.includes(a.kind)),
        "anchor kind",
      );
      if (a.kind === "water")
        check(
          w.waters.some((b) => contains(b, a.point) && a.point[1] === b.max[1]),
          "water anchor",
        );
      else if (a.kind === "perch")
        check(
          w.placements.some(
            (t) =>
              ((t.model === "RootArch" &&
                archContacts(t).some((p) =>
                  p.every((v, i) => Math.abs(v - a.point[i]) < 0.00001),
                )) ||
                (t.model === "SnagTall" &&
                  distance(t.position, a.point) <= 1)) &&
              a.point[1] >= 2 &&
              a.point[1] < 6,
          ),
          "perch tree",
        );
      else
        check(
          ground(w, a.point) &&
            !corridorBlocked(a.point, a.point, w.walls, 0.4, 2),
          "ground anchor",
        );
      check(
        cameras.some(
          (c) =>
            distance(c.position, a.point) >= 4 &&
            distance(c.position, a.point) <= 30,
        ),
        "camera range",
      );
    }
  }
  check(w.residents.length >= 36 && w.residents.length <= 48, "resident count");
  check(
    new Set(w.residents.map((r) => r.species)).size === 12,
    "species diversity",
  );
  for (const r of w.residents) {
    check(RESERVE_SPECIES.includes(r.species), "species");
    const p = w.pockets.find((p) => p.id === r.home);
    check(p, "resident home");
    inside(r.spawn);
    check(
      reserveApproaches(w, r.home).some((n) =>
        reserveCameraFits(n.position, r.spawn, r.species),
      ),
      "resident photograph size",
    );
    check(
      Array.isArray(r.anchors) &&
        r.anchors.length >= 3 &&
        r.anchors.every((id) =>
          p.anchors.some(
            (a) =>
              a.id === id && RESERVE_ROUTINES[r.species].kinds.includes(a.kind),
          ),
        ),
      "resident anchors",
    );
    check(
      r.anchors.some(
        (id) =>
          anchors.find((a) => a.id === id)!.kind ===
          RESERVE_ROUTINES[r.species].anchor,
      ),
      "routine opportunity",
    );
    check(
      r.anchors.some((id) =>
        anchors
          .find((a) => a.id === id)!
          .point.every((v, i) => v === r.spawn[i]),
      ),
      "resident spawn",
    );
    check(
      r.group === null || (typeof r.group === "string" && r.group.length <= 96),
      "group",
    );
    const nearby = (b: Box) =>
      b.min[0] < p.position[0] + 28 &&
      b.max[0] > p.position[0] - 28 &&
      b.min[2] < p.position[2] + 28 &&
      b.max[2] > p.position[2] - 28;
    const landBoxes = w.walls.filter(nearby),
      swimBoxes = placementSolids.filter(nearby);
    const local = p.anchors.filter((a) => r.anchors.includes(a.id)),
      seen = new Set<string>(),
      pending = [local.find((a) => a.point.every((v, i) => v === r.spawn[i]))!];
    while (pending.length) {
      const a = pending.pop()!;
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      for (const b of local.filter((b) => a.links.includes(b.id))) {
        const boxes =
          a.kind === "water" || b.kind === "water" ? swimBoxes : landBoxes;
        check(
          a.kind === "perch" ||
            b.kind === "perch" ||
            !corridorBlocked(a.point, b.point, boxes, 0.35, 1.8),
          "blocked animal transition",
        );
        pending.push(b);
      }
    }
    check(seen.size === local.length, "unreachable animal routine");
  }
  for (const s of w.stations) {
    inside(s.position);
    inside(s.recover);
    check(
      ground(w, s.position) &&
        w.navNodes.some((n) =>
          n.position.every((v, i) => v === s.position[i]),
        ) &&
        ground(w, s.recover) &&
        !corridorBlocked(s.position, s.recover, obstacles, 2.5),
      "station recovery",
    );
  }
  for (const prop of w.props) {
    check(
      ["case", "plank", "screen", "decoy"].includes(prop.kind),
      "prop kind",
    );
    keys(prop.pose, "position rotation");
    inside(prop.pose.position);
    check(
      prop.pose.position[1] === PROP_CENTER_HEIGHT[prop.kind],
      "prop support height",
    );
    check(
      Array.isArray(prop.pose.rotation) &&
        prop.pose.rotation.length === 4 &&
        prop.pose.rotation.every(
          (n) => typeof n === "number" && Number.isFinite(n),
        ) &&
        Math.abs(Math.hypot(...prop.pose.rotation) - 1) < 1e-6,
      "prop rotation",
    );
    const p = point(prop.pose.position[0], 0, prop.pose.position[2]);
    check(
      ground(w, p) && !corridorBlocked(p, p, obstacles, 2),
      "prop handling",
    );
    check(
      w.navNodes.some(
        (n) =>
          distance(n.position, p) < 8 &&
          !corridorBlocked(n.position, p, obstacles),
      ),
      "prop approach",
    );
  }
  for (const kind of ["case", "screen", "decoy"])
    check(w.props.filter((p) => p.kind === kind).length === 1, "shared tool");
  for (const f of w.fixtures) {
    inside(f.position);
    check(
      [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].includes(f.yaw),
      "fixture rotation",
    );
    check(
      f.seats && typeof f.seats === "object" && !Array.isArray(f.seats),
      "seats",
    );
    for (const seat of Object.values(f.seats)) {
      keys(seat, "position rotation");
      inside(seat.position);
      check(
        Array.isArray(seat.rotation) &&
          seat.rotation.length === 4 &&
          seat.rotation.every(
            (n) => typeof n === "number" && Number.isFinite(n),
          ) &&
          Math.abs(Math.hypot(...seat.rotation) - 1) < 1e-6,
        "seat rotation",
      );
      check(distance(seat.position, f.position) < 4, "seat position");
    }
    check(f.kind === "gate" || f.kind === "crossing", "fixture kind");
    check(f.position[1] === 0, "fixture datum");
    check(
      JSON.stringify(f) ===
        JSON.stringify(fixture(f.id, f.kind, f.position, f.yaw, f.plankId)),
      "fixture geometry",
    );
    if (f.kind === "gate")
      check(
        w.placements.some(
          (p) =>
            p.id === f.id + "-posts" &&
            p.model === "ForestGate" &&
            p.yaw === f.yaw &&
            p.position.every((v, i) => v === f.position[i]),
        ),
        "gate posts",
      );
    for (const b of f.closedBoxes) inBox(b);
    if (f.kind === "crossing") {
      check(
        w.props.some(
          (p) =>
            p.id === f.plankId &&
            p.kind === "plank" &&
            distance(p.pose.position, f.position) < 8,
        ),
        "local plank",
      );
      check(
        f.openSurfaces.length > 0 && Object.keys(f.seats).length >= 1,
        "crossing seats",
      );
      for (const s of f.openSurfaces) {
        surface(s);
        check(
          s.heightStart === s.heightEnd &&
            s.heightStart >
              w.waters.find((b) => contains(b, f.position))!.max[1],
          "crossing surface",
        );
      }
    } else {
      check(f.latch !== null && f.plankId === null, "gate latch");
      inside(f.latch!);
    }
  }
  check(
    new Set(
      w.fixtures.filter((f) => f.kind === "crossing").map((f) => f.plankId),
    ).size === w.props.filter((p) => p.kind === "plank").length,
    "individual planks",
  );
  check(
    w.commissions.length === 8 &&
      w.commissions.filter((c) => c.required).length === 6,
    "commission count",
  );
  const required = w.commissions.filter((c) => c.required),
    kinds = required.map((c) => c.kind).sort();
  check(
    JSON.stringify(kinds) ===
      JSON.stringify([
        "behavior",
        "behavior",
        "composition",
        "pair",
        "passage",
        "setup",
      ]),
    "commission mix",
  );
  for (const c of w.commissions) {
    check(
      typeof c.required === "boolean" &&
        [
          "behavior",
          "setup",
          "composition",
          "passage",
          "pair",
          "cameo",
          "incident",
        ].includes(c.kind),
      "commission kind",
    );
    check(
      typeof c.title === "string" &&
        c.title.length > 0 &&
        typeof c.instructions === "string" &&
        c.instructions.length > 0,
      "commission text",
    );
    check(
      c.behavior === null || typeof c.behavior === "string",
      "commission behavior type",
    );
    check(
      c.subjects.length === (c.kind === "pair" ? 2 : 1) &&
        new Set(c.subjects).size === c.subjects.length,
      "subjects",
    );
    const subjects = c.subjects.map((id) =>
      w.residents.find((r) => r.id === id),
    );
    check(
      subjects.every((r) => r && r.home === c.pocket),
      "subject reference",
    );
    const r = subjects[0]!;
    check(
      anchors.some((a) => a.id === c.anchor) &&
        c.anchor?.startsWith(c.pocket + "-"),
      "commission anchor",
    );
    const target = anchors.find((a) => a.id === c.anchor)!;
    check(
      subjects.every((r) => r!.anchors.includes(target.id)),
      "commission target unreachable by subject",
    );
    check(
      reserveApproaches(w, c.pocket).some(
        (n) =>
          subjects.every((r) =>
            reserveCameraFits(n.position, target.point, r!.species),
          ) &&
          !rayBlocked(
            point(n.position[0], 1.6, n.position[2]),
            point(target.point[0], target.point[1] + 0.4, target.point[2]),
            photoBoxes,
          ),
      ),
      "camera sight line",
    );
    if (c.kind === "behavior")
      check(
        c.behavior === RESERVE_ROUTINES[r.species].behavior &&
          c.anchor ===
            `${r.home}-${r.species === "woodpecker" ? "woodpecker-perch" : RESERVE_ROUTINES[r.species].anchor}`,
        "behavior prerequisite",
      );
    if (c.kind === "passage")
      check(
        ["deer", "fox", "badger"].includes(r.species) &&
          c.anchor === `${r.home}-passage` &&
          c.behavior === "passage",
        "passage prerequisite",
      );
    if (c.kind === "pair")
      check(
        PAIRS.some((pair) =>
          pair.every((s) => subjects.some((r) => r!.species === s)),
        ) && c.anchor === `${r.home}-feed`,
        "compatible pair",
      );
    if (c.kind === "composition")
      check(
        c.landmark === `${r.home}-landmark` &&
          w.placements.some(
            (p) =>
              p.id === c.landmark &&
              distance(
                p.position,
                anchors.find((a) => a.id === c.anchor)!.point,
              ) < 12,
          ),
        "landmark prerequisite",
      );
    else check(c.landmark === null, "unexpected landmark");
    if (c.kind === "setup")
      check(
        ["raccoon", "deer", "heron", "rabbit", "mallard"].includes(r.species) &&
          c.anchor === `${r.home}-feed`,
        "setup prerequisite",
      );
    for (const tool of commissionRequirements(w, c).tools)
      check(
        tool === "tin" || w.props.some((p) => p.kind === tool),
        "missing tool",
      );
  }
  check(new Set(required.map((c) => c.pocket)).size >= 5, "commission pockets");
  const used = new Set(
    required
      .flatMap((c) => c.subjects)
      .map((id) => w.residents.find((r) => r.id === id)!.species),
  );
  check(
    used.size >= 5 &&
      [...used].filter((s) => !["raccoon", "deer", "heron"].includes(s))
        .length >= 2,
    "commission species",
  );
  check(
    w.commissions
      .filter((c) => !c.required)
      .every((c) => c.kind === "cameo" || c.kind === "incident"),
    "optional mix",
  );
  check(w.density.length === 3, "density zones");
  check(
    w.density.some((d) => d.kind === "open" && contains(d, w.camp)),
    "open camp",
  );
  let area = 0;
  for (const d of w.density) {
    inBox(d, "kind");
    check(["dense", "light", "open"].includes(d.kind), "density kind");
    area += (d.max[0] - d.min[0]) * (d.max[2] - d.min[2]);
  }
  check(Math.abs(area - 384 * 320) < 0.01, "density area");
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++)
      check(
        Math.min(w.density[i].max[0], w.density[j].max[0]) <=
          Math.max(w.density[i].min[0], w.density[j].min[0]) ||
          Math.min(w.density[i].max[2], w.density[j].max[2]) <=
            Math.max(w.density[i].min[2], w.density[j].min[2]),
        "density overlap",
      );
  for (const [kind, min, max] of [
    ["dense", 0.65, 0.75],
    ["light", 0.15, 0.25],
    ["open", 0.05, 0.15],
  ] as const) {
    const a =
      w.density
        .filter((d) => d.kind === kind)
        .reduce(
          (n, d) => n + (d.max[0] - d.min[0]) * (d.max[2] - d.min[2]),
          0,
        ) /
      (384 * 320);
    check(a >= min && a <= max, "density ratio");
  }
  const coverage = reserveCanopyCoverage(w);
  check(coverage >= 0.7 && coverage <= 0.9, `canopy coverage ${coverage}`);
  const seen = new WeakSet<object>();
  const freeze = (v: unknown): void => {
    if (v && typeof v === "object" && !seen.has(v)) {
      seen.add(v);
      for (const nested of Object.values(v)) freeze(nested);
      Object.freeze(v);
    }
  };
  freeze(w);
  return w;
}
