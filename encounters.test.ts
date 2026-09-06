import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addPlayer,
  advanceRun,
  applyCommand as applyWorldCommand,
  createRun,
  evaluatePhoto,
  makePhotoFrame,
} from "./game.ts";
import {
  HABITAT_SITES,
  CAMP,
  PROP_DEFINITIONS,
  fixtureSurfaces,
  fixtureBoxes,
  WALLS,
  WOODLAND_WASH_SITES,
  NAV_NODES,
  WALKABLES,
  routeBoxes,
  routeSurfaces,
  subjectPoints,
  animalArticulation,
} from "./level.ts";
import {
  distance,
  pose,
  propBoxes,
  surfaceHeight,
  type Vec3,
} from "./shared.ts";
import { animalRoute } from "./encounters.ts";
import { saveRun, loadRun } from "./save.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function crew(seed = 0) {
  const run = createRun(seed);
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { type: "start", seq: 1 });
  return run;
}
function step(run: ReturnType<typeof createRun>, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) advanceRun(run, 1 / 60);
}

function home(run: ReturnType<typeof createRun>, species: string): Vec3 { const resident = run.world.residents.find(r => r.species === species)!; return run.world.pockets.find(p => p.id === resident.home)!.position; }
function anchor(run: ReturnType<typeof createRun>, species: string, kind: string): Vec3 { const resident = run.world.residents.find(r => r.species === species)!; return run.world.pockets.find(p => p.id === resident.home)!.anchors.find(a => a.kind === kind)!.point; }
function applyCommand(run: ReturnType<typeof createRun>, id: string, input: Record<string, unknown>) {
  return applyWorldCommand(run, id, {worldId: run.worldId, ...input});
}

test("a crowded raccoon looks and reaches before a theft; stepping away interrupts it", () => {
  const run = crew(),
    r = run.animals.find(a => a.species === "raccoon")!,
    p = run.players[0];
  p.position = [r.pose.position[0], 0, r.pose.position[2] + 1];
  step(run, 0.2);
  assert.equal(r.behavior, "hat-reach");
  assert.equal(animalArticulation(r, run.tick).headX, 0.3);
  assert.equal(run.hats[0].carrier, "owner");
  for (let i = 0; i < 35; i++) {
    applyCommand(run, "a", {
      type: "input",
      value: {
        seq: p.lastSeq + 1,
        x: 0,
        z: 1,
        yaw: 0,
        pitch: 0,
        run: false,
        crouch: false,
      },
    });
    advanceRun(run, 1 / 60);
  }
  step(run, 1);
  assert.equal(run.hats[0].carrier, "owner");
  assert.notEqual(r.behavior, "hat-reach");
  p.position = [r.pose.position[0], 0, r.pose.position[2] + 1];
  step(run, 1.5);
  assert.equal(run.hats[0].carrier, "raccoon");
  assert.ok(
    Math.abs(run.hats[0].position[1] - r.pose.position[1] - 0.68) < 1e-6,
    "recovery follows the actual Head mount plus the visible hat offset",
  );
  assert.ok(
    Math.abs(
      Math.hypot(
        run.hats[0].position[0] - r.pose.position[0],
        run.hats[0].position[2] - r.pose.position[2],
      ) - 0.26,
    ) < 1e-6,
  );
  assert.equal(run.hats[0].protectedUntilTick - run.hats[0].untilTick, 1800);
  assert.equal(run.hats.filter((h) => h.carrier.startsWith("animal:")).length, 1);
  const ally = run.players[1];
  ally.position = [r.pose.position[0], 0, r.pose.position[2] + 0.5];
  applyCommand(run, "b", { type: "interact", seq: ally.lastSeq + 1 });
  assert.equal(run.hats[0].carrier, "owner");
  assert.equal(run.hats[0].owner, "a");
  p.position = [r.pose.position[0], 0, r.pose.position[2] + 1];
  step(run, 2);
  assert.equal(
    run.hats[0].carrier,
    "owner",
    "repeat protection survives retrieval",
  );
});

test("a raccoon consumes a reached spill once without changing goals or prepared routes", () => {
  const run = crew(),
    r = run.animals.find(a => a.species === "raccoon")!;
  const progress = structuredClone([
    run.world,
    run.completed,
    run.route,
    run.album,
  ]);
  run.spills = [
    {
      id: "spill-1",
      position: [r.pose.position[0], 0, r.pose.position[2] + 1],
      portions: 1,
      untilTick: 3600,
    },
  ];
  step(run, 6);
  assert.equal(run.spills.length, 0);
  assert.deepEqual([run.world, run.completed, run.route, run.album], progress);
});

test("a close hat behind a solid screen is not reachable and disconnect restores a stolen hat", async () => {
  const { disconnectPlayer } = await import("./game.ts");
  const run = crew(),
    r = run.animals.find(a => a.species === "raccoon")!,
    p = run.players[0],
    screen = run.props.find((p) => p.kind === "screen")!;
  r.pose = pose([0, 0, 0]);
  p.position = [0, 0, 1.1];
  screen.pose = pose([0, 0.97, 0.55]);
  step(run, 2);
  assert.equal(run.hats[0].carrier, "owner");
  assert.notEqual(r.behavior, "hat-reach");
  screen.pose.position = [50, 0.97, 50];
  p.position = [r.pose.position[0], 0, r.pose.position[2] + 1];
  step(run, 1.5);
  assert.equal(run.hats[0].carrier, "raccoon");
  const protection = run.hats[0].protectedUntilTick;
  disconnectPlayer(run, "a");
  assert.equal(run.hats[0].carrier, "owner");
  assert.equal(run.hats[0].protectedUntilTick, protection);
});

test("seeded outings spawn three species at the selected sites and reach every site/commission combination", () => {
  const selections = new Set<string>();
  for (let seed = 0; seed < 64; seed++) {
    const run = createRun(seed);
    assert.deepEqual(run, createRun(seed));
    assert.equal(run.animals.length, 3);
    for (const [species, habitat] of [
      ["raccoon", "woodland"],
      ["deer", "clearing"],
      ["heron", "wetland"],
    ] as const)
      assert.deepEqual(
        run.animals.find((a) => a.species === species)!.pose.position,
        HABITAT_SITES[habitat][run.world.sites[habitat]],
      );
    assert.equal(new Set(run.world.commissions.filter(c => c.required).map(c => c.id)).size, 4);
    selections.add(JSON.stringify([run.world.sites, run.world.commissions.filter(c => c.required).map(c => c.id)]));
  }
  assert.equal(selections.size, 64);
});

test("held open tin interest ends and a moved setup restores an actual inspection", () => {
  const run = crew(),
    r = run.animals.find(a => a.species === "raccoon")!,
    p = run.players[0];
  p.position = [r.pose.position[0], 0, r.pose.position[2] + 1.4];
  run.tin.holder = p.id;
  run.tin.open = true;
  step(run, 1);
  assert.equal(r.behavior, "inspect");
  step(run, 4.5);
  assert.notEqual(r.behavior, "inspect");
  step(run, 1);
  assert.notEqual(r.behavior, "inspect");
  p.position = [r.pose.position[0] + 1.5, 0, r.pose.position[2] + 1.3];
  step(run, 3);
  assert.equal(r.behavior, "inspect");
});

test("all four selected commissions are required for camp return", () => {
  const run = crew();
  run.completed = run.world.commissions.filter(c => c.required).map(c => c.id).slice(0, 3);
  run.players.forEach((p) => (p.position = [...CAMP]));
  assert.throws(
    () => applyCommand(run, "a", { type: "ready-end", seq: 2 }),
    /assignment|photo/i,
  );
  run.completed = [...run.world.commissions.filter(c => c.required).map(c => c.id)];
  applyCommand(run, "a", { type: "ready-end", seq: 3 });
  applyCommand(run, "b", { type: "ready-end", seq: 1 });
  applyCommand(run, "a", { type: "finish", seq: 4 });
  assert.equal(run.phase, "exhibition");
});

test("all authored encounter approaches and route edges have supported animal-radius movement", () => {
  for (const crossing of [null, "left", "right"] as const)
    for (const gateOpen of [false, true]) {
      const route = { crossing, gateOpen };
      for (const node of NAV_NODES) {
        const path = animalRoute(CAMP, node.id, route);
        assert.ok(
          path.length,
          `${node.id} unreachable ${JSON.stringify(route)}`,
        );
        let from = CAMP;
        for (const to of path) {
          const steps = Math.ceil(distance(from, to) / 0.05);
          for (let i = 0; i <= steps; i++) {
            const point = from.map(
              (v, a) => v + ((to[a] - v) * i) / Math.max(1, steps),
            ) as Vec3;
            const heights = [...WALKABLES, ...routeSurfaces(route)]
              .map((s) => surfaceHeight(s, point[0], point[2]))
              .filter((h): h is number => h !== null);
            assert.ok(heights.length, `unsupported ${point}`);
            point[1] = Math.max(...heights);
            assert.ok(
              ![...WALLS, ...routeBoxes(route)].some(
                (b) =>
                  b.max[1] > point[1] + 0.16 &&
                  b.min[1] < point[1] + 1.7 &&
                  point[0] > b.min[0] - 0.3 &&
                  point[0] < b.max[0] + 0.3 &&
                  point[2] > b.min[2] - 0.3 &&
                  point[2] < b.max[2] + 0.3,
              ),
              `solid at ${point}`,
            );
          }
          from = to;
        }
      }
    }
});

test("deer distinguishes exposed players and real noise from quiet screen cover", () => {
  for (const covered of [false, true]) {
    const run = crew(),
      d = run.animals.find((a) => a.species === "deer")!,
      p = run.players[0],
      screen = run.props.find((p) => p.kind === "screen")!;
    p.position = [d.pose.position[0], 0, d.pose.position[2] + 3];
    if (covered) screen.pose = pose([p.position[0], 0.97, p.position[2] - 0.8]);
    step(run, 0.2);
    assert.equal(d.behavior === "alert", !covered);
    if (covered) {
      run.events.push({
        kind: "noise",
        player: p.id,
        point: [...p.position],
        tick: run.tick,
      });
      step(run, 0.2);
      assert.equal(d.behavior, "alert");
    }
    step(run, 1);
    assert.equal(d.behavior, "retreat");
  }
});

test("an expired running input cannot manufacture continuing noise", () => {
  const run = crew(),
    p = run.players[0],
    d = run.animals.find(a => a.species === "deer")!;
  p.position = [d.pose.position[0], 0, d.pose.position[2] + 6];
  applyCommand(run, p.id, {
    type: "input",
    value: {
      seq: p.lastSeq + 1,
      x: 1,
      z: 0,
      yaw: 0,
      pitch: 0,
      run: true,
      crouch: false,
    },
  });
  step(run, 1);
  const lastNoise = run.events.filter((e) => e.kind === "noise").at(-1)!;
  assert.ok(
    lastNoise.tick <= p.inputTick + 15,
    `stale input emitted noise at ${lastNoise.tick}`,
  );
});

test("unreachable lures behind equipment never pull an animal through a panel", () => {
  const run = crew(),
    r = run.animals.find(a => a.species === "raccoon")!,
    screen = run.props.find((p) => p.kind === "screen")!;
  screen.pose = pose([r.pose.position[0], 0.97, r.pose.position[2] - 1]);
  run.tin.pose = pose([r.pose.position[0], 0.109, r.pose.position[2] - 2]);
  run.tin.open = true;
  for (let i = 0; i < 80; i++) {
    const before = [...r.pose.position] as Vec3;
    step(run, 0.1);
    for (const box of propBoxes(screen, PROP_DEFINITIONS.screen))
      assert.ok(
        !(
          r.pose.position[0] > box.min[0] - 0.3 &&
          r.pose.position[0] < box.max[0] + 0.3 &&
          r.pose.position[2] > box.min[2] - 0.3 &&
          r.pose.position[2] < box.max[2] + 0.3 &&
          box.max[1] > 0.16
        ),
        `${before} entered screen ${r.pose.position}`,
      );
  }
});

test("an inaccessible tin does not hide an accessible filled decoy cup", () => {
  const run = crew(),
    r = run.animals.find(a => a.species === "raccoon")!,
    item = run.props.find((p) => p.kind === "case")!,
    decoy = run.props.find((p) => p.kind === "decoy")!;
  item.pose = pose([r.pose.position[0], 0.325, r.pose.position[2] - 2]);
  run.tin.pose = pose([item.pose.position[0], 0.109, item.pose.position[2]]);
  run.tin.open = true;
  decoy.pose = pose([r.pose.position[0] + 3, 0.5, r.pose.position[2]]);
  decoy.open = true;
  for (let i = 0; i < 60 && r.behavior !== "investigate"; i++) step(run, 0.1);
  assert.equal(r.behavior, "investigate");
  assert.ok(distance(r.pose.position, decoy.pose.position) < 1.5);
});

test("calm goal choices avoid immediately repeating a completed goal", () => {
  const run = crew();
  const behaviors = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    step(run, 0.1);
    behaviors.add(run.animals.find(a => a.species === "deer")!.behavior);
  }
  assert.ok(
    behaviors.has("graze") && behaviors.has("settle"),
    "calm deer must pause to scan as well as graze",
  );
  for (const memory of Object.values(run.animalMemory)) {
    assert.ok(memory.recentGoals.length >= 2);
    const goals = [...memory.recentGoals, memory.goal];
    assert.ok(goals.every((g, i) => !i || g !== goals[i - 1]));
  }
});

test("a heron walks between resting sites and preens while stationary", () => {
  const run = crew(),
    h = run.animals.find(a => a.species === "heron")!,
    behaviors = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const before = [...h.pose.position] as Vec3,
      behavior = h.behavior;
    step(run, 0.1);
    behaviors.add(h.behavior);
    if (behavior === "preen" && h.behavior === "preen")
      assert.ok(distance(before, h.pose.position) < 0.001);
  }
  assert.ok(behaviors.has("wander") && behaviors.has("preen"));
});

test("a raccoon stops washing when the visible food is removed", () => {
  const run = crew(8),
    r = run.animals.find(a => a.species === "raccoon")!,
    wash = WOODLAND_WASH_SITES[0];
  run.tin.pose = pose([wash[0] + 0.6, 0.109, wash[2]]);
  run.tin.open = true;
  for (let i = 0; i < 60 && r.behavior !== "wash"; i++) step(run, 0.1);
  assert.equal(r.behavior, "wash");
  run.tin.open = false;
  run.tin.pose = pose([50, 0.109, 50]);
  step(run, 0.1);
  assert.notEqual(r.behavior, "wash");
});

test("deer cautiously investigates the actual moved decoy and resumes interest after relocation", () => {
  const run = crew(16),
    d = run.animals.find((a) => a.species === "deer")!,
    decoy = run.props.find((p) => p.kind === "decoy")!;
  decoy.pose = pose([d.pose.position[0] + 3, 0.5, d.pose.position[2]]);
  step(run, 3);
  assert.equal(d.behavior, "investigate");
  assert.ok(distance(d.pose.position, decoy.pose.position) < 2);
  step(run, 12);
  assert.notEqual(d.behavior, "investigate");
  decoy.pose.position[2] += 3;
  step(run, 5);
  assert.equal(d.behavior, "investigate");
});

test("washing requires food at the selected stream and heron feeding follows either selected patch", () => {
  for (const seed of [8, 13]) {
    const run = crew(seed),
      r = run.animals.find(a => a.species === "raccoon")!,
      h = run.animals.find(a => a.species === "heron")!,
      wash = anchor(run, "raccoon", "wash");
    run.tin.pose = pose([wash[0] + 0.6, 0.109, wash[2]]);
    run.tin.open = true;
    run.tin.portions = 0;
    step(run, 3);
    assert.notEqual(r.behavior, "wash");
    run.tin.portions = 4;
    run.tin.pose.position[0] += 0.1;
    // Changing an exhausted lure to food is a meaningful setup change.
    for (let i = 0; i < 60 && r.behavior !== "wash"; i++) step(run, 0.1);
    assert.equal(r.behavior, "wash");
    const patch = home(run, "heron"),
      p = run.players[0];
    run.tin.holder = p.id;
    p.position = [patch[0], 0, patch[2] + 1];
    applyCommand(run, p.id, { type: "use", seq: p.lastSeq + 1 });
    assert.equal(run.baitPatches[run.world.pockets.flatMap(p => p.anchors).find(a => a.kind === "feed")!.id], 1);
    p.position = [...CAMP];
    step(run, 15);
    assert.ok(distance(h.pose.position, patch) < 3);
    assert.equal(run.baitPatches[run.world.pockets.flatMap(p => p.anchors).find(a => a.kind === "feed")!.id], 0);
  }
});

test("selected behavior photographs use both deer attachments through the physical screen opening", () => {
  const run = crew(),
    d = run.animals.find((a) => a.species === "deer")!,
    p = run.players[0],
    screen = run.props.find((p) => p.kind === "screen")!;
  d.behavior = "graze";
  p.position = [d.pose.position[0], 0, d.pose.position[2] + 6];
  screen.pose = pose([p.position[0], 0.97, p.position[2] - 0.8]);
  const frame = makePhotoFrame(run, p.id);
  assert.ok(subjectPoints(d, frame.tick)[1][1] < 1.5);
  assert.ok(evaluatePhoto(frame, WALLS).credits.includes("deer-graze"));
  const panel = structuredClone(frame);
  panel.props.find((p) => p.kind === "screen")!.pose.position[0] += 0.9;
  assert.ok(!evaluatePhoto(panel, WALLS).credits.includes("deer-graze"));
  const other = structuredClone(frame);
  other.world.assignments[1] = "deer-decoy";
  assert.ok(!evaluatePhoto(other, WALLS).credits.includes("deer-graze"));
});

test("a rotated screen keeps the edge of its opening clear in the immutable photo", () => {
  const run = crew(),
    d = run.animals.find((a) => a.species === "deer")!,
    p = run.players[0],
    screen = run.props.find((p) => p.kind === "screen")!;
  const yaw = Math.PI / 4,
    transform = (x: number, z: number): Vec3 => [
      21 + x * Math.cos(yaw) + z * Math.sin(yaw),
      0,
      14 - x * Math.sin(yaw) + z * Math.cos(yaw),
    ];
  d.pose = {
    position: transform(0.53, -6),
    rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
  };
  d.behavior = "graze";
  p.position = transform(0.53, 0.8);
  p.yaw = yaw;
  screen.pose = {
    position: [21, 0.97, 14],
    rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
  };
  assert.ok(
    evaluatePhoto(makePhotoFrame(run, p.id), WALLS).credits.includes(
      "deer-graze",
    ),
  );
});

test("every seed's four selected commissions are attainable through actual encounter states", () => {
  for (let seed = 0; seed < 64; seed++) {
    const run = crew(seed),
      r = run.animals.find(a => a.species === "raccoon")!,
      h = run.animals.find(a => a.species === "heron")!,
      d = run.animals.find(a => a.species === "deer")!,
      p = run.players[0],
      wash = anchor(run, "raccoon", "wash"),
      wet = home(run, "heron");
    const until = (condition: () => boolean, seconds = 15) => {
      for (let i = 0; i < seconds * 10 && !condition(); i++) step(run, 0.1);
      assert.ok(condition(), `seed ${seed}: ${JSON.stringify(run.animals)}`);
    };
    const photograph = (point: Vec3) => {
      p.position = [point[0], 0, point[2] + 7];
      p.yaw = 0;
      p.pitch = -0.08;
      run.tick += 60;
      const result = applyCommand(run, p.id, {
        type: "photo",
        seq: p.lastSeq + 1,
      })!;
      p.position = [...CAMP];
      return result.verdict;
    };
    if (run.world.commissions.filter(c => c.required).map(c => c.id).includes("raccoon-wash")) {
      run.tin.pose = pose([wash[0] + 0.6, 0.109, wash[2]]);
      run.tin.open = true;
      until(() => r.behavior === "wash");
      assert.ok(
        photograph(r.pose.position).credits.includes("raccoon-wash"),
        `wash ${seed}`,
      );
    }
    const decoy = run.props.find((p) => p.kind === "decoy")!;
    if (run.world.commissions.filter(c => c.required).map(c => c.id).includes("deer-decoy")) {
      decoy.pose = pose([d.pose.position[0] + 3, 0.5, d.pose.position[2]]);
      until(() => d.behavior === "investigate");
      assert.ok(
        photograph(d.pose.position).credits.includes("deer-decoy"),
        `decoy ${seed}`,
      );
    } else {
      until(() => d.behavior === "graze");
      assert.ok(
        photograph(d.pose.position).credits.includes("deer-graze"),
        `graze ${seed}`,
      );
    }
    if (run.world.commissions.filter(c => c.required).map(c => c.id).includes("heron-preen")) {
      until(() => h.behavior === "preen");
      assert.ok(
        photograph(h.pose.position).credits.includes("heron-preen"),
        `preen ${seed}`,
      );
    }
    // Arrange a second supported encounter, then let normal feeding and lure interest create the portrait window.
    r.pose = pose([wet[0] - 5, 0, wet[2] + 1]);
    r.behavior = "wander";
    r.remaining = 0;
    run.tin.holder = null;
    run.tin.open = false;
    run.baitPatches[run.world.pockets.flatMap(p => p.anchors).find(a => a.kind === "feed")!.id] = 1;
    until(() => h.behavior === "feed" && h.remaining <= 3);
    run.tin.pose = pose([wet[0] - 5, 0.109, wet[2]]);
    run.tin.open = true;
    until(() => h.behavior === "display" && r.behavior === "inspect");
    const verdict = photograph([wet[0] - 2.5, 0, wet[2]]);
    assert.ok(
      verdict.credits.includes("pond-pair"),
      `pair ${seed}: ${JSON.stringify(verdict)}`,
    );
    assert.deepEqual(
      new Set(run.completed),
      new Set(run.world.commissions.filter(c => c.required).map(c => c.id)),
      `completion ${seed}`,
    );
  }
});

test("saved encounter memory is bounded, exact, referenced and preserves the seeded configuration", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "wu encounters "));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const run = crew(63);
  step(run, 1);
  await saveRun(dir, run, new Map());
  const loaded = (await loadRun(dir))!.run;
  assert.deepEqual(loaded.world, run.world);
  assert.deepEqual(loaded.animalMemory, run.animalMemory);
  for (const mutate of [
    (r: typeof run) => delete r.animalMemory.deer,
    (r: typeof run) =>
      (r.animalMemory.deer.recentGoals = Array(5).fill("repeat")),
    (r: typeof run) => (r.animalMemory.deer.interestUntilTick = Infinity),
    (r: typeof run) => r.animals.pop(),
    (r: typeof run) => (r.world.sites.wetland = 0),
    (r: typeof run) => (r.completed = ["raccoon-inspect"]),
    (r: typeof run) => (r.phase = "exhibition"),
  ]) {
    const invalid = structuredClone(run);
    mutate(invalid);
    await assert.rejects(saveRun(dir, invalid, new Map()));
  }
});
