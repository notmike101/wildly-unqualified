import { test } from "node:test";
import assert from "node:assert/strict";
import * as Shared from "./shared.ts";
import {
  parseMessage as parseWorldMessage,
  movePlayer,
  rayBlocked,
  surfaceHeight,
  type Player,
  type Input,
  type Walkable,
  type FieldProp,
} from "./shared.ts";
function parseMessage(value: unknown) {
  return parseWorldMessage(
    value && typeof value === "object"
      ? { worldId: "test-world", ...value }
      : value,
  );
}
const equipmentTarget = (Shared as any).equipmentTarget;
const equipmentUseTarget = (Shared as any).equipmentUseTarget;
const playerSpeed = (Shared as any).playerSpeed;
const propBoxes = (Shared as any).propBoxes;
const player: Player = {
  id: "p1",
  name: "Player",
  slot: 0,
  position: [0, 0, 0],
  yaw: 0,
  pitch: 0,
  lastSeq: 0,
  connected: true,
  lastInput: null,
  inputTick: 0,
};
const input: Input = {
  seq: 1,
  x: 1,
  z: 1,
  yaw: 0,
  pitch: 0,
  run: false,
  crouch: false,
};

test("favorites accept only a bounded canonical photo ID, boolean and safe sequence", () => {
  const message = {
    worldId: "test-world",
    type: "favorite",
    seq: 1,
    photoId: "photo-1",
    selected: true,
  };
  assert.deepEqual(parseMessage(message), message);
  assert.deepEqual(parseMessage({ ...message, selected: false }), {
    ...message,
    selected: false,
  });
  for (const change of [
    { playerId: "other" },
    { selected: 1 },
    { selected: undefined },
    { photoId: "" },
    { photoId: "a".repeat(81) },
    { photoId: "../photo-1" },
    { photoId: "photo 1" },
    { seq: 0 },
    { seq: 1.5 },
    { seq: Infinity },
    { seq: Number.MAX_SAFE_INTEGER + 1 },
  ])
    assert.throws(() => parseMessage({ ...message, ...change }));
});

test("walkable surfaces interpolate ramps only inside their bounds", () => {
  const ramp: Walkable = {
    id: "ramp",
    min: [-2, -1, -1],
    max: [2, 0, 1],
    axis: 0,
    heightStart: 0,
    heightEnd: -1,
  };
  assert.equal(surfaceHeight(ramp, -2, 0), 0);
  assert.equal(surfaceHeight(ramp, 0, 0), -0.5);
  assert.equal(surfaceHeight(ramp, 2, 0), -1);
  assert.equal(surfaceHeight(ramp, 0, 2), null);
});

test("movement normalizes diagonals and cannot pass thin walls", () => {
  const p = movePlayer(player, input, 0.1, []);
  assert.ok(Math.hypot(p.position[0], p.position[2]) <= 0.300001);
  const w = movePlayer(player, { ...input, z: 0, run: true }, 0.25, [
    { id: "wall", min: [0.6, -1, -2], max: [0.65, 3, 2] },
  ]);
  assert.ok(w.position[0] <= 0.251);
  assert.equal(player.position[0], 0);
});

test("small steps can escape an existing box overlap along either axis", () => {
  const position: [number, number, number] = [
      -46.285810432382895, 0, 41.46912793927619,
    ],
    wall = {
      id: "released-case",
      min: [-47.86302049741294, -0.00008621366, 40.39249055777753] as [
        number,
        number,
        number,
      ],
      max: [-46.524888438133935, 0.64991387279, 41.12257749642169] as [
        number,
        number,
        number,
      ],
    };
  const moved = movePlayer(
    { ...player, position, yaw: -1.5729599996566783 },
    {
      ...input,
      x: 0,
      z: -1,
      yaw: -1.5729599996566783,
      run: false,
    },
    1 / 60,
    [wall],
  );
  assert.ok(moved.position[0] > position[0] + 0.04);

  const sidewaysPosition: [number, number, number] = [
      -46.17788843813394, 0, 41.36157749642169,
    ],
    sideways = movePlayer(
      { ...player, position: sidewaysPosition },
      { ...input, x: 0, z: 1, yaw: 0, run: false },
      1 / 60,
      [wall],
    );
  assert.ok(sideways.position[2] > sidewaysPosition[2] + 0.04);

  const inward = movePlayer(
    { ...player, position },
    { ...input, x: 0, z: 1, yaw: -1.5729599996566783, run: false },
    1 / 60,
    [wall],
  );
  assert.deepEqual(inward.position, position);
});

test("wire parser refuses nonfinite, unknown, extra and oversized input", () => {
  assert.deepEqual(parseMessage({ type: "input", value: input }), {
    worldId: "test-world",
    type: "input",
    value: input,
  });
  for (const bad of [
    { type: "input", value: { ...input, x: NaN } },
    { type: "teleport", seq: 1 },
    { type: "photo", seq: 1, admin: true },
    { type: "input", value: { ...input, x: 2 } },
  ])
    assert.throws(() => parseMessage(bad));
});
test("occlusion handles parallel rays and obstacles behind subjects", () => {
  const b = {
    id: "wall",
    min: [-1, 0, -4] as [number, number, number],
    max: [1, 3, -3] as [number, number, number],
  };
  assert.equal(rayBlocked([0, 1, 0], [0, 1, -5], [b]), true);
  assert.equal(rayBlocked([2, 1, 0], [2, 1, -5], [b]), false);
  assert.equal(rayBlocked([0, 1, 0], [0, 1, -2], [b]), false);
});

const prop = (
  kind: FieldProp["kind"],
  position: [number, number, number],
): FieldProp => ({
  id: kind,
  kind,
  pose: { position, rotation: [0, 0, 0, 1] },
  velocity: [0, 0, 0],
  angularVelocity: [0, 0, 0],
  holders: [null, null],
  placed: false,
  open: false,
  spillUntilTick: 0,
});
const definition = {
  bounds: [
    [-1.2, -1, -0.1],
    [1.2, 1, 0.1],
  ],
  solids: [
    { center: [-0.9, 0, 0], size: [0.6, 2, 0.2] },
    { center: [0.9, 0, 0], size: [0.6, 2, 0.2] },
  ],
  handles: [
    [-1, 0, 0],
    [1, 0, 0],
  ],
  usePoints: [{ part: "lid", point: [0, 0.5, 0] }],
};

test("equipment selectors choose only visible free handles for E and free bait cups for Q", () => {
  assert.equal(typeof equipmentTarget, "function");
  assert.equal(typeof equipmentUseTarget, "function");
  const item = prop("case", [0, 1, -1]);
  item.holders[0] = "other";
  assert.deepEqual(
    equipmentTarget(player, [item], { case: definition } as never, []),
    { propId: "case", handle: 1, part: "handle", point: [1, 1, -1] },
  );
  assert.equal(
    equipmentUseTarget(player, [item], { case: definition } as never, []),
    null,
  );
  const decoy = prop("decoy", [0, 1, -1.7]),
    sideCase = prop("case", [1.5, 1, -0.2]),
    decoyDefinition = {
      ...definition,
      usePoints: [{ part: "bait-cup", point: [0, 0.5, 0] }],
    };
  assert.deepEqual(
    equipmentUseTarget(
      player,
      [sideCase, decoy],
      { case: definition, decoy: decoyDefinition } as never,
      [],
    ),
    { propId: "decoy", handle: null, part: "bait-cup", point: [0, 1.5, -1.7] },
  );
  const heldScreen = prop("screen", [10, 1, 10]);
  heldScreen.holders[0] = player.id;
  assert.equal(
    equipmentUseTarget(
      player,
      [heldScreen, decoy],
      { screen: definition, decoy: decoyDefinition } as never,
      [],
    ),
    null,
  );
  assert.equal(
    equipmentTarget(player, [item], { case: definition } as never, [
      { id: "wall", min: [-2, -2, -0.75], max: [2, 2, -0.7] },
    ]),
    null,
  );
});

test("compound prop boxes preserve openings and carry speed follows holder count", () => {
  assert.equal(typeof propBoxes, "function");
  assert.equal(typeof playerSpeed, "function");
  const item = prop("case", [3, 2, 4]);
  const boxes = propBoxes(item, definition);
  assert.equal(boxes.length, 2);
  assert.equal(rayBlocked([3, 2, 3], [3, 2, 5], boxes), false);
  const movement = { ...input, x: 1, z: 0, run: true };
  item.holders = ["p1", null];
  assert.equal(playerSpeed("p1", movement, [item]), 0.8);
  item.holders[1] = "p2";
  assert.equal(playerSpeed("p1", movement, [item]), 2);
  item.kind = "decoy";
  assert.equal(playerSpeed("p1", movement, [item]), 5);
  const limited = movePlayer(player, movement, 0.25, [], [], 0.8);
  assert.ok(limited.position[0] > 0.19 && limited.position[0] < 0.21);
});

test("wire commands require a bounded exact world identity before gameplay validation", () => {
  assert.throws(
    () => parseWorldMessage({ type: "photo", seq: 1 }),
    /world|message/i,
  );
  for (const worldId of ["", "../reserve", "a".repeat(65), null, 3])
    assert.throws(() => parseWorldMessage({ type: "photo", seq: 1, worldId }));
  assert.deepEqual(
    parseWorldMessage({ type: "photo", seq: 1, worldId: "outing-1" }),
    { type: "photo", seq: 1, worldId: "outing-1" },
  );
});
