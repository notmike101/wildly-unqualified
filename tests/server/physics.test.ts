import assert from "node:assert/strict";
import { test } from "node:test";
import { createPhysics } from "../../src/server/simulation/physics.ts";
import {
  movePlayer,
  pose,
  type Player,
  type Tin,
} from "../../src/shared/shared.ts";
import {
  PATCH,
  PHYSICS_BOXES,
  WALKABLES,
  WALLS,
} from "../../src/shared/world/level.ts";
import { surfaceHeight } from "../../src/shared/shared.ts";
import {
  addPlayer,
  advanceRun,
  applyCommand as applyWorldCommand,
  attachPhysics,
  createRun,
  snapshot,
} from "../../src/server/simulation/game.ts";

function applyCommand(
  run: ReturnType<typeof createRun>,
  id: string,
  input: Record<string, unknown>,
) {
  return applyWorldCommand(run, id, { worldId: run.worldId, ...input });
}

test("native impacts name the actual case and an unrelated dropped tin cannot spill its stock", async () => {
  for (const [dropCase, open] of [
    [false, true],
    [true, true],
    [true, false],
  ]) {
    const run = createRun(),
      item = run.props[0];
    addPlayer(run, "a", "A");
    addPlayer(run, "b", "B");
    applyCommand(run, "a", { type: "start", seq: 1 });
    item.open = open;
    item.pose = pose([0, dropCase ? 3 : 0.325, 0]);
    run.tin.pose = pose([5, 3, 0]);
    const physics = await attachPhysics(run);
    try {
      for (let i = 0; i < 100; i++) {
        advanceRun(run, 1 / 60);
        physics.step(1 / 60);
      }
      assert.equal(run.spills.length, dropCase && open ? 1 : 0);
      assert.equal(run.spareBait, dropCase && open ? 7 : 8);
    } finally {
      physics.dispose();
    }
  }
});

test("native loose tin lands on the same bank surface players walk", async () => {
  const tin = createRun().tin;
  tin.pose = pose([-18, 0.109, 2]);
  const physics = await createPhysics(PHYSICS_BOXES, tin);
  try {
    let state = physics.step(1 / 60);
    for (let i = 0; i < 120; i++) state = physics.step(1 / 60);
    const [x, y, z] = state.pose.position;
    const ground = Math.max(
      ...WALKABLES.map((s) => surfaceHeight(s, x, z) ?? -Infinity),
    );
    assert.ok(y > ground && y < ground + 0.2, `tin ${y}, ground ${ground}`);
  } finally {
    physics.dispose();
  }
});

test("both visual dry-bank edges support walking and the native tin", async () => {
  // The imported dry bank spans X -7.5..-0.5; its mesh top at Z30 is 0.593684m.
  for (const x of [-7.25, -0.75]) {
    let player: Player = {
      id: "walker",
      name: "Walker",
      slot: 0,
      position: [x, 0, 27.5],
      yaw: 0,
      pitch: 0,
      lastSeq: 0,
      connected: true,
      lastInput: null,
      inputTick: 0,
    };
    for (let step = 0; step < 50; step++)
      player = movePlayer(
        player,
        {
          seq: step + 1,
          x: 0,
          z: 1,
          yaw: 0,
          pitch: 0,
          run: false,
          crouch: false,
        },
        1 / 60,
        WALLS,
        WALKABLES,
      );
    assert.ok(
      Math.abs(player.position[1] - 0.593684) < 0.01,
      `walking edge ${x}: ${player.position}`,
    );
    const tin = createRun().tin;
    tin.pose = pose([x, 3, 30]);
    const physics = await createPhysics(PHYSICS_BOXES, tin);
    try {
      let state = physics.step(1 / 60);
      for (let step = 0; step < 180; step++) state = physics.step(1 / 60);
      const [, y, z] = state.pose.position;
      // The loose tin can roll downhill; compare with the mesh at its final position.
      const meshHeight = 0.12 + ((z - 28) / 3.8) * 0.9;
      assert.ok(
        meshHeight > 0.2 && y > meshHeight && y < meshHeight + 0.2,
        `native tin edge ${x}: ${state.pose.position}, mesh ${meshHeight}`,
      );
    } finally {
      physics.dispose();
    }
  }
});

test("native loose equipment lands as a persistent compound body and can be held without recreation", async () => {
  const run = createRun(),
    item = run.props.find((prop) => prop.kind === "case")!;
  item.pose.position = [0, 3, 0];
  run.tin.holder = "animal:raccoon";
  const physics = await createPhysics(
    [{ id: "ground", min: [-10, -1, -10], max: [10, 0, 10] }],
    run.tin,
    [item],
    run.route,
  );
  try {
    let state = physics.step(1 / 60);
    for (let i = 0; i < 360; i++) state = physics.step(1 / 60);
    assert.ok(
      state.props[0].pose.position[1] > 0.3 &&
        state.props[0].pose.position[1] < 0.36,
    );
    const held = structuredClone(state.props[0]);
    held.holders[0] = "a";
    held.pose.position = [2, 2, 2];
    physics.setProps([held], run.route);
    for (let i = 0; i < 60; i++) state = physics.step(1 / 60);
    assert.deepEqual(state.props[0].pose.position, [2, 2, 2]);
  } finally {
    physics.dispose();
  }
});

test("native grounding proxies keep plank and screen model roots on the ground", async () => {
  for (const kind of ["plank", "screen"] as const) {
    const run = createRun(),
      item = run.props.find((prop) => prop.kind === kind)!;
    item.pose = pose([0, 3, 0]);
    run.tin.holder = "animal:raccoon";
    const physics = await createPhysics(
      [{ id: "ground", min: [-10, -1, -10], max: [10, 0, 10] }],
      run.tin,
      [item],
      run.route,
    );
    try {
      let state = physics.step(1 / 60);
      for (let i = 0; i < 480; i++) state = physics.step(1 / 60);
      const expected = kind === "plank" ? 0.095 : 0.97;
      assert.ok(
        Math.abs(state.props[0].pose.position[1] - expected) < 0.035,
        `${kind} root ${state.props[0].pose.position[1]}, expected ${expected}`,
      );
    } finally {
      physics.dispose();
    }
  }
});

test("a seated route exposes its real native 0.65 metre deck", async () => {
  const run = createRun();
  run.tin.pose = pose([-12.6, 1, 2]);
  const physics = await createPhysics([], run.tin, [], {
    crossing: "left",
    gateOpen: false,
  });
  try {
    let state = physics.step(1 / 60);
    for (let i = 0; i < 360; i++) state = physics.step(1 / 60);
    assert.ok(
      state.pose.position[1] > -0.76 && state.pose.position[1] < -0.73,
      `tin root ${state.pose.position[1]}`,
    );
  } finally {
    physics.dispose();
  }
});

test("a held prop remains a native collider for loose equipment", async () => {
  const run = createRun(),
    item = run.props.find((prop) => prop.kind === "case")!;
  item.pose.position = [0, 0.325, 0];
  item.holders[0] = "a";
  run.tin.pose = pose([0, 2, 0]);
  const physics = await createPhysics([], run.tin, [item], run.route);
  try {
    let state = physics.step(1 / 60);
    for (let i = 0; i < 240; i++) state = physics.step(1 / 60);
    assert.ok(state.pose.position[1] > 0.72 && state.pose.position[1] < 0.8);
  } finally {
    physics.dispose();
  }
});

test("the saved closed gate is a native collider for loose equipment", async () => {
  const run = createRun(),
    normal: [number, number] = [
      -Math.sin(-0.3805063771123649),
      -Math.cos(-0.3805063771123649),
    ];
  run.tin.pose = pose([-44.8 + normal[0], 1, 31 + normal[1]]);
  run.tin.velocity = [-normal[0] * 5, 0, -normal[1] * 5];
  const physics = await createPhysics([], run.tin, [], {
    crossing: null,
    gateOpen: false,
  });
  try {
    let state = physics.step(1 / 60);
    for (let i = 0; i < 24; i++) state = physics.step(1 / 60);
    const side =
      (state.pose.position[0] + 44.8) * normal[0] +
      (state.pose.position[2] - 31) * normal[1];
    assert.ok(side > -0.25, `tin crossed the gate by ${side}`);
  } finally {
    physics.dispose();
  }
});

test("the actual Box3D loose tin falls, reports impact, saves velocities, disables while held and cleans up", async () => {
  for (let round = 0; round < 2; round++) {
    const tin: Tin = {
      pose: pose([0, 3, 0]),
      velocity: [0.5, 0, 0],
      angularVelocity: [0, 1, 0],
      holder: null,
      portions: 3,
      open: true,
    };
    const physics = await createPhysics(
      [{ id: "ground", min: [-10, -1, -10], max: [10, 0, 10] }],
      tin,
    );
    let state = physics.step(1 / 60),
      impacts = state.impacts.length;
    assert.ok(state.velocity[1] < 0);
    assert.ok(state.angularVelocity[1] > 0.1);
    for (let i = 0; i < 29; i++) {
      state = physics.step(1 / 60);
      impacts += state.impacts.length;
    }
    assert.ok(state.pose.position[1] < 2 && state.pose.position[1] > 0.3);
    for (let i = 0; i < 330; i++) {
      state = physics.step(1 / 60);
      impacts += state.impacts.length;
    }
    assert.ok(
      state.pose.position[1] > 0.1 && state.pose.position[1] < 0.15,
      `settles on collider: ${state.pose.position[1]}`,
    );
    assert.ok(impacts > 0);
    const held = { ...tin, pose: pose([2, 2, 2]), holder: "a" };
    physics.setTin(held);
    for (let i = 0; i < 60; i++) state = physics.step(1 / 60);
    assert.deepEqual(state.pose.position, [2, 2, 2]);
    physics.setTin({ ...held, holder: null, velocity: [0, 0, 0] });
    state = physics.step(0.25);
    assert.ok(state.pose.position[1] < 2);
    physics.dispose();
    physics.dispose();
    assert.throws(() => physics.step(1 / 60), /disposed/);
  }
});

test("authoritative Box3D impacts startle the heron and pause freezes the native body with the world", async () => {
  const run = createRun();
  addPlayer(run, "a", "A");
  addPlayer(run, "b", "B");
  applyCommand(run, "a", { type: "start", seq: 1 });
  const heron = run.animals.find((a) => a.species === "heron")!;
  run.tin.pose = pose([heron.pose.position[0], 2, heron.pose.position[2] + 4]);
  run.tin.angularVelocity = [0, 1, 0.5];
  run.tinRevision++;
  const physics = await attachPhysics(run);
  const step = (count: number) => {
    for (let i = 0; i < count; i++) {
      advanceRun(run, 1 / 60);
      physics.step(1 / 60);
    }
  };
  try {
    step(20);
    assert.ok(run.tin.pose.position[1] < 1.5);
    assert.ok(run.tin.velocity[1] < -1);
    applyCommand(run, "a", { type: "pause", seq: 2 });
    const frozen = snapshot(run);
    step(120);
    assert.deepEqual(snapshot(run), frozen);
    applyCommand(run, "a", { type: "resume", seq: 3 });
    step(90);
    assert.ok(
      run.events.some((e) => e.kind === "noise" && e.player === "tin"),
      "a native contact must reach creature rules",
    );
    assert.ok(["alert", "retreat", "settle"].includes(heron.behavior));
    assert.ok(run.tin.pose.position[1] > 0.1 && run.tin.pose.position[1] < 0.3);
    run.players[0].position = [
      run.tin.pose.position[0],
      0,
      run.tin.pose.position[2] + 0.5,
    ];
    applyCommand(run, "a", { type: "interact", seq: 4 });
    step(1);
    const held = [...run.tin.pose.position];
    step(60);
    assert.deepEqual(run.tin.pose.position, held);
    applyCommand(run, "a", { type: "drop", seq: 5 });
    step(20);
    assert.ok(run.tin.pose.position[1] < held[1]);
  } finally {
    physics.dispose();
  }
});
