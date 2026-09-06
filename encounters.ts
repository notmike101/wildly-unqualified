import type { RunState } from "./game.ts";
import {
  PROP_DEFINITIONS,
  RULES,
  fixtureBoxes,
  fixtureSurfaces,
  TIN_HALF,
} from "./level.ts";
import {
  distance,
  pose,
  propBoxes,
  propRayBlocked,
  rayBlocked,
  surfaceHeight,
  type Animal,
  type Box,
  type Vec3,
} from "./shared.ts";

export type AnimalMemory = {
  goal: string;
  recentGoals: string[];
  interestPoint: Vec3 | null;
  interestUntilTick: number;
  habituatedUntilTick: number;
  hatTarget: string | null;
};
type Navigation = Pick<RunState, "world" | "route">;
const anchorsFor = (run: RunState, a: Animal) => {
  const resident = run.world.residents.find(r => r.id === a.id)!;
  return run.world.pockets.find(p => p.id === resident.home)!.anchors.filter(anchor => resident.anchors.includes(anchor.id));
};
const homeFor = (run: RunState, a: Animal): Vec3 => anchorsFor(run, a).find(anchor => anchor.kind === "ground")?.point ?? run.world.residents.find(r => r.id === a.id)!.spawn;
const anchorFor = (run: RunState, a: Animal, kind: string): Vec3 => anchorsFor(run, a).find(anchor => anchor.kind === kind)?.point ?? homeFor(run, a);
const flatDistance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const ground = (point: Vec3, run: Navigation): Vec3 | null => {
  const heights = [...run.world.walkables, ...fixtureSurfaces(run.world.fixtures, run.route)]
    .map((s) => surfaceHeight(s, point[0], point[2]))
    .filter((h): h is number => h !== null);
  return heights.length ? [point[0], Math.max(...heights), point[2]] : null;
};
// ponytail: a 30cm animal radius and authored graph suit these three actors; use species hulls if larger wildlife is added.
const radius = 0.3;
function clear(from: Vec3, to: Vec3, run: Navigation, extra: Box[] = []) {
  const walls = [...run.world.walls, ...fixtureBoxes(run.world.fixtures, run.route), ...extra].filter(
    (b) =>
      b.max[0] + radius >= Math.min(from[0], to[0]) &&
      b.min[0] - radius <= Math.max(from[0], to[0]) &&
      b.max[2] + radius >= Math.min(from[2], to[2]) &&
      b.min[2] - radius <= Math.max(from[2], to[2]),
  );
  const count = Math.max(1, Math.ceil(flatDistance(from, to) / 0.15));
  let previous = ground(from, run);
  if (!previous) return false;
  for (let i = 0; i <= count; i++) {
    const point = ground(
      from.map((n, axis) => n + ((to[axis] - n) * i) / count) as Vec3,
      run,
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
const graphCache = new WeakMap<Navigation["world"], Map<string, Map<string, string[]>>>();
function graph(run: Navigation) {
  const key = JSON.stringify(run.route), cache = graphCache.get(run.world) ?? new Map<string, Map<string, string[]>>();
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
function routeTo(
  from: Vec3,
  target: Vec3,
  run: Navigation,
  extra: Box[] = [],
): Vec3[] {
  if (clear(from, target, run, extra)) return [ground(target, run)!];
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
  if (!end) return [];
  const result = [ground(target, run)!];
  for (let id: string | null = end; id; id = previous.get(id) ?? null)
    result.unshift(ground(nodes.find((n) => n.id === id)!.position, run)!);
  return result;
}
export function animalRoute(
  from: Vec3,
  toNode: string,
  run: Navigation,
): Vec3[] {
  const target = run.world.navNodes.find((n) => n.id === toNode);
  return target ? routeTo(from, target.position, run) : [];
}
const paths = new WeakMap<
  Animal,
  { target: Vec3; route: string; points: Vec3[] }
>();
function walk(
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
function observe(run: RunState, text: string) {
  if (!run.observations.includes(text)) run.observations.push(text);
  run.observations = run.observations.slice(-40);
}
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
function goal(memory: AnimalMemory, name: string) {
  if (name === memory.goal) return;
  memory.recentGoals = [...memory.recentGoals, memory.goal]
    .filter(Boolean)
    .slice(-4);
  memory.goal = name;
}
function choose(
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
function disturbed(run: RunState, a: Animal, extra: Box[]) {
  const point: Vec3 = [
      a.pose.position[0],
      a.pose.position[1] + 1,
      a.pose.position[2],
    ],
    boxes = [...run.world.walls, ...fixtureBoxes(run.world.fixtures, run.route)];
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
function approachPoint(
  run: RunState,
  a: Animal,
  point: Vec3,
  extra: Box[],
  separation = 0.85,
  ignoredProp?: string,
): Vec3 | null {
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
      routeTo(a.pose.position, candidate, run, extra).length &&
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
      )
    )
      return candidate;
  }
  return null;
}
function raccoonStep(
  run: RunState,
  a: Animal,
  m: AnimalMemory,
  dt: number,
  extra: Box[],
) {
  const home = homeFor(run, a), wash = anchorFor(run, a, "wash"), stash = anchorFor(run, a, "rest");
  if (run.tin.holder === `animal:${a.id}`) {
    m.hatTarget = null;
    const whistle = [...run.events]
      .reverse()
      .find(
        (e) =>
          e.kind === "whistle" &&
          run.tick - e.tick < 240 &&
          flatDistance(e.point, a.pose.position) < RULES.lureRadius &&
          !m.recentGoals.includes(`whistle-${e.tick}`) &&
          m.goal !== `whistle-${e.tick}`,
      );
    if (a.behavior !== "investigate" && whistle) {
      const point = approachPoint(run, a, whistle.point, extra);
      if (point) {
        goal(m, `whistle-${whistle.tick}`);
        m.interestUntilTick = run.tick + 120;
        a.target = point;
        a.behavior = "investigate";
      }
    }
    if (a.behavior === "investigate") {
      if (run.tick < m.interestUntilTick) {
        walk(run, a, a.target, 2, dt, extra);
        return;
      }
      goal(m, "carry-stash");
      a.target = [...stash];
    }
    a.behavior = "carry";
    if (walk(run, a, a.target, 1.9, dt, extra)) {
      run.tin.holder = null;
      run.tin.pose = pose([
        a.pose.position[0],
        a.pose.position[1] + TIN_HALF[1],
        a.pose.position[2],
      ]);
      run.tinRevision++;
      a.behavior = "wander";
      a.remaining = 1;
      m.habituatedUntilTick = run.tick + 480;
      observe(
        run,
        "The raccoon left the same tin at a reachable stash. Reclaim it close by.",
      );
    }
    return;
  }
  const decoy = run.props.find(
      (p) => p.kind === "decoy" && p.open && !p.holders.some(Boolean),
    ),
    noise = [...run.events]
      .reverse()
      .find(
        (e) =>
          ["rattle", "whistle", "place"].includes(e.kind) &&
          run.tick - e.tick < 240 &&
          flatDistance(e.point, a.pose.position) < RULES.lureRadius,
      ),
    spill = run.spills.find(
      (s) =>
        s.portions > 0 &&
        s.untilTick > run.tick &&
        flatDistance(s.position, a.pose.position) < RULES.lureRadius,
    );
  const candidates: { id: string; point: Vec3; food: boolean }[] = [];
  if (
    run.tin.open &&
    flatDistance(run.tin.pose.position, a.pose.position) < RULES.lureRadius
  )
    candidates.push({
      id: "tin",
      point: run.tin.pose.position,
      food: run.tin.portions > 0,
    });
  if (spill)
    candidates.push({ id: spill.id, point: spill.position, food: true });
  if (
    decoy &&
    flatDistance(decoy.pose.position, a.pose.position) < RULES.lureRadius
  )
    candidates.push({ id: decoy.id, point: decoy.pose.position, food: true });
  if (noise)
    candidates.push({
      id: `${noise.kind}-${noise.tick}`,
      point: noise.point,
      food: false,
    });
  const lure = candidates.find((c) =>
    approachPoint(run, a, c.point, extra, 0.85, c.id),
  );
  const hatOwner = (id: string) =>
    run.players.find(
      (p) =>
        p.id === id &&
        p.connected &&
        distance(p.position, a.pose.position) <= 1.2 &&
        clear(a.pose.position, p.position, run, extra) &&
        run.hats.some(
          (h) =>
            h.owner === id &&
            h.carrier === "owner" &&
            h.protectedUntilTick <= run.tick,
        ),
    );
  if (a.behavior === "hat-reach") {
    const owner = m.hatTarget ? hatOwner(m.hatTarget) : undefined;
    if (!owner || run.hats.some((h) => h.carrier.startsWith("animal:"))) {
      m.hatTarget = null;
      a.behavior = "wander";
      a.remaining = 0;
    } else {
      a.target = [...owner.position];
      const yaw = Math.atan2(
        a.pose.position[0] - owner.position[0],
        a.pose.position[2] - owner.position[2],
      );
      a.pose.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
      a.remaining = Math.max(0, a.remaining - dt);
      if (a.remaining > 1e-6) return;
      const hat = run.hats.find((h) => h.owner === owner.id)!;
      hat.carrier = `animal:${a.id}`;
      hat.untilTick = run.tick + 1800;
      hat.protectedUntilTick = run.tick + 3600;
      m.hatTarget = null;
      a.behavior = "wander";
      a.remaining = 0;
      observe(
        run,
        "The raccoon borrowed a crew hat. Anyone close by can reclaim it with E; it drops within 30 seconds.",
      );
      return;
    }
  }
  if (
    !lure &&
    a.behavior === "wander" &&
    !run.hats.some((h) => h.carrier.startsWith("animal:"))
  ) {
    const owner = run.players.find((p) => hatOwner(p.id));
    if (owner) {
      m.hatTarget = owner.id;
      a.target = [...owner.position];
      a.behavior = "hat-reach";
      a.remaining = 1.2;
      observe(
        run,
        "The raccoon is looking up and reaching for a nearby hat. Step away to keep it.",
      );
      return;
    }
  }
  if (
    (a.behavior === "wash" &&
      (!lure?.food || flatDistance(lure.point, wash) >= 2)) ||
    (a.behavior === "inspect" &&
      (!run.tin.open ||
        flatDistance(a.pose.position, run.tin.pose.position) > 1.5))
  ) {
    a.behavior = "wander";
    a.remaining = 0;
  }
  if (
    a.behavior === "inspect" &&
    lure?.food &&
    flatDistance(lure.point, wash) < 2 &&
    flatDistance(a.pose.position, wash) < 1
  ) {
    a.behavior = "wash";
    a.remaining = RULES.inspectSeconds;
  }
  if (
    ["inspect", "wash", "investigate"].includes(a.behavior) &&
    a.remaining > 0
  ) {
    a.remaining = Math.max(0, a.remaining - dt);
    if (a.remaining) return;
    const eaten = run.spills.find(
      (s) => s.id === m.goal && flatDistance(s.position, a.pose.position) < 1.5,
    );
    if (eaten) {
      eaten.portions--;
      run.spills = run.spills.filter((s) => s.portions > 0);
      observe(
        run,
        "The raccoon ate one spilled portion. Camp can replace supplies.",
      );
    }
    m.habituatedUntilTick = run.tick + 480;
    if (
      m.goal === "tin" &&
      !run.tin.holder &&
      flatDistance(a.pose.position, run.tin.pose.position) < 1.5
    ) {
      const target = routeTo(a.pose.position, stash, run, extra).length ? stash : home;
      run.tin.holder = `animal:${a.id}`;
      run.tinRevision++;
      a.behavior = "carry";
      a.target = [...target];
      return;
    }
    a.behavior = "wander";
    a.remaining = 1;
    a.pose.rotation = [0, a.pose.rotation[3], 0, -a.pose.rotation[1]];
    observe(
      run,
      "The raccoon has lost interest in the unchanged setup. Move the lure to draw it back.",
    );
    return;
  }
  if (
    lure &&
    (run.tick >= m.habituatedUntilTick ||
      !m.interestPoint ||
      flatDistance(m.interestPoint, lure.point) > 1.2)
  ) {
    const washing = lure.food && flatDistance(lure.point, wash) < 2,
      target = washing
        ? wash
        : approachPoint(run, a, lure.point, extra, 0.85, lure.id);
    if (target) {
      if (
        m.goal !== lure.id ||
        !m.interestPoint ||
        flatDistance(m.interestPoint, lure.point) > 1.2
      ) {
        goal(m, lure.id);
        m.interestPoint = [...lure.point];
        m.interestUntilTick = run.tick + 900;
        m.habituatedUntilTick = 0;
      }
      if (run.tick <= m.interestUntilTick) {
        a.behavior = "approach";
        if (walk(run, a, target, 1.9, dt, extra)) {
          a.behavior = washing
            ? "wash"
            : lure.id === "tin"
              ? "inspect"
              : "investigate";
          a.remaining = RULES.inspectSeconds;
          m.interestPoint = [...lure.point];
          observe(
            run,
            washing
              ? "Food by the woodland rivulet: the raccoon rinses it with its front paws."
              : "The raccoon checks the lure for four seconds, then turns away or takes an unattended tin.",
          );
        }
        return;
      }
    }
  }
  a.behavior = "wander";
  a.remaining = Math.max(0, a.remaining - dt);
  if (a.remaining) return;
  if (!anchorsFor(run, a).some(anchor => anchor.id === m.goal) || flatDistance(a.pose.position, a.target) < 0.2) {
    choose(run, a, m, anchorsFor(run, a).filter(anchor => ["ground", "rest", "retreat"].includes(anchor.kind)).map(anchor => ({id: anchor.id, point: anchor.point})), extra);
  }
  if (walk(run, a, a.target, 1.1, dt, extra)) a.remaining = 2;
}
export function stepAnimals(run: RunState, dt: number): void {
  const extra = run.props
    .filter((p) => !(p.kind === "plank" && p.placed))
    .flatMap((p) => propBoxes(p, PROP_DEFINITIONS[p.kind]));
  for (const a of run.animals) {
    const m = run.animalMemory[a.id];
    if (a.species === "raccoon") {
      raccoonStep(run, a, m, dt, extra);
      continue;
    }
    // Task 5 installs species-specific routines for the nine new residents.
    if (a.species !== "deer" && a.species !== "heron") continue;
    const habitat = a.species === "deer" ? "clearing" : "wetland",
      home = homeFor(run, a),
      feed = anchorsFor(run, a).find(anchor => anchor.kind === "feed"),
      noisy = disturbed(run, a, extra);
    if (noisy && !["alert", "retreat"].includes(a.behavior)) {
      a.behavior = "alert";
      a.remaining = 0.7;
      observe(
        run,
        `${a.species === "deer" ? "Deer" : "Heron"} alert: use cover, keep back, and stop making noise.`,
      );
    }
    if (a.behavior === "alert") {
      a.remaining = Math.max(0, a.remaining - dt);
      if (!a.remaining) {
        const threat =
          run.players
            .filter((p) => p.connected)
            .sort(
              (p, q) =>
                distance(p.position, a.pose.position) -
                distance(q.position, a.pose.position),
            )[0]?.position ?? home;
        const choices = [
          {
            id: `${habitat}-near`,
            point: [home[0] - 4, 0, home[2] - 1] as Vec3,
          },
          {
            id: `${habitat}-far`,
            point: [home[0] + 4, 0, home[2] + 3] as Vec3,
          },
        ].sort((p, q) => distance(q.point, threat) - distance(p.point, threat));
        const choice =
          choices.find(
            (c) =>
              c.id !== m.goal &&
              routeTo(a.pose.position, c.point, run, extra).length,
          ) ??
          choices.find(
            (c) => routeTo(a.pose.position, c.point, run, extra).length,
          );
        if (choice) {
          goal(m, choice.id);
          a.target = [...choice.point];
        }
        a.behavior = "retreat";
      }
      continue;
    }
    if (a.behavior === "retreat") {
      if (walk(run, a, a.target, 2.8, dt, extra)) {
        a.behavior = "settle";
        a.remaining = RULES.quietSeconds;
      }
      continue;
    }
    if (a.behavior === "settle") {
      a.remaining = Math.max(0, a.remaining - dt);
      if (!a.remaining) a.behavior = a.species === "deer" ? "graze" : "preen";
      continue;
    }
    if (a.species === "heron") {
      if (a.behavior === "display") {
        a.remaining = Math.max(0, a.remaining - dt);
        if (!a.remaining) {
          a.behavior = "preen";
          a.remaining = 3;
        }
        continue;
      }
      if (feed && run.baitPatches[feed.id] > 0) {
        if (a.behavior !== "feed") {
          a.remaining = RULES.quietSeconds;
          goal(m, "wetland-feed");
        }
        a.behavior = "feed";
        if (walk(run, a, feed!.point, 1.6, dt, extra)) {
          a.remaining = Math.max(0, a.remaining - dt);
          if (!a.remaining) {
            run.baitPatches[feed!.id]--;
            a.behavior = "display";
            a.remaining = RULES.displaySeconds;
            observe(
              run,
              "Quiet feeding earns a six-second wing display at the selected wetland patch.",
            );
          }
        }
      } else {
        a.remaining = Math.max(0, a.remaining - dt);
        if (!a.remaining && a.behavior !== "wander") {
          choose(
            run,
            a,
            m,
            [
              { id: "wetland-preen", point: home },
              { id: "wetland-rest", point: [home[0] - 2, 0, home[2] + 1] },
            ],
            extra,
          );
          a.behavior = "wander";
        }
        if (a.behavior === "wander" && walk(run, a, a.target, 1.2, dt, extra)) {
          a.behavior = "preen";
          a.remaining = 6;
        }
      }
    } else {
      const decoy = run.props.find(
          (p) =>
            p.kind === "decoy" &&
            !p.holders.some(Boolean) &&
            flatDistance(p.pose.position, a.pose.position) < 10,
        ),
        changed =
          decoy &&
          (!m.interestPoint ||
            flatDistance(m.interestPoint, decoy.pose.position) > 1.2);
      if (decoy && (changed || run.tick >= m.habituatedUntilTick)) {
        if (changed || m.goal !== "deer-decoy") {
          goal(m, "deer-decoy");
          m.interestPoint = [...decoy.pose.position];
          m.interestUntilTick = run.tick + 720;
          m.habituatedUntilTick = 0;
        }
        const target = approachPoint(
          run,
          a,
          decoy.pose.position,
          extra,
          1.4,
          decoy.id,
        );
        if (target && run.tick < m.interestUntilTick) {
          a.behavior = "approach";
          if (walk(run, a, target, 0.9, dt, extra)) a.behavior = "investigate";
          continue;
        }
        m.habituatedUntilTick = run.tick + 480;
      }
      if (a.behavior !== "graze" && a.behavior !== "wander") {
        a.behavior = "graze";
        a.remaining = 5;
      }
      a.remaining = Math.max(0, a.remaining - dt);
      if (!a.remaining && a.behavior !== "wander") {
        choose(
          run,
          a,
          m,
          [
            { id: "clearing-graze", point: home },
            { id: "clearing-scan", point: [home[0] + 2, 0, home[2] + 2] },
          ],
          extra,
        );
        a.behavior = "wander";
      }
      if (a.behavior === "wander" && walk(run, a, a.target, 0.7, dt, extra)) {
        a.behavior = m.goal === "clearing-scan" ? "settle" : "graze";
        a.remaining = m.goal === "clearing-scan" ? 2 : 5;
      }
    }
  }
}
