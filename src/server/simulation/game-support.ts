/** Shared run operations: safe spawn, carried tin pose, release, and recoverable incidents. */
import {
  TIN_HALF,
  fixtureBoxes,
  fixtureSurfaces,
} from "../../shared/world/level.ts";
import {
  eye,
  forward,
  pose,
  rayBlocked,
  surfaceHeight,
  propPoint,
  type FieldProp,
  type Player,
  type Vec3,
} from "../../shared/shared.ts";
import { localRecoveryPoint } from "./wildlife/encounters.ts";
import { type RunState, nearby, flat, observe, event } from "./game-state.ts";
import { rotate } from "../../shared/wildlife/wildlife.ts";
/**
 * Consume one spare bait portion and create a reachable spill when an open case passes the
 * incident limits and cooldown. Leaves state alone when no recovery ground is available.
 *
 * @param run - Authoritative run and incident history to update
 * @param prop - Equipment that was bumped or turned
 */
export function spillCase(run: RunState, prop: FieldProp) {
  if (
    prop.kind !== "case" ||
    !prop.open ||
    !run.spareBait ||
    run.spills.length >= 8 ||
    run.tick < prop.spillUntilTick
  )
    return;
  const point = localRecoveryPoint(run, prop.pose.position);
  if (!point) return;
  prop.spillUntilTick = run.tick + 120;
  run.spareBait--;
  run.spills.push({
    id: `spill-${run.tick}`,
    position: point,
    portions: 1,
    untilTick: run.tick + 3600,
  });
  observe(
    run,
    "The open case spilled one bait portion after a bump or sharp turn. Set equipment down, then E retrieves the pile before wildlife eats it.",
  );
}
/**
 * Synchronize hats with owners or raccoons and resolve expired thefts onto reachable
 * ground, falling back to the owner. Also clears theft on disconnection.
 *
 * @param run - Authoritative run containing hats and carriers
 */
export function updateHats(run: RunState) {
  for (const hat of run.hats) {
    const owner = run.players.find((p) => p.id === hat.owner),
      r = run.animals.find((a) => `animal:${a.id}` === hat.carrier);
    if (!owner) continue; // Invalid removed owners are rejected by persistence.
    if (!owner.connected || (hat.carrier.startsWith("animal:") && !r)) {
      hat.carrier = "owner";
      hat.untilTick = 0;
    }
    if (hat.carrier.startsWith("animal:") && r) {
      if (run.tick >= hat.untilTick) {
        const point = localRecoveryPoint(run, r.pose.position);
        hat.carrier = point ? "ground" : "owner";
        hat.untilTick = 0;
        if (point) hat.position = point;
        observe(
          run,
          "The raccoon dropped the borrowed hat on reachable ground. Anyone nearby can return it with E.",
        );
      } else {
        hat.position = propPoint([0, 0.45, -0.26], r.pose);
        hat.position[1] += 0.23;
      }
    }
    if (hat.carrier === "owner")
      hat.position = [
        owner.position[0],
        owner.position[1] + 1.8,
        owner.position[2],
      ];
  }
}
/**
 * Clear every player's held input at the current tick to prevent stale movement after a
 * pause or disconnect.
 *
 * @param run - Authoritative run to update
 */
export function neutralize(run: RunState) {
  for (const p of run.players) {
    p.lastInput = null;
    p.inputTick = run.tick;
  }
}
/**
 * Check horizontal world bounds, surface coverage, and standing-player clearance. Surface
 * coverage does not by itself snap the point's height.
 *
 * @param run - Run supplying terrain and route state
 * @param point - Candidate foot position
 * @param walls - Blocking boxes, defaults to static and current fixture boxes
 * @returns Whether the candidate passes these spawn/placement checks.
 */
export function safe(
  run: RunState,
  point: Vec3,
  walls = [...run.world.walls, ...fixtureBoxes(run.world.fixtures, run.route)],
) {
  return (
    [
      ...run.world.walkables,
      ...fixtureSurfaces(run.world.fixtures, run.route),
    ].some((surface) => surfaceHeight(surface, point[0], point[2]) !== null) &&
    point[0] > run.world.bounds.min[0] &&
    point[0] < run.world.bounds.max[0] &&
    point[2] > run.world.bounds.min[2] &&
    point[2] < run.world.bounds.max[2] &&
    !walls.some(
      (b) =>
        b.max[1] > point[1] + 0.15 &&
        b.min[1] < point[1] + 1.8 &&
        point[0] > b.min[0] - 0.45 &&
        point[0] < b.max[0] + 0.45 &&
        point[2] > b.min[2] - 0.45 &&
        point[2] < b.max[2] + 0.45,
    )
  );
}
/**
 * Search around connected crew, or camp, for a supported clear spawn with crew separation.
 *
 * @param run - Run supplying crew and terrain
 * @param id - Joining player ID, excluded from separation checks
 * @returns A new spawn vector, falling back to a copy of camp if the search fails.
 */
export function safeSpawn(run: RunState, id: string): Vec3 {
  const crew = run.players.filter((p) => p.connected && p.id !== id),
    anchor = crew[0]?.position ?? run.world.camp;
  for (const radius of [1.5, 3, 5])
    for (let i = 0; i < 8; i++) {
      const point: Vec3 = [
        anchor[0] + Math.cos((i * Math.PI) / 4) * radius,
        0,
        anchor[2] + Math.sin((i * Math.PI) / 4) * radius,
      ];
      const heights = [
        ...run.world.walkables,
        ...fixtureSurfaces(run.world.fixtures, run.route),
      ]
        .map((s) => surfaceHeight(s, point[0], point[2]))
        .filter((h): h is number => h !== null && h <= anchor[1] + 0.45);
      if (!heights.length) continue;
      point[1] = Math.max(...heights);
      if (
        safe(run, point, [
          ...run.world.walls,
          ...fixtureBoxes(run.world.fixtures, run.route),
        ]) &&
        crew.every((p) => !nearby(p.position, point, 0.8))
      )
        return point;
    }
  return [...run.world.camp];
}

/**
 * Update the tin's pose to follow its player or animal holder and zero its velocities. An
 * unheld tin is unchanged.
 *
 * @param run - Authoritative run whose tin is updated
 */
export function heldPose(run: RunState) {
  const holder = run.tin.holder;
  if (!holder) return;
  if (holder.startsWith("animal:")) {
    const r = run.animals.find((a) => a.id === run.tin.holder?.slice(7))!,
      f = rotate([0, 0.2 + TIN_HALF[1], -0.61], r.pose.rotation);
    run.tin.pose = {
      position: r.pose.position.map((n, i) => n + f[i]) as Vec3,
      rotation: [...r.pose.rotation],
    };
  } else {
    const p = run.players.find((p) => p.id === holder);
    if (!p) return;
    const f = forward(p.yaw);
    run.tin.pose = {
      position: [
        p.position[0] + f[0] * 0.8,
        p.position[1] + 1,
        p.position[2] + f[2] * 0.8,
      ],
      rotation: [0, Math.sin(p.yaw / 2), 0, Math.cos(p.yaw / 2)],
    };
  }
  run.tin.velocity = [0, 0, 0];
  run.tin.angularVelocity = [0, 0, 0];
}
/**
 * Place the tin on clear ground ahead of the player or drop it from its held pose. Opens
 * the tin, increments its revision, and records a placement event.
 *
 * @param run - Authoritative run to update
 * @param p - Player releasing the tin
 * @param drop - Drop at the held position when true, otherwise validate a ground placement
 * @throws {Error} Ground placement is blocked or lacks safe support.
 */
export function release(run: RunState, p: Player, drop: boolean) {
  heldPose(run);
  const f = forward(p.yaw),
    target: Vec3 = [
      p.position[0] + f[0] * 1.1,
      TIN_HALF[1],
      p.position[2] + f[2] * 1.1,
    ];
  const support = [
    ...run.world.walkables,
    ...fixtureSurfaces(run.world.fixtures, run.route),
  ]
    .map((s) => surfaceHeight(s, target[0], target[2]))
    .filter((y): y is number => y !== null);
  if (support.length) target[1] = Math.max(...support) + TIN_HALF[1];
  if (
    !drop &&
    (!safe(run, [target[0], target[1] - TIN_HALF[1], target[2]]) ||
      rayBlocked(eye(p), target, [
        ...run.world.walls,
        ...fixtureBoxes(run.world.fixtures, run.route),
      ]))
  )
    throw Error("Placement blocked; face clear ground");
  run.tin.holder = null;
  run.tin.pose = pose(drop ? [...run.tin.pose.position] : target);
  run.tin.velocity = [0, 0, 0];
  run.tin.angularVelocity = drop ? [0, 0.8, 0.5] : [0, 0, 0];
  run.tin.open = true;
  run.tinRevision++;
  event(run, "place", p, run.tin.pose.position);
}
/**
 * Detect an invalid, out-of-height-range, or horizontally unsafe tin position.
 *
 * @param run - Run containing the tin and current geometry
 * @returns Whether the tin qualifies for recovery.
 */
export function recoverable(run: RunState) {
  const p = run.tin.pose.position;
  return (
    p.some((n) => !Number.isFinite(n)) ||
    p[1] < -0.5 ||
    p[1] > 5 ||
    !safe(run, flat(p))
  );
}
