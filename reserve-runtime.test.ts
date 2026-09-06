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
