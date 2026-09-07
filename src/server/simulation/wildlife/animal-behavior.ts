/** Shared wildlife goals, disturbance checks, and lure approaches. */
import type { RunState } from "../game.ts";
import {
  PROP_DEFINITIONS,
  RULES,
  fixtureBoxes,
} from "../../../shared/world/level.ts";
import {
  propRayBlocked,
  rayBlocked,
  type Animal,
  type Box,
  type Vec3,
} from "../../../shared/shared.ts";
import { type AnimalMemory } from "./animal-context.ts";
import { flatDistance, geometry, routeTo } from "./animal-navigation.ts";
/**
 * Append a previously unseen observation and retain only the last 40 entries.
 *
 * @param run - Authoritative run to update
 * @param text - Notebook text to retain
 */
export function observe(run: RunState, text: string) {
  if (!run.observations.includes(text)) run.observations.push(text);
  run.observations = run.observations.slice(-40);
}
/**
 * Change the animal's goal and retain up to four previous nonempty goals. Repeating the
 * current goal does nothing.
 *
 * @param memory - Animal memory to update
 * @param name - Next goal identifier
 */
export function goal(memory: AnimalMemory, name: string) {
  if (name === memory.goal) return;
  memory.recentGoals = [...memory.recentGoals, memory.goal]
    .filter(Boolean)
    .slice(-4);
  memory.goal = name;
}
/**
 * Select a reachable goal deterministically, avoiding the current goal when alternatives
 * exist. Updates memory and the animal target; leaves both alone if no candidate is
 * reachable.
 *
 * @param run - Run supplying seed and navigation
 * @param a - Animal whose target changes
 * @param memory - Goal history to update
 * @param candidates - Authored goal identifiers and world points
 * @param extra - Additional equipment blockers
 */
export function choose(
  run: RunState,
  a: Animal,
  memory: AnimalMemory,
  candidates: { id: string; point: Vec3 }[],
  extra: Box[],
) {
  const valid = candidates.filter(
    (c) => routeTo(a.pose.position, c.point, run, extra).length,
  );
  const options =
    valid.length > 1 ? valid.filter((c) => c.id !== memory.goal) : valid;
  const value =
    options[
      ((run.world.seed >>> 6) + memory.recentGoals.length + a.id.length) %
        options.length
    ];
  if (value) {
    goal(memory, value.id);
    a.target = [...value.point];
  }
}
/**
 * Check recent nearby noise, visible crew, and the heron's proximity to raccoons.
 *
 * @param run - Run containing recent events and crew
 * @param a - Animal being assessed
 * @param extra - Reserved blocker argument, currently unused
 * @returns Whether a disturbance currently applies.
 */
export function disturbed(run: RunState, a: Animal, extra: Box[]) {
  const point: Vec3 = [
      a.pose.position[0],
      a.pose.position[1] + 1,
      a.pose.position[2],
    ],
    boxes = [
      ...run.world.walls,
      ...fixtureBoxes(run.world.fixtures, run.route),
    ];
  return (
    run.events.some(
      (e) =>
        ["noise", "impact"].includes(e.kind) &&
        e.tick >= run.tick - 30 &&
        flatDistance(e.point, point) < RULES.noiseRadius,
    ) ||
    run.players.some(
      (p) =>
        p.connected &&
        flatDistance(p.position, point) < (p.lastInput?.crouch ? 2 : 4) &&
        !rayBlocked(
          point,
          [p.position[0], p.position[1] + 0.7, p.position[2]],
          boxes,
        ) &&
        !propRayBlocked(
          point,
          [p.position[0], p.position[1] + 0.7, p.position[2]],
          run.props,
          PROP_DEFINITIONS,
        ),
    ) ||
    (a.species === "heron" &&
      run.animals.some(
        (other) =>
          other.species === "raccoon" &&
          flatDistance(other.pose.position, a.pose.position) < RULES.shyRadius,
      ))
  );
}
/**
 * Try four grounded approaches around a visible lure, checking navigation and equipment
 * occlusion.
 *
 * @param run - Run supplying geometry and props
 * @param a - Approaching animal
 * @param point - Lure position in world coordinates
 * @param extra - Additional navigation blockers
 * @param separation - Stand-off distance in metres, default 0.85
 * @param ignoredProp - Prop identifier excluded from lure occlusion
 * @returns First reachable approach, or null when the lure or all approaches are blocked.
 */
export function approachPoint(
  run: RunState,
  a: Animal,
  point: Vec3,
  extra: Box[],
  separation = 0.85,
  ignoredProp?: string,
): Vec3 | null {
  const eyes: Vec3 = [
      a.pose.position[0],
      a.pose.position[1] + 0.5,
      a.pose.position[2],
    ],
    lure: Vec3 = [point[0], Math.max(0.5, point[1]), point[2]];
  if (
    rayBlocked(eyes, lure, geometry(run).walls) ||
    propRayBlocked(
      eyes,
      lure,
      run.props.filter((p) => p.id !== ignoredProp),
      PROP_DEFINITIONS,
    )
  )
    return null;
  const angle = Math.atan2(
    a.pose.position[2] - point[2],
    a.pose.position[0] - point[0],
  );
  for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const candidate: Vec3 = [
      point[0] + Math.cos(angle + turn) * separation,
      0,
      point[2] + Math.sin(angle + turn) * separation,
    ];
    if (
      !rayBlocked(
        [candidate[0], 0.5, candidate[2]],
        [point[0], Math.max(0.5, point[1]), point[2]],
        [...run.world.walls, ...fixtureBoxes(run.world.fixtures, run.route)],
      ) &&
      !propRayBlocked(
        [candidate[0], 0.5, candidate[2]],
        [point[0], Math.max(0.5, point[1]), point[2]],
        run.props.filter((p) => p.id !== ignoredProp),
        PROP_DEFINITIONS,
      ) &&
      routeTo(a.pose.position, candidate, run, extra).length
    )
      return candidate;
  }
  return null;
}
