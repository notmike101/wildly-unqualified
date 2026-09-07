import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceRun, type RunState } from "../../src/server/simulation/game.ts";
import { animalRoute } from "../../src/server/simulation/wildlife/encounters.ts";
import {
  PROP_DEFINITIONS,
  fixtureBoxes,
} from "../../src/shared/world/level.ts";
import {
  distance,
  propPoint,
  propBoxes,
  rayBlocked,
  type FieldProp,
  type Vec3,
} from "../../src/shared/shared.ts";
import { rotate, xyz } from "../../src/shared/wildlife/wildlife.ts";
import {
  crew,
  input,
  command,
  walkTo,
  cameraApproach,
  until,
  aim,
} from "../helpers/expedition-test-helpers.ts";

// Read-only guidance follows the generated four-metre trail edges. Progress
// always comes from ordinary input, E/Q and production ticks.
function trail(run: RunState, from: string, to: string) {
  const nodes = new Map(run.world.navNodes.map((n) => [n.id, n]));
  const open = new Set([from]),
    costs = new Map([[from, 0]]),
    previous = new Map<string, string>();
  while (open.size) {
    const id = [...open].sort((a, b) => costs.get(a)! - costs.get(b)!)[0];
    open.delete(id);
    if (id === to) {
      const result = [nodes.get(id)!.position];
      let cursor = id;
      while (previous.has(cursor)) {
        cursor = previous.get(cursor)!;
        result.unshift(nodes.get(cursor)!.position);
      }
      return result;
    }
    for (const next of nodes.get(id)!.links) {
      const cost =
        costs.get(id)! +
        distance(nodes.get(id)!.position, nodes.get(next)!.position);
      if (cost < (costs.get(next) ?? Infinity)) {
        costs.set(next, cost);
        previous.set(next, id);
        open.add(next);
      }
    }
  }
  throw Error("no generated equipment trail");
}
function carryTo(run: RunState, prop: FieldProp, target: Vec3, detour = true) {
  const bounds = propBoxes(prop, PROP_DEFINITIONS[prop.kind]);
  const min = [0, 1, 2].map(
    (i) => Math.min(...bounds.map((b) => b.min[i])) - prop.pose.position[i],
  );
  const max = [0, 1, 2].map(
    (i) => Math.max(...bounds.map((b) => b.max[i])) - prop.pose.position[i],
  );
  const obstacles = [
    ...run.world.walls,
    ...fixtureBoxes(run.world.fixtures, run.route),
    ...run.props
      .filter((p) => p.id !== prop.id)
      .flatMap((p) => propBoxes(p, PROP_DEFINITIONS[p.kind])),
  ].map((b) => ({
    id: b.id,
    min: b.min.map((v, i) => v - max[i] - 0.025) as Vec3,
    max: b.max.map((v, i) => v - min[i] + 0.025) as Vec3,
  }));
  const at = (p: Vec3): Vec3 => [p[0], prop.pose.position[1], p[2]];
  const clear = (a: Vec3, b: Vec3) => !rayBlocked(at(a), at(b), obstacles);
  if (detour && !clear(prop.pose.position, target)) {
    const middle = target.map(
      (v, i) => (v + prop.pose.position[i]) / 2,
    ) as Vec3;
    const candidates = [1, 2, 3, 4, 5].flatMap((radius) =>
      Array.from(
        { length: 16 },
        (_, i) =>
          [
            middle[0] + Math.cos((i * Math.PI) / 8) * radius,
            0,
            middle[2] + Math.sin((i * Math.PI) / 8) * radius,
          ] as Vec3,
      ),
    );
    const via = candidates.find(
      (p) => clear(prop.pose.position, p) && clear(p, target),
    );
    assert.ok(
      via,
      `no ordinary local carry detour for ${prop.id} to ${target}`,
    );
    carryTo(run, prop, via, false);
  }
  for (
    let left = 180 * 60;
    Math.hypot(
      prop.pose.position[0] - target[0],
      prop.pose.position[2] - target[2],
    ) > 0.2;
    left--
  ) {
    assert.ok(
      left > 0,
      `ordinary ${prop.kind} carry stalled: player ${run.players[0].position}, prop ${prop.pose.position}, target ${target}`,
    );
    const dx = target[0] - prop.pose.position[0],
      dz = target[2] - prop.pose.position[2],
      length = Math.max(1, Math.hypot(dx, dz));
    input(run, dx / length, dz / length, 0, 0, false);
    advanceRun(run, 1 / 60);
  }
  input(run);
}
function pickUp(run: RunState, kind: "screen" | "decoy") {
  const prop = run.props.find((p) => p.kind === kind)!;
  const handle = propPoint(
    PROP_DEFINITIONS[kind].handles[kind === "screen" ? 1 : 0],
    prop.pose,
  );
  if (kind === "decoy") {
    walkTo(run, [handle[0] + 1, 0, run.players[0].position[2]]);
    walkTo(run, [handle[0] + 1, 0, handle[2] + 0.65]);
  }
  walkTo(
    run,
    kind === "screen"
      ? [handle[0] + 0.5, 0, handle[2]]
      : [handle[0], 0, handle[2] + 0.65],
  );
  command(run, "interact");
  assert.ok(prop.holders.includes("a"), `ordinary E should select ${kind}`);
  return prop;
}

test("ordinary equipment transport and a replenished tin earn a rabbit feeding setup", (t) => {
  const run = crew(23),
    c = run.world.commissions.find((c) => c.kind === "setup")!,
    a = run.animals.find((a) => a.id === c.subjects[0])!;
  const pocket = run.world.pockets.find((p) => p.id === c.pocket)!,
    feed = pocket.anchors.find((a) => a.id === c.anchor)!.point;
  const yaw = run.world.placements.find(
    (p) => p.id === pocket.id + "-landmark",
  )!.yaw;
  const local = (offset: Vec3) =>
    rotate(offset, xyz([0, yaw, 0])).map((v, i) => v + feed[i]) as Vec3;
  const camera = run.world.navNodes
    .filter((n) => n.id.startsWith(pocket.id + "-camera-"))
    .sort((a, b) => distance(a.position, feed) - distance(b.position, feed))[0];
  for (const kind of ["decoy", "screen"] as const) {
    if (kind === "screen")
      for (const point of animalRoute(run.players[0].position, "camp", run))
        walkTo(run, point);
    const prop = pickUp(run, kind);
    for (const point of trail(run, "camp", camera.id))
      carryTo(run, prop, point);
    carryTo(run, prop, local(kind === "decoy" ? [-1.2, 0, 1.2] : [2.3, 0, 3]));
    command(run, "interact");
    assert.ok(!prop.holders.some(Boolean));
    if (kind === "decoy") {
      const cup = propPoint(
        PROP_DEFINITIONS.decoy.usePoints![0].point,
        prop.pose,
      );
      walkTo(run, [cup[0] + 0.65, 0, cup[2]]);
      command(run, "use");
      assert.ok(prop.open, "ordinary Q fills the decoy cup");
    }
  }
  for (const point of animalRoute(run.players[0].position, "camp", run))
    walkTo(run, point);
  walkTo(run, [run.tin.pose.position[0], 0, run.tin.pose.position[2] - 0.7]);
  command(run, "interact");
  assert.equal(run.tin.holder, "a");
  command(run, "use");
  assert.equal(
    run.spareBait,
    8,
    "camp replaces the portion used in the actual decoy",
  );
  cameraApproach(run, a.id);
  walkTo(run, local([1.2, 0, 1.2]));
  command(run, "interact");
  assert.ok(run.tin.open && !run.tin.holder);
  walkTo(run, camera.position);
  until(run, () => a.behavior === "feed", 120);
  aim(run, a);
  const result = command(run, "photo")!;
  t.diagnostic(
    JSON.stringify({
      seed: 23,
      tick: run.tick,
      animal: a.id,
      credits: result.verdict.credits,
      propPositions: run.props
        .filter((p) => p.kind !== "plank")
        .map((p) => [p.kind, p.pose.position]),
    }),
  );
  assert.ok(result.verdict.credits.includes(c.id), result.verdict.reason);
});
