/** Collision-aware animal paths, walking, and local recovery; caches remain keyed by world/run identity. */
import type { RunState } from "../game.ts";
import {
  PROP_DEFINITIONS,
  fixtureBoxes,
  fixtureSurfaces,
} from "../../../shared/world/level.ts";
import {
  distance,
  propBoxes,
  surfaceHeight,
  type Animal,
  type Box,
  type Vec3,
  type Walkable,
} from "../../../shared/shared.ts";
type Navigation = Pick<RunState, "world" | "route">;
/**
 * Measure separation in the horizontal X/Z plane, ignoring elevation.
 *
 * @param a - First world position
 * @param b - Second world position
 * @returns Horizontal distance in metres.
 */
export const flatDistance = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[2] - b[2]);
const geometryCache = new WeakMap<
  Navigation["world"],
  Map<
    string,
    { walls: Box[]; surfaces: Walkable[]; routes: Map<string, Vec3[]> }
  >
>();
/**
 * Cache combined static and fixture geometry by blueprint identity and serialized route
 * state.
 *
 * @param run - World and current fixture state
 * @returns Shared walls, walkable surfaces, and a route cache for that fixture
 * configuration.
 */
export function geometry(run: Navigation) {
  let cache = geometryCache.get(run.world);
  if (!cache) {
    cache = new Map();
    geometryCache.set(run.world, cache);
  }
  const key = JSON.stringify(run.route);
  let value = cache.get(key);
  if (!value) {
    value = {
      routes: new Map(),
      walls: [
        ...run.world.walls,
        ...fixtureBoxes(run.world.fixtures, run.route),
      ],
      surfaces: [
        ...run.world.walkables,
        ...fixtureSurfaces(run.world.fixtures, run.route),
      ],
    };
    cache.set(key, value);
  }
  return value;
}
/**
 * Project a point onto the highest supporting surface at its X/Z coordinates.
 *
 * @param point - World point to project
 * @param run - World and current fixture state
 * @param surfaces - Candidate surfaces, defaults to current combined geometry
 * @returns A new grounded point, or null when no surface covers it.
 */
export const ground = (
  point: Vec3,
  run: Navigation,
  surfaces = geometry(run).surfaces,
): Vec3 | null => {
  let height = -Infinity;
  for (const surface of surfaces) {
    const y = surfaceHeight(surface, point[0], point[2]);
    if (y !== null) height = Math.max(height, y);
  }
  return height === -Infinity ? null : [point[0], height, point[2]];
};
// ponytail: a 30cm animal radius and authored graph suit these three actors; use species hulls if larger wildlife is added.
const radius = 0.3;
/**
 * Sample a grounded segment every five centimetres using the animal clearance radius and a
 * 30 cm step limit.
 *
 * @param from - Segment start
 * @param to - Segment end
 * @param run - World and current fixture state
 * @param extra - Additional blockers, normally loose equipment
 * @returns Whether the entire segment is supported and unobstructed.
 */
export function clear(
  from: Vec3,
  to: Vec3,
  run: Navigation,
  extra: Box[] = [],
) {
  const current = geometry(run),
    minX = Math.min(from[0], to[0]),
    maxX = Math.max(from[0], to[0]),
    minZ = Math.min(from[2], to[2]),
    maxZ = Math.max(from[2], to[2]);
  const surfaces = current.surfaces.filter(
    (s) =>
      s.max[0] >= minX &&
      s.min[0] <= maxX &&
      s.max[2] >= minZ &&
      s.min[2] <= maxZ,
  );
  const walls = [...current.walls, ...extra].filter(
    (b) =>
      b.max[0] + radius >= Math.min(from[0], to[0]) &&
      b.min[0] - radius <= Math.max(from[0], to[0]) &&
      b.max[2] + radius >= Math.min(from[2], to[2]) &&
      b.min[2] - radius <= Math.max(from[2], to[2]),
  );
  const count = Math.max(1, Math.ceil(flatDistance(from, to) / 0.05));
  let previous = ground(from, run, surfaces);
  if (!previous) return false;
  for (let i = 0; i <= count; i++) {
    const point = ground(
      from.map((n, axis) => n + ((to[axis] - n) * i) / count) as Vec3,
      run,
      surfaces,
    );
    if (
      !point ||
      Math.abs(point[1] - previous[1]) > 0.3 ||
      walls.some(
        (b) =>
          b.max[1] > point[1] + 0.16 &&
          b.min[1] < point[1] + 1.7 &&
          point[0] > b.min[0] - radius &&
          point[0] < b.max[0] + radius &&
          point[2] > b.min[2] - radius &&
          point[2] < b.max[2] + radius,
      )
    )
      return false;
    previous = point;
  }
  return true;
}
const graphCache = new WeakMap<
  Navigation["world"],
  Map<string, Map<string, string[]>>
>();
/**
 * Cache the authored navigation links that remain traversable in the current fixture state.
 *
 * @param run - World and current fixture state
 * @returns Shared adjacency map keyed by navigation node ID.
 */
function graph(run: Navigation) {
  const key = JSON.stringify(run.route),
    cache =
      graphCache.get(run.world) ?? new Map<string, Map<string, string[]>>();
  graphCache.set(run.world, cache);
  let value = cache.get(key);
  if (!value) {
    value = new Map(
      run.world.navNodes.map((n) => [
        n.id,
        n.links.filter((id) => {
          const next = run.world.navNodes.find((n) => n.id === id);
          return next && clear(n.position, next.position, run);
        }),
      ]),
    );
    cache.set(key, value);
  }
  return value;
}
/**
 * Find a grounded route using direct travel or shortest paths over authored nodes. Cached
 * results are copied before reuse.
 *
 * @param from - Starting world point
 * @param target - Destination world point
 * @param run - World and current fixture state
 * @param extra - Additional blockers, included in the route cache key
 * @returns Waypoints excluding the start, or an empty array if either endpoint or the route
 * is blocked.
 */
export function routeTo(
  from: Vec3,
  target: Vec3,
  run: Navigation,
  extra: Box[] = [],
): Vec3[] {
  if (!clear(from, from, run, extra) || !clear(target, target, run, extra))
    return [];
  if (clear(from, target, run, extra)) return [ground(target, run)!];
  const cache = geometry(run).routes,
    query = JSON.stringify([from, target, extra]),
    cached = cache.get(query);
  if (cached) return cached.map((p) => [...p]);
  /**
   * Store a defensive copy of this query's path, evicting the oldest entry at the 256-entry
   * limit.
   *
   * @param points - Computed waypoints, including an empty failed route
   * @returns The original waypoint array supplied by the caller.
   */
  const remember = (points: Vec3[]) => {
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(
      query,
      points.map((p) => [...p]),
    );
    return points;
  };
  const nodes = run.world.navNodes,
    links = graph(run),
    costs = new Map<string, number>(),
    previous = new Map<string, string | null>(),
    visited = new Set<string>();
  for (const n of nodes)
    if (clear(from, n.position, run, extra)) {
      costs.set(n.id, distance(from, n.position));
      previous.set(n.id, null);
    }
  let end: string | undefined,
    best = Infinity;
  while (visited.size < nodes.length) {
    const at = nodes
      .filter((n) => !visited.has(n.id) && costs.has(n.id))
      .sort((a, b) => costs.get(a.id)! - costs.get(b.id)!)[0];
    if (!at || costs.get(at.id)! >= best) break;
    visited.add(at.id);
    if (clear(at.position, target, run, extra)) {
      best = costs.get(at.id)! + distance(at.position, target);
      end = at.id;
    }
    for (const id of links.get(at.id) ?? []) {
      const next = nodes.find((n) => n.id === id)!;
      if (
        visited.has(id) ||
        (extra.length && !clear(at.position, next.position, run, extra))
      )
        continue;
      const cost = costs.get(at.id)! + distance(at.position, next.position);
      if (cost < (costs.get(id) ?? Infinity)) {
        costs.set(id, cost);
        previous.set(id, at.id);
      }
    }
  }
  if (!end) return remember([]);
  const result = [ground(target, run)!];
  for (let id: string | null = end; id; id = previous.get(id) ?? null)
    result.unshift(ground(nodes.find((n) => n.id === id)!.position, run)!);
  return remember(result);
}
/**
 * Resolve a navigation node and route to its position.
 *
 * @param from - Starting world point
 * @param toNode - Destination navigation node ID
 * @param run - World and current fixture state
 * @returns Grounded waypoints, or an empty array for an unknown or unreachable node.
 */
export function animalRoute(
  from: Vec3,
  toNode: string,
  run: Navigation,
): Vec3[] {
  const target = run.world.navNodes.find((n) => n.id === toNode);
  return target ? routeTo(from, target.position, run) : [];
}
export const paths = new WeakMap<
  Animal,
  { target: Vec3; route: string; points: Vec3[] }
>();
/**
 * Advance an animal along its cached route, updating pose and target. Invalidates blocked
 * routes and tries a short lateral yield when another resident obstructs movement.
 *
 * @param run - Authoritative run to update
 * @param a - Animal to move in place
 * @param target - Destination world point
 * @param speed - Travel speed in metres per second
 * @param dt - Elapsed simulation seconds
 * @param extra - Additional equipment blockers
 * @returns Whether the animal is within 20 cm of the destination after moving.
 */
export function walk(
  run: RunState,
  a: Animal,
  target: Vec3,
  speed: number,
  dt: number,
  extra: Box[],
) {
  a.target = [...target];
  const key = `${run.world.id}:${JSON.stringify(run.route)}`;
  let path = paths.get(a);
  if (
    !path ||
    flatDistance(path.target, target) > 0.4 ||
    path.route !== key ||
    !path.points.length
  ) {
    path = {
      target: [...target],
      route: key,
      points: routeTo(a.pose.position, target, run, extra),
    };
    paths.set(a, path);
  }
  const next = path.points[0];
  if (!next) return false;
  const length = flatDistance(a.pose.position, next),
    amount = Math.min(length, speed * dt),
    point = ground(
      [
        a.pose.position[0] +
          (next[0] - a.pose.position[0]) * (length ? amount / length : 0),
        0,
        a.pose.position[2] +
          (next[2] - a.pose.position[2]) * (length ? amount / length : 0),
      ],
      run,
    );
  if (!point || !clear(a.pose.position, point, run, extra)) {
    paths.delete(a);
    return false;
  }
  /**
   * Check whether a proposed step would move closer to an overlapping resident at similar
   * elevation.
   *
   * @param p - Proposed grounded animal position
   * @returns Whether another resident prevents this step.
   */
  const occupied = (p: Vec3) =>
    run.animals.some(
      (other) =>
        other.id !== a.id &&
        Math.abs(other.pose.position[1] - p[1]) < 0.6 &&
        flatDistance(p, other.pose.position) < 0.55 &&
        flatDistance(p, other.pose.position) <
          flatDistance(a.pose.position, other.pose.position) - 1e-6,
    );
  if (occupied(point)) {
    // A short ordinary lateral step lets a waiting resident yield at a shared
    // approach. No body is moved after the fact, and the action target stays bound.
    const dx = point[0] - a.pose.position[0],
      dz = point[2] - a.pose.position[2];
    for (const side of [1, -1]) {
      const candidate = ground(
        [a.pose.position[0] + dz * side, 0, a.pose.position[2] - dx * side],
        run,
      );
      if (
        candidate &&
        !occupied(candidate) &&
        clear(a.pose.position, candidate, run, extra)
      ) {
        a.pose.position = candidate;
        return false;
      }
    }
    return false;
  }
  if (length > 0.001) {
    const yaw = Math.atan2(
      a.pose.position[0] - next[0],
      a.pose.position[2] - next[2],
    );
    a.pose.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  }
  a.pose.position = point;
  if (length <= amount + 0.02) path.points.shift();
  return flatDistance(point, target) <= 0.2;
}
/**
 * Search concentric rings up to three metres away for supported, unobstructed ground
 * connected to an authored navigation node.
 *
 * @param run - Run supplying fixture and equipment geometry
 * @param origin - Incident position around which to search
 * @returns First suitable recovery point, or null when the local search fails.
 */
export function localRecoveryPoint(run: RunState, origin: Vec3): Vec3 | null {
  const extra = run.props
    .filter((p) => !p.placed)
    .flatMap((p) => propBoxes(p, PROP_DEFINITIONS[p.kind]));
  for (const radius of [0, 0.75, 1.5, 2.25, 3])
    for (let i = 0; i < (radius ? 8 : 1); i++) {
      const point = ground(
        [
          origin[0] + Math.cos((i * Math.PI) / 4) * radius,
          origin[1],
          origin[2] + Math.sin((i * Math.PI) / 4) * radius,
        ],
        run,
      );
      if (
        point &&
        Math.abs(point[1] - origin[1]) < 4 &&
        clear(point, point, run, extra) &&
        run.world.navNodes.some((n) => clear(point, n.position, run, extra))
      )
        return point;
    }
  return null;
}
