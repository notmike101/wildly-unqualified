import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { addPlayer, advanceRun, applyCommand, createRun } from "./game.ts";
import { animalRoute } from "./encounters.ts";
import { distance, type Animal, type Vec3 } from "./shared.ts";
import {
  crew,
  command,
  walkTo,
  cameraApproach,
  input,
  until,
} from "./expedition-test-helpers.ts";

const DT = 1 / 60;

for (const species of ["fox", "owl", "woodpecker", "otter"] as const)
  test(`${species} leaves a disturbed action and retries locally after an ordinary whistle`, () => {
    const run = crew(7),
      a = run.animals.find((a) => a.species === species)!;
    cameraApproach(run, a.id);
    const wanted = {
      fox: "pounce",
      owl: "roost",
      woodpecker: "tap",
      otter: "surface",
    }[species];
    if (species === "otter") {
      const resident = run.world.residents.find((r) => r.id === a.id)!;
      const water = run.world.pockets
        .find((p) => p.id === resident.home)!
        .anchors.find((a) => a.kind === "water")!.point;
      const pool = run.world.waters.find((w) =>
        water.every((v, i) => v >= w.min[i] && v <= w.max[i]),
      )!;
      const observer = run.players[0].position,
        side =
          Math.abs(observer[0] - water[0]) > Math.abs(observer[2] - water[2])
            ? 2
            : 0;
      const bank = [...water] as Vec3;
      bank[1] = 0;
      bank[side] =
        observer[side] < water[side]
          ? pool.min[side] - 2.5
          : pool.max[side] + 2.5;
      const corner = [...observer] as Vec3;
      corner[side] = bank[side];
      walkTo(run, corner);
      walkTo(run, bank);
    }
    until(run, () => a.behavior === wanted && a.remaining > 2, 150);
    command(run, "use");
    until(run, () => a.behavior !== wanted, 0.5);
    assert.ok(
      ["alert", "freeze", "fly", "swim"].includes(a.behavior),
      `no visible response: ${a.behavior}`,
    );
    until(run, () => a.behavior === wanted, 150);
    assert.ok(
      distance(
        a.pose.position,
        run.world.residents.find((r) => r.id === a.id)!.spawn,
      ) < 25,
    );
  });
type Sample = { tick: number; behavior: string; position: Vec3 };

function observeFamily(t: TestContext, species: "fox" | "squirrel" | "otter") {
  const run = createRun(7, `routine-red-${species}`);
  const observer = addPlayer(run, "observer", "Observer");
  addPlayer(run, "partner", "Partner");
  applyCommand(run, observer.id, {
    worldId: run.worldId,
    type: "start",
    seq: 1,
  });
  const resident = run.world.residents.find((r) => r.species === species)!;
  const animal = run.animals.find((a) => a.id === resident.id)!;
  const pocket = run.world.pockets.find((p) => p.id === resident.home)!;
  const anchors = pocket.anchors.filter((a) => resident.anchors.includes(a.id));
  const camera = run.world.navNodes.find(
    (n) => n.id === `${resident.home}-camera-a`,
  )!;
  assert.ok(animal && camera, "generated resident and observer approach exist");

  const input = (x: number, z: number, crouch: boolean) =>
    applyCommand(run, observer.id, {
      worldId: run.worldId,
      type: "input",
      value: {
        seq: observer.lastSeq + 1,
        x,
        z,
        yaw: 0,
        pitch: 0,
        run: !crouch,
        crouch,
      },
    });

  // Read-only route guidance; every player displacement is an ordinary input
  // processed by advanceRun. No animal, route, equipment or credit is assigned.
  const route = animalRoute(observer.position, camera.id, run);
  assert.ok(route.length, "generated camera has a route from the actual spawn");
  for (const target of route) {
    let remaining = 60 * 120;
    while (distance(observer.position, target) > 0.12 && remaining-- > 0) {
      const dx = target[0] - observer.position[0];
      const dz = target[2] - observer.position[2];
      const length = Math.hypot(dx, dz);
      input(dx / Math.max(1, length), dz / Math.max(1, length), false);
      advanceRun(run, DT);
    }
    assert.ok(
      remaining > 0,
      `observer route setup stalled: ${observer.position} -> ${target}`,
    );
  }
  input(0, 0, true);
  advanceRun(run, DT);
  assert.ok(distance(observer.position, camera.position) < 0.15);
  assert.equal(run.paused, false);
  assert.equal(run.phase, "outing");

  const samples: Sample[] = [];
  const startTick = run.tick;
  // 90 simulated seconds is a generous local routine deadline, not an outing
  // duration requirement. Observe every production tick to catch root jumps.
  for (let i = 0; i < 90 * 60; i++) {
    input(0, 0, true);
    advanceRun(run, DT);
    samples.push({
      tick: run.tick,
      behavior: animal.behavior,
      position: [...animal.pose.position],
    });
  }
  assert.equal(run.tick - startTick, 90 * 60, "production ticks actually ran");
  assert.equal(
    run.animals.find((a) => a.id === resident.id),
    animal,
  );
  t.diagnostic(
    JSON.stringify({
      seed: 7,
      resident: resident.id,
      camera: camera.id,
      observer: observer.position,
      startTick,
      endTick: run.tick,
      behaviors: [...new Set(samples.map((s) => s.behavior))],
      displacement: Math.max(
        ...samples.map((s) => distance(s.position, samples[0].position)),
      ),
      heightRange: [
        Math.min(...samples.map((s) => s.position[1])),
        Math.max(...samples.map((s) => s.position[1])),
      ],
    }),
  );
  return { run, animal, anchors, samples };
}

function bounded(samples: Sample[], animal: Animal, home: Vec3) {
  for (let i = 1; i < samples.length; i++) {
    assert.ok(
      distance(samples[i - 1].position, samples[i].position) <= 0.2,
      `${animal.id} jumped more than 20 cm in one production tick`,
    );
    assert.ok(
      distance(samples[i].position, home) < 35,
      `${animal.id} left its local encounter instead of retrying locally`,
    );
  }
}

test("fox traverses its generated ground passage and lands a local pounce", (t) => {
  const { animal, anchors, samples } = observeFamily(t, "fox");
  assert.ok(
    samples.some((s) => s.behavior === "pounce"),
    "missing ground stalk/pounce routine: a quiet observer saw no earned pounce",
  );
  const passages = anchors.filter(
    (a) => a.kind === "passage" && !a.id.endsWith("-start"),
  );
  assert.ok(
    passages.filter((a) =>
      samples.some((s) => distance(s.position, a.point) < 1),
    ).length >= 2,
    "a passage routine must traverse distinct bound anchors, not label an idle fox",
  );
  const airborne = samples.findIndex(
    (s) => s.behavior === "pounce" && s.position[1] > 0.1,
  );
  assert.ok(airborne >= 0, "pounce has actual root lift");
  assert.ok(
    samples.slice(airborne + 1).some((s) => Math.abs(s.position[1]) < 0.03),
    "pounce returns to supported ground",
  );
  bounded(samples, animal, anchors.find((a) => a.kind === "ground")!.point);
});

test("squirrel leaves the ground cache, reaches its arch perch and returns", (t) => {
  const { animal, anchors, samples } = observeFamily(t, "squirrel");
  const cache = anchors.find((a) => a.kind === "cache")!;
  const perch = anchors.find((a) => a.kind === "perch")!;
  const reached = samples.findIndex(
    (s) => distance(s.position, perch.point) < 0.6,
  );
  assert.ok(
    reached >= 0,
    "missing climb/perch transition: the ground-start squirrel never reached its real arch",
  );
  assert.ok(
    samples
      .slice(0, reached)
      .some((s) => s.position[1] > 0.5 && s.position[1] < 3),
    "climb includes intermediate heights rather than teleporting to the perch",
  );
  assert.ok(
    samples
      .slice(reached + 1)
      .some(
        (s) => s.behavior === "cache" && distance(s.position, cache.point) < 1,
      ),
    "the same resident returns to its ground cache after climbing",
  );
  bounded(samples, animal, cache.point);
});

test("otter enters its pond at a floating datum then returns to bank grooming", (t) => {
  const { run, animal, anchors, samples } = observeFamily(t, "otter");
  const water = anchors.find((a) => a.kind === "water")!;
  const rest = anchors.find((a) => a.kind === "rest")!;
  const pool = run.world.waters.find((w) =>
    water.point.every((n, axis) => n >= w.min[axis] && n <= w.max[axis]),
  )!;
  assert.ok(pool, "generated water anchor belongs to an actual pond");
  const floating = samples.findIndex(
    (s) =>
      Math.hypot(
        s.position[0] - water.point[0],
        s.position[2] - water.point[2],
      ) < 1.5 &&
      s.position[1] < pool.max[1] - 0.1 &&
      s.position[1] > pool.max[1] - 0.25,
  );
  assert.ok(
    floating >= 0,
    "missing swimming/surfacing routine: otter never entered its pond at the measured float datum",
  );
  // Accepts either documented visible surface (.12 or .1075); a bed-walking
  // animal or a neutral model standing on top of the water cannot satisfy it.
  assert.ok(
    samples
      .slice(floating + 1)
      .some(
        (s) =>
          s.behavior === "groom" &&
          distance(s.position, rest.point) < 1 &&
          Math.abs(s.position[1] - rest.point[1]) < 0.03,
      ),
    "a swimming otter returns to supported bank grooming",
  );
  bounded(samples, animal, rest.point);
});

test("repeated raccoons keep separate bodies while approaching shared woodland sites", () => {
  const run = createRun(7, "shared-sites");
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { worldId: run.worldId, type: "start", seq: 1 });
  const residents = run.animals.filter((a) => a.species === "raccoon");
  for (let tick = 0; tick < 120 * 60; tick++) {
    advanceRun(run, DT);
    if (tick < 60) continue;
    for (let i = 0; i < residents.length; i++)
      for (let j = i + 1; j < residents.length; j++)
        assert.ok(
          distance(residents[i].pose.position, residents[j].pose.position) >=
            0.45,
          `shared-site overlap at tick ${run.tick}: ${residents[i].id}/${residents[j].id}`,
        );
  }
});

test("every raccoon including bound targets gets another wash turn after yielding at the shared site", (t) => {
  const run = crew(7);
  const tin = run.tin.pose.position;
  walkTo(run, [tin[0], 0, tin[2] - 0.7]);
  command(run, "interact");
  assert.equal(
    run.tin.holder,
    "a",
    "ordinary E picked up the actual shared tin",
  );
  const residents = run.animals.filter((a) => a.species === "raccoon");
  cameraApproach(run, residents[0].id);
  const resident = run.world.residents.find((r) => r.id === residents[0].id)!;
  const wash = run.world.pockets
    .find((p) => p.id === resident.home)!
    .anchors.find((a) => a.kind === "wash" && !a.id.endsWith("-start"))!.point;
  walkTo(run, [wash[0], 0, wash[2] + 1.5]);
  input(run);
  advanceRun(run, DT);
  command(run, "use");
  assert.ok(run.tin.open && run.tin.portions > 0);
  const turns = new Map(residents.map((a) => [a.id, 0]));
  const last = new Map(residents.map((a) => [a.id, a.behavior]));
  for (let tick = 0; tick < 150 * 60; tick++) {
    input(run);
    advanceRun(run, DT);
    for (const a of residents) {
      if (a.behavior === "wash" && last.get(a.id) !== "wash")
        turns.set(a.id, turns.get(a.id)! + 1);
      last.set(a.id, a.behavior);
      for (const b of residents)
        if (a.id !== b.id)
          assert.ok(
            distance(a.pose.position, b.pose.position) >= 0.45,
            `overlap while ${a.id}/${b.id} wash or yield`,
          );
    }
  }
  t.diagnostic(
    JSON.stringify({
      turns: Object.fromEntries(turns),
      states: residents.map((a) => [a.id, a.behavior, a.pose.position]),
    }),
  );
  for (const a of residents)
    assert.ok(
      turns.get(a.id)! >= 2,
      `${a.id} never gets a repeat action turn after yielding`,
    );
});
