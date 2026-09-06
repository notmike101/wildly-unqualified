import assert from "node:assert/strict";
import {
  createRun,
  addPlayer,
  applyCommand,
  advanceRun,
  type RunState,
} from "./game.ts";
import { animalRoute } from "./encounters.ts";
import { distance, eye, type Vec3, type Animal } from "./shared.ts";
import { subjectPoints } from "./level.ts";
import { rotate } from "./wildlife.ts";
export function command(run: RunState, type: string) {
  return applyCommand(run, "a", {
    worldId: run.worldId,
    type,
    seq: run.players[0].lastSeq + 1,
  });
}
export function crew(seed = 7) {
  const run = createRun(seed, `field-${seed}`);
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  command(run, "start");
  return run;
}
export function input(
  run: RunState,
  x = 0,
  z = 0,
  yaw = 0,
  pitch = 0,
  crouch = true,
) {
  const p = run.players[0];
  applyCommand(run, p.id, {
    worldId: run.worldId,
    type: "input",
    value: { seq: p.lastSeq + 1, x, z, yaw, pitch, run: !crouch, crouch },
  });
}
export function walkTo(run: RunState, target: Vec3) {
  for (
    let left = 60 * 120;
    distance(run.players[0].position, target) > 0.12;
    left--
  ) {
    assert.ok(
      left > 0,
      `ordinary approach stalled at ${run.players[0].position} toward ${target}`,
    );
    const p = run.players[0].position,
      dx = target[0] - p[0],
      dz = target[2] - p[2],
      len = Math.max(1, Math.hypot(dx, dz));
    input(run, dx / len, dz / len, 0, 0, false);
    advanceRun(run, 1 / 60);
  }
  input(run);
}
export function cameraApproach(run: RunState, residentId: string) {
  const r = run.world.residents.find((r) => r.id === residentId)!;
  const node =
    run.world.navNodes.find((n) => n.id === `${r.home}-camera-${r.species}`) ??
    run.world.navNodes
      .filter((n) => n.id.startsWith(`${r.home}-camera-`))
      .sort(
        (a, b) => distance(a.position, r.spawn) - distance(b.position, r.spawn),
      )[0];
  const route = animalRoute(run.players[0].position, node.id, run);
  assert.ok(route.length, "actual camera route exists");
  for (const target of route) walkTo(run, target);
  return node;
}
export function aim(run: RunState, a: Animal) {
  const points = subjectPoints(a, run.tick).map(
    (p) =>
      rotate(p, a.pose.rotation).map((v, i) => v + a.pose.position[i]) as Vec3,
  );
  const point = points[0].map((v, i) => (v + points[1][i]) / 2) as Vec3;
  aimPoint(run, point);
}
export function aimPoint(run: RunState, point: Vec3) {
  const from = eye(run.players[0]),
    dx = point[0] - from[0],
    dy = point[1] - from[1],
    dz = point[2] - from[2];
  input(run, 0, 0, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
}
export function until(run: RunState, predicate: () => boolean, seconds = 90) {
  for (let i = 0; i < seconds * 60; i++) {
    if (predicate()) return;
    input(run);
    advanceRun(run, 1 / 60);
  }
  assert.ok(
    predicate(),
    "expected local action did not occur through production ticks",
  );
}
