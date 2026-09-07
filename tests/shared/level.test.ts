import assert from "node:assert/strict";
import { test } from "node:test";
import * as Level from "../../src/shared/world/level.ts";
import {
  CAMP,
  CLEARING,
  CONTENT_VERSION,
  PHYSICS_BOXES,
  PROP_RECOVERY_POINTS,
  TRAILS,
  WALKABLES,
  WASHOUT,
  WETLAND,
  WOODLAND,
  WORLD_PLACEMENTS,
  WALLS,
  routeBoxes,
  routeSurfaces,
} from "../../src/shared/world/level.ts";
const PLANK_PLACEMENTS = (Level as any).PLANK_PLACEMENTS;
const PROP_DEFINITIONS = (Level as any).PROP_DEFINITIONS;
import {
  distance,
  movePlayer,
  surfaceHeight,
  type Player,
  type Vec3,
} from "../../src/shared/shared.ts";

const input = (from: Vec3, to: Vec3) => {
  const dx = to[0] - from[0],
    dz = to[2] - from[2],
    length = Math.hypot(dx, dz);
  return {
    seq: 1,
    x: dx / length,
    z: dz / length,
    yaw: 0,
    pitch: 0,
    run: true,
    crouch: false,
  };
};

function walk(points: Vec3[], surfaces = WALKABLES) {
  let player: Player = {
    id: "walker",
    name: "Walker",
    slot: 0,
    position: [...points[0]],
    yaw: 0,
    pitch: 0,
    lastSeq: 0,
    connected: true,
    inputTick: 0,
  };
  const walls = [...WALLS, ...routeBoxes({ crossing: "left", gateOpen: true })];
  for (const target of points.slice(1)) {
    for (
      let step = 0;
      step < 2000 && distance(player.position, target) > 0.12;
      step++
    )
      player = movePlayer(
        player,
        input(player.position, target),
        0.02,
        walls,
        surfaces,
      );
    assert.ok(
      distance(player.position, target) <= 0.12,
      `${JSON.stringify(player.position)} did not reach ${JSON.stringify(target)}`,
    );
  }
  return player;
}

test("authored forest exports cover the required world and model inventory", () => {
  assert.equal(CONTENT_VERSION, "forest-mvp-1");
  assert.deepEqual(CAMP, [-48, 0, 45]);
  assert.deepEqual(WOODLAND, [-38, 0, 14]);
  assert.deepEqual(WASHOUT, [-14, -1, 2]);
  assert.deepEqual(CLEARING, [21, 0, 14]);
  assert.deepEqual(WETLAND, [39, 0, -30]);
  const retainedCampModels = new Set(["CampTable", "Bench", "SupplyCrate"]);
  assert.equal(
    new Set(
      WORLD_PLACEMENTS.filter((p) => !retainedCampModels.has(p.model)).map(
        (p) => p.model,
      ),
    ).size,
    29,
  );
  for (const model of retainedCampModels) {
    const furniture = WORLD_PLACEMENTS.find((p) => p.model === model);
    assert.ok(
      furniture &&
        distance(furniture.position, CAMP) < 6 &&
        furniture.solids.length,
      `${model} has a solid, reachable camp placement`,
    );
  }
  assert.equal(
    new Set(WORLD_PLACEMENTS.map((p) => p.id)).size,
    WORLD_PLACEMENTS.length,
  );
  assert.ok(
    WORLD_PLACEMENTS.filter((p) => p.model.startsWith("Mature")).length >= 140,
  );
  assert.ok(
    WORLD_PLACEMENTS.filter((p) => p.model.startsWith("Mature")).length <= 220,
  );
  assert.ok(PHYSICS_BOXES.some((box) => box.id === "terrain-west"));
});

test("every authored trail is walkable through production collision", () => {
  const surfaces = [
    ...WALKABLES,
    ...routeSurfaces({ crossing: "left", gateOpen: true }),
  ];
  for (const trail of TRAILS) walk(trail.points, surfaces);
});

test("the full four-metre trail corridor stays clear of scenery", () => {
  for (const trail of TRAILS)
    for (let i = 1; i < trail.points.length; i++) {
      const a = trail.points[i - 1],
        b = trail.points[i];
      const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      for (const side of [-1.65, 0, 1.65])
        for (let d = 0; d <= length; d += 0.3) {
          const x =
            a[0] +
            ((b[0] - a[0]) * d) / length -
            ((b[2] - a[2]) * side) / length;
          const z =
            a[2] +
            ((b[2] - a[2]) * d) / length +
            ((b[0] - a[0]) * side) / length;
          const hit = WALLS.find(
            (w) =>
              w.max[1] > 0.15 &&
              w.min[1] < 1.8 &&
              x > w.min[0] - 0.35 &&
              x < w.max[0] + 0.35 &&
              z > w.min[2] - 0.35 &&
              z < w.max[2] + 0.35,
          );
          assert.equal(
            hit,
            undefined,
            `${trail.id} scenery ${hit?.id} blocks corridor near ${x},${z}`,
          );
        }
    }
});

test("bank height follows the ramp while unsupported washout stays blocked", () => {
  const down = walk([
    [-21.8, 0, 2],
    [-18, -0.5, 2],
    [-14, -1, 2],
  ]);
  assert.ok(down.position[1] < -0.9);
  const blocked = movePlayer(
    down,
    { ...input(down.position, [-13, -1, 2]), run: false },
    0.25,
    WALLS,
    WALKABLES,
  );
  assert.ok(blocked.position[0] < -13.9);
  walk([
    [-22, 0, -6],
    [-6, 0, -6],
  ]);
});

test("the real plank seats across a 2.8 metre gap on its 0.65 metre deck", () => {
  assert.ok(PLANK_PLACEMENTS);
  assert.ok(PROP_DEFINITIONS);
  assert.deepEqual(PLANK_PLACEMENTS.left.position, [-12.6, -0.905, 2]);
  assert.deepEqual(PLANK_PLACEMENTS.right.position, [-12.6, -0.905, 5]);
  const deck = routeSurfaces({ crossing: "left", gateOpen: false })[0];
  assert.deepEqual(deck.min, [-14, -0.855, 1.675]);
  assert.deepEqual(deck.max, [-11.2, -0.855, 2.325]);
  assert.deepEqual(PROP_DEFINITIONS.plank.bounds, [
    [-1.6, -0.095, -0.325],
    [1.6, 0.093, 0.325],
  ]);
});

test("the staged plank footprint is fully supported by the west bank", () => {
  const start = PROP_RECOVERY_POINTS.plank[0],
    halfLength = 1.6;
  assert.ok(start.position[2] - halfLength >= -2);
  assert.ok(start.position[2] + halfLength <= 6);
  assert.equal(
    surfaceHeight(
      WALKABLES.find((surface) => surface.id === "washout-west-bank")!,
      -20,
      start.position[2] - halfLength,
    ),
    -0.25,
  );
  assert.equal(
    surfaceHeight(
      WALKABLES.find((surface) => surface.id === "washout-west-bank")!,
      -20,
      start.position[2] + halfLength,
    ),
    -0.25,
  );
});

test("the open return gate leaves the full four metre trail corridor clear", () => {
  const open = routeBoxes({ crossing: null, gateOpen: true });
  for (const point of [
    [-46.07, 0, 34.38],
    [-46.8, 0, 32.4],
  ] as Vec3[])
    assert.equal(
      open.find(
        (box) =>
          point[0] > box.min[0] - 2 &&
          point[0] < box.max[0] + 2 &&
          point[2] > box.min[2] - 2 &&
          point[2] < box.max[2] + 2,
      ),
      undefined,
    );
});
