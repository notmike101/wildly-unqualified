/** Equipment grips, swept movement, seating, release, and safe recovery. */
import {
  PROP_DEFINITIONS,
  PROP_CENTER_HEIGHT,
  fixtureBoxes,
  fixtureSurfaces,
} from "../../shared/world/level.ts";
import {
  distance,
  pose,
  surfaceHeight,
  propPoint,
  propBoxes,
  type Box,
  type FieldProp,
  type Player,
  type Pose,
  type Quat,
  type Vec3,
} from "../../shared/shared.ts";
import { type RunState } from "./game-state.ts";
const gripState = new WeakMap<RunState, Map<string, Vec3>>();
/**
 * Test strict overlap of two axis-aligned boxes; touching faces do not overlap.
 *
 * @param a - First world-space box
 * @param b - Second world-space box
 * @returns Whether all three axis intervals overlap.
 */
const overlap = (a: Box, b: Box) =>
  a.min.every(
    (value, axis) => value < b.max[axis] && a.max[axis] > b.min[axis],
  );
/**
 * Extract the heading component from a pose quaternion.
 *
 * @param value - Pose containing an XYZW quaternion
 * @returns Yaw in radians.
 */
const yawOf = (value: Pose) => {
  const [x, y, z, w] = value.rotation;
  return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
};
/**
 * Construct a yaw-only pose while copying its position.
 *
 * @param position - World position
 * @param yaw - Yaw in radians
 * @returns A new pose with a unit yaw quaternion.
 */
export const yawPose = (position: Vec3, yaw: number): Pose => ({
  position: [...position],
  rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
});
/**
 * Wrap the difference between headings to the shortest signed turn.
 *
 * @param from - Initial heading in radians
 * @param to - Target heading in radians
 * @returns Signed angular difference in radians.
 */
const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));
/**
 * Measure the shortest angular separation of unit quaternions, treating opposite signs as
 * the same rotation.
 *
 * @param a - First unit XYZW quaternion
 * @param b - Second unit XYZW quaternion
 * @returns Unsigned angle in radians.
 */
export const quatAngle = (a: Quat, b: Quat) =>
  2 *
  Math.acos(
    Math.min(1, Math.abs(a.reduce((sum, value, i) => sum + value * b[i], 0))),
  );
/**
 * Interpolate unit quaternions along the shortest arc, using normalized linear
 * interpolation for nearly equal rotations.
 *
 * @param a - Starting unit quaternion
 * @param b - Ending unit quaternion
 * @param t - Interpolation fraction, normally between 0 and 1
 * @returns Interpolated unit XYZW quaternion.
 */
export const slerp = (a: Quat, b: Quat, t: number): Quat => {
  let dot = a.reduce((sum, value, i) => sum + value * b[i], 0),
    end = b;
  if (dot < 0) {
    dot = -dot;
    end = b.map((value) => -value) as Quat;
  }
  if (dot > 0.9995) {
    const mixed = a.map((value, i) => value + (end[i] - value) * t) as Quat,
      length = Math.hypot(...mixed);
    return mixed.map((value) => value / length) as Quat;
  }
  const angle = Math.acos(Math.min(1, dot)),
    scale = Math.sin(angle),
    startWeight = Math.sin((1 - t) * angle) / scale,
    endWeight = Math.sin(t * angle) / scale;
  return a.map((value, i) => value * startWeight + end[i] * endWeight) as Quat;
};
/**
 * Construct a quaternion that points the local X axis along a nonzero direction.
 *
 * @param direction - Nonzero direction vector, normalization is performed internally
 * @returns Unit XYZW quaternion, with a special case for the opposite X axis.
 */
export const alignLocalX = (direction: Vec3): Quat => {
  const length = Math.hypot(...direction),
    [x, y, z] = direction.map((value) => value / length) as Vec3;
  if (x < -0.999999) return [0, 1, 0, 0];
  const q: Quat = [0, -z, y, 1 + x],
    magnitude = Math.hypot(...q);
  return q.map((value) => value / magnitude) as Quat;
};
/**
 * Sample prop solid bottoms against walkable surfaces to find the required upward
 * correction.
 *
 * @param run - Run supplying terrain and fixture state
 * @param prop - Prop whose support is tested
 * @param value - Proposed world pose
 * @returns Nonnegative lift in metres.
 */
function terrainLift(run: RunState, prop: FieldProp, value: Pose) {
  const surfaces = [
    ...run.world.walkables,
    ...(prop.kind === "plank" && prop.placed
      ? []
      : fixtureSurfaces(run.world.fixtures, run.route)),
  ];
  return Math.max(
    0,
    ...PROP_DEFINITIONS[prop.kind].solids.flatMap((solid) => {
      const half = solid.size.map((size) => size / 2) as Vec3;
      return [-1, 0, 1].flatMap((x) =>
        [-1, 0, 1].map((z) => {
          const point = propPoint(
              [
                solid.center[0] + x * half[0],
                solid.center[1] - half[1],
                solid.center[2] + z * half[2],
              ],
              value,
            ),
            heights = surfaces
              .map((surface) => surfaceHeight(surface, point[0], point[2]))
              .filter((height): height is number => height !== null);
          return heights.length ? Math.max(...heights) - point[1] : 0;
        }),
      );
    }),
  );
}
/**
 * Test terrain clearance and overlap against fixtures and other props, allowing an aligned
 * plank to span its own crossing water.
 *
 * @param run - Run supplying terrain and equipment
 * @param prop - Prop being tested, excluded from other-prop blockers
 * @param value - Proposed world pose
 * @param outer - Use the full outer bounds instead of individual solids
 * @returns Whether the proposed pose clears all applicable blockers.
 */
function propClear(run: RunState, prop: FieldProp, value: Pose, outer = false) {
  const definition = PROP_DEFINITIONS[prop.kind],
    shape = outer
      ? {
          ...definition,
          solids: [
            {
              center: definition.bounds[0].map(
                (n, i) => (n + definition.bounds[1][i]) / 2,
              ) as Vec3,
              size: definition.bounds[0].map(
                (n, i) => definition.bounds[1][i] - n,
              ) as Vec3,
            },
          ],
        }
      : definition,
    test = { ...prop, pose: value },
    crossing = run.world.fixtures.find((f) => f.plankId === prop.id),
    deck = crossing?.openSurfaces[0],
    /**
     * Recognize water beneath this plank's aligned crossing deck so it can be excluded as a
     * blocker.
     *
     * @param wall - Candidate world wall or water box
     * @returns Whether this water box belongs to the valid spanning exception.
     */
    spansOwnWater = (wall: Box) =>
      !!deck &&
      run.world.waters.some((w) => w.id === wall.id) &&
      wall.min[0] < deck.max[0] &&
      wall.max[0] > deck.min[0] &&
      wall.min[2] < deck.max[2] &&
      wall.max[2] > deck.min[2] &&
      Math.abs(angleDelta(yawOf(value), crossing!.yaw)) < 1e-6 &&
      propBoxes(test, shape).every(
        (b) => b.min[2] >= deck.min[2] - 1e-6 && b.max[2] <= deck.max[2] + 1e-6,
      ),
    blockers = [
      ...run.world.walls.filter((wall) => !spansOwnWater(wall)),
      ...fixtureBoxes(run.world.fixtures, run.route),
      ...run.props
        .filter((p) => p !== prop)
        .flatMap((p) => propBoxes(p, PROP_DEFINITIONS[p.kind])),
    ];
  return (
    terrainLift(run, prop, value) <= 0.05 &&
    !propBoxes(test, shape).some((box) =>
      blockers.some((wall) => overlap(box, wall)),
    )
  );
}
/**
 * Build a collision-resistant cache key from the prop, handle, and player identifiers.
 *
 * @param prop - Held prop
 * @param handle - Handle index
 * @param id - Holding player ID
 * @returns A NUL-delimited grip key.
 */
const gripKey = (prop: FieldProp, handle: number, id: string) =>
  `${prop.id}\0${handle}\0${id}`;
/**
 * Remember the initial world-space displacement from a player to a prop handle for this
 * grip.
 *
 * @param run - Run owning the grip cache
 * @param prop - Held prop
 * @param handle - Handle index
 * @param p - Player holding that handle
 * @returns Cached handle offset; callers must not mutate it.
 */
export const gripOffset = (
  run: RunState,
  prop: FieldProp,
  handle: number,
  p: Player,
) => {
  const grips = gripState.get(run) ?? new Map<string, Vec3>();
  gripState.set(run, grips);
  const key = gripKey(prop, handle, p.id),
    existing = grips.get(key);
  if (existing) return existing;
  const point = propPoint(
      PROP_DEFINITIONS[prop.kind].handles[handle],
      prop.pose,
    ),
    offset = point.map((value, axis) => value - p.position[axis]) as Vec3;
  grips.set(key, offset);
  return offset;
};
/**
 * Remove cached offsets for a prop, optionally restricted to one player.
 *
 * @param run - Run owning the grip cache
 * @param prop - Prop whose grips are invalidated
 * @param id - Player ID to clear, omission clears every grip on the prop
 */
export const clearGrips = (run: RunState, prop: FieldProp, id?: string) => {
  const grips = gripState.get(run);
  if (!grips) return;
  for (const key of grips.keys())
    if (key.startsWith(`${prop.id}\0`) && (!id || key.endsWith(`\0${id}`)))
      grips.delete(key);
};
/**
 * Sweep translation and rotation in small increments, applying terrain lift until blocked.
 * Does not mutate the prop.
 *
 * @param run - Run supplying collision geometry
 * @param prop - Prop at its starting pose
 * @param desired - Requested destination pose
 * @returns Last valid pose and a hit flag indicating early collision termination.
 */
export function sweepProp(run: RunState, prop: FieldProp, desired: Pose) {
  const from = prop.pose,
    rotation = quatAngle(from.rotation, desired.rotation),
    travel = distance(from.position, desired.position),
    steps = Math.max(
      1,
      Math.ceil(Math.max(travel / 0.1, rotation / (Math.PI / 36))),
    );
  let result = structuredClone(from),
    hit = false;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps,
      next: Pose = {
        position: from.position.map(
          (n, axis) => n + (desired.position[axis] - n) * t,
        ) as Vec3,
        rotation: slerp(from.rotation, desired.rotation, t),
      },
      lift = terrainLift(run, prop, next);
    if (lift > 0.15) {
      hit = true;
      break;
    }
    next.position[1] += Math.max(0, lift);
    if (!propClear(run, prop, next, true)) {
      hit = true;
      break;
    }
    result = next;
  }
  return { pose: result, hit };
}
/**
 * Snap a plank to the nearest authored seat within distance and angle tolerances. Clears
 * holders and velocities and opens the crossing only on success.
 *
 * @param run - Authoritative run and route state to update
 * @param prop - Plank to seat in place
 * @returns Whether a suitable seat was found and applied.
 */
function seatPlank(run: RunState, prop: FieldProp) {
  const yaw = yawOf(prop.pose),
    fixture = run.world.fixtures.find((f) => f.plankId === prop.id),
    seat = Object.entries(fixture?.seats ?? {})
      .filter(
        ([, value]) => distance(prop.pose.position, value.position) <= 0.75,
      )
      .filter(
        ([, value]) =>
          Math.abs(angleDelta(yaw, yawOf(value))) <= (20 * Math.PI) / 180,
      )
      .sort(
        (a, b) =>
          distance(prop.pose.position, a[1].position) -
          distance(prop.pose.position, b[1].position),
      )[0];
  if (!seat) return false;
  prop.pose = structuredClone(seat[1]);
  prop.velocity = [0, 0, 0];
  prop.angularVelocity = [0, 0, 0];
  prop.holders = [null, null];
  prop.placed = true;
  run.route[fixture!.id] = { open: true, seat: seat[0] };
  return true;
}
/**
 * Release the player's grip or place the whole prop. Placement may seat a plank; a loose
 * drop retains any other holder and otherwise adds angular motion.
 *
 * @param run - Authoritative run to update
 * @param prop - Held prop to update
 * @param id - Releasing player ID
 * @param place - Place the whole prop when true, otherwise release this player's grip
 */
export function releaseProp(
  run: RunState,
  prop: FieldProp,
  id: string,
  place: boolean,
) {
  if (place && prop.kind === "plank" && seatPlank(run, prop)) {
    clearGrips(run, prop);
    return;
  }
  clearGrips(run, prop, place ? undefined : id);
  prop.holders = prop.holders.map((holder) =>
    holder === id || place ? null : holder,
  ) as [string | null, string | null];
  if (prop.holders.some(Boolean)) return;
  prop.placed = false;
  prop.velocity = [0, 0, 0];
  prop.angularVelocity = place ? [0, 0, 0] : [0, 0.6, 0.35];
}
/**
 * Move equipment to the nearest clear authored spawn or station recovery pose and clear its
 * grip and motion state.
 *
 * @param run - Authoritative run to update
 * @param prop - Prop to recover in place
 * @param origin - Position used to rank recovery candidates
 * @throws {Error} No authored recovery pose has sufficient clearance.
 */
export function recoverProp(run: RunState, prop: FieldProp, origin: Vec3) {
  const choices = [
    run.world.props.find((value) => value.id === prop.id)!.pose,
    ...run.world.stations.map((station) =>
      pose([
        station.recover[0],
        station.recover[1] + PROP_CENTER_HEIGHT[prop.kind],
        station.recover[2],
      ]),
    ),
  ]
    .filter((candidate) => propClear(run, prop, candidate, true))
    .sort(
      (a, b) => distance(a.position, origin) - distance(b.position, origin),
    );
  if (!choices[0])
    throw Error("No clear authored recovery point for that equipment");
  clearGrips(run, prop);
  prop.pose = structuredClone(choices[0]);
  prop.velocity = [0, 0, 0];
  prop.angularVelocity = [0, 0, 0];
  prop.holders = [null, null];
  prop.placed = false;
}
/**
 * Detect invalid, obstructed, or excessively tilted equipment while exempting a correctly
 * seated crossing plank.
 *
 * @param run - Run supplying route and collision state
 * @param prop - Prop to inspect
 * @returns Whether the recovery action should be available.
 */
export function propRecoverable(run: RunState, prop: FieldProp) {
  const fixture = run.world.fixtures.find((f) => f.plankId === prop.id),
    state = fixture && run.route[fixture.id],
    seated =
      fixture && state?.open && state.seat ? fixture.seats[state.seat] : null;
  if (
    prop.placed &&
    seated &&
    distance(prop.pose.position, seated.position) < 1e-6 &&
    quatAngle(prop.pose.rotation, seated.rotation) < 1e-6
  )
    return false;
  const [x, , z] = prop.pose.rotation;
  return (
    prop.pose.position.some((n) => !Number.isFinite(n)) ||
    prop.pose.position[1] < -2 ||
    prop.pose.position[1] > 5 ||
    // Allow recovery beyond 60 degrees when a low grip prevents straightening.
    (!prop.placed && 1 - 2 * (x * x + z * z) < 0.5) ||
    !propClear(run, prop, prop.pose, true)
  );
}
