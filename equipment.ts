/** Equipment grips, swept movement, seating, release, and safe recovery. */
import {
  PROP_DEFINITIONS,
  PROP_CENTER_HEIGHT,
  fixtureBoxes,
  fixtureSurfaces,
} from "./level.ts";
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
} from "./shared.ts";
import { type RunState } from "./game-state.ts";
const gripState = new WeakMap<RunState, Map<string, Vec3>>();
const overlap = (a: Box, b: Box) =>
  a.min.every(
    (value, axis) => value < b.max[axis] && a.max[axis] > b.min[axis],
  );
const yawOf = (value: Pose) => {
  const [x, y, z, w] = value.rotation;
  return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
};
export const yawPose = (position: Vec3, yaw: number): Pose => ({
  position: [...position],
  rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
});
const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));
export const quatAngle = (a: Quat, b: Quat) =>
  2 *
  Math.acos(
    Math.min(1, Math.abs(a.reduce((sum, value, i) => sum + value * b[i], 0))),
  );
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
export const alignLocalX = (direction: Vec3): Quat => {
  const length = Math.hypot(...direction),
    [x, y, z] = direction.map((value) => value / length) as Vec3;
  if (x < -0.999999) return [0, 1, 0, 0];
  const q: Quat = [0, -z, y, 1 + x],
    magnitude = Math.hypot(...q);
  return q.map((value) => value / magnitude) as Quat;
};
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
const gripKey = (prop: FieldProp, handle: number, id: string) =>
  `${prop.id}\0${handle}\0${id}`;
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
export const clearGrips = (run: RunState, prop: FieldProp, id?: string) => {
  const grips = gripState.get(run);
  if (!grips) return;
  for (const key of grips.keys())
    if (key.startsWith(`${prop.id}\0`) && (!id || key.endsWith(`\0${id}`)))
      grips.delete(key);
};
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
