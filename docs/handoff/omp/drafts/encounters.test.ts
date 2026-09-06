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

function crew(seed = 9) {
  const run = createRun(seed);
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { type: "start", seq: 1 });
  return run;
}
function step(run: ReturnType<typeof createRun>, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) advanceRun(run, 1 / 60);
}

function home(run: ReturnType<typeof createRun>, species: string): Vec3 {
  const resident = run.world.residents.find((r) => r.species === species)!;
  return run.world.pockets.find((p) => p.id === resident.home)!.position;
}
function anchor(
  run: ReturnType<typeof createRun>,
  species: string,
  kind: string,
): Vec3 {
  const resident = run.world.residents.find((r) => r.species === species)!;
  return run.world.pockets
    .find((p) => p.id === resident.home)!
    .anchors.find((a) => a.kind === kind)!.point;
}
function applyCommand(
  run: ReturnType<typeof createRun>,
  id: string,
  input: Record<string, unknown>,
) {
  return applyWorldCommand(run, id, { worldId: run.worldId, ...input });
}

test("a crowded raccoon looks and reaches before a theft; stepping away interrupts it", () => {
  const run = crew(),
    r = run.animals.find((a) => a.species === "raccoon")!,
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
  assert.equal(run.hats[0].carrier, `animal:${r.id}`);
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
  assert.equal(
    run.hats.filter((h) => h.carrier.startsWith("animal:")).length,
    1,
  );
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
    r = run.animals.find((a) => a.species === "raccoon")!;
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
    r = run.animals.find((a) => a.species === "raccoon")!,
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
  assert.equal(run.hats[0].carrier, `animal:${r.id}`);
  const protection = run.hats[0].protectedUntilTick;
  disconnectPlayer(run, "a");
  assert.equal(run.hats[0].carrier, "owner");
  assert.equal(run.hats[0].protectedUntilTick, protection);
});

test("seeded outings preserve all twelve species and every generated resident identity", () => {
  const selections = new Set<string>();
  for (let seed = 0; seed < 16; seed++) {
    const run = createRun(seed, "deterministic-world");
    assert.deepEqual(run, createRun(seed, "deterministic-world"));
    assert.ok(run.animals.length >= 36 && run.animals.length <= 48);
    assert.equal(new Set(run.animals.map((a) => a.species)).size, 12);
    for (const resident of run.world.residents) {
      const animal = run.animals.find((a) => a.id === resident.id)!;
      assert.equal(animal.species, resident.species);
      assert.deepEqual(animal.pose.position, resident.spawn);
    }
    assert.equal(run.world.commissions.filter((c) => c.required).length, 6);
    selections.add(JSON.stringify(run.world.pockets));
  }
  assert.equal(selections.size, 16);
});

test("held open tin interest ends and a moved setup restores an actual inspection", () => {
  const run = crew(),
    r = run.animals.find((a) => a.species === "raccoon")!,
    p = run.players[0];
  r.pose.position = [...anchor(run, "raccoon", "ground")];
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

test("all six selected commissions are required for camp return", () => {
  const run = crew();
  run.completed = run.world.commissions
    .filter((c) => c.required)
    .map((c) => c.id)
    .slice(0, 3);
  run.players.forEach((p) => (p.position = [...run.world.camp]));
  assert.throws(
    () => applyCommand(run, "a", { type: "ready-end", seq: 2 }),
    /commission|photo/i,
  );
  run.completed = [
    ...run.world.commissions.filter((c) => c.required).map((c) => c.id),
  ];
  applyCommand(run, "a", { type: "ready-end", seq: 3 });
  applyCommand(run, "b", { type: "ready-end", seq: 1 });
  applyCommand(run, "a", { type: "finish", seq: 4 });
  assert.equal(run.phase, "exhibition");
});

test("all authored encounter approaches and route edges have supported animal-radius movement", () => {
  for (const seed of [2, 9])
    for (const open of [false, true]) {
      const run = createRun(seed, "navigation-world");
      if (open)
        for (const fixture of run.world.fixtures)
          run.route[fixture.id] = {
            open: true,
            seat:
              fixture.kind === "crossing"
                ? Object.keys(fixture.seats)[0]
                : null,
          };
      const route = run.route;
      for (const node of run.world.navNodes.filter((n) =>
        n.id.endsWith("camera-a"),
      )) {
        const path = animalRoute(run.world.camp, node.id, run);
        assert.ok(
          path.length,
          `${node.id} unreachable ${JSON.stringify(route)}`,
        );
        let from = run.world.camp;
        for (const to of path) {
          const steps = Math.ceil(distance(from, to) / 0.05);
          for (let i = 0; i <= steps; i++) {
            const point = from.map(
              (v, a) => v + ((to[a] - v) * i) / Math.max(1, steps),
            ) as Vec3;
            const heights = [
              ...run.world.walkables,
              ...fixtureSurfaces(run.world.fixtures, route),
            ]
              .map((s) => surfaceHeight(s, point[0], point[2]))
              .filter((h): h is number => h !== null);
            assert.ok(heights.length, `unsupported ${point}`);
            point[1] = Math.max(...heights);
            assert.ok(
              ![
                ...run.world.walls,
                ...fixtureBoxes(run.world.fixtures, route),
              ].some(
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
    d = run.animals.find((a) => a.species === "deer")!;
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
    r = run.animals.find((a) => a.species === "raccoon")!,
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
    r = run.animals.find((a) => a.species === "raccoon")!,
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
    behaviors.add(run.animals.find((a) => a.species === "deer")!.behavior);
  }
  assert.ok(
    behaviors.has("graze") && behaviors.has("settle"),
    "calm deer must pause to scan as well as graze",
  );
  for (const animal of run.animals.filter((a) =>
    ["raccoon", "deer", "heron"].includes(a.species),
  )) {
    const memory = run.animalMemory[animal.id];
    assert.ok(memory.recentGoals.length >= 2);
    const goals = [...memory.recentGoals, memory.goal];
    assert.ok(goals.every((g, i) => !i || g !== goals[i - 1]));
  }
});

test("a heron walks between resting sites and preens while stationary", () => {
  const run = crew(),
    h = run.animals.find((a) => a.species === "heron")!,
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
    r = run.animals.find((a) => a.species === "raccoon")!,
    wash = anchor(run, "raccoon", "wash");
  run.tin.pose = pose([wash[0] + 0.6, 0.109, wash[2]]);
  run.tin.open = true;
  for (let i = 0; i < 300 && r.behavior !== "wash"; i++) step(run, 0.1);
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
  for (let i = 0; i < 100 && d.behavior !== "investigate"; i++) step(run, 0.1);
  assert.equal(d.behavior, "investigate");
  step(run, 0.5);
  assert.equal(d.behavior, "investigate", "unchanged decoy keeps a stable inspection pose");
  assert.ok(distance(d.pose.position, decoy.pose.position) < 2);
  step(run, 12);
  assert.notEqual(d.behavior, "investigate");
  decoy.pose.position[2] += 3;
  for (let i = 0; i < 100 && d.behavior !== "investigate"; i++) step(run, 0.1);
  assert.equal(d.behavior, "investigate");
});

test("washing requires food at the selected stream and heron feeding follows either selected patch", () => {
  for (const seed of [8, 13]) {
    const run = crew(seed),
      r = run.animals.find((a) => a.species === "raccoon")!,
      h = run.animals.find((a) => a.species === "heron")!,
      wash = anchor(run, "raccoon", "wash");
    run.tin.pose = pose([wash[0] + 0.6, 0.109, wash[2]]);
    r.pose = pose(wash);
    run.tin.open = true;
    run.tin.portions = 0;
    step(run, 3);
    assert.notEqual(r.behavior, "wash");
    run.tin.portions = 4;
    run.tin.pose.position[0] += 0.1;
    // Changing an exhausted lure to food is a meaningful setup change.
    for (let i = 0; i < 300 && r.behavior !== "wash"; i++) step(run, 0.1);
    assert.equal(r.behavior, "wash");
    const patch = anchor(run, "heron", "feed"),
      p = run.players[0];
    run.tin.holder = p.id;
    p.position = [patch[0], 0, patch[2] + 1];
    applyCommand(run, p.id, { type: "use", seq: p.lastSeq + 1 });
    assert.equal(
      run.baitPatches[
        run.world.pockets
          .find(
            (p) =>
              p.id === run.world.residents.find((r) => r.id === h.id)!.home,
          )!
          .anchors.find((a) => a.kind === "feed")!.id
      ],
      1,
    );
    p.position = [...run.world.camp];
    step(run, 15);
    assert.ok(distance(h.pose.position, patch) < 3);
    assert.equal(
      run.baitPatches[
        run.world.pockets
          .find(
            (p) =>
              p.id === run.world.residents.find((r) => r.id === h.id)!.home,
          )!
          .anchors.find((a) => a.kind === "feed")!.id
      ],
      0,
    );
  }
});

test("selected behavior photographs use both deer attachments through the physical screen opening", () => {
  const run = crew(9),
    commission = run.world.commissions.find(
      (c) =>
        c.kind === "behavior" &&
        run.world.residents.find((r) => r.id === c.subjects[0])!.species ===
          "deer",
    )!,
    d = run.animals.find((a) => a.id === commission.subjects[0])!,
    p = run.players[0],
    screen = run.props.find((p) => p.kind === "screen")!;
  d.behavior = "graze";
  d.pose.position = [
    ...run.world.pockets
      .find((p) => p.id === commission.pocket)!
      .anchors.find((a) => a.id === commission.anchor)!.point,
  ];
  p.position = [d.pose.position[0], 0, d.pose.position[2] + 6];
  screen.pose = pose([p.position[0], 0.97, p.position[2] - 0.8]);
  const frame = makePhotoFrame(run, p.id);
  assert.ok(subjectPoints(d, frame.tick)[1][1] < 1.5);
  assert.ok(evaluatePhoto(frame, run.world).credits.includes(commission.id));
  const panel = structuredClone(frame);
  panel.props.find((p) => p.kind === "screen")!.pose.position[0] += 0.9;
  assert.ok(!evaluatePhoto(panel, run.world).credits.includes(commission.id));
  const other = structuredClone(frame);
  other.animals.find((a) => a.id === d.id)!.behavior = "investigate";
  assert.ok(!evaluatePhoto(other, run.world).credits.includes(commission.id));
});

test("a rotated screen keeps the edge of its opening clear in the immutable photo", () => {
  const run = crew(9),
    commission = run.world.commissions.find(
      (c) =>
        c.kind === "behavior" &&
        run.world.residents.find((r) => r.id === c.subjects[0])!.species ===
          "deer",
    )!,
    d = run.animals.find((a) => a.id === commission.subjects[0])!,
    p = run.players[0],
    screen = run.props.find((p) => p.kind === "screen")!;
  const goal = run.world.pockets
    .find((p) => p.id === commission.pocket)!
    .anchors.find((a) => a.id === commission.anchor)!.point;
  const yaw = Math.PI / 4,
    baseX = goal[0] - 0.53 * Math.cos(yaw) + 6 * Math.sin(yaw),
    baseZ = goal[2] + 0.53 * Math.sin(yaw) + 6 * Math.cos(yaw),
    transform = (x: number, z: number): Vec3 => [
      baseX + x * Math.cos(yaw) + z * Math.sin(yaw),
      0,
      baseZ - x * Math.sin(yaw) + z * Math.cos(yaw),
    ];
  d.pose = {
    position: transform(0.53, -6),
    rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
  };
  d.behavior = "graze";
  p.position = transform(0.53, 0.8);
  p.yaw = yaw;
  screen.pose = {
    position: [baseX, 0.97, baseZ],
    rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
  };
  assert.ok(
    evaluatePhoto(makePhotoFrame(run, p.id), run.world).credits.includes(
      commission.id,
    ),
  );
});

test("supported generated legacy behavior commissions arise from real encounter updates", () => {
  for (const [seed, species, behavior] of [
    [1, "raccoon", "wash"],
    [5, "heron", "preen"],
    [9, "deer", "graze"],
  ] as const) {
    const run = crew(seed),
      commission = run.world.commissions.find(
        (c) =>
          c.kind === "behavior" &&
          run.world.residents.find((r) => r.id === c.subjects[0])!.species ===
            species,
      )!;
    const animal = run.animals.find((a) => a.id === commission.subjects[0])!,
      goal = run.world.pockets
        .find((p) => p.id === commission.pocket)!
        .anchors.find((a) => a.id === commission.anchor)!;
    if (species === "raccoon") {
      animal.pose = pose(goal.point);
      run.tin.pose = pose([goal.point[0] + 0.6, 0.109, goal.point[2]]);
      run.tin.open = true;
    }
    for (let i = 0; i < 200 && animal.behavior !== behavior; i++)
      step(run, 0.1);
    assert.equal(animal.behavior, behavior);
    const player = run.players[0];
    player.position = [animal.pose.position[0], 0, animal.pose.position[2] + 5];
    player.pitch = -0.12;
    const result = applyCommand(run, player.id, {
      type: "photo",
      seq: player.lastSeq + 1,
    })!;
    assert.ok(result.verdict.credits.includes(commission.id));
    assert.equal(run.phase, "outing");
    assert.throws(
      () =>
        applyCommand(run, player.id, {
          type: "ready-end",
          seq: player.lastSeq + 1,
        }),
      /all six/,
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
    (r: typeof run) =>
      delete r.animalMemory[r.animals.find((a) => a.species === "deer")!.id],
    (r: typeof run) =>
      (r.animalMemory[
        r.animals.find((a) => a.species === "deer")!.id
      ].recentGoals = Array(5).fill("repeat")),
    (r: typeof run) =>
      (r.animalMemory[
        r.animals.find((a) => a.species === "deer")!.id
      ].interestUntilTick = Infinity),
    (r: typeof run) => r.animals.pop(),
    (r: typeof run) => (r.world.residents[0].home = "unknown-pocket"),
    (r: typeof run) => (r.completed = ["raccoon-inspect"]),
    (r: typeof run) => (r.phase = "exhibition"),
  ]) {
    const invalid = structuredClone(run);
    mutate(invalid);
    await assert.rejects(saveRun(dir, invalid, new Map()));
  }
});

test("legacy residents retain individual calm homes instead of converging on one species point", () => {
  const run = crew(9),
    deer = run.animals.filter((a) => a.species === "deer");
  step(run, 40);
  for (let i = 0; i < deer.length; i++)
    for (let j = i + 1; j < deer.length; j++) {
      assert.ok(
        distance(deer[i].pose.position, deer[j].pose.position) > 0.5,
        `${deer[i].id} overlaps ${deer[j].id}`,
      );
      assert.notDeepEqual(deer[i].target, deer[j].target);
    }
});

test("an ordinary dropped hat stays on reachable ground through ticks, restore and recovery", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "wu-ground-hat-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const live = crew(9),
    r = live.animals.find((a) => a.species === "raccoon")!,
    owner = live.players[0];
  owner.position = [r.pose.position[0], 0, r.pose.position[2] + 1];
  step(live, 1.5);
  const hat = live.hats.find((h) => h.owner === owner.id)!;
  assert.equal(hat.carrier, `animal:${r.id}`);
  owner.position = [...live.world.camp];
  for (let i = 0; i < 1900 && hat.carrier !== "ground"; i++)
    advanceRun(live, 1 / 60);
  assert.equal(hat.carrier, "ground");
  const at = [...hat.position],
    protection = hat.protectedUntilTick;
  await saveRun(dir, live, new Map());
  const restored = (await loadRun(dir))!.run;
  addPlayer(restored, "a", "A");
  addPlayer(restored, "b", "B");
  applyCommand(restored, "a", {
    type: "resume",
    seq: restored.players[0].lastSeq + 1,
  });
  for (const run of [live, restored]) {
    step(run, 0.5);
    const ground = run.hats.find((h) => h.owner === "a")!;
    assert.equal(ground.carrier, "ground");
    assert.deepEqual(ground.position, at);
    const ally = run.players.find((p) => p.id === "b")!;
    ally.position = [
      ground.position[0],
      ground.position[1],
      ground.position[2] + 0.5,
    ];
    applyCommand(run, "b", { type: "interact", seq: ally.lastSeq + 1 });
    assert.equal(ground.carrier, "owner");
    assert.equal(ground.owner, "a");
    assert.equal(ground.protectedUntilTick, protection);
  }
});
