/** Species-specific routine stages and their movement/action transitions. */
import type { RunState } from "../game.ts";
import {
  distance,
  pose,
  rayBlocked,
  type Animal,
  type Box,
  type Vec3,
  type Behavior,
  type Pose,
} from "../../../shared/shared.ts";
import {
  SQUIRREL_CLIMB,
  ARCH_STANCES,
} from "../../../shared/wildlife/wildlife-data.ts";
import {
  multiply,
  rotate,
  xyz,
  bankStance,
} from "../../../shared/wildlife/wildlife.ts";
import { type AnimalMemory, anchorsFor, anchorFor } from "./animal-context.ts";
import { flatDistance, walk } from "./animal-navigation.ts";
import { disturbed, approachPoint } from "./animal-behavior.ts";
type RoutineStage = {
  point: Vec3;
  move: Behavior;
  action: Behavior;
  seconds: number;
  speed: number;
  path?: Pose[];
  rotation?: Pose["rotation"];
};
const routines = new WeakMap<RunState["world"], Map<string, RoutineStage[]>>();
/**
 * Build and cache the resident's authored movement/action cycle, including calibrated
 * perch, climbing, and water paths. Requires validated species anchors and placements.
 *
 * @param run - Run containing the resident blueprint
 * @param a - Animal whose routine is requested
 * @returns Shared routine stages keyed by blueprint and resident identity; do not mutate
 * them.
 */
function routineStages(run: RunState, a: Animal): RoutineStage[] {
  let cache = routines.get(run.world);
  if (!cache) {
    cache = new Map();
    routines.set(run.world, cache);
  }
  const cached = cache.get(a.id);
  if (cached) return cached;
  const resident = run.world.residents.find((r) => r.id === a.id)!;
  const anchors = anchorsFor(run, a);
  const index = Number(a.id.split("-").at(-1));
  /**
   * Find a required routine anchor while excluding approach-start markers.
   *
   * @param kind - Routine anchor kind
   * @returns The authored world point; requires a matching anchor.
   */
  const anchor = (kind: string) =>
    anchors.find((p) => p.kind === kind && !p.id.endsWith("-start"))!.point;
  /**
   * Construct a routine stage with a copied destination.
   *
   * @param point - Destination world point
   * @param move - Behavior during travel
   * @param action - Behavior on arrival
   * @param seconds - Action duration in seconds, default 4
   * @param speed - Travel speed in metres per second, default 1.2
   * @returns A movement/action stage with duration and speed.
   */
  const stage = (
    point: Vec3,
    move: Behavior,
    action: Behavior,
    seconds = 4,
    speed = 1.2,
  ): RoutineStage => ({ point: [...point], move, action, seconds, speed });
  let stages: RoutineStage[] = [];
  if (a.species === "fox" || a.species === "badger") {
    const passage = anchors.filter(
      (p) => p.kind === "passage" && !p.id.endsWith("-start"),
    );
    stages = passage.map((p, i) =>
      stage(
        p.point,
        a.species === "fox" ? "stalk" : "sniff",
        i === 0 ? (a.species === "fox" ? "pounce" : "dig") : "sniff",
        i === 0 ? 3 : 2,
      ),
    );
    stages.push(stage(passage[0].point, "passage", "passage", 4));
    if (a.species === "badger")
      stages.push(stage(anchor("den"), "sniff", "dig", 6));
  } else if (a.species === "rabbit") {
    stages = [
      stage(anchor("feed"), "wander", "nibble", 6),
      stage(anchor("rest"), "bound", "freeze", 3, 1.7),
      stage(anchor("ground"), "bound", "freeze", 2, 1.7),
    ];
  } else if (["otter", "beaver", "mallard"].includes(a.species)) {
    const water = anchor("water"),
      stance = bankStance(run.world, a.id),
      bank = stance.position;
    // Separate small feeding stances allow both members of a calm pair to act
    // together. They stay inside the bound patch and use normal ground walking.
    const pool = run.world.waters.find((w) =>
      water.every((v, i) => v >= w.min[i] && v <= w.max[i]),
    )!;
    // All float paths stay within the real pool; a full body-length shore band
    // keeps bank-overlapping paws/tails above ground before immersion.
    const waterline =
      a.species === "beaver" ? 0.3 : a.species === "otter" ? 0.2 : 0.21;
    const inset = 1.15;
    const entry: Vec3 = [
      Math.max(pool.min[0] + inset, Math.min(pool.max[0] - inset, bank[0])),
      0,
      Math.max(pool.min[2] + inset, Math.min(pool.max[2] - inset, bank[2])),
    ];
    const outside: Vec3 = [...entry];
    const axis =
      Math.abs(bank[0] - entry[0]) > Math.abs(bank[2] - entry[2]) ? 0 : 2;
    const laneAxis = axis === 0 ? 2 : 0;
    const swimmers = run.world.residents.filter(
      (r) =>
        r.home === resident.home &&
        ["otter", "beaver", "mallard"].includes(r.species),
    );
    const lane =
      (swimmers.findIndex((r) => r.id === a.id) - (swimmers.length - 1) / 2) *
      0.65;
    entry[laneAxis] = water[laneAxis] + lane;
    outside[laneAxis] = entry[laneAxis];
    outside[axis] =
      bank[axis] < entry[axis] ? pool.min[axis] - 1.2 : pool.max[axis] + 1.2;
    const floatY = pool.max[1] - 0.0125 - waterline;
    const at: Vec3 = [water[0], floatY, water[2]];
    at[laneAxis] += lane;
    const path = [pose(outside), pose(entry), pose(at)];
    stages = [
      stage(
        bank,
        "wander",
        a.species === "otter"
          ? "groom"
          : a.species === "beaver"
            ? "gnaw"
            : "preen",
        a.species === "beaver" ? 12 : a.species === "otter" ? 7 : 6,
      ),
      stage(outside, "wander", "freeze", 0.2),
      {
        ...stage(at, "swim", a.species === "mallard" ? "dabble" : "surface", 5),
        path,
      },
      { ...stage(outside, "swim", "freeze", 0.2), path: [...path].reverse() },
    ];
    if (a.species === "beaver") stages[0].rotation = stance.rotation;
  } else if (a.species === "squirrel" || a.species === "owl") {
    const arch = run.world.placements.find(
      (p) => p.id === resident.home + "-perch-arch",
    )!;
    /**
     * Transform a calibrated local pose by the resident's root arch placement.
     *
     * @param p - Pose in the arch's local coordinates
     * @returns A new world-space pose.
     */
    const transform = (p: Pose): Pose => ({
      position: rotate(p.position, xyz([0, arch.yaw, 0])).map(
        (v, i) => v + arch.position[i],
      ) as Vec3,
      rotation: multiply(xyz([0, arch.yaw, 0]), p.rotation),
    });
    const stance = transform(
      ARCH_STANCES[a.species === "squirrel" ? (index + 2) % 4 : index],
    );
    if (a.species === "owl") {
      const away = transform({
        position: [ARCH_STANCES[index].position[0], 5.2, 1.6],
        rotation: [0, 0, 0, 1],
      });
      stages = [
        {
          ...stage(stance.position, "fly", "roost", 7),
          rotation: stance.rotation,
        },
        { ...stage(away.position, "fly", "fly", 0.2), path: [stance, away] },
        {
          ...stage(stance.position, "fly", "roost", 7),
          path: [away, stance],
          rotation: stance.rotation,
        },
      ];
    } else {
      const approach = transform(pose([-2.5, 0, 1.0]));
      const climb = SQUIRREL_CLIMB.map(transform);
      climb.push(stance);
      stages = [
        stage(anchor("cache"), "wander", "cache", 5),
        stage(approach.position, "wander", "freeze", 0.2),
        {
          ...stage(stance.position, "climb", "perch", 5, 0.8),
          path: [approach, ...climb],
          rotation: stance.rotation,
        },
        {
          ...stage(approach.position, "descend", "freeze", 0.2, 0.8),
          path: [stance, ...climb.slice(0, -1).reverse(), approach],
        },
      ];
    }
  } else if (a.species === "woodpecker") {
    const snag =
      run.world.placements.find((p) => p.id === resident.home + "-snag") ??
      run.world.placements.find(
        (p) =>
          p.model === "SnagTall" && distance(p.position, resident.spawn) < 8,
      )!;
    const local: Vec3 = [
      0,
      2.5 + index * 0.45,
      [
        0.7388908567413354, 0.7238267356013756, 0.7052572026042866,
        0.6851170750556442,
      ][index],
    ];
    const p = rotate(local, xyz([0, snag.yaw, 0])).map(
      (v, i) => v + snag.position[i],
    ) as Vec3;
    const rotation = xyz([0, snag.yaw + [-0.18, -0.3, -0.42, -0.42][index], 0]);
    const away = rotate(
      [0, local[1] + 1.2, local[2] + 1.4],
      xyz([0, snag.yaw, 0]),
    ).map((v, i) => v + snag.position[i]) as Vec3;
    stages = [
      { ...stage(p, "fly", "tap", 8), rotation },
      { ...stage(away, "fly", "fly", 0.2), path: [pose(away)] },
      {
        ...stage(p, "fly", "tap", 8),
        path: [{ position: p, rotation }],
        rotation,
      },
    ];
  }
  cache.set(a.id, stages);
  return stages;
}

/**
 * Advance one species routine, mutating its goal cursor, pose, behavior, and action timer.
 * Handles disturbance pauses and feeding setups; negative remaining values encode travel
 * progress.
 *
 * @param run - Authoritative run and nearby entities
 * @param a - Animal to update
 * @param m - Persistent routine memory to update
 * @param dt - Elapsed simulation seconds
 * @param extra - Equipment blockers along routine paths
 */
export function wildlifeStep(
  run: RunState,
  a: Animal,
  m: AnimalMemory,
  dt: number,
  extra: Box[],
) {
  const stages = routineStages(run, a);
  if (!stages.length) return;
  if (a.species === "rabbit" || a.species === "mallard") {
    const feed = anchorFor(run, a, "feed"),
      decoy = run.props.find(
        (p) =>
          p.kind === "decoy" &&
          p.open &&
          !p.holders.some(Boolean) &&
          flatDistance(p.pose.position, feed) < 3,
      );
    if (
      decoy &&
      run.tin.open &&
      run.tin.portions > 0 &&
      flatDistance(run.tin.pose.position, feed) < 3 &&
      !run.world.waters.some(
        (w) =>
          a.pose.position[0] > w.min[0] &&
          a.pose.position[0] < w.max[0] &&
          a.pose.position[2] > w.min[2] &&
          a.pose.position[2] < w.max[2],
      ) &&
      !disturbed(run, a, extra)
    ) {
      m.goal = "feeding-setup";
      a.remaining = -1;
      a.behavior = "approach";
      const target = approachPoint(
        run,
        a,
        decoy.pose.position,
        extra,
        1.2,
        decoy.id,
      );
      if (target && walk(run, a, target, 1.1, dt, extra)) a.behavior = "feed";
      return;
    }
  }
  if (!m.goal.startsWith("routine:")) {
    m.goal = a.species === "mallard" ? "routine:3:0" : "routine:0:0";
    a.remaining = -1;
  }
  if (
    a.species === "mallard" &&
    m.goal === "routine:0:0" &&
    a.pose.position[1] > 0.1
  )
    m.goal = "routine:3:0";
  const [, stageText, pointText] = m.goal.split(":");
  const index = Number(stageText) % stages.length,
    s = stages[index];
  let cursor = Number(pointText);
  const noisy = disturbed(run, a, extra);
  if (
    noisy &&
    ["owl", "woodpecker"].includes(a.species) &&
    a.remaining >= 0 &&
    ["roost", "tap"].includes(a.behavior)
  ) {
    m.goal = "routine:1:0";
    a.remaining = -1;
    a.behavior = "fly";
    return;
  }
  if (
    noisy &&
    s.move === "swim" &&
    a.remaining >= 0 &&
    ["surface", "dabble"].includes(a.behavior)
  ) {
    m.goal = "routine:3:0";
    a.remaining = -1;
    a.behavior = "swim";
    return;
  }
  if (noisy && a.pose.position[1] < 0.5 && s.move !== "swim") {
    m.habituatedUntilTick = run.tick + 120;
    a.behavior = a.species === "rabbit" ? "freeze" : "alert";
    return;
  }
  if (run.tick < m.habituatedUntilTick) return;
  if (a.remaining >= 0) {
    a.behavior = s.action;
    a.remaining = Math.max(0, a.remaining - dt);
    if (s.action === "pounce")
      a.pose.position[1] =
        Math.sin(Math.PI * (1 - a.remaining / s.seconds)) * 0.35;
    if (a.remaining <= 1e-6) {
      a.remaining = -1;
      m.goal = `routine:${(index + 1) % stages.length}:0`;
    }
    return;
  }
  a.behavior = s.move;
  if (
    a.species === "squirrel" &&
    s.move === "climb" &&
    a.pose.position[1] < 0.5 &&
    run.animals.some(
      (other) =>
        other.id !== a.id &&
        other.species === "squirrel" &&
        ["climb", "descend", "perch"].includes(other.behavior) &&
        other.pose.position[1] > 0.5,
    )
  ) {
    a.behavior = "freeze";
    return;
  }
  let arrived = false;
  if (s.path || ["fly", "swim"].includes(s.move)) {
    const path = s.path ?? [
      { position: s.point, rotation: s.rotation ?? a.pose.rotation },
    ];
    const next = path[Math.min(cursor, path.length - 1)];
    const length = distance(a.pose.position, next.position),
      fraction = Math.min(1, (s.speed * dt) / Math.max(length, 1e-9));
    const proposed = a.pose.position.map(
      (v, i) => v + (next.position[i] - v) * fraction,
    ) as Vec3;
    // Elevated paths use measured support contacts, pool routes their resolved
    // water bounds. Loose player equipment can still obstruct either path.
    if (rayBlocked(a.pose.position, proposed, extra)) return;
    a.pose.position = proposed;
    if (s.move !== "swim") {
      const same =
        a.pose.rotation.reduce((sum, v, i) => sum + v * next.rotation[i], 0) >=
        0
          ? 1
          : -1;
      const q = a.pose.rotation.map(
        (v, i) => v + (same * next.rotation[i] - v) * fraction,
      );
      const norm = Math.hypot(...q);
      a.pose.rotation = q.map((v) => v / norm) as Pose["rotation"];
    }
    if (s.move === "climb" || s.move === "descend") {
      const previous = path[Math.max(0, cursor - 1)];
      const phase =
        1 -
        distance(proposed, next.position) /
          Math.max(1e-9, distance(previous.position, next.position));
      const progress =
        s.move === "climb"
          ? (cursor - 2 + phase) / 84
          : (86 - cursor - phase) / 84;
      // Negative remaining encodes frozen travel progress; nonnegative values
      // are the action's remaining seconds. No wall-clock pose state is used.
      a.remaining = -1 + 0.99 * Math.max(0, Math.min(1, progress));
    }
    if (length > 0.001 && s.move === "swim") {
      const yaw = Math.atan2(
        proposed[0] - next.position[0],
        proposed[2] - next.position[2],
      );
      a.pose.rotation = xyz([0, yaw, 0]);
    }
    if (fraction === 1) {
      cursor++;
      m.goal = `routine:${index}:${cursor}`;
    }
    arrived = cursor >= path.length;
  } else {
    arrived = walk(run, a, s.point, s.speed, dt, extra);
    if (s.move === "bound" && !arrived)
      a.pose.position[1] = Math.abs(Math.sin((run.tick / 60) * 7)) * 0.16;
  }
  a.target = [...s.point];
  if (arrived) {
    if (s.rotation) a.pose.rotation = [...s.rotation];
    a.behavior = s.action;
    a.remaining = s.seconds;
    m.interestPoint = [...a.pose.position];
  }
}
