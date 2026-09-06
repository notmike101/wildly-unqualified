import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, loadRoom, loadRun, saveRun, validJPEG } from "./save.ts";
import {
  createRun,
  addPlayer,
  makePhotoFrame,
  advanceRun,
  attachPhysics,
  applyCommand as applyWorldCommand,
  disconnectPlayer,
} from "./game.ts";
import type { Spill } from "./shared.ts";

function applyCommand(run: ReturnType<typeof createRun>, id: string, input: Record<string, unknown>) {
  return applyWorldCommand(run, id, {worldId: run.worldId, ...input});
}

test("captured props, hat, gate and articulation remain exact after live changes and restart", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "wu frozen frame "));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const run = createRun();
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { type: "start", seq: 1 });
  const captured = applyCommand(run, "a", { type: "photo", seq: 2 })!.frame;
  const expected = structuredClone(captured);
  run.props[0].pose.position[0] += 2;
  run.props[0].open = true;
  run.route.gate.open = true;
  run.hats[0].carrier = "ground";
  run.hats[0].position = [...run.players[0].position];
  run.players[0].name = "Changed";
  run.players[0].yaw = 1;
  run.animals[0].remaining = 3;
  run.animals[0].pose.position[0] += 1;
  run.tin.open = true;
  run.tick += 60;
  assert.throws(() => {
    captured.props[0].pose.position[0] = 0;
  }, TypeError);
  assert.throws(() => {
    captured.hats[0].carrier = "ground";
  }, TypeError);
  assert.deepEqual(captured, expected);
  await saveRun(dir, run, new Map());
  const restored = (await loadRun(dir))!.run;
  assert.deepEqual(restored.pendingPhotos[captured.id], expected);
  assert.equal(restored.route.gate.open, true);
  assert.equal(restored.pendingPhotos[captured.id].route.gate.open, false);
});

test("saved favorites reject duplicate and foreign crew identities", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "wu favorites "));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const run = createRun();
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { type: "start", seq: 1 });
  applyCommand(run, "a", { type: "photo", seq: 2 });
  run.album[0].favorites = ["a", "a"];
  await assert.rejects(saveRun(dir, run, new Map()), /duplicate.*favorite/i);
  run.album[0].favorites = ["foreign"];
  await assert.rejects(saveRun(dir, run, new Map()), /favorite/i);
});

test("mid-reach and stolen hats persist their actual theft/drop/protection clocks and owner", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "wu hat incident "));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let run = createRun(9);
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { type: "start", seq: 1 });
  const commission = run.world.commissions.find(c => c.kind === "behavior" && run.world.residents.find(r => r.id === c.subjects[0])!.species === "deer")!,
    deer = run.animals.find(a => a.id === commission.subjects[0])!,
    anchor = run.world.pockets.flatMap(p => p.anchors).find(a => a.id === commission.anchor)!.point,
    photographer = run.players[0];
  deer.pose.position = [...anchor]; deer.behavior = "graze";
  photographer.position = [anchor[0], anchor[1], anchor[2] + 5]; photographer.pitch = -0.12;
  assert.ok(applyCommand(run, "a", {type: "photo", seq: 2})!.verdict.credits.includes(commission.id));
  run.route.gate.open = true;
  const r = run.animals.find(a => a.species === "raccoon")!;
  run.players[0].position = [r.pose.position[0], 0, r.pose.position[2] + 1];
  for (let i = 0; i < 30; i++) advanceRun(run, 1 / 60);
  assert.equal(r.behavior, "hat-reach");
  const remaining = r.remaining;
  await saveRun(dir, run, new Map());
  run = (await loadRun(dir))!.run;
  assert.equal(run.animals.find(a => a.id === r.id)!.remaining, remaining);
  applyCommand(run, "a", { type: "resume", seq: run.players[0].lastSeq + 1 });
  for (let i = 0; i < 65; i++) advanceRun(run, 1 / 60);
  assert.equal(run.hats[0].carrier, `animal:${r.id}`);
  const until = run.hats[0].untilTick,
    protection = run.hats[0].protectedUntilTick;
  const progress = structuredClone([
    run.world,
    run.completed,
    run.route,
    run.album,
  ]);
  await saveRun(dir, run, new Map());
  run = (await loadRun(dir))!.run;
  assert.equal(run.hats[0].untilTick, until);
  assert.equal(run.hats[0].protectedUntilTick, protection);
  applyCommand(run, "a", { type: "resume", seq: run.players[0].lastSeq + 1 });
  while (run.tick < until) advanceRun(run, 1 / 60);
  assert.equal(run.hats[0].carrier, "ground");
  assert.equal(run.hats[0].untilTick, 0);
  assert.deepEqual([run.world, run.completed, run.route, run.album], progress);
  const pile = run.hats[0].position;
  run.players[1].position = [pile[0], pile[1], pile[2] + 0.4];
  applyCommand(run, "b", { type: "interact", seq: run.players[1].lastSeq + 1 });
  assert.equal(run.hats[0].carrier, "owner");
  assert.equal(run.hats[0].protectedUntilTick, protection);
  disconnectPlayer(run, "a");
  assert.equal(run.hats[0].carrier, "owner");
});

test("live and frozen incidents reject contradictory owners, states and far-future deadlines", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "wu invalid incidents "));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const base = createRun();
  addPlayer(base, "a", "A");
  addPlayer(base, "b", "B");
  const changes: ((s: any) => void)[] = [
    (s) =>
      (s.spills = [
        {
          id: "spill-1",
          position: [base.world.waters[0].min[0] + 1, 0, base.world.waters[0].min[2] + 1],
          portions: 1,
          untilTick: s.tick + 60,
        },
      ]),
    (s) =>
      Object.assign(s.hats[0], { carrier: "ground", position: [base.world.waters[0].min[0] + 1, 0, base.world.waters[0].min[2] + 1] }),
    (s) =>
      (s.spills = [
        {
          id: "spill-1",
          position: [0, 0, 0],
          portions: 2,
          untilTick: s.tick + 60,
        },
      ]),
    (s) => s.hats.pop(),
    (s) => (s.hats[0].owner = "missing"),
    (s) => (s.hats[0].untilTick = 20),
    (s) => (s.hats[0].protectedUntilTick = s.tick + 3601),
    (s) =>
      Object.assign(s.hats[0], {
        carrier: "raccoon",
        untilTick: s.tick + 1801,
        protectedUntilTick: s.tick + 3600,
      }),
    (s) =>
      Object.assign(s.hats[0], {
        carrier: "raccoon",
        untilTick: s.tick + 1800,
        protectedUntilTick: 0,
      }),
    (s) =>
      s.hats.forEach((h: any) =>
        Object.assign(h, {
          carrier: "raccoon",
          untilTick: s.tick + 1800,
          protectedUntilTick: s.tick + 3600,
        }),
      ),
    (s) => (s.props[0].spillUntilTick = s.tick + 121),
    (s) => (s.props[1].spillUntilTick = 1),
    (s) =>
      (s.spills = [
        {
          id: "spill-1",
          position: [0, 0, 0],
          portions: 1,
          untilTick: s.tick + 3601,
        },
      ]),
    (s) =>
      (s.spills = [
        { id: "spill-1", position: [0, 0, 0], portions: 1, untilTick: s.tick },
      ]),
    (s) =>
      (s.spills = [
        {
          id: "spill-1",
          position: [0, 30, 0],
          portions: 1,
          untilTick: s.tick + 60,
        },
      ]),
    (s) => Object.assign(s.animals[1], { behavior: "hat-reach", remaining: 1 }),
  ];
  for (const frozen of [false, true])
    for (const [index, change] of changes.entries()) {
      const run = structuredClone(base);
      if (frozen) {
        const frame = structuredClone(makePhotoFrame(run, "a"));
        change(frame);
        run.pendingPhotos[frame.id] = frame;
        run.album = [
          {
            id: frame.id,
            photographer: "a",
            tick: frame.tick,
            credits: [],
            assists: [],
            favorites: [],
            incident: null,
            thumbnail: "pending",
          },
        ];
      } else change(run);
      await assert.rejects(
        saveRun(dir, run, new Map()),
        `mutation ${index}, frozen ${frozen}`,
      );
    }
  for (const change of [
    (s: any) => (s.animalMemory[s.animals.find((a: any) => a.species === "raccoon").id].hatTarget = "missing"),
    (s: any) => (s.animalMemory[s.animals.find((a: any) => a.species === "raccoon").id].hatTarget = "a"),
    (s: any) => (s.animals[0].behavior = "hat-reach"),
  ]) {
    const run = structuredClone(base);
    change(run);
    await assert.rejects(saveRun(dir, run, new Map()));
  }
  const run = structuredClone(base),
    r = run.animals.find(a => a.species === "raccoon")!;
  applyCommand(run, "a", { type: "start", seq: 1 });
  run.players[0].position = [r.pose.position[0], 0, r.pose.position[2] + 1];
  for (let i = 0; i < 12; i++) advanceRun(run, 1 / 60);
  assert.equal(r.behavior, "hat-reach");
  run.animalMemory[run.animals.find(a => a.species === "raccoon")!.id].hatTarget = "b";
  await assert.rejects(
    saveRun(dir, run, new Map()),
    "hat reach memory must name the actual target owner",
  );
  run.animalMemory[run.animals.find(a => a.species === "raccoon")!.id].hatTarget = "a";
  for (const frozen of [false, true]) {
    const invalid = structuredClone(run);
    if (frozen) {
      const frame = structuredClone(makePhotoFrame(invalid, "a"));
      frame.animals.find(a => a.id === r.id)!.pose.position = [0, 0, 0];
      invalid.pendingPhotos[frame.id] = frame;
      invalid.album = [
        {
          id: frame.id,
          photographer: "a",
          tick: frame.tick,
          credits: [],
          assists: [],
          favorites: [],
          incident: null,
          thumbnail: "pending",
        },
      ];
    } else invalid.animals.find(a => a.id === r.id)!.pose.position = [0, 0, 0];
    await assert.rejects(
      saveRun(dir, invalid, new Map()),
      `distant raccoon, frozen ${frozen}`,
    );
  }
  const covered = structuredClone(base);
  covered.hats[0].carrier = "ground";
  covered.hats[0].position = [0, 0, 0];
  covered.spills = [
    { id: "spill-covered", position: [0, 0, 0], portions: 1, untilTick: 60 },
  ];
  covered.props[0].pose.position = [0, 0.325, 0];
  await saveRun(dir, covered, new Map());
});

test("disconnect during a reach safely cancels the target and remains saveable", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "wu interrupted hat "));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const run = createRun(0);
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { type: "start", seq: 1 });
  const r = run.animals.find(a => a.species === "raccoon")!;
  run.players[0].position = [r.pose.position[0], 0, r.pose.position[2] + 1];
  for (let i = 0; i < 12; i++) advanceRun(run, 1 / 60);
  assert.equal(r.behavior, "hat-reach");
  disconnectPlayer(run, "a");
  assert.notEqual(r.behavior, "hat-reach");
  assert.equal(run.animalMemory[run.animals.find(a => a.species === "raccoon")!.id].hatTarget, null);
  await saveRun(dir, run, new Map());
});

test("a saved case incident guard survives released-body restart contacts and frozen capture", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "wu spill restart "));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let run = createRun();
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { type: "start", seq: 1 });
  run.props[0].pose.position = [0, 3, 0];
  run.props[0].open = true;
  let physics = await attachPhysics(run);
  try {
    for (let i = 0; i < 60; i++) {
      advanceRun(run, 1 / 60);
      physics.step(1 / 60);
    }
  } finally {
    physics.dispose();
  }
  assert.equal(run.spills.length, 1);
  assert.equal(run.spareBait, 7);
  const guard = run.props[0].spillUntilTick;
  const frame = makePhotoFrame(run, "a");
  assert.equal(frame.props[0].spillUntilTick, guard);
  await saveRun(dir, run, new Map());
  run = (await loadRun(dir))!.run;
  assert.equal(run.props[0].spillUntilTick, guard);
  assert.equal(run.spills.length, 1);
  applyCommand(run, "a", { type: "resume", seq: run.players[0].lastSeq + 1 });
  physics = await attachPhysics(run);
  try {
    for (let i = 0; i < 90; i++) {
      advanceRun(run, 1 / 60);
      physics.step(1 / 60);
    }
  } finally {
    physics.dispose();
  }
  assert.equal(run.spills.length, 1);
  assert.equal(run.spareBait, 7);
});

test("JPEG uploads require a bounded frame header and an actual scan", () => {
  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAA//Z",
    "base64",
  );
  assert.equal(validJPEG(jpeg), true);
  const huge = Buffer.from(jpeg);
  huge.writeUInt16BE(20000, huge.indexOf(Buffer.from([255, 192])) + 7);
  assert.equal(validJPEG(huge), false);
  assert.equal(
    validJPEG(Buffer.from([255, 216, 255, 224, 0, 2, 255, 217])),
    false,
  );
});

test("configuration is module relative and refuses invalid or publicly served private paths", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const config = loadConfig({
    WU_PORT: "4551",
    WU_DATA_DIR: "private data",
    WU_WEB_DIR: "public build",
    WU_PUBLIC_ORIGIN: "https://game.example",
  });
  assert.equal(config.port, 4551);
  assert.equal(config.origin, "https://game.example");
  assert.equal(config.dataDir, resolve(root, "private data"));
  assert.equal(config.webDir, resolve(root, "public build"));
  assert.equal(loadConfig({}).dataDir, join(root, "data-expedition"));
  for (const WU_PORT of ["0", "1.5", "65536", "-1", "4310junk", ""])
    assert.throws(() => loadConfig({ WU_PORT }));
  for (const WU_PUBLIC_ORIGIN of [
    "javascript:foo",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com/",
    "null",
  ])
    assert.throws(() => loadConfig({ WU_PUBLIC_ORIGIN }));
  assert.throws(() =>
    loadConfig({ WU_WEB_DIR: "public", WU_DATA_DIR: "public/private" }),
  );
});

test("save snapshots preserve pending frames and image bytes across serialized writes, backup, and rejected corruption", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "wu save "));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const room = await loadRoom(dataDir);
  assert.equal(room.joinSecret.length, 32);
  assert.notEqual(room.joinSecret, room.hostSecret);
  assert.deepEqual(await loadRoom(dataDir), room);
  assert.equal(await loadRun(dataDir), null);
  const run = createRun();
  addPlayer(run, "host", "Host");
  run.hostId = "host";
  const frame = makePhotoFrame(run, "host");
  run.pendingPhotos[frame.id] = frame;
  run.album.push({
    id: frame.id,
    photographer: "host",
    tick: frame.tick,
    credits: [run.world.commissions[0].id],
    assists: [],
    favorites: [],
    incident: null,
    thumbnail: "pending",
  });
  run.completed = [run.world.commissions[0].id];
  run.tin.portions = 2;
  run.animals[1].behavior = "display";
  run.animals[1].remaining = 4.25;
  const first = saveRun(dataDir, run, new Map());
  run.seconds = 12;
  const second = saveRun(dataDir, run, new Map());
  await Promise.all([first, second]);
  const loaded = (await loadRun(dataDir))!;
  assert.equal(loaded.run.seconds, 12);
  assert.equal(loaded.run.tin.portions, 2);
  assert.equal(loaded.run.animals[1].remaining, 4.25);
  assert.equal(loaded.run.version, 3);
  assert.equal(loaded.run.world.content, "forest-expedition-1");
  assert.equal(loaded.run.players[0].slot, 0);
  assert.equal(loaded.run.props.length, run.world.props.length);
  assert.equal(loaded.run.hats[0].owner, "host");
  assert.deepEqual(loaded.run.pendingPhotos[frame.id], frame);
  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAA//Z",
    "base64",
  );
  loaded.run.album[0].thumbnail = "ready";
  delete loaded.run.pendingPhotos[frame.id];
  await saveRun(dataDir, loaded.run, new Map([[frame.id, jpeg]]));
  assert.deepEqual(
    Buffer.from((await loadRun(dataDir))!.images.get(frame.id)!),
    jpeg,
  );
  await writeFile(join(dataDir, "run.json"), "{broken");
  const backup = (await loadRun(dataDir))!;
  assert.equal(backup.run.album[0].thumbnail, "pending");
  await writeFile(join(dataDir, "run.json"), JSON.stringify({ version: 999 }));
  await assert.rejects(loadRun(dataDir), /version/i);
  const valid = JSON.parse(
    await readFile(join(dataDir, "run.json.bak"), "utf8"),
  );
  valid.run.album[0].thumbnail = "ready";
  await writeFile(join(dataDir, "run.json"), JSON.stringify(valid));
  await rm(join(dataDir, "run.json.bak"));
  await assert.rejects(loadRun(dataDir), /image|pending/i);
});

test("failed filesystem replacement retains the previous valid save", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "wu write failure "));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const run = createRun();
  await saveRun(dataDir, run, new Map());
  await mkdir(join(dataDir, "run.json.tmp"));
  run.seconds = 10;
  await assert.rejects(saveRun(dataDir, run, new Map()));
  assert.equal((await loadRun(dataDir))!.run.seconds, 0);
});

test("restart data pauses and releases equipment without mutating the live outing", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "wu restart release "));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const run = createRun();
  addPlayer(run, "a", "A");
  run.paused = false;
  run.props[0].holders[0] = "a";
  run.tin.holder = "a";
  await saveRun(dataDir, run, new Map());
  const restored = (await loadRun(dataDir))!.run;
  assert.equal(restored.paused, true);
  assert.match(restored.pauseReason, /restart|saved/i);
  assert.deepEqual(restored.props[0].holders, [null, null]);
  assert.equal(restored.tin.holder, null);
  assert.deepEqual(run.props[0].holders, ["a", null]);
  assert.equal(run.tin.holder, "a");
});

test("version-1 outing saves fail with an explicit incompatibility error", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "wu old save "));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  await writeFile(
    join(dataDir, "run.json"),
    JSON.stringify({ version: 1, run: {}, images: {} }),
  );
  await assert.rejects(loadRun(dataDir), /incompatible.*version 1/i);
  const before = await readFile(join(dataDir, "run.json"), "utf8");
  await assert.rejects(
    saveRun(dataDir, createRun(), new Map()),
    /incompatible.*version 1/i,
  );
  assert.equal(await readFile(join(dataDir, "run.json"), "utf8"), before);
});

test("pending captures enforce the saved crew identities, slots and tin ownership", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "wu frame references "));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const run = createRun();
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  const frame = makePhotoFrame(run, "a");
  run.pendingPhotos[frame.id] = frame;
  run.album = [
    {
      id: frame.id,
      photographer: "a",
      tick: frame.tick,
      credits: [],
      assists: [],
      favorites: [],
      incident: null,
      thumbnail: "pending",
    },
  ];
  await saveRun(dataDir, run, new Map());
  for (const corrupt of [
    (f: typeof frame) => {
      f.players[1].slot = f.players[0].slot;
    },
    (f: typeof frame) => {
      f.tin.holder = "missing";
    },
    (f: typeof frame) => {
      f.players[1].id = "missing";
      f.hats = [];
    },
  ]) {
    const invalid = structuredClone(run);
    corrupt(invalid.pendingPhotos[frame.id]);
    await assert.rejects(saveRun(dataDir, invalid, new Map()));
  }
});

test("real Box3D impact events and active animal timers remain saveable", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "wu impact save "));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const run = createRun();
  addPlayer(run, "host", "Host");
  addPlayer(run, "guest", "Guest");
  run.phase = "outing";
  run.tin.pose.position = [10, 3, -12];
  const physics = await attachPhysics(run);
  t.after(() => physics.dispose());
  for (let i = 0; i < 120; i++) {
    advanceRun(run, 1 / 60);
    physics.step(1 / 60);
  }
  assert.ok(
    run.events.some(
      (event) => event.kind === "noise" && event.player === "tin",
    ),
  );
  await saveRun(dataDir, run, new Map());
  const restored = (await loadRun(dataDir))!;
  assert.ok(restored.run.events.some((event) => event.player === "tin"));
  assert.ok(restored.run.seconds > 1);
});

test("inconsistent world, identity, inventory and photo references are rejected before replacing a save", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "wu invalid state "));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const original = createRun();
  addPlayer(original, "host", "Host");
  addPlayer(original, "guest", "Guest");
  await saveRun(dataDir, original, new Map());
  for (const corrupt of [
    (run: ReturnType<typeof createRun>) => {
      run.animals[1] = structuredClone(run.animals[0]);
    },
    (run: ReturnType<typeof createRun>) => {
      run.tin.holder = "missing-player";
    },
    (run: ReturnType<typeof createRun>) => {
      run.completed = ["raccoon-inspect", "raccoon-inspect"];
    },
    (run: ReturnType<typeof createRun>) => {
      run.players[1].slot = run.players[0].slot;
    },
    (run: ReturnType<typeof createRun>) => {
      run.world.seed = -1;
    },
    (run: ReturnType<typeof createRun>) => {
      run.world.commissions[0].subjects = ["missing-resident"];
    },
    (run: ReturnType<typeof createRun>) => {
      run.props.pop();
    },
    (run: ReturnType<typeof createRun>) => {
      run.props[0].holders[0] = "missing-player";
    },
    (run: ReturnType<typeof createRun>) => {
      run.props[0].pose.position[0] = run.world.bounds.max[0] + 3;
    },
    (run: ReturnType<typeof createRun>) => {
      run.route[run.world.fixtures.find(f => f.kind === "crossing")!.id] = {open: true, seat: "left"};
    },
    (run: ReturnType<typeof createRun>) => {
      run.props.find((prop) => prop.kind === "plank")!.placed = true;
    },
    (run: ReturnType<typeof createRun>) => {
      run.hats[0].owner = "missing-player";
    },
    (run: ReturnType<typeof createRun>) => {
      run.spills = Array.from({ length: 9 }, (_, i): Spill => ({
        id: `spill-${i}`,
        position: [0, 0, 0],
        portions: 1,
        untilTick: 10,
      }));
    },
    (run: ReturnType<typeof createRun>) => {
      const frame = makePhotoFrame(run, "host");
      run.pendingPhotos[frame.id] = frame;
      run.album = [
        {
          id: frame.id,
          photographer: "other",
          tick: frame.tick,
          credits: [],
          assists: [],
          favorites: [],
          incident: null,
          thumbnail: "pending",
        },
      ];
    },
  ]) {
    const run = structuredClone(original);
    corrupt(run);
    await assert.rejects(saveRun(dataDir, run, new Map()));
  }
  assert.equal((await loadRun(dataDir))!.run.tin.holder, null);
});
