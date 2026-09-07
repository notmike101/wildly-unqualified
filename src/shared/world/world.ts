/** Deterministic reserve generation. Public exports remain here for existing callers. */
import type { Vec3 } from "../shared.ts";
import { rayBlocked } from "../shared.ts";
import {
  FOREST_MODELS,
  worldBox,
  PROP_CENTER_HEIGHT,
  type NavNode,
} from "./level.ts";
import {
  residentName,
  commissionInstructions,
  type ReserveSpecies,
  type Anchor,
  type Resident,
  type Commission,
  type ReserveBlueprint,
  RESERVE_ROUTINES,
  PAIRS,
} from "./world-data.ts";
import {
  round,
  point,
  distance,
  pose,
  check,
  placed,
  contains,
  corridorBlocked,
  reserveApproaches,
  boundaries,
  waterBeds,
  terrain,
  ROOT_ARCH_CONTACTS,
  archContacts,
  fixture,
} from "./world-geometry.ts";
import { validateReserve } from "./world-validation.ts";
export {
  RESERVE_SPECIES,
  residentName,
  commissionInstructions,
  type ReserveSpecies,
  type Anchor,
  type Resident,
  type Commission,
  type Fixture,
  type ReserveBlueprint,
  BLUEPRINT_LIMIT,
  RESERVE_ROUTINES,
} from "./world-data.ts";
export {
  corridorBlocked,
  reserveApproaches,
  commissionRequirements,
  RESERVE_SUBJECT_HEIGHT,
  reserveCameraFits,
  reserveCanopyCoverage,
} from "./world-geometry.ts";
export { reserveHash, validateReserve } from "./world-validation.ts";

/**
 * Create a deterministic 32-bit seeded pseudorandom stream for layout generation; it is not
 * suitable for credentials.
 *
 * @param seed - Generation seed converted to unsigned 32-bit state
 * @returns Stateful generator producing numbers in [0, 1).
 */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
/**
 * Apply Fisher–Yates shuffling to a shallow copy, preserving the input array.
 *
 * @template T - Element type preserved by the shuffle.
 * @param values - Source elements
 * @param random - Random-number callback yielding values in [0, 1)
 * @returns Shuffled array with the same element references.
 */
function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/**
 * Construct one deterministic reserve candidate, including habitat geometry, equipment
 * routes, and bound commissions. Final validation belongs to generateReserve.
 *
 * @param seed - Unsigned 32-bit seed
 * @param id - Stable world ID
 * @param attempt - Retry index mixed into the generation seed
 * @returns Mutable candidate blueprint.
 * @throws {Error} Layout routing or commission binding cannot satisfy the generation
 * constraints.
 */
function build(seed: number, id: string, attempt: number): ReserveBlueprint {
  const random = rng(seed ^ Math.imul(attempt, 0x9e3779b9)),
    w: ReserveBlueprint = {
      id,
      content: "forest-expedition-1",
      seed,
      attempt,
      bounds: { id: "bounds", min: [-192, -4, -160], max: [192, 36, 160] },
      camp: [seed & 1 ? -174 : 174, 0, 32],
      tinStart: [seed & 1 ? -174 : 174, 0.109, 35],
      pockets: [],
      stations: [],
      density: [],
      placements: [],
      walkables: [],
      waters: [],
      trails: [],
      navNodes: [],
      walls: [],
      physicsBoxes: [],
      fixtures: [],
      residents: [],
      commissions: [],
      props: [],
    };
  const cells: Vec3[] = [
    [-128, 0, -96],
    [0, 0, -96],
    [128, 0, -96],
    [128, 0, 32],
    [128, 0, 96],
    [0, 0, 96],
    [-128, 0, 96],
    [-128, 0, 32],
  ];
  cells[1][0] = (Math.floor(random() * 3) - 1) * 64;
  cells[5][0] = (Math.floor(random() * 3) - 1) * 64;
  cells[3][2] = random() < 0.5 ? -32 : 32;
  cells[7][2] = random() < 0.5 ? -32 : 32;
  const families = shuffle<ReserveSpecies[]>(
    [
      ...PAIRS,
      ["fox"],
      ["squirrel"],
      ["otter"],
      ["badger"],
      ["owl", "woodpecker"],
    ],
    random,
  );
  /**
   * Append an initially unlinked navigation node to the candidate blueprint.
   *
   * @param id - Unique node ID
   * @param p - World position retained by the node
   * @returns The supplied node ID.
   */
  const addNode = (id: string, p: Vec3) => {
    w.navNodes.push({ id, position: p, links: [] });
    return id;
  };
  /**
   * Connect two existing navigation nodes bidirectionally and add a four-metre-wide trail if
   * the link is new.
   *
   * @param a - First existing node ID
   * @param b - Second existing node ID
   */
  const link = (a: string, b: string) => {
    const n = w.navNodes.find((n) => n.id === a)!,
      m = w.navNodes.find((n) => n.id === b)!;
    if (!n.links.includes(b)) {
      n.links.push(b);
      m.links.push(a);
      w.trails.push({
        id: `path-${w.trails.length}`,
        points: [n.position, m.position],
        width: 4,
      });
    }
  };
  addNode("camp", w.camp);
  for (let i = 0; i < 8; i++) {
    const c = cells[i],
      p = point(
        c[0] + Math.floor(random() * 13) - 6,
        0,
        c[2] + Math.floor(random() * 13) - 6,
      ),
      yaw = (Math.floor(random() * 4) * Math.PI) / 2;
    /**
     * Transform a habitat-local point through the current pocket's yaw and horizontal position.
     *
     * @param x - Local X coordinate
     * @param y - World Y coordinate
     * @param z - Local Z coordinate
     * @returns Rounded world point.
     */
    const local = (x: number, y: number, z: number) =>
      point(
        p[0] + x * Math.cos(yaw) + z * Math.sin(yaw),
        y,
        p[2] - x * Math.sin(yaw) + z * Math.cos(yaw),
      );
    const home = `p${i}`,
      species = families[i],
      wet = species.some((s) =>
        ["raccoon", "heron", "beaver", "mallard", "otter"].includes(s),
      );
    const pocket: ReserveBlueprint["pockets"][number] = {
      id: home,
      habitat: wet
        ? "wetland"
        : species.includes("deer")
          ? "clearing"
          : "woodland",
      position: p,
      anchors: [],
    };
    w.pockets.push(pocket);
    addNode(`${home}-camera-a`, p);
    addNode(`${home}-camera-b`, local(10, 0, 0));
    addNode(`${home}-entrance`, local(-10, 0, 0));
    link(`${home}-entrance`, `${home}-camera-a`);
    link(`${home}-camera-a`, `${home}-camera-b`);
    w.placements.push(
      placed(
        `${home}-landmark`,
        i % 2 ? "HollowLog" : "MossBoulderA",
        local(-7, 0, -13),
        yaw,
      ),
    );
    const perch = local(3, 0, -11);
    if (species.some((s) => ["squirrel", "owl", "woodpecker"].includes(s)))
      w.placements.push(placed(`${home}-perch-arch`, "RootArch", perch, yaw));
    if (species.includes("woodpecker"))
      w.placements.push(
        placed(`${home}-cling-tree`, "SnagTall", local(7, 0, -11), yaw),
      );
    const offsets: Record<Anchor["kind"], Vec3> = {
      ground: [0, 0, -9],
      feed: [-2, 0, -9],
      rest: [2, 0, -8],
      retreat: [-4, 0, -11],
      passage: [-3, 0, -7],
      cache: [1, 0, -9],
      den: [-4, 0, -10],
      wash: [7, 0, -9],
      water: [12, 0.12, -10],
      perch: [
        3 + ROOT_ARCH_CONTACTS[2][0],
        ROOT_ARCH_CONTACTS[2][1],
        -11 + ROOT_ARCH_CONTACTS[2][2],
      ],
    };
    if (wet) {
      const a = local(9, -1.5, -13),
        b = local(15, 0.12, -7);
      w.waters.push({
        id: `${home}-water`,
        min: point(Math.min(a[0], b[0]), -1.5, Math.min(a[2], b[2])),
        max: point(Math.max(a[0], b[0]), 0.12, Math.max(a[2], b[2])),
      });
    }
    for (const kind of [
      ...new Set(species.flatMap((s) => RESERVE_ROUTINES[s].kinds)),
    ])
      pocket.anchors.push({
        id: `${home}-${kind}`,
        kind,
        point: local(...offsets[kind]),
        links: [],
      });
    if (species.some((s) => ["deer", "fox", "badger"].includes(s)))
      for (const [n, x, z] of [
        [1, -1, -16],
        [2, -2, -21],
      ])
        pocket.anchors.push({
          id: `${home}-passage-${n}`,
          kind: "passage",
          point: local(x, 0, z),
          links: [],
        });
    if (species.includes("woodpecker"))
      pocket.anchors.push({
        id: home + "-woodpecker-perch",
        kind: "perch",
        point: local(7, 2.5, -10.15),
        links: [],
      });
    for (const speciesName of species) {
      const kind = RESERVE_ROUTINES[speciesName].anchor,
        offset =
          speciesName === "woodpecker" ? [7, 2.5, -10.15] : offsets[kind];
      const camera = local(offset[0], 0, offset[2] + 5);
      if (
        !w.navNodes.some((n) => n.position.every((v, i) => v === camera[i]))
      ) {
        addNode(home + "-camera-" + speciesName, camera);
        link(home + "-camera-a", home + "-camera-" + speciesName);
      }
    }
    for (const s of species)
      for (let n = 0, count = 3 + Math.floor(random() * 2); n < count; n++) {
        const anchors = pocket.anchors.filter(
          (a) =>
            RESERVE_ROUTINES[s].kinds.includes(a.kind) &&
            (a.kind !== "perch" ||
              (s === "woodpecker"
                ? a.id.includes("woodpecker")
                : !a.id.includes("woodpecker"))),
        );
        const base = anchors.find(
          (a) => a.kind === RESERVE_ROUTINES[s].anchor,
        )!;
        const localBase: Vec3 =
          s === "woodpecker" ? [7, 2.5, -10.15] : offsets[base.kind];
        const spawn =
          base.kind === "perch" && s !== "woodpecker"
            ? archContacts(
                w.placements.find((p) => p.id === home + "-perch-arch")!,
              )[n]
            : local(
                localBase[0] + (s === "woodpecker" ? 0 : (n - 1.5) * 0.65),
                base.kind === "perch"
                  ? s === "woodpecker"
                    ? 2.5 + n * 0.45
                    : 3.95
                  : localBase[1],
                localBase[2] +
                  (base.kind === "perch" ? 0 : species.indexOf(s) * 0.7),
              );
        const spawnAnchor: Anchor = {
          id: `${home}-${s}-${n}-start`,
          kind: base.kind,
          point: spawn,
          links: [],
        };
        pocket.anchors.push(spawnAnchor);
        w.residents.push({
          id: `${home}-${s}-${n}`,
          species: s,
          home,
          spawn,
          anchors: [...anchors.map((a) => a.id), spawnAnchor.id],
          group: count > 1 ? `${home}-${s}` : null,
        });
      }
    for (const anchor of pocket.anchors)
      anchor.links = pocket.anchors
        .filter(
          (a) =>
            a !== anchor &&
            (anchor.kind === "perch" ||
              a.kind === "perch" ||
              !corridorBlocked(
                anchor.point,
                a.point,
                w.placements.flatMap((p) => p.solids),
                0.35,
                1.8,
              )) &&
            (anchor.kind === "water" ||
              a.kind === "water" ||
              !corridorBlocked(anchor.point, a.point, w.waters, 0.35, 1.8)),
        )
        .map((a) => a.id);
  }
  for (let i = 0; i < 8; i++)
    link(`p${i}-camera-b`, `p${(i + 1) % 8}-entrance`);
  link("camp", "p1-camera-a");
  link("camp", "p5-camera-a");
  for (const i of [1, 5]) {
    const p = w.pockets[i].position;
    w.stations.push({ id: `station-${i}`, position: [...p], recover: [...p] });
  }
  for (const kind of ["case", "screen", "decoy"] as const)
    w.props.push({
      id: kind,
      kind,
      pose: pose(
        point(
          w.camp[0] + (["case", "screen", "decoy"].indexOf(kind) - 1) * 3,
          PROP_CENTER_HEIGHT[kind],
          w.camp[2] + 4,
        ),
      ),
    });
  // The primary loops stay usable with every fixture closed. Each small brook shortcut has its own plank.
  for (const i of [0, 4]) {
    const p = w.pockets[i].position,
      z = p[2] + 28,
      x = p[0];
    w.waters.push({
      id: `brook-${i}`,
      min: [x - 1.4, -1.5, z - 4],
      max: [x + 1.4, 0.12, z + 4],
    });
    const plankId = `plank-${i}`;
    w.props.push({ id: plankId, kind: "plank", pose: pose([x - 5, 0.095, z]) });
    w.fixtures.push(
      fixture(`crossing-${i}`, "crossing", [x, 0, z], 0, plankId),
    );
    addNode(`crossing-${i}-west`, [x - 5, 0, z]);
    addNode(`crossing-${i}-east`, [x + 5, 0, z]);
    link(`p${i}-camera-a`, `crossing-${i}-west`);
    link(`p${i}-camera-a`, `crossing-${i}-east`);
  }
  const gp = point(w.camp[0] + 12, 0, w.camp[2]);
  w.fixtures.push(fixture("gate", "gate", gp, 0, null));
  w.placements.push(placed("gate-posts", "ForestGate", gp));
  addNode("gate-near", point(gp[0], 0, gp[2] + 5));
  addNode("gate-far", point(gp[0], 0, gp[2] - 5));
  link("camp", "gate-near");
  link("camp", "gate-far");
  w.walkables = terrain(w.waters);
  routeTrails(w);
  // Broad connected bands vary in extent and direction; they are not alternating cell labels.
  const dense = 0.68 + random() * 0.04,
    light = 0.18 + random() * 0.04,
    flip = w.camp[0] < 0;
  let start = -192;
  for (const [kind, fraction] of [
    ["dense", dense],
    ["light", light],
    ["open", 1 - dense - light],
  ] as const) {
    const end = kind === "open" ? 192 : round(start + 384 * fraction);
    w.density.push({
      id: kind,
      kind,
      min: [flip ? -end : start, 0, -160],
      max: [flip ? -start : end, 36, 160],
    });
    start = end;
  }
  bindCommissions(w, random);
  const protectedPoints = [
    w.camp,
    ...w.props.map((p) => point(p.pose.position[0], 0, p.pose.position[2])),
    ...w.stations.map((s) => s.recover),
    ...w.pockets.flatMap((p) =>
      p.anchors
        .filter((a) => a.kind !== "perch" && a.kind !== "water")
        .map((a) => a.point),
    ),
  ];
  const obstacles = [
    ...w.waters,
    ...w.placements.flatMap((p) => p.solids),
    ...w.fixtures.flatMap((f) => f.closedBoxes),
  ];
  // Jittered stands retain overlapping mature crowns without putting roots inside carrying/camera corridors.
  for (let z = -151; z < 152; z += 11)
    for (let x = -183; x < 184; x += 11) {
      const p = point(x + (random() - 0.5) * 6, 0, z + (random() - 0.5) * 6),
        zone = w.density.find((d) => contains(d, p))!;
      if (zone.kind === "open" || (zone.kind === "light" && random() < 0.65))
        continue;
      const model = shuffle(
        ["MatureOakA", "MatureOakB", "MaturePineB", "MatureCedarA"],
        random,
      )[0];
      const t = placed(
        `t${w.placements.length}`,
        model,
        p,
        (Math.floor(random() * 4) * Math.PI) / 2,
      );
      const bounds = worldBox("tree", p, t.yaw, ...FOREST_MODELS[model].bounds);
      if (
        !contains(w.bounds, bounds.min) ||
        !contains(w.bounds, bounds.max) ||
        protectedPoints.some((q) => corridorBlocked(q, q, t.solids, 2.5)) ||
        w.trails.some((path) =>
          corridorBlocked(path.points[0], path.points[1], t.solids),
        ) ||
        corridorBlocked(p, p, obstacles, 1.5)
      )
        continue;
      if (
        w.pockets.some((pocket) =>
          pocket.anchors.some((a) =>
            a.links.some((id) => {
              const b = pocket.anchors.find((b) => b.id === id)!;
              return corridorBlocked(a.point, b.point, t.solids, 0.35, 1.8);
            }),
          ),
        )
      )
        continue;
      if (
        w.pockets.some((pocket) =>
          reserveApproaches(w, pocket.id).some((camera) =>
            pocket.anchors.some((a) =>
              rayBlocked(
                point(camera.position[0], 1.6, camera.position[2]),
                point(a.point[0], a.point[1] + 0.4, a.point[2]),
                [...t.solids, ...t.occluders],
              ),
            ),
          ),
        )
      )
        continue;
      w.placements.push(t);
      if (w.placements.length % 4 === 0)
        w.placements.push(
          placed(
            `floor${w.placements.length}`,
            w.placements.length % 8 ? "LeafMat" : "NeedleMat",
            point(p[0], 0.01, p[2]),
            t.yaw,
          ),
        );
    }
  w.walls = [
    ...w.placements.flatMap((p) => p.solids),
    ...w.waters,
    ...boundaries(),
  ];
  w.physicsBoxes = [
    ...w.walkables.map((s) => ({
      id: s.id,
      min: point(s.min[0], s.heightStart - 1, s.min[2]),
      max: point(s.max[0], s.heightStart, s.max[2]),
    })),
    ...waterBeds(w.waters),
    ...w.walls,
  ];
  return w;
}
/**
 * Replace draft trails and node links with equipment-width paths around water, scenery, and
 * closed fixtures using a four-metre search grid.
 *
 * @param w - Mutable candidate blueprint
 * @throws {Error} An authored node lacks a clear entrance or a required equipment route
 * cannot be found.
 */
function routeTrails(w: ReserveBlueprint) {
  const obstacles = [
    ...w.waters,
    ...w.placements.flatMap((p) => p.solids),
    ...w.fixtures.flatMap((f) => f.closedBoxes),
  ];
  const edges = w.trails.map((t) => t.points),
    originals = [...w.navNodes];
  w.trails = [];
  for (const n of w.navNodes) n.links = [];
  const nodes = new Map(w.navNodes.map((n) => [n.position.join(","), n]));
  /**
   * Reuse a navigation node at an exact coordinate key or append a new junction.
   *
   * @param p - World position retained if a junction is created
   * @returns Existing or newly created mutable node.
   */
  const node = (p: Vec3) => {
    const key = p.join(",");
    let n = nodes.get(key);
    if (!n) {
      n = { id: `junction-${nodes.size}`, position: p, links: [] };
      nodes.set(key, n);
      w.navNodes.push(n);
    }
    return n;
  };
  /**
   * Add a bidirectional link and trail unless the nodes are identical or already connected.
   *
   * @param a - First mutable node
   * @param b - Second mutable node
   */
  const connect = (a: NavNode, b: NavNode) => {
    if (a === b || a.links.includes(b.id)) return;
    a.links.push(b.id);
    b.links.push(a.id);
    w.trails.push({
      id: `path-${w.trails.length}`,
      points: [a.position, b.position],
      width: 4,
    });
  };
  const grid = new Map<string, Vec3>();
  for (let z = -152; z <= 152; z += 4)
    for (let x = -184; x <= 184; x += 4) {
      const p: Vec3 = [x, 0, z];
      if (!corridorBlocked(p, p, obstacles)) grid.set(`${x},${z}`, p);
    }
  /**
   * Find the nearest unobstructed equipment-grid entrance within 16 metres.
   *
   * @param p - Authored navigation point
   * @returns Selected grid point.
   * @throws {Error} No equipment entrance is reachable within the search radius.
   */
  const nearest = (p: Vec3) => {
    const candidates = [...grid.values()]
      .filter((q) => distance(p, q) < 16 && !corridorBlocked(p, q, obstacles))
      .sort((a, b) => distance(p, a) - distance(p, b));
    check(candidates[0], "equipment entrance");
    return candidates[0];
  };
  const ends = new Map(
    originals.map((n) => [n.position.join(","), nearest(n.position)]),
  );
  for (const [start, end] of edges) {
    const a = ends.get(start.join(","))!,
      b = ends.get(end.join(","))!,
      /**
       * Encode a grid point's horizontal coordinates for path-search maps.
       *
       * @param p - Grid point
       * @returns X/Z coordinate key.
       */
      key = (p: Vec3) => `${p[0]},${p[2]}`;
    const open = [a],
      scores = new Map([[key(a), 0]]),
      parents = new Map<string, Vec3>();
    let found = false;
    while (open.length) {
      open.sort(
        (p, q) =>
          scores.get(key(q))! +
          distance(q, b) -
          (scores.get(key(p))! + distance(p, b)),
      );
      const current = open.pop()!;
      if (key(current) === key(b)) {
        found = true;
        break;
      }
      for (const [dx, dz] of [
        [4, 0],
        [-4, 0],
        [0, 4],
        [0, -4],
      ]) {
        const next = grid.get(`${current[0] + dx},${current[2] + dz}`);
        if (!next || corridorBlocked(current, next, obstacles)) continue;
        const cost = scores.get(key(current))! + 4;
        if (cost < (scores.get(key(next)) ?? Infinity)) {
          scores.set(key(next), cost);
          parents.set(key(next), current);
          if (!open.includes(next)) open.push(next);
        }
      }
    }
    check(found, "equipment route");
    const path = [b];
    while (key(path[path.length - 1]) !== key(a))
      path.push(parents.get(key(path[path.length - 1]))!);
    path.reverse();
    const all = [start, ...path, end];
    for (let i = 1; i < all.length; i++)
      connect(node(all[i - 1]), node(all[i]));
  }
}
/**
 * Assign the existing commission kinds to compatible residents while satisfying species and
 * habitat diversity constraints. Replaces the candidate's commissions.
 *
 * @param w - Mutable candidate blueprint
 * @param random - Seeded random callback used for candidate ordering
 * @throws {Error} No compatible commission combination is found.
 */
function bindCommissions(w: ReserveBlueprint, random: () => number) {
  const choices = shuffle(
    w.residents.filter((r) => r.id.endsWith("-0")),
    random,
  );
  for (const a of choices)
    for (const b of choices)
      for (const setup of choices.filter((r) =>
        ["raccoon", "deer", "heron", "rabbit", "mallard"].includes(r.species),
      ))
        for (const composition of choices)
          for (const passage of choices.filter((r) =>
            ["deer", "fox", "badger"].includes(r.species),
          ))
            for (const pair of shuffle(PAIRS, random)) {
              const duo = pair.map((s) =>
                choices.find((r) => r.species === s)!,
              );
              const subjects = [a, b, setup, composition, passage, ...duo];
              if (
                a === b ||
                new Set(subjects.map((r) => r.species)).size < 5 ||
                new Set(
                  [a, b, setup, composition, passage, duo[0]].map(
                    (r) => r.home,
                  ),
                ).size < 5 ||
                new Set(
                  subjects
                    .filter(
                      (r) => !["raccoon", "deer", "heron"].includes(r.species),
                    )
                    .map((r) => r.species),
                ).size < 2
              )
                continue;
              const bindings: [Commission["kind"], Resident[]][] = [
                ["behavior", [a]],
                ["behavior", [b]],
                ["setup", [setup]],
                ["composition", [composition]],
                ["passage", [passage]],
                ["pair", duo],
                ["cameo", [choices[0]]],
                ["incident", [choices.find((r) => r.species === "raccoon")!]],
              ];
              w.commissions = bindings.map(([kind, rs], i) => {
                const r = rs[0],
                  routine = RESERVE_ROUTINES[r.species],
                  anchor =
                    kind === "passage"
                      ? "passage"
                      : kind === "setup" || kind === "pair"
                        ? "feed"
                        : routine.anchor;
                const commission: Commission = {
                  id: `commission-${i}`,
                  required: i < 6,
                  kind,
                  subjects: rs.map((r) => r.id),
                  pocket: r.home,
                  anchor: `${r.home}-${anchor === "perch" && r.species === "woodpecker" ? "woodpecker-perch" : anchor}`,
                  landmark:
                    kind === "composition" ? `${r.home}-landmark` : null,
                  behavior:
                    kind === "behavior"
                      ? routine.behavior
                      : kind === "passage"
                        ? "passage"
                        : null,
                  title: `${residentName(w, r.id)} · ${kind === "behavior" ? routine.behavior : kind === "composition" ? "landmark portrait" : kind === "passage" ? "trail study" : kind === "setup" ? "feeding setup" : kind === "pair" ? "shared portrait" : kind === "incident" ? "field mishap" : "cameo"}`,
                  instructions:
                    kind === "setup"
                      ? "Bring the tin, screen and decoy; prepare cover and photograph the feeding setup."
                      : kind === "passage"
                        ? "Follow the local passage anchors and frame the repeatable route."
                        : `Photograph ${rs.map((r) => r.species).join(" and ")} at ${r.home} during ${kind}.`,
                };
                commission.instructions = commissionInstructions(w, commission);
                return commission;
              });
              return;
            }
  throw new Error("No compatible commissions");
}
/**
 * Try up to eight deterministic layout candidates and return the first fully validated,
 * frozen blueprint. Saved worlds must retain their blueprint rather than regenerate it.
 *
 * @param seed - Unsigned 32-bit generation seed
 * @param worldId - Stable world identifier
 * @returns Validated, deeply frozen reserve blueprint.
 * @throws {Error} Seed/ID validation fails or all eight generation attempts fail.
 */
export function generateReserve(
  seed: number,
  worldId: string,
): ReserveBlueprint {
  check(
    Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff,
    "seed must be uint32",
  );
  check(
    typeof worldId === "string" && /^[\w-]{1,96}$/.test(worldId),
    "world id",
  );
  let error: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return validateReserve(build(seed, worldId, attempt));
    } catch (e) {
      error = e;
    }
  }
  throw new Error(`Reserve generation exhausted 8 attempts: ${String(error)}`);
}
