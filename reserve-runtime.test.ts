import assert from "node:assert/strict";
import { test } from "node:test";
import { createPhysics } from "./physics.ts";
import { generateReserve } from "./world.ts";
import { fixtureBoxes, fixtureSurfaces } from "./level.ts";
import { pose, type FieldProp, type FixtureState, type Tin } from "./shared.ts";

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
  const { createRun, addPlayer, snapshot, makePhotoFrame, evaluatePhoto, attachPhysics, advanceRun } = await import("./game.ts");
  const a = createRun(7, "run-a"), b = createRun(18, "run-b");
  assert.equal(a.version, 3);
  assert.equal(a.world.id, "run-a");
  assert.equal(a.worldId, a.world.id);
  assert.ok(Object.isFrozen(a.world));
  assert.ok(a.animals.length >= 36 && a.animals.length <= 48);
  assert.equal(new Set(a.animals.map(r => r.species)).size, 12);
  assert.deepEqual(a.animals.map(r => r.id), a.world.residents.map(r => r.id));
  const p = addPlayer(a, "a", "A"), q = addPlayer(b, "b", "B");
  assert.ok(Math.hypot(p.position[0] - a.world.camp[0], p.position[2] - a.world.camp[2]) < 6);
  assert.ok(Math.hypot(q.position[0] - b.world.camp[0], q.position[2] - b.world.camp[2]) < 6);
  assert.notDeepEqual(p.position, q.position);
  assert.equal("world" in snapshot(a), false);
  const frame = makePhotoFrame(a, p.id);
  assert.equal(frame.worldId, a.worldId);
  assert.equal("world" in frame, false);
  assert.ok(frame.id.startsWith(a.worldId + "-"));
  assert.throws(() => evaluatePhoto(frame, b.world), /world/i);
  const physics = await attachPhysics(a);
  try { advanceRun(a, 1 / 60); physics.step(1 / 60); }
  finally { physics.dispose(); }
});

test("schema 3 saves preserve exact blueprint and reject cross-world frozen references", async () => {
  const { mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createRun, addPlayer, makePhotoFrame } = await import("./game.ts");
  const { saveRun, loadRun } = await import("./save.ts");
  const dir = await mkdtemp(join(tmpdir(), "wu-schema3-"));
  try {
    const run = createRun(7, "saved-world"); addPlayer(run, "a", "A");
    const frame = makePhotoFrame(run, "a");
    run.pendingPhotos[frame.id] = frame;
    run.album.push({ id: frame.id, photographer: "a", tick: frame.tick, credits: [], assists: [], favorites: [], incident: null, thumbnail: "pending" });
    await saveRun(dir, run, new Map());
    const restored = (await loadRun(dir))!.run;
    assert.deepEqual(restored.world, run.world);
    assert.ok(Object.isFrozen(restored.world));
    assert.equal(restored.pendingPhotos[frame.id].worldId, run.worldId);
    assert.equal((await readFile(join(dir, "run.json"), "utf8")).match(/"placements":/g)?.length, 1);
    const invalid = structuredClone(run);
    invalid.pendingPhotos[frame.id].worldId = "another-world";
    await assert.rejects(saveRun(dir, invalid, new Map()), /world/i);
    invalid.pendingPhotos[frame.id].worldId = run.worldId;
    invalid.animals[0].species = "mallard";
    await assert.rejects(saveRun(dir, invalid, new Map()), /identit/i);
    await writeFile(join(dir, "run.json"), '{"version":2}');
    await assert.rejects(loadRun(dir), /version/i);
    assert.equal(await readFile(join(dir, "run.json"), "utf8"), '{"version":2}');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("legacy generated behavior credits require the bound resident, real state and clear photograph", async () => {
  const { createRun, addPlayer, makePhotoFrame, evaluatePhoto } = await import("./game.ts");
  for (const [seed, species] of [[1,"raccoon"],[5,"heron"],[9,"deer"]] as const) {
    const run = createRun(seed, "credit-world"), commission = run.world.commissions.find(c => c.kind === "behavior" && run.world.residents.find(r => r.id === c.subjects[0])!.species === species)!;
    const anchor = run.world.pockets.find(p => p.id === commission.pocket)!.anchors.find(a => a.id === commission.anchor)!;
    const subject = run.animals.find(a => a.id === commission.subjects[0])!;
    subject.pose = pose(anchor.point); subject.behavior = species === "raccoon" ? "wash" : species === "deer" ? "graze" : "preen";
    const player = addPlayer(run,"a","A"); player.position = [anchor.point[0],anchor.point[1],anchor.point[2]+5];
    player.yaw = 0; player.pitch = -0.12;
    if (species === "raccoon") {run.tin.open = true; run.tin.pose = pose([anchor.point[0]+0.9,anchor.point[1]+0.109,anchor.point[2]]);}
    const frame = structuredClone(makePhotoFrame(run,"a"));
    assert.ok(evaluatePhoto(frame,run.world).credits.includes(commission.id), species);
    const captured = frame.animals.find(a => a.id === subject.id)!;
    captured.behavior = "alert";
    assert.ok(!evaluatePhoto(frame,run.world).credits.includes(commission.id));
    captured.behavior = subject.behavior;
    frame.camera.yaw = Math.PI;
    assert.deepEqual(evaluatePhoto(frame,run.world).credits,[]);
  }
});

test("a seated generated crossing is permanent and cannot be recovered as loose equipment", async () => {
  const { createRun, addPlayer, applyCommand } = await import("./game.ts");
  const run = createRun(9,"permanent-crossing"), player = addPlayer(run,"a","A");
  for (const fixture of run.world.fixtures.filter(f => f.kind === "crossing")) {
    const seat = Object.keys(fixture.seats)[0], plank = run.props.find(p => p.id === fixture.plankId)!;
    run.route[fixture.id] = {open: true,seat}; plank.pose = structuredClone(fixture.seats[seat]); plank.placed = true;
  }
  const before = structuredClone(run.route); run.tin.holder = player.id;
  assert.throws(() => applyCommand(run,player.id,{worldId:run.worldId,type:"recover",seq:1}), /tin is currently held/);
  assert.deepEqual(run.route,before);
  assert.ok(run.props.filter(p=>p.kind==="plank").every(p=>p.placed));
});
