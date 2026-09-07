import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addPlayer,
  advanceRun,
  applyCommand as applyWorldCommand,
  attachPhysics,
  createRun,
  disconnectPlayer,
  evaluatePhoto,
  makePhotoFrame,
  snapshot,
} from "../../src/server/simulation/game.ts";
import {
  CAMP,
  CLEARING,
  HABITAT_SITES,
  CLUES,
  PATCH,
  STASH,
  TIN_START,
  PLANK_PLACEMENTS,
  PROP_DEFINITIONS,
  fixtureSurfaces,
  fixtureBoxes,
  gateLatch,
  routeSurfaces,
  WALKABLES,
  WALLS,
} from "../../src/shared/world/level.ts";
import {
  distance,
  pose,
  movePlayer,
  surfaceHeight,
  type ClientMessage,
  type PhotoFrame,
  type Vec3,
  propBoxes,
  propPoint,
} from "../../src/shared/shared.ts";

const crossing = (run: ReturnType<typeof createRun>) =>
  run.world.fixtures.find(
    (f) => f.plankId === run.props.find((p) => p.kind === "plank")!.id,
  )!;
const seat = (run: ReturnType<typeof createRun>) =>
  Object.values(crossing(run).seats)[0];
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

test("rejoining beside a washout finds supported ground with an escape", () => {
  const run = createRun();
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  disconnectPlayer(run, "b");
  const water = run.world.waters[0];
  run.players[0].position = [
    water.min[0] - 0.5,
    0,
    (water.min[2] + water.max[2]) / 2,
  ];
  addPlayer(run, "b", "B");
  const p = run.players[1];
  assert.ok(
    run.world.walkables.some(
      (s) => surfaceHeight(s, p.position[0], p.position[2]) === p.position[1],
    ),
  );
  assert.ok(
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(
      ([x, z]) =>
        distance(
          p.position,
          movePlayer(
            p,
            { seq: 1, x, z, yaw: 0, pitch: 0, run: false, crouch: false },
            0.25,
            run.world.walls,
            run.world.walkables,
          ).position,
        ) > 0.3,
    ),
  );
});

function crew() {
  const run = createRun(9);
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { type: "start", seq: 1 });
  advanceRun(run, 1 / 60);
  for (let i = 0; i < 6; i++) advanceRun(run, 1 / 60);
  return run;
}

test("an open case spills one recoverable portion on a real sharp carry turn, with a two-second guard", () => {
  const run = crew(),
    p = run.players[0],
    item = run.props[0];
  const deer = run.animals.find((a) => a.species === "deer")!;
  p.position = [deer.pose.position[0], 0, deer.pose.position[2] + 6];
  assert.ok(
    command(run, "a", "photo")!.verdict.credits.includes(
      run.world.commissions.find(
        (c) => c.kind === "behavior" && c.subjects.includes(deer.id),
      )!.id,
    ),
  );
  run.props.find((p) => p.kind === "plank")!.pose = structuredClone(seat(run));
  run.props.find((p) => p.kind === "plank")!.placed = true;
  run.route[run.world.fixtures.find((f) => f.kind === "crossing")!.id] = {
    open: true,
    seat: "left",
  };
  const progress = structuredClone([
    run.world,
    run.completed,
    run.route,
    run.album,
    run.pendingPhotos,
  ]);
  item.pose = pose([0, 0.325, 0]);
  p.position = [-0.75, 0, 1];
  command(run, "a", "interact");
  command(run, "a", "use");
  step(run, 0.5);
  assert.equal(run.spills.length, 0, "opening alone is harmless");
  const turn = (yaw: number, ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      applyCommand(run, "a", {
        type: "input",
        value: {
          seq: p.lastSeq + 1,
          x: 0,
          z: 0,
          yaw,
          pitch: 0,
          run: false,
          crouch: false,
        },
      });
      advanceRun(run, 1 / 60);
    }
  };
  turn(Math.PI / 2, 30);
  assert.equal(run.spills.length, 1);
  assert.equal(run.spareBait, 7);
  turn(-Math.PI / 2, 60);
  assert.equal(
    run.spills.length,
    1,
    "repeated turn inside the guard cannot cascade",
  );
  const pile = run.spills[0];
  assert.ok(
    WALKABLES.some(
      (s) =>
        surfaceHeight(s, pile.position[0], pile.position[2]) ===
        pile.position[1],
    ),
  );
  assert.equal(pile.portions, 1);
  command(run, "a", "interact");
  p.position = [pile.position[0], pile.position[1], pile.position[2] + 0.4];
  command(run, "a", "interact");
  assert.equal(run.spills.length, 0);
  assert.equal(run.spareBait, 8);
  assert.deepEqual(
    [run.world, run.completed, run.route, run.album, run.pendingPhotos],
    progress,
  );
});

test("closed turns and slow open carrying do not spill; a case bump does", () => {
  const run = crew(),
    p = run.players[0],
    item = run.props[0];
  item.pose = pose([0, 0.325, 0]);
  p.position = [-0.75, 0, 1];
  run.props.find((prop) => prop.kind === "screen")!.pose = pose([3, 0.97, 0]);
  command(run, "a", "interact");
  const move = (x: number, yaw = 0) => {
    applyCommand(run, "a", {
      type: "input",
      value: {
        seq: p.lastSeq + 1,
        x,
        z: 0,
        yaw,
        pitch: 0,
        run: false,
        crouch: false,
      },
    });
    advanceRun(run, 1 / 60);
  };
  for (let i = 0; i < 30; i++) move(0, 0.2);
  assert.equal(run.spills.length, 0);
  command(run, "a", "use");
  for (let i = 0; i < 10; i++) move(1, 0.2);
  assert.equal(run.spills.length, 0, "ordinary slow carry is harmless");
  for (let i = 0; i < 300; i++) move(1, 0.2);
  assert.ok(run.events.some((e) => e.kind === "impact"));
  assert.equal(
    run.spills.length,
    1,
    "continuous pressure against the same wall is one incident",
  );
  assert.equal(run.spareBait, 7);
});

test("spills stay bounded, expire, and depleted camp supplies can be restored with the tin", () => {
  const run = crew(),
    p = run.players[0],
    item = run.props[0];
  item.pose = pose([0, 0.325, 0]);
  p.position = [-0.75, 0, 1];
  command(run, "a", "interact");
  command(run, "a", "use");
  run.spills = Array.from({ length: 8 }, (_, i) => ({
    id: `old-${i}`,
    position: [10 + i, 0, 0] as Vec3,
    portions: 1,
    untilTick: run.tick + 60,
  }));
  applyCommand(run, "a", {
    type: "input",
    value: {
      seq: p.lastSeq + 1,
      x: 0,
      z: 0,
      yaw: Math.PI / 2,
      pitch: 0,
      run: false,
      crouch: false,
    },
  });
  advanceRun(run, 1 / 60);
  assert.equal(run.spills.length, 8);
  assert.equal(run.spareBait, 8);
  step(run, 1);
  assert.equal(run.spills.length, 0);
  command(run, "a", "interact");
  run.tin.holder = "a";
  run.tin.portions = 0;
  run.spareBait = 0;
  p.position = [...run.world.camp];
  step(run, 2);
  command(run, "a", "use");
  assert.equal(run.tin.portions, 4);
  assert.equal(run.spareBait, 8);
});
function command(
  run: ReturnType<typeof createRun>,
  id: string,
  type: Exclude<ClientMessage["type"], "input" | "ping" | "favorite">,
) {
  return applyCommand(run, id, {
    type,
    seq: run.players.find((p) => p.id === id)!.lastSeq + 1,
  });
}
function step(run: ReturnType<typeof createRun>, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) advanceRun(run, 1 / 60);
}
function place(run: ReturnType<typeof createRun>, point: Vec3) {
  run.tin.pose = pose(point);
  run.tin.holder = null;
  run.tin.open = true;
  run.tinRevision++;
}
const photoRun = createRun(2, "photo-contract-world");
const pairCommission = photoRun.world.commissions.find(
  (c) => c.kind === "pair",
)!;
const pairAnchor = photoRun.world.pockets
  .find((p) => p.id === pairCommission.pocket)!
  .anchors.find((a) => a.id === pairCommission.anchor)!.point;
function photoPoint(x: number, y: number, z: number): Vec3 {
  return [x + pairAnchor[0] - 39, y, z + pairAnchor[2] + 30];
}
function photoWorld(boxes: { id: string; min: Vec3; max: Vec3 }[] = []) {
  return { ...photoRun.world, walls: [...photoRun.world.walls, ...boxes] };
}
function photo(): PhotoFrame {
  const state = createRun(2, photoRun.worldId);
  const r = state.animals.find(
    (a) =>
      a.id ===
      pairCommission.subjects.find(
        (id) => state.animals.find((a) => a.id === id)!.species === "raccoon",
      ),
  )!;
  const h = state.animals.find(
    (a) =>
      a.id ===
      pairCommission.subjects.find(
        (id) => state.animals.find((a) => a.id === id)!.species === "heron",
      ),
  )!;
  r.pose = pose(photoPoint(34, 0, -30));
  r.behavior = "inspect";
  h.pose = pose(photoPoint(39, 0, -30));
  h.behavior = "display";
  state.animals = [r, h, ...state.animals.filter((a) => a !== r && a !== h)];
  state.tin.pose = pose(photoPoint(34, 0.109, -30.8));
  state.tin.open = true;
  const p = addPlayer(state, "a", "A");
  p.position = photoPoint(36.5, 0, -22);
  return structuredClone(makePhotoFrame(state, "a"));
}

test("authoritative interactions give each reachable handle one owner and each player one object", () => {
  const run = crew();
  run.tin.pose.position = [50, 1, 50];
  const decoy = run.props.find((p) => p.kind === "decoy")!;
  decoy.pose.position = [0, 0.5, 0];
  run.players[0].position = [0, 0, 1];
  run.players[1].position = [0.2, 0, 1];
  command(run, "a", "interact");
  assert.deepEqual(decoy.holders, ["a", null]);
  assert.throws(() => command(run, "b", "interact"), /handle|held|reach/i);
  assert.deepEqual(decoy.holders, ["a", null]);
  command(run, "a", "drop");

  const item = run.props.find((p) => p.kind === "case")!;
  item.pose.position = [0, 0.325, 0];
  run.players[0].position = [-0.75, 0, 1];
  run.players[1].position = [0.75, 0, 1];
  command(run, "a", "interact");
  command(run, "b", "interact");
  assert.deepEqual(new Set(item.holders), new Set(["a", "b"]));
  assert.equal(run.props.filter((p) => p.holders.includes("a")).length, 1);
});

test("a prop body occludes its opposite handle without hiding a visible near handle", () => {
  const run = crew(),
    item = run.props.find((prop) => prop.kind === "case")!;
  run.tin.pose.position = [50, 1, 50];
  run.props
    .filter((prop) => prop !== item)
    .forEach((prop, index) => (prop.pose.position = [50 + index * 3, 1, 50]));
  item.pose.position = [0, 0.325, 0];
  run.players[1].position = [-0.75, 0, 1];
  command(run, "b", "interact");
  assert.deepEqual(item.holders, ["b", null]);
  run.players[0].position = [-0.8, 0, 0];
  assert.throws(() => command(run, "a", "interact"), /reach|closer|blocked/i);
  assert.deepEqual(item.holders, ["b", null]);
});

test("heavy carry uses full prop bounds and cannot pass through the wetland solid", () => {
  const run = crew(),
    item = run.props.find((p) => p.kind === "case")!,
    p = run.players[0];
  run.tin.pose.position = [50, 1, 50];
  const water = run.world.waters[0],
    edge = water.min[0],
    z = (water.min[2] + water.max[2]) / 2;
  item.pose.position = [edge - 2, 0.325, z];
  p.position = [edge - 2.75, 0, z];
  command(run, "a", "interact");
  for (let i = 0; i < 25; i++) {
    applyCommand(run, "a", {
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
    step(run, 0.2);
  }
  assert.ok(
    Math.max(
      ...propBoxes(item, PROP_DEFINITIONS.case).map((box) => box.max[0]),
    ) <=
      edge + 0.001,
  );
  assert.ok(
    run.events.some((event) => event.kind === "noise" && event.player === "a"),
  );
  assert.ok(
    run.events.some((event) => event.kind === "impact" && event.player === "a"),
  );
});

test("a stationary doorway blocker yields only to the blocked pair after 1.5 seconds", () => {
  const run = crew(),
    mover = run.players[0],
    blocker = run.players[1];
  mover.position = [0, 0, 0];
  blocker.position = [1, 0, 0];
  for (let i = 0; i < 5; i++) {
    applyCommand(run, "a", {
      type: "input",
      value: {
        seq: mover.lastSeq + 1,
        x: 1,
        z: 0,
        yaw: 0,
        pitch: 0,
        run: false,
        crouch: false,
      },
    });
    step(run, 0.2);
  }
  assert.ok(mover.position[0] < blocker.position[0]);
  for (let i = 0; i < 5; i++) {
    applyCommand(run, "a", {
      type: "input",
      value: {
        seq: mover.lastSeq + 1,
        x: 1,
        z: 0,
        yaw: 0,
        pitch: 0,
        run: false,
        crouch: false,
      },
    });
    step(run, 0.2);
  }
  assert.ok(mover.position[0] > blocker.position[0] + 0.35);
  blocker.connected = false;
  mover.position = [0, 0, 0];
  blocker.position = [0.4, 0, 0];
  applyCommand(run, "a", {
    type: "input",
    value: {
      seq: mover.lastSeq + 1,
      x: 1,
      z: 0,
      yaw: 0,
      pitch: 0,
      run: false,
      crouch: false,
    },
  });
  step(run, 0.25);
  assert.ok(mover.position[0] > 0.5);
});

test("plank seating, gate latch, case stock and local prop recovery update authoritative state", () => {
  const run = crew(),
    p = run.players[0],
    plank = run.props.find((prop) => prop.kind === "plank")!,
    item = run.props.find((prop) => prop.kind === "case")!;
  run.tin.pose.position = [50, 1, 50];
  plank.pose = structuredClone(seat(run));
  plank.holders[0] = "a";
  p.position = [-14, -1, 2];
  command(run, "a", "interact");
  assert.equal(run.route[crossing(run).id].seat, "left");
  assert.equal(plank.placed, true);

  const latch = run.world.fixtures.find((f) => f.kind === "gate")!.latch!;
  p.position = [latch[0], 0, latch[2] + 1];
  const parked = run.props
    .filter((prop) => prop !== plank)
    .map((prop) => [prop, structuredClone(prop.pose)] as const);
  parked.forEach(
    ([prop], index) => (prop.pose.position = [50 + index * 3, 1, 50]),
  );
  command(run, "a", "interact");
  assert.equal(run.route.gate.open, true);
  parked.forEach(([prop, saved]) => (prop.pose = saved));

  item.pose.position = [80, -10, 80];
  command(run, "a", "recover");
  assert.ok(
    run.world.stations.some(
      (s) =>
        distance(item.pose.position, [
          s.recover[0],
          s.recover[1] + 0.325,
          s.recover[2],
        ]) < 1e-6,
    ) ||
      distance(
        item.pose.position,
        run.world.props.find((p) => p.id === item.id)!.pose.position,
      ) < 1e-6,
  );

  item.pose.position = [0, 0.325, 0];
  item.holders[0] = "a";
  p.position = [-0.75, 0, 1];
  command(run, "a", "use");
  assert.equal(item.open, true);
  item.holders[0] = null;
  run.tin.holder = "a";
  run.tin.portions = 1;
  run.tin.pose.position = [0, 1, 0.5];
  step(run, 3.1);
  command(run, "a", "use");
  assert.equal(run.tin.portions, 4);
  assert.equal(run.spareBait, 5);
});

test("ordinary recovery rescues the browser's tipped decoy and permits native carrying without losing progress", async () => {
  const run = crew(),
    fern = run.players[1],
    decoy = run.props.find((prop) => prop.kind === "decoy")!,
    plank = run.props.find((prop) => prop.kind === "plank")!;
  // Exact loose pose and standing position from outing-stall-Fern.json.
  fern.position = [-6.740282428845981, -0.14236200554730394, 1.821530884777579];
  fern.yaw = 1.6462253071414559;
  decoy.pose = {
    position: [-7.719655513763428, -0.04035712033510208, 1.92520010471344],
    rotation: [
      0.6432297825813293, -0.29320842027664185, 0.409008651971817,
      0.5770582556724548,
    ],
  };
  run.route.gate.open = true;
  run.route[crossing(run).id] = { open: true, seat: "left" };
  plank.pose = structuredClone(seat(run));
  plank.placed = true;
  run.tin.holder = "a";
  run.spareBait = 5;
  run.baitPatches[
    run.world.pockets
      .flatMap((p) => p.anchors)
      .find((a) => a.kind === "feed")!.id
  ] = 2;
  run.completed = ["raccoon-inspect"];
  run.album = [
    {
      id: "photo-1",
      photographer: "a",
      tick: 0,
      credits: ["raccoon-inspect"],
      assists: [],
      favorites: ["b"],
      incident: null,
      thumbnail: "ready",
    },
  ];
  const preserved = () =>
    structuredClone({
      world: run.world,
      completed: run.completed,
      album: run.album,
      route: run.route,
      spareBait: run.spareBait,
      baitPatch:
        run.baitPatches[
          run.world.pockets
            .flatMap((p) => p.anchors)
            .find((a) => a.kind === "feed")!.id
        ],
      portions: run.tin.portions,
      tinHolder: run.tin.holder,
      plank,
    });
  const before = preserved();
  command(run, "b", "recover");
  const recovered = [...decoy.pose.position] as Vec3;
  assert.ok(
    run.world.stations.some(
      (s) =>
        distance(recovered, [s.recover[0], s.recover[1] + 0.5, s.recover[2]]) <
        1e-6,
    ),
  );
  assert.deepEqual(decoy.holders, [null, null]);
  assert.deepEqual(preserved(), before);
  fern.position = [recovered[0], recovered[1] - 0.5, recovered[2] + 0.7];
  fern.yaw = 0;
  const native = await attachPhysics(run);
  try {
    command(run, "b", "interact");
    assert.equal(decoy.holders[0], "b");
    for (let i = 0; i < 60; i++) {
      applyCommand(run, "b", {
        type: "input",
        value: {
          seq: fern.lastSeq + 1,
          x: 1,
          z: 0,
          yaw: 0,
          pitch: 0,
          run: false,
          crouch: false,
        },
      });
      advanceRun(run, 1 / 60);
      native.step(1 / 60);
    }
    assert.ok(
      fern.position[0] > recovered[0] + 2,
      "recovered decoy permits sustained walking",
    );
    assert.ok(
      decoy.pose.position[0] > recovered[0] + 2,
      "claimed decoy follows its carrier",
    );
    assert.equal(decoy.holders[0], "b");
    assert.deepEqual(decoy.pose.rotation, [0, 0, 0, 1]);
    assert.deepEqual(preserved(), before);
  } finally {
    native.dispose();
  }
});

test("recovery preserves modest equipment tilt, pure yaw, and held or seated equipment", () => {
  for (const kind of ["case", "decoy", "screen", "plank"] as const) {
    for (const condition of ["bank tilt", "yaw", "held", "seated"] as const) {
      const run = crew(),
        prop = run.props.find((prop) => prop.kind === kind)!;
      const angle = Math.PI / 6;
      prop.pose = {
        position: [0, 2, 0],
        rotation:
          condition === "yaw"
            ? [0, 1, 0, 0]
            : [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)],
      };
      if (condition === "held") {
        prop.pose.rotation = [1, 0, 0, 0];
        prop.holders[0] = "b";
      }
      if (condition === "seated") {
        if (kind !== "plank") continue;
        prop.pose = structuredClone(seat(run));
        prop.placed = true;
        run.route[crossing(run).id] = { open: true, seat: "left" };
      }
      run.tin.holder = "a";
      const before = structuredClone(prop);
      assert.throws(
        () => command(run, "a", "recover"),
        /tin is currently held/,
      );
      assert.deepEqual(prop, before, `${kind}: ${condition}`);
    }
  }
});

test("plank seating rejects a pose outside the twenty degree tolerance", () => {
  const run = crew(),
    plank = run.props.find((prop) => prop.kind === "plank")!,
    angle = (21 * Math.PI) / 180;
  plank.pose = {
    position: [...seat(run).position],
    rotation: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
  };
  plank.holders[0] = "a";
  run.players[0].position = [-14, -1, 5];
  run.tin.pose.position = [50, 1, 50];
  command(run, "a", "interact");
  assert.equal(run.route[crossing(run).id].seat, null);
  assert.equal(plank.placed, false);
});

test("one carrier can push the staged plank from the west bank into a reachable seat", () => {
  const run = crew(),
    p = run.players[0],
    plank = run.props.find((prop) => prop.kind === "plank")!,
    local = PROP_DEFINITIONS.plank.handles[0];
  run.tin.pose.position = [50, 1, 50];
  const handle = propPoint(local, plank.pose);
  p.position = [handle[0], 0, handle[2] + 0.8];
  command(run, "a", "interact");
  assert.equal(plank.holders[0], "a");
  applyCommand(run, "a", {
    type: "input",
    value: {
      seq: p.lastSeq + 1,
      x: 0,
      z: 0,
      yaw: 0,
      pitch: 0,
      run: false,
      crouch: false,
    },
  });
  step(run, 0.6);
  for (let i = 0; i < 40; i++) {
    applyCommand(run, "a", {
      type: "input",
      value: {
        seq: p.lastSeq + 1,
        x: 1,
        z: 0,
        yaw: 0,
        pitch: 0,
        run: false,
        crouch: false,
      },
    });
    step(run, 0.2);
  }
  command(run, "a", "interact");
  assert.equal(
    plank.placed,
    true,
    JSON.stringify({
      player: p.position,
      plank: plank.pose,
      seat: seat(run),
      events: run.events,
    }),
  );
  assert.equal(run.route[crossing(run).id].seat, "left");
  assert.deepEqual(plank.pose, seat(run));
});

test("disconnect releases an equipment handle while the other holder can continue", () => {
  const run = crew(),
    item = run.props.find((prop) => prop.kind === "screen")!;
  item.holders = ["a", "b"];
  disconnectPlayer(run, "a");
  assert.deepEqual(item.holders, [null, "b"]);
  assert.equal(item.placed, false);
});

test("turning held equipment sweeps its full outer bounds before a solid contact", () => {
  const run = crew(),
    item = run.props.find((prop) => prop.kind === "screen")!,
    p = run.players[0];
  const water = run.world.waters[0],
    edge = water.min[2],
    x = (water.min[0] + water.max[0]) / 2;
  item.pose.position = [x, 0.97, edge - 1.3];
  item.holders[0] = "a";
  p.position = [x - 1.25, 0, edge - 1.2];
  for (let i = 0; i < 90; i++) {
    applyCommand(run, "a", {
      type: "input",
      value: {
        seq: p.lastSeq + 1,
        x: 0,
        z: 0,
        yaw: -Math.PI / 2,
        pitch: 0,
        run: false,
        crouch: false,
      },
    });
    step(run, 1 / 60);
  }
  assert.ok(
    Math.max(
      ...propBoxes(item, PROP_DEFINITIONS.screen).map((box) => box.max[2]),
    ) <= edge,
  );
  assert.ok(run.events.some((event) => event.kind === "noise"));
});

test("two holders cannot diverge from the claimed equipment handles", () => {
  const run = crew(),
    item = run.props.find((prop) => prop.kind === "case")!,
    a = run.players[0],
    b = run.players[1];
  item.pose.position = [0, 0.325, 0];
  item.holders = ["a", "b"];
  a.position = [-0.75, 0, 0];
  b.position = [0.75, 0, 0];
  for (let i = 0; i < 180; i++) {
    applyCommand(run, "a", {
      type: "input",
      value: {
        seq: a.lastSeq + 1,
        x: -1,
        z: 0,
        yaw: 0,
        pitch: 0,
        run: false,
        crouch: false,
      },
    });
    advanceRun(run, 1 / 60);
  }
  const leftHandle: Vec3 = [
    item.pose.position[0] - 0.75,
    0,
    item.pose.position[2],
  ];
  assert.ok(
    distance(a.position, leftHandle) < 0.2,
    `holder drifted ${distance(a.position, leftHandle)}m`,
  );
  assert.ok(
    distance(b.position, [
      item.pose.position[0] + 0.75,
      0,
      item.pose.position[2],
    ]) < 0.2,
  );
});

test("one holder turns equipment around the claimed handle", () => {
  const run = crew(),
    item = run.props.find((prop) => prop.kind === "screen")!,
    p = run.players[0];
  item.pose.position = [0, 0.97, 0];
  item.holders = ["a", null];
  p.position = [-1.25, 0, 0.08];
  for (let i = 0; i < 90; i++) {
    applyCommand(run, "a", {
      type: "input",
      value: {
        seq: p.lastSeq + 1,
        x: 0,
        z: 0,
        yaw: Math.PI / 2,
        pitch: 0,
        run: false,
        crouch: false,
      },
    });
    advanceRun(run, 1 / 60);
  }
  const local = PROP_DEFINITIONS.screen.handles[0],
    yaw = 2 * Math.atan2(item.pose.rotation[1], item.pose.rotation[3]),
    handle: Vec3 = [
      item.pose.position[0] +
        Math.cos(yaw) * local[0] +
        Math.sin(yaw) * local[2],
      item.pose.position[1] + local[1],
      item.pose.position[2] -
        Math.sin(yaw) * local[0] +
        Math.cos(yaw) * local[2],
    ];
  assert.ok(distance([p.position[0], handle[1], p.position[2]], handle) < 0.2);
});

test("a staged plank handle cannot rotate the body into bank terrain", () => {
  const run = crew(),
    plank = run.props.find((prop) => prop.kind === "plank")!,
    p = run.players[0],
    handle = propPoint(PROP_DEFINITIONS.plank.handles[1], plank.pose);
  run.tin.pose.position = [50, 1, 50];
  p.position = [handle[0], -0.25, handle[2]];
  command(run, "a", "interact");
  for (let i = 0; i < 36; i++) {
    applyCommand(run, "a", {
      type: "input",
      value: {
        seq: p.lastSeq + 1,
        x: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        run: false,
        crouch: false,
      },
    });
    advanceRun(run, 1 / 60);
  }
  const bank = WALKABLES.find((surface) => surface.id === "washout-west-bank")!,
    deck = propBoxes(plank, PROP_DEFINITIONS.plank)[0],
    ground = surfaceHeight(
      bank,
      plank.pose.position[0],
      plank.pose.position[2],
    )!,
    penetration = ground - deck.min[1];
  assert.ok(penetration <= 0.001, `plank penetrated bank by ${penetration}m`);
});

test("two holders retain exact handles across a three dimensional slope", () => {
  const run = crew(),
    plank = run.props.find((prop) => prop.kind === "plank")!,
    a = run.players[0],
    b = run.players[1];
  plank.pose = pose([0, 0.095, 0]);
  plank.holders = ["a", "b"];
  a.position = [-1.43, 0, 0];
  b.position = [1.43, 0, 0];
  advanceRun(run, 1 / 60);
  for (let step = 1; step <= 24; step++) {
    const rise = step / 24,
      horizontal = Math.sqrt(2.86 ** 2 - rise ** 2);
    a.position = [-horizontal / 2, 0, 0];
    b.position = [horizontal / 2, rise, 0];
    advanceRun(run, 1 / 60);
  }
  const retained = plank.holders.flatMap((id, handleIndex) =>
    id
      ? [
          distance(
            propPoint(PROP_DEFINITIONS.plank.handles[handleIndex], plank.pose),
            run.players
              .find((player) => player.id === id)!
              .position.map(
                (value, axis) => value + (axis === 1 ? 0.165 : 0),
              ) as Vec3,
          ),
        ]
      : [],
  );
  assert.ok(
    plank.holders[0] === "a" &&
      plank.holders[1] === "b" &&
      retained.every((error) => error <= 0.15),
    retained.join(","),
  );
});

test("player separation never pushes a body into a world solid", () => {
  const run = crew(),
    a = run.players[0],
    b = run.players[1];
  const wall = run.world.walls.find((b) => b.id === "boundary-east")!;
  a.position = [wall.min[0] - 0.46, 0, 32];
  b.position = [wall.min[0] - 0.7, 0, 32];
  advanceRun(run, 1 / 60);
  assert.ok(
    a.position[0] <= wall.min[0] - 0.45 + 1e-6,
    `separation pushed player into pond at ${a.position[0]}`,
  );
});

test("player separation never pushes a supported body into the washout", () => {
  const run = crew(),
    a = run.players[0],
    b = run.players[1];
  const water = run.world.waters[0],
    z = (water.min[2] + water.max[2]) / 2;
  a.position = [water.min[0] - 0.01, 0, z];
  b.position = [water.min[0] - 0.72, 0, z];
  applyCommand(run, "a", {
    type: "input",
    value: {
      seq: a.lastSeq + 1,
      x: 0,
      z: 1,
      yaw: 0,
      pitch: 0,
      run: false,
      crouch: false,
    },
  });
  applyCommand(run, "b", {
    type: "input",
    value: {
      seq: b.lastSeq + 1,
      x: 1,
      z: 0,
      yaw: 0,
      pitch: 0,
      run: false,
      crouch: false,
    },
  });
  advanceRun(run, 1 / 60);
  assert.ok(
    [
      ...run.world.walkables,
      ...fixtureSurfaces(run.world.fixtures, run.route),
    ].some(
      (surface) =>
        surfaceHeight(surface, a.position[0], a.position[2]) !== null,
    ),
    `separation pushed player into unsupported space at ${a.position}`,
  );
});

test("a released player can move out of an existing equipment overlap", () => {
  const run = crew(),
    p = run.players[0],
    item = run.props.find((prop) => prop.kind === "case")!,
    target: Vec3 = [-46, 0, 34];
  run.props
    .filter((prop) => prop !== item)
    .forEach((prop, index) => (prop.pose.position = [50 + index * 3, 1, 50]));
  item.pose = {
    position: [-47.1700325, 0.3249138, 40.3690033],
    rotation: [0, -0.2922728, 0, 0.956335],
  };
  p.position = [-47.39212084, 0, 39.46640246];
  const start = distance(p.position, target);
  for (let i = 0; i < 5; i++) {
    const dx = target[0] - p.position[0],
      dz = target[2] - p.position[2],
      length = Math.hypot(dx, dz);
    applyCommand(run, "a", {
      type: "input",
      value: {
        seq: p.lastSeq + 1,
        x: dx / length,
        z: dz / length,
        yaw: 0,
        pitch: 0,
        run: false,
        crouch: false,
      },
    });
    step(run, 0.2);
  }
  assert.ok(
    distance(p.position, target) < start - 1,
    `${p.position} remained trapped`,
  );
});

test("crew slots and seeded world identity survive reconnection", () => {
  const run = createRun(41);
  addPlayer(run, "a", "Ash");
  addPlayer(run, "b", "Reed");
  const slots = new Map(run.players.map((p) => [p.id, p.slot]));
  disconnectPlayer(run, "a");
  addPlayer(run, "a", "Ash");
  assert.equal(run.players.find((p) => p.id === "a")!.slot, slots.get("a"));
  assert.equal(new Set(run.players.map((p) => p.slot)).size, 2);
  assert.deepEqual(
    run.players.map((p) => p.slot),
    [0, 1],
  );
  assert.deepEqual(
    run.hats.map((hat) => hat.owner),
    ["a", "b"],
  );
  assert.equal(snapshot(run).version, 3);
  assert.equal(run.world.content, "forest-expedition-1");
  assert.equal(run.world.seed, 41);
  assert.throws(() => createRun(-1), /uint32/i);
  assert.throws(() => createRun(0x100000000), /uint32/i);
});

test("commands enforce host authority, sequence ordering and a 15 tick movement timeout", () => {
  const run = createRun();
  addPlayer(run, "a", "A");
  assert.throws(() => command(run, "a", "start"), /two|2/i);
  addPlayer(run, "b", "B");
  assert.throws(() => command(run, "b", "start"), /host/i);
  command(run, "a", "start");
  const p = run.players[0];
  p.position = [0, 0, 10];
  const input = {
    seq: p.lastSeq + 1,
    x: 1,
    z: 0,
    yaw: 0,
    pitch: 0,
    run: false,
    crouch: false,
  };
  applyCommand(run, "a", { type: "input", value: input });
  assert.throws(
    () => applyCommand(run, "a", { type: "input", value: input }),
    /sequence|replay/i,
  );
  step(run, 1);
  assert.ok(
    p.position[0] > 0.65 && p.position[0] < 0.8,
    `${p.position[0]}m after expired input`,
  );
  const x = p.position[0];
  step(run, 1);
  assert.equal(p.position[0], x);
  assert.throws(
    () =>
      applyCommand(run, "a", {
        type: "input",
        value: { ...input, seq: p.lastSeq + 1, x: NaN },
      }),
    /number/i,
  );
});

test("one physical tin has exclusive ownership and rejects pickup through walls or beyond reach", () => {
  const run = crew();
  place(run, [0, 0.25, 5]);
  for (const p of run.players) p.position = [0, 0, 6];
  command(run, "a", "interact");
  assert.equal(run.tin.holder, "a");
  assert.throws(() => command(run, "b", "interact"), /held|holding/i);
  command(run, "a", "interact");
  assert.equal(run.tin.holder, null);
  command(run, "b", "interact");
  assert.equal(run.tin.holder, "b");
  command(run, "b", "drop");
  assert.equal(run.tin.holder, null);
  assert.ok(run.tin.pose.position[1] > 0.5);
  run.players[0].position = [0, 0, 15];
  assert.throws(() => command(run, "a", "interact"), /closer|reach/i);
  const gate = run.world.fixtures.find((f) => f.kind === "gate")!,
    transform = {
      position: gate.position,
      rotation: [0, Math.sin(gate.yaw / 2), 0, Math.cos(gate.yaw / 2)] as [
        number,
        number,
        number,
        number,
      ],
    };
  run.players[0].position = propPoint([0, 0, 0.7], transform);
  place(run, propPoint([0, 0.25, -0.6], transform));
  assert.throws(() => command(run, "a", "interact"), /blocked|wall|hidden/i);
});

test("rattle brings inspection before theft; whistle diverts the same carried tin and it reaches the stash", () => {
  const run = crew(),
    r = run.animals.find((a) => a.species === "raccoon")!;
  const clearing = anchor(run, "raccoon", "ground"),
    stash = run.world.residents.find((a) => a.id === r.id)!.spawn;
  r.pose = pose(clearing);
  place(run, [clearing[0], 0.25, clearing[2] + 3]);
  run.players[0].position = [clearing[0], 0, clearing[2] + 4];
  command(run, "a", "interact");
  command(run, "a", "use");
  command(run, "a", "interact");
  step(run, 3);
  assert.equal(r.behavior, "inspect");
  assert.equal(run.tin.holder, null);
  for (let i = 0; i < 80 && run.tin.holder !== `animal:${r.id}`; i++)
    step(run, 0.1);
  assert.equal(run.tin.holder, `animal:${r.id}`);
  run.players[1].position = [r.pose.position[0] + 3, 0, r.pose.position[2]];
  command(run, "b", "use");
  step(run, 0.2);
  assert.equal(r.behavior, "investigate");
  const firstTarget = [...r.target];
  run.players[0].position = [r.pose.position[0] - 3, 0, r.pose.position[2]];
  command(run, "a", "use");
  step(run, 0.2);
  assert.deepEqual(
    r.target,
    firstTarget,
    "a newer whistle cannot erase the commitment immediately",
  );
  step(run, 38);
  assert.equal(run.tin.holder, null);
  assert.ok(
    distance(run.tin.pose.position, stash) < 1.5,
    JSON.stringify({ r, tin: run.tin, stash }),
  );
  run.players[1].position = [
    run.tin.pose.position[0],
    0,
    run.tin.pose.position[2] + 0.7,
  ];
  command(run, "b", "interact");
  assert.equal(run.tin.holder, "b");
});

test("heron consumes bait once, retreats visibly from noise, then returns and displays after quiet", () => {
  const run = crew(),
    h = run.animals.find((a) => a.species === "heron")!;
  const patch = anchor(run, "heron", "feed"),
    patchId = run.world.pockets
      .find(
        (p) => p.id === run.world.residents.find((r) => r.id === h.id)!.home,
      )!
      .anchors.find((a) => a.kind === "feed")!.id;
  run.baitPatches[patchId] = 2;
  run.animals.find((a) => a.species === "raccoon")!.pose = pose(CLEARING);
  for (let i = 0; i < 150 && h.behavior !== "display"; i++) step(run, 0.1);
  assert.equal(h.behavior, "display");
  assert.equal(run.baitPatches[patchId], 1);
  run.players[0].position = [patch[0], 0, patch[2] + 4];
  command(run, "a", "use");
  step(run, 0.2);
  assert.equal(h.behavior, "alert");
  const before = [...h.pose.position];
  step(run, 1.1);
  assert.equal(h.behavior, "retreat");
  assert.ok(distance(before as Vec3, h.pose.position) > 0.2);
  assert.equal(run.baitPatches[patchId], 1);
  run.players[0].position = [...run.world.camp];
  for (let i = 0; i < 350 && h.behavior !== "display"; i++) step(run, 0.1);
  assert.ok(["display", "feed"].includes(h.behavior));
  assert.equal(run.baitPatches[patchId], 0);
  assert.ok(run.observations.some((s) => /quiet|noise|startl/i.test(s)));
});

test("photo geometry checks front, frame clipping, subject size, occlusion and actual behavior", () => {
  const frame = photo();
  assert.deepEqual(evaluatePhoto(frame, photoWorld()).credits, [
    pairCommission.id,
  ]);
  const cases: [string, (f: PhotoFrame) => void][] = [
    [
      "behind",
      (f) => {
        f.camera.yaw = Math.PI;
      },
    ],
    [
      "clipped",
      (f) => {
        f.camera.position[0] = photoPoint(50, 0, 0)[0];
      },
    ],
    [
      "too small",
      (f) => {
        f.camera.position[2] = photoPoint(0, 0, 100)[2];
      },
    ],
    [
      "wrong state",
      (f) => {
        f.animals[0].behavior = "wander";
        f.animals[1].behavior = "alert";
      },
    ],
  ];
  for (const [label, change] of cases) {
    const f = structuredClone(frame);
    change(f);
    assert.deepEqual(evaluatePhoto(f, photoWorld()).credits, [], label);
  }
  assert.deepEqual(
    evaluatePhoto(
      frame,
      photoWorld([
        {
          id: "wall",
          min: photoPoint(32, 0, -27),
          max: photoPoint(41, 4, -26),
        },
      ]),
    ).credits,
    [],
  );
  const equipmentBlocked = structuredClone(frame),
    fieldCase = equipmentBlocked.props.find((prop) => prop.kind === "case")!;
  fieldCase.pose.position = photoPoint(35.25, 0.7, -26);
  assert.ok(
    !evaluatePhoto(equipmentBlocked, photoWorld()).credits.includes(
      pairCommission.id,
    ),
    "field equipment must occlude photo subjects",
  );
  const distant = structuredClone(frame);
  distant.animals[1].pose.position[0] = photoPoint(43, 0, 0)[0];
  assert.ok(
    !evaluatePhoto(distant, photoWorld()).credits.includes(pairCommission.id),
  );
  const closed = structuredClone(frame);
  closed.tin.open = false;
  assert.ok(
    !evaluatePhoto(closed, photoWorld()).credits.includes(pairCommission.id),
  );
});

test("rejected deer portraits explain the framed selected behavior instead of offscreen wildlife", () => {
  for (const seed of [9, 10]) {
    const run = createRun(seed);
    addPlayer(run, "a", "A");
    const deer = run.animals.find((a) => a.species === "deer")!;
    run.players[0].position = [
      deer.pose.position[0],
      0,
      deer.pose.position[2] + 6,
    ];
    for (const behavior of ["alert", "settle"] as const) {
      deer.behavior = behavior;
      const result = evaluatePhoto(makePhotoFrame(run, "a"), run.world);
      assert.deepEqual(result.credits, []);
      assert.match(result.reason, /deer/i);
      assert.doesNotMatch(result.reason, /raccoon|heron|behind/i);
      if (behavior === "settle")
        assert.match(result.reason, /graze|grazing|photograph/i);
    }
  }
});

test("photo subject visibility requires two points and pair distance is exactly three to eight metres", () => {
  const frame = photo();
  const oneHidden = {
    id: "left",
    min: photoPoint(34.12, 0.4, -29.2),
    max: photoPoint(34.24, 0.65, -28.8),
  };
  assert.ok(
    evaluatePhoto(frame, photoWorld([oneHidden])).credits.includes(
      pairCommission.id,
    ),
  );
  const twoHidden = {
    id: "low",
    min: photoPoint(33.5, 0, -29.5),
    max: photoPoint(35.5, 1, -28.5),
  };
  assert.deepEqual(evaluatePhoto(frame, photoWorld([twoHidden])).credits, []);
  const blockedByTin = structuredClone(frame);
  blockedByTin.tin.pose = pose(photoPoint(34.31, 0.55, -29));
  assert.deepEqual(evaluatePhoto(blockedByTin, photoWorld()).credits, []);
  for (const [separation, want] of [
    [2.9995, false],
    [3, true],
    [8, true],
    [8.0001, false],
  ] as const) {
    const f = structuredClone(frame);
    f.animals[0].pose.position[0] = photoPoint(39 - separation, 0, 0)[0];
    f.tin.pose.position[0] = photoPoint(39 - separation, 0, 0)[0];
    assert.equal(
      evaluatePhoto(f, photoWorld()).credits.includes(pairCommission.id),
      want,
      `distance ${separation}`,
    );
  }
});

test("nearby clues enter shared knowledge once while reachable tin actions retain priority", () => {
  const run = crew(),
    p = run.players[0],
    commission = run.world.commissions[0],
    clue = {
      title: commission.title,
      text: commission.instructions,
      position: run.world.pockets.find((p) => p.id === commission.pocket)!
        .position,
    },
    note = `${clue.title}: ${clue.text}`;
  assert.throws(() => command(run, "a", "interact"), /closer|reach/i);
  assert.ok(!run.observations.includes(note));
  p.position = [clue.position[0], 0, clue.position[2] + 0.5];
  place(run, [p.position[0], 0.109, p.position[2] - 0.5]);
  command(run, "a", "interact");
  assert.equal(run.tin.holder, "a");
  assert.ok(!run.observations.includes(note));
  command(run, "a", "interact");
  assert.equal(run.tin.holder, null);
  assert.ok(!run.observations.includes(note));
  run.tin.holder = "b";
  command(run, "a", "interact");
  assert.equal(run.tin.holder, "b");
  assert.ok(run.observations.includes(note));
  command(run, "a", "interact");
  assert.equal(run.observations.filter((s) => s === note).length, 1);
});

test("photographs freeze the authoritative pose; early pair credit works and album/pending frames stay bounded", () => {
  const run = createRun(2, photoRun.worldId);
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  command(run, "a", "start");
  const f = photo();
  run.animals = f.animals;
  run.tin = f.tin;
  run.players[0].position = photoPoint(36.5, 0, -22);
  const accepted = command(run, "a", "photo")!;
  assert.deepEqual(run.completed, [pairCommission.id]);
  assert.equal(accepted.frame.camera.position[1], 1.6);
  assert.ok(Object.isFrozen(accepted.frame));
  run.props[0].open = true;
  assert.equal(accepted.frame.props[0].open, false);
  const oldX = accepted.frame.animals[0].pose.position[0];
  run.animals[0].pose.position[0] += 12;
  assert.equal(accepted.frame.animals[0].pose.position[0], oldX);
  assert.deepEqual(run.pendingPhotos[accepted.frame.id], accepted.frame);
  assert.throws(() => command(run, "a", "photo"), /wait|cooldown/i);
  for (let i = 0; i < 26; i++) {
    step(run, 1.1);
    command(run, "a", "photo");
  }
  assert.equal(run.completed.length, 1);
  assert.ok(run.album.length <= 24);
  assert.equal(run.album.filter((p) => p.credits.length).length, 1);
  assert.equal(Object.keys(run.pendingPhotos).length, run.album.length);
  assert.ok(run.album.some((p) => p.id === accepted.frame.id));
  const publicState = snapshot(run);
  assert.ok(!("pendingPhotos" in publicState));
  assert.ok(!("hostId" in publicState));
  const captured = makePhotoFrame(run, "a");
  publicState.tin.portions = 0;
  assert.equal(captured.tin.portions, 4);
});

test("disconnect releases the held tin and freezes timers; a guest can continue if the host is absent, rejoin is safe", () => {
  const run = crew();
  run.players[0].position = [0, 0, 6];
  place(run, [0, 0.25, 5]);
  command(run, "a", "interact");
  run.animals.find((a) => a.species === "heron")!.behavior = "display";
  run.animals.find((a) => a.species === "heron")!.remaining = 3;
  run.baitPatches[
    run.world.pockets
      .flatMap((p) => p.anchors)
      .find((a) => a.kind === "feed")!.id
  ] = 1;
  disconnectPlayer(run, "a");
  assert.equal(run.paused, true);
  assert.equal(run.tin.holder, null);
  const saved = structuredClone(run);
  step(run, 10);
  assert.deepEqual(run, saved);
  command(run, "b", "resume");
  step(run, 0.5);
  assert.equal(run.paused, false);
  assert.ok(run.animals.find((a) => a.species === "heron")!.remaining < 3);
  assert.equal(
    run.baitPatches[
      run.world.pockets
        .flatMap((p) => p.anchors)
        .find((a) => a.kind === "feed")!.id
    ],
    1,
  );
  run.players[1].position = [-10.4, 0, 1];
  addPlayer(run, "a", "A");
  assert.equal(run.players.length, 2);
  assert.equal(run.players[0].lastInput, null);
  assert.ok(distance(run.players[0].position, run.players[1].position) < 8);
  assert.throws(() => command(run, "b", "pause"), /host/i);
});

test("each selected assignment, camp return and connected readiness gate the exhibition", () => {
  const run = crew();
  for (const missing of run.world.commissions
    .filter((c) => c.required)
    .map((c) => c.id)) {
    run.completed = run.world.commissions
      .filter((c) => c.required)
      .map((c) => c.id)
      .filter((id) => id !== missing);
    assert.throws(() => command(run, "a", "ready-end"), /all six/i);
    assert.throws(() => command(run, "a", "finish"), /all six/i);
  }
  run.completed = [
    ...run.world.commissions.filter((c) => c.required).map((c) => c.id),
  ];
  for (const p of run.players) p.position = [...run.world.camp];
  command(run, "a", "ready-end");
  command(run, "b", "ready-end");
  run.players[1].position[0] += 7;
  assert.throws(() => command(run, "a", "finish"), /at camp/i);
  run.players[1].position = [...run.world.camp];
  command(run, "b", "ready-end");
  assert.throws(() => command(run, "a", "finish"), /ready/i);
  disconnectPlayer(run, "b");
  command(run, "a", "resume");
  command(run, "a", "finish");
  assert.equal(run.phase, "exhibition");
});

test("bait refills and contextual recovery preserve progress; camp ending requires every connected player ready", () => {
  const run = crew(),
    patch = anchor(run, "heron", "feed"),
    patchId = run.world.pockets
      .find(
        (p) =>
          p.id === run.world.residents.find((r) => r.species === "heron")!.home,
      )!
      .anchors.find((a) => a.kind === "feed")!.id;
  run.tin.portions = 0;
  run.players[0].position = [...run.world.camp];
  place(run, [run.world.camp[0], 0.25, run.world.camp[2] - 1]);
  command(run, "a", "interact");
  command(run, "a", "use");
  assert.equal(run.tin.portions, 4);
  step(run, 3.1);
  run.players[0].position = [patch[0], 0, patch[2] + 1];
  command(run, "a", "use");
  assert.equal(run.tin.portions, 3);
  assert.equal(run.baitPatches[patchId], 1);
  command(run, "a", "drop");
  run.tin.pose.position = [80, -10, 80];
  command(run, "b", "recover");
  assert.equal(run.tin.portions, 3);
  assert.deepEqual(
    run.tin.pose.position,
    [
      run.world.tinStart,
      ...run.world.stations.map(
        (s) => [s.recover[0], s.recover[1] + 0.109, s.recover[2]] as Vec3,
      ),
    ].sort(
      (a, b) => distance(a, [80, -10, 80]) - distance(b, [80, -10, 80]),
    )[0],
    "recovery chooses the point nearest the lost tin",
  );
  assert.throws(() => command(run, "a", "ready-end"), /assignment|photo/i);
  run.completed = [
    ...run.world.commissions.filter((c) => c.required).map((c) => c.id),
  ];
  for (const p of run.players) p.position = [...run.world.camp];
  command(run, "a", "ready-end");
  assert.throws(() => command(run, "a", "finish"), /ready/i);
  command(run, "b", "ready-end");
  command(run, "a", "finish");
  assert.equal(run.phase, "exhibition");
});

test("a linked generated encounter preserves tin identity through theft, pause, recovery and pair credit", () => {
  const run = createRun(2, photoRun.worldId);
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  command(run, "a", "start");
  const pairPoint = (x: number, y: number, z: number) =>
    photoPoint(78 - x, y, z);
  const tin = run.tin,
    r = run.animals.find(
      (a) =>
        a.id ===
        pairCommission.subjects.find(
          (id) => run.animals.find((a) => a.id === id)!.species === "raccoon",
        ),
    )!,
    h = run.animals.find(
      (a) =>
        a.id ===
        pairCommission.subjects.find(
          (id) => run.animals.find((a) => a.id === id)!.species === "heron",
        ),
    )!,
    a = run.players[0],
    b = run.players[1];
  const until = (condition: () => boolean, seconds: number) => {
    for (let i = 0; i < seconds * 10 && !condition(); i++) step(run, 0.1);
    assert.ok(condition(), JSON.stringify({ r, h, tin }));
  };
  // The physical setup starts in the pair's bound pocket; transitions are authoritative updates.
  r.pose = pose(pairPoint(34, 0, -30));
  r.remaining = 0;
  place(run, pairPoint(34, 0.109, -30.8));
  until(() => r.behavior === "inspect", 8);
  until(() => tin.holder === `animal:${r.id}`, 8);
  b.position = [r.pose.position[0] + 3, 0, r.pose.position[2]];
  command(run, "b", "use");
  step(run, 0.2);
  assert.equal(r.behavior, "investigate");
  command(run, "a", "pause");
  const frozen = snapshot(run);
  step(run, 20);
  assert.deepEqual(snapshot(run), frozen);
  command(run, "a", "resume");
  b.position = [...run.world.camp];
  until(() => tin.holder === null, 40);
  a.position = [tin.pose.position[0], 0, tin.pose.position[2] + 0.8];
  command(run, "a", "interact");
  assert.equal(tin.holder, "a");
  a.position = [pairAnchor[0], 0, pairAnchor[2] + 1];
  for (let portion = 0; portion < 4; portion++) {
    command(run, "a", "use");
    if (portion < 3) step(run, 3.1);
  }
  assert.equal(run.baitPatches[pairCommission.anchor!], 4);
  a.position = [...run.world.camp];
  until(() => h.behavior === "feed" && h.remaining <= 3, 25);
  a.position = pairPoint(34, 0, -29.8);
  command(run, "a", "interact");
  a.position = [...run.world.camp];
  until(() => r.behavior === "inspect" && h.behavior === "display", 12);
  b.position = pairPoint(36.5, 0, -22);
  b.yaw = 0;
  b.pitch = 0;
  const captured = command(run, "b", "photo")!;
  assert.ok(
    captured.verdict.credits.includes(pairCommission.id),
    JSON.stringify(captured.verdict),
  );
  assert.equal(run.tin, tin);
  assert.equal(tin.portions, 0);
  until(() => run.baitPatches[pairCommission.anchor!] === 0, 15);
  assert.equal(run.baitPatches[pairCommission.anchor!], 0);
  assert.ok(run.album.at(-1)!.assists.includes("a"));
  assert.ok(run.observations.some((s) => /quiet|noise|inspect/i.test(s)));
  assert.throws(() => command(run, "a", "ready-end"), /all six/);
  assert.equal(run.phase, "outing");
});

test("a local plank cannot bypass another crossing's water or leave its own deck strip", () => {
  for (const variant of ["wrong-plank", "outside-strip", "rotated"] as const) {
    const run = crew(),
      fixture = crossing(run),
      original = run.props.find((p) => p.id === fixture.plankId)!,
      plank =
        variant === "wrong-plank"
          ? run.props.find((p) => p.kind === "plank" && p !== original)!
          : original,
      start = structuredClone(original.pose),
      player = run.players[0];
    if (plank !== original) original.pose.position = [...run.world.camp];
    plank.pose = start;
    if (variant === "outside-strip") plank.pose.position[2] += 1;
    const yaw = variant === "rotated" ? 0.15 : 0;
    plank.pose.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
    const handle = propPoint(PROP_DEFINITIONS.plank.handles[0], plank.pose);
    player.position = [handle[0], 0, handle[2] + 0.8];
    player.yaw = yaw;
    command(run, "a", "interact");
    assert.equal(plank.holders[0], "a");
    for (let i = 0; i < 40; i++) {
      applyCommand(run, "a", {
        type: "input",
        value: {
          seq: player.lastSeq + 1,
          x: 1,
          z: 0,
          yaw,
          pitch: 0,
          run: false,
          crouch: false,
        },
      });
      step(run, 0.2);
    }
    command(run, "a", "interact");
    assert.equal(plank.placed, false, variant);
    assert.equal(run.route[fixture.id].open, false, variant);
    assert.ok(
      run.events.some((e) => e.kind === "impact"),
      variant,
    );
  }
});
