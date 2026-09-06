/** Shared reserve geometry used by generation and validation; no runtime state. */
import type { Box, Pose, Vec3, Walkable } from "./shared.ts";
import {
  placement,
  worldBox,
  PROP_DEFINITIONS,
  type NavNode,
  type WorldPlacement,
} from "./level.ts";
import {
  type ReserveSpecies,
  type Commission,
  type Fixture,
  type ReserveBlueprint,
} from "./world-data.ts";
export const round = (n: number) => Math.round(n * 100000) / 100000;
export const point = (x: number, y: number, z: number): Vec3 => [
  round(x),
  round(y),
  round(z),
];
export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[2] - b[2]);
export const pose = (position: Vec3, yaw = 0): Pose => ({
  position,
  rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
});
export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Invalid reserve: ${message}`);
}
export function placed(id: string, model: string, p: Vec3, yaw = 0) {
  const v = placement(id, model, p, yaw);
  for (const box of [...v.solids, ...v.occluders]) {
    box.min = box.min.map(round) as Vec3;
    box.max = box.max.map(round) as Vec3;
  }
  return v;
}
export function contains(box: Pick<Box, "min" | "max">, p: Vec3, margin = 0) {
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
export function boundaries(): Box[] {
  return [
    { id: "boundary-west", min: [-192, -4, -160], max: [-191.8, 36, 160] },
    { id: "boundary-east", min: [191.8, -4, -160], max: [192, 36, 160] },
    { id: "boundary-south", min: [-192, -4, -160], max: [192, 36, -159.8] },
    { id: "boundary-north", min: [-192, -4, 159.8], max: [192, 36, 160] },
  ];
}
export function waterBeds(waters: Box[]): Box[] {
  return waters.map((b) => ({
    id: b.id + "-bed",
    min: point(b.min[0], b.min[1] - 1, b.min[2]),
    max: point(b.max[0], b.min[1], b.max[2]),
  }));
}
export function ground(world: ReserveBlueprint, p: Vec3, margin = 0) {
  return world.walkables.some(
    (s) =>
      contains(s, p, margin) &&
      Math.abs(p[1] - s.heightStart) < 1e-6 &&
      s.heightStart === s.heightEnd,
  );
}
export function terrain(waters: Box[]): Walkable[] {
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
export const ROOT_ARCH_CONTACTS: Vec3[] = [
  [-0.9, 3.72163, 0.35],
  [-0.3, 3.84199, 0.35],
  [0.3, 3.86264, 0.35],
  [0.9, 3.57587, 0.35],
];
export function archContacts(p: WorldPlacement): Vec3[] {
  return ROOT_ARCH_CONTACTS.map((c) => transformPoint(p.position, p.yaw, c));
}
export function fixture(
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
