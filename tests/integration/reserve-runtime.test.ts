import assert from "node:assert/strict";
import { test } from "node:test";
import { createPhysics } from "../../src/server/simulation/physics.ts";
import { generateReserve } from "../../src/shared/world/world.ts";
import { fixtureBoxes, fixtureSurfaces } from "../../src/shared/world/level.ts";
import {
  pose,
  type FieldProp,
  type FixtureState,
  type Tin,
} from "../../src/shared/shared.ts";

const initialFixtures = (
  world: ReturnType<typeof generateReserve>,
): FixtureState =>
  Object.fromEntries(
    world.fixtures.map((f) => [f.id, { open: false, seat: null }]),
  );

test("generated fixture geometry selects independent crossings and gates by ID", () => {
  const a = generateReserve(7, "fixture-a"),
    b = generateReserve(18, "fixture-b");
  const state = initialFixtures(a),
    crossing = a.fixtures.find((f) => f.kind === "crossing")!;
  assert.deepEqual(
    fixtureBoxes(a.fixtures, state),
    a.fixtures.flatMap((f) => f.closedBoxes),
  );
  assert.deepEqual(fixtureSurfaces(a.fixtures, state), []);
  state[crossing.id] = { open: true, seat: Object.keys(crossing.seats)[0] };
  assert.deepEqual(fixtureSurfaces(a.fixtures, state), crossing.openSurfaces);
  assert.deepEqual(
    fixtureBoxes(a.fixtures, state),
    a.fixtures
      .filter((f) => f.id !== crossing.id)
      .flatMap((f) => f.closedBoxes),
  );
  assert.notDeepEqual(
    fixtureBoxes(a.fixtures, initialFixtures(a)),
    fixtureBoxes(b.fixtures, initialFixtures(b)),
  );
  assert.throws(() => fixtureBoxes(a.fixtures, {}), /fixture/i);
  state[crossing.id] = { open: false, seat: "unknown" };
  assert.throws(() => fixtureBoxes(a.fixtures, state), /fixture/i);
});

test("native generated crossings use their own seat and compound plank body", async () => {
  const world = generateReserve(7, "native-fixtures"),
    state = initialFixtures(world);
  for (const crossing of world.fixtures.filter((f) => f.kind === "crossing")) {
    const seat = Object.keys(crossing.seats)[0],
      at = crossing.seats[seat];
    state[crossing.id] = { open: true, seat };
    const tin: Tin = {
      pose: pose([at.position[0], at.position[1] + 1, at.position[2]]),
      velocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      holder: null,
      portions: 4,
      open: false,
    };
    const props: FieldProp[] = world.props.map((p) => ({
      ...p,
      pose: structuredClone(p.pose),
      velocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      holders: [null, null],
      placed: p.id === crossing.plankId,
      open: false,
      spillUntilTick: 0,
    }));
    props.find((p) => p.id === crossing.plankId)!.pose = structuredClone(at);
    const physics = await createPhysics(
      world.physicsBoxes,
      tin,
      props,
      state,
      world.fixtures,
    );
    try {
      let result = physics.step(1 / 60);
      for (let i = 0; i < 180; i++) result = physics.step(1 / 60);
      assert.ok(
        Math.abs(result.pose.position[1] - (at.position[1] + 0.05 + 0.109)) <
          0.04,
        `${crossing.id}: tin at ${result.pose.position}`,
      );
    } finally {
      physics.dispose();
    }
  }
});

// The production run must carry one world, while frequent and frozen state references it.
test("authoritative generated runs isolate resident identities, spawns and frozen geometry", async () => {
  const {
    createRun,
    addPlayer,
    snapshot,
    makePhotoFrame,
    evaluatePhoto,
    attachPhysics,
    advanceRun,
  } = await import("../../src/server/simulation/game.ts");
  const a = createRun(7, "run-a"),
    b = createRun(18, "run-b");
  assert.equal(a.version, 3);
  assert.equal(a.world.id, "run-a");
  assert.equal(a.worldId, a.world.id);
  assert.ok(Object.isFrozen(a.world));
  assert.ok(a.animals.length >= 36 && a.animals.length <= 48);
  assert.equal(new Set(a.animals.map((r) => r.species)).size, 12);
  assert.deepEqual(
    a.animals.map((r) => r.id),
    a.world.residents.map((r) => r.id),
  );
  const p = addPlayer(a, "a", "A"),
    q = addPlayer(b, "b", "B");
  assert.ok(
    Math.hypot(
      p.position[0] - a.world.camp[0],
      p.position[2] - a.world.camp[2],
    ) < 6,
  );
  assert.ok(
    Math.hypot(
      q.position[0] - b.world.camp[0],
      q.position[2] - b.world.camp[2],
    ) < 6,
  );
  assert.notDeepEqual(p.position, q.position);
  assert.equal("world" in snapshot(a), false);
  const frame = makePhotoFrame(a, p.id);
  assert.equal(frame.worldId, a.worldId);
  assert.equal("world" in frame, false);
  assert.ok(frame.id.startsWith(a.worldId + "-"));
  assert.throws(() => evaluatePhoto(frame, b.world), /world/i);
  const physics = await attachPhysics(a);
  try {
    advanceRun(a, 1 / 60);
    physics.step(1 / 60);
  } finally {
    physics.dispose();
  }
});

test("schema 3 saves preserve exact blueprint and reject cross-world frozen references", async () => {
  const { mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createRun, addPlayer, makePhotoFrame } =
    await import("../../src/server/simulation/game.ts");
  const { saveRun, loadRun } =
    await import("../../src/server/persistence/save.ts");
  const dir = await mkdtemp(join(tmpdir(), "wu-schema3-"));
  try {
    const run = createRun(7, "saved-world");
    addPlayer(run, "a", "A");
    const frame = makePhotoFrame(run, "a");
    run.pendingPhotos[frame.id] = frame;
    run.album.push({
      id: frame.id,
      photographer: "a",
      tick: frame.tick,
      credits: [],
      assists: [],
      favorites: [],
      incident: null,
      thumbnail: "pending",
    });
    await saveRun(dir, run, new Map());
    const restored = (await loadRun(dir))!.run;
    assert.deepEqual(restored.world, run.world);
    assert.ok(Object.isFrozen(restored.world));
    assert.equal(restored.pendingPhotos[frame.id].worldId, run.worldId);
    assert.equal(
      (await readFile(join(dir, "run.json"), "utf8")).match(/"placements":/g)
        ?.length,
      1,
    );
    const invalid = structuredClone(run);
    invalid.pendingPhotos[frame.id].worldId = "another-world";
    await assert.rejects(saveRun(dir, invalid, new Map()), /world/i);
    invalid.pendingPhotos[frame.id].worldId = run.worldId;
    invalid.animals[0].species = "mallard";
    await assert.rejects(saveRun(dir, invalid, new Map()), /identit/i);
    await writeFile(join(dir, "run.json"), '{"version":2}');
    await assert.rejects(loadRun(dir), /version/i);
    assert.equal(
      await readFile(join(dir, "run.json"), "utf8"),
      '{"version":2}',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("legacy generated behavior credits require the bound resident, real state and clear photograph", async () => {
  const { createRun, addPlayer, makePhotoFrame, evaluatePhoto } =
    await import("../../src/server/simulation/game.ts");
  for (const [seed, species] of [
    [1, "raccoon"],
    [5, "heron"],
    [9, "deer"],
  ] as const) {
    const run = createRun(seed, "credit-world"),
      commission = run.world.commissions.find(
        (c) =>
          c.kind === "behavior" &&
          run.world.residents.find((r) => r.id === c.subjects[0])!.species ===
            species,
      )!;
    const anchor = run.world.pockets
      .find((p) => p.id === commission.pocket)!
      .anchors.find((a) => a.id === commission.anchor)!;
    const subject = run.animals.find((a) => a.id === commission.subjects[0])!;
    subject.pose = pose(anchor.point);
    subject.behavior =
      species === "raccoon" ? "wash" : species === "deer" ? "graze" : "preen";
    const player = addPlayer(run, "a", "A");
    player.position = [anchor.point[0], anchor.point[1], anchor.point[2] + 5];
    player.yaw = 0;
    player.pitch = -0.12;
    if (species === "raccoon") {
      run.tin.open = true;
      run.tin.pose = pose([
        anchor.point[0] + 0.9,
        anchor.point[1] + 0.109,
        anchor.point[2],
      ]);
    }
    const frame = structuredClone(makePhotoFrame(run, "a"));
    assert.ok(
      evaluatePhoto(frame, run.world).credits.includes(commission.id),
      species,
    );
    const captured = frame.animals.find((a) => a.id === subject.id)!;
    captured.behavior = "alert";
    assert.ok(!evaluatePhoto(frame, run.world).credits.includes(commission.id));
    captured.behavior = subject.behavior;
    frame.camera.yaw = Math.PI;
    assert.deepEqual(evaluatePhoto(frame, run.world).credits, []);
  }
});

test("a seated generated crossing is permanent and cannot be recovered as loose equipment", async () => {
  const { createRun, addPlayer, applyCommand } =
    await import("../../src/server/simulation/game.ts");
  const run = createRun(9, "permanent-crossing"),
    player = addPlayer(run, "a", "A");
  for (const fixture of run.world.fixtures.filter(
    (f) => f.kind === "crossing",
  )) {
    const seat = Object.keys(fixture.seats)[0],
      plank = run.props.find((p) => p.id === fixture.plankId)!;
    run.route[fixture.id] = { open: true, seat };
    plank.pose = structuredClone(fixture.seats[seat]);
    plank.placed = true;
  }
  const before = structuredClone(run.route);
  run.tin.holder = player.id;
  assert.throws(
    () =>
      applyCommand(run, player.id, {
        worldId: run.worldId,
        type: "recover",
        seq: 1,
      }),
    /tin is currently held/,
  );
  assert.deepEqual(run.route, before);
  assert.ok(run.props.filter((p) => p.kind === "plank").every((p) => p.placed));
});

test("placing the shared tin uses the generated open deck's actual support height", async () => {
  const { createRun, addPlayer, applyCommand } =
    await import("../../src/server/simulation/game.ts");
  const run = createRun(9, "deck-placement"),
    p = addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { worldId: run.worldId, type: "start", seq: 1 });
  const fixture = run.world.fixtures.find((f) => f.kind === "crossing")!,
    key = Object.keys(fixture.seats)[0],
    plank = run.props.find((p) => p.id === fixture.plankId)!;
  run.route[fixture.id] = { open: true, seat: key };
  plank.placed = true;
  plank.pose = structuredClone(fixture.seats[key]);
  p.position = [fixture.position[0] - 0.7, 0.198, fixture.position[2]];
  p.yaw = -Math.PI / 2;
  run.tin.holder = p.id;
  applyCommand(run, p.id, { worldId: run.worldId, type: "interact", seq: 2 });
  assert.equal(run.tin.holder, null);
  assert.ok(Math.abs(run.tin.pose.position[1] - (0.198 + 0.109)) < 1e-8);
});

test("production movement and navigation keep independent generated geometry and caches", async () => {
  const { createRun, addPlayer, applyCommand, advanceRun } =
    await import("../../src/server/simulation/game.ts");
  const { animalRoute } =
    await import("../../src/server/simulation/wildlife/encounters.ts");
  const { surfaceHeight, rayBlocked } =
    await import("../../src/shared/shared.ts");
  const a = createRun(7, "movement-a"),
    b = createRun(18, "movement-b");
  for (const run of [a, b]) {
    addPlayer(run, "p", "P");
    addPlayer(run, "q", "Q");
    applyCommand(run, "p", { worldId: run.worldId, type: "start", seq: 1 });
  }
  const water = a.world.waters.find((w) => {
    const start: [number, number, number] = [
        w.min[0] - 0.6,
        0,
        (w.min[2] + w.max[2]) / 2,
      ],
      end: [number, number, number] = [start[0] + 2, 0, start[2]];
    return (
      b.world.walkables.some(
        (s) => surfaceHeight(s, start[0], start[2]) !== null,
      ) &&
      b.world.walkables.some(
        (s) => surfaceHeight(s, end[0], end[2]) !== null,
      ) &&
      !rayBlocked(
        [start[0], 1, start[2]],
        [end[0], 1, end[2]],
        b.world.walls.map((w) => ({
          id: w.id,
          min: [w.min[0] - 0.35, w.min[1], w.min[2] - 0.35],
          max: [w.max[0] + 0.35, w.max[1], w.max[2] + 0.35],
        })),
      )
    );
  })!;
  assert.ok(water, "a water boundary is open ground in b");
  const start: [number, number, number] = [
    water.min[0] - 0.6,
    0,
    (water.min[2] + water.max[2]) / 2,
  ];
  for (const run of [a, b]) {
    run.players[0].position = [...start];
    for (let i = 0; i < 60; i++) {
      applyCommand(run, "p", {
        worldId: run.worldId,
        type: "input",
        value: {
          seq: run.players[0].lastSeq + 1,
          x: 1,
          z: 0,
          yaw: 0,
          pitch: 0,
          run: false,
          crouch: false,
        },
      });
      advanceRun(run, 1 / 60);
    }
  }
  assert.ok(
    a.players[0].position[0] <= water.min[0] + 1e-8,
    JSON.stringify({ position: a.players[0].position, water }),
  );
  assert.ok(b.players[0].position[0] > start[0] + 2);
  for (const run of [a, b, a]) {
    const node = run.world.navNodes.find((n) => n.id === "p0-camera-a")!;
    const path = animalRoute(run.world.camp, node.id, run);
    assert.ok(path.length);
    assert.deepEqual(path.at(-1), node.position);
  }
});

test("generated gate interaction follows the actual opened latch and preserves other fixtures", async () => {
  const { createRun, addPlayer, applyCommand } =
      await import("../../src/server/simulation/game.ts"),
    { fixtureLatch } = await import("../../src/shared/world/level.ts");
  const run = createRun(9, "moving-latch"),
    p = addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { worldId: run.worldId, type: "start", seq: 1 });
  const gate = run.world.fixtures.find((f) => f.kind === "gate")!,
    closed = fixtureLatch(gate, run.route)!;
  p.position = [closed[0], 0, closed[2] + 0.5];
  applyCommand(run, p.id, { worldId: run.worldId, type: "interact", seq: 2 });
  assert.equal(run.route[gate.id].open, true);
  const opened = fixtureLatch(gate, run.route)!;
  assert.ok(Math.hypot(opened[0] - closed[0], opened[2] - closed[2]) > 4);
  p.position = [opened[0], 0, opened[2] + 0.5];
  applyCommand(run, p.id, { worldId: run.worldId, type: "interact", seq: 3 });
  assert.equal(run.route[gate.id].open, false);
  assert.ok(
    run.world.fixtures
      .filter((f) => f.kind === "crossing")
      .every((f) => !run.route[f.id].open),
  );
});

test("unimplemented new wildlife commissions do not inherit permissive legacy credit", async () => {
  const { createRun, addPlayer, makePhotoFrame, evaluatePhoto } =
    await import("../../src/server/simulation/game.ts");
  const run = createRun(0, "pending-routines"),
    c = run.world.commissions.find(
      (c) =>
        c.kind === "behavior" &&
        run.world.residents.find((r) => r.id === c.subjects[0])!.species ===
          "mallard",
    )!;
  const anchor = run.world.pockets
      .find((p) => p.id === c.pocket)!
      .anchors.find((a) => a.id === c.anchor)!,
    subject = run.animals.find((a) => a.id === c.subjects[0])!,
    p = addPlayer(run, "a", "A");
  subject.pose = pose(anchor.point);
  subject.behavior = "dabble";
  p.position = [anchor.point[0], 0, anchor.point[2] + 3];
  p.pitch = -0.25;
  const frame = makePhotoFrame(run, p.id);
  assert.ok(!evaluatePhoto(frame, run.world).credits.includes(c.id));
  const malformed = structuredClone(frame);
  malformed.animals[1].id = malformed.animals[0].id;
  assert.throws(() => evaluatePhoto(malformed, run.world), /identity/);
});
