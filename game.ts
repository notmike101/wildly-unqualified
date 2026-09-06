import {
  PROP_DEFINITIONS,
  RULES,
  SUBJECT_HEIGHT,
  subjectPoints,
  TIN_HALF,
  PROP_CENTER_HEIGHT,
  fixtureBoxes,
  fixtureSurfaces,
  fixtureLatch,
} from "./level.ts";
import { generateReserve, type ReserveBlueprint } from "./world.ts";
import {
  distance,
  eye,
  forward,
  equipmentTarget,
  equipmentUseTarget,
  recoveryTarget,
  heldProp,
  movePlayer,
  parseMessage,
  pose,
  rayBlocked,
  surfaceHeight,
  playerSpeed,
  propPoint,
  propBoxes,
  propRayBlocked,
  type Animal,
  type Assignment,
  type Box,
  type ClientMessage,
  type CrewSlot,
  type FieldProp,
  type PhotoFrame,
  type PhotoVerdict,
  type Player,
  type Pose,
  type Quat,
  type Snapshot,
  type Vec3,
} from "./shared.ts";
import { createPhysics } from "./physics.ts";
import {
  stepAnimals,
  localRecoveryPoint,
  type AnimalMemory,
} from "./encounters.ts";

type Action = {
  kind:
    "rattle" | "whistle" | "noise" | "impact" | "bait" | "recover" | "place";
  player: string;
  point: Vec3;
  tick: number;
};
export type RunState = Snapshot & {
  world: ReserveBlueprint;
  pendingPhotos: Record<string, PhotoFrame>;
  hostId: string | null;
  events: Action[];
  cooldowns: Record<string, { use: number; photo: number }>;
  animalMemory: Record<string, AnimalMemory>;
  decisionSeconds: number;
  nextPhoto: number;
  tinRevision: number;
  lastImpactTick: number;
  failedSetups: number;
};
const nearby = (a: Vec3, b: Vec3, r: number) =>
  Math.hypot(a[0] - b[0], a[2] - b[2]) <= r;
const flat = (p: Vec3): Vec3 => [p[0], 0, p[2]];
const carryState = new WeakMap<
  RunState,
  Map<string, { blocked: number; ignore: boolean }>
>();
const gripState = new WeakMap<RunState, Map<string, Vec3>>();
const observe = (run: RunState, text: string) => {
  if (!run.observations.includes(text)) run.observations.push(text);
  run.observations = run.observations.slice(-40);
};
function spillCase(run: RunState, prop: FieldProp) {
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
function updateHats(run: RunState) {
  for (const hat of run.hats) {
    const owner = run.players.find((p) => p.id === hat.owner),
      r = run.animals.find((a) => `animal:${a.id}` === hat.carrier);
    if (!owner) continue; // Invalid removed owners are rejected by persistence.
    if (!owner.connected || !r) {
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
const animal = (run: RunState, species: "raccoon" | "heron") =>
  run.animals.find((a) => a.species === species)!;
function player(run: RunState, id: string) {
  const p = run.players.find((p) => p.id === id && p.connected);
  if (!p) throw Error("Player is disconnected");
  return p;
}
function neutralize(run: RunState) {
  for (const p of run.players) {
    p.lastInput = null;
    p.inputTick = run.tick;
  }
}
function event(
  run: RunState,
  kind: Action["kind"],
  p: Player | null,
  point: Vec3,
) {
  run.events.push({
    kind,
    player: p?.id ?? "tin",
    point: [...point],
    tick: run.tick,
  });
  run.events = run.events.slice(-128);
}
function safe(
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
const overlap = (a: Box, b: Box) =>
  a.min.every(
    (value, axis) => value < b.max[axis] && a.max[axis] > b.min[axis],
  );
const yawOf = (value: Pose) => {
  const [x, y, z, w] = value.rotation;
  return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
};
const yawPose = (position: Vec3, yaw: number): Pose => ({
  position: [...position],
  rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
});
const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));
const quatAngle = (a: Quat, b: Quat) =>
  2 *
  Math.acos(
    Math.min(1, Math.abs(a.reduce((sum, value, i) => sum + value * b[i], 0))),
  );
const slerp = (a: Quat, b: Quat, t: number): Quat => {
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
const alignLocalX = (direction: Vec3): Quat => {
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
const gripOffset = (
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
const clearGrips = (run: RunState, prop: FieldProp, id?: string) => {
  const grips = gripState.get(run);
  if (!grips) return;
  for (const key of grips.keys())
    if (key.startsWith(`${prop.id}\0`) && (!id || key.endsWith(`\0${id}`)))
      grips.delete(key);
};
function sweepProp(run: RunState, prop: FieldProp, desired: Pose) {
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
function releaseProp(
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
function recoverProp(run: RunState, prop: FieldProp, origin: Vec3) {
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
function propRecoverable(run: RunState, prop: FieldProp) {
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
function safeSpawn(run: RunState, id: string): Vec3 {
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

export function createRun(
  seed = 1,
  worldId: string = crypto.randomUUID(),
): RunState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw Error("World seed must be a uint32 integer");
  const world = generateReserve(seed, worldId);
  const fieldProp = (
    id: string,
    kind: FieldProp["kind"],
    position: Vec3,
    rotation: Quat = [0, 0, 0, 1],
  ): FieldProp => ({
    id,
    kind,
    pose: { position: [...position], rotation: [...rotation] },
    velocity: [0, 0, 0],
    angularVelocity: [0, 0, 0],
    holders: [null, null],
    placed: false,
    open: false,
    spillUntilTick: 0,
  });
  return {
    version: 3,
    worldId: world.id,
    tick: 0,
    seconds: 0,
    phase: "camp",
    paused: true,
    pauseReason: "Waiting for crew",
    players: [],
    animals: world.residents.map((resident) => ({
      id: resident.id,
      species: resident.species,
      behavior: "wander",
      pose: pose(resident.spawn),
      target: [...resident.spawn],
      remaining: 5,
    })),
    tin: {
      pose: pose(world.tinStart),
      velocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      holder: null,
      portions: 4,
      open: false,
    },
    world,
    props: world.props.map((prop) =>
      fieldProp(prop.id, prop.kind, prop.pose.position, prop.pose.rotation),
    ),
    route: Object.fromEntries(
      world.fixtures.map((f) => [f.id, { open: false, seat: null }]),
    ),
    spills: [],
    hats: [],
    spareBait: 8,
    baitPatches: Object.fromEntries(
      world.pockets.flatMap((p) =>
        p.anchors.filter((a) => a.kind === "feed").map((a) => [a.id, 0]),
      ),
    ),
    observations: [
      "Open the tin near the raccoon. Watch its paws before it steals the tin.",
    ],
    completed: [],
    album: [],
    ready: [],
    pings: [],
    pendingPhotos: {},
    hostId: null,
    events: [],
    cooldowns: {},
    animalMemory: Object.fromEntries(
      world.residents.map(({ id }) => [
        id,
        {
          goal: "",
          recentGoals: [],
          interestPoint: null,
          interestUntilTick: 0,
          habituatedUntilTick: 0,
          hatTarget: null,
        },
      ]),
    ),
    decisionSeconds: 0,
    nextPhoto: 1,
    tinRevision: 0,
    lastImpactTick: -6000,
    failedSetups: 0,
  };
}

export function addPlayer(run: RunState, id: string, name: string): Player {
  if (
    !/^[-_a-zA-Z0-9]{1,80}$/.test(id) ||
    ["__proto__", "constructor", "prototype"].includes(id)
  )
    throw Error("Invalid player ID");
  let p = run.players.find((p) => p.id === id);
  if (!p && run.players.length >= 4)
    throw Error("The four crew slots are full");
  const position = safeSpawn(run, id);
  if (p) {
    p.connected = true;
    p.position = position;
    p.lastInput = null;
    p.inputTick = run.tick;
  } else {
    const slot = ([0, 1, 2, 3] as CrewSlot[]).find(
      (slot) => !run.players.some((player) => player.slot === slot),
    );
    if (slot === undefined) throw Error("The four crew slots are full");
    p = {
      id,
      name: name.trim().slice(0, 24) || "Researcher",
      slot,
      position,
      yaw: 0,
      pitch: 0,
      lastSeq: 0,
      connected: true,
      lastInput: null,
      inputTick: run.tick,
    };
    run.players.push(p);
    run.hats.push({
      owner: id,
      carrier: "owner",
      position: [...position],
      untilTick: 0,
      protectedUntilTick: 0,
    });
  }
  run.cooldowns[id] ??= { use: -6000, photo: -6000 };
  run.ready = run.ready.filter((id) => id !== p.id);
  if (run.hostId === null) run.hostId = id;
  if (run.phase === "camp" && run.pauseReason === "Waiting for crew") {
    run.paused = false;
    run.pauseReason = "";
  }
  return p;
}

function heldPose(run: RunState) {
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
function release(run: RunState, p: Player, drop: boolean) {
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
export function disconnectPlayer(run: RunState, id: string): void {
  const p = run.players.find((p) => p.id === id);
  if (!p) return;
  if (run.tin.holder === id) {
    try {
      release(run, p, false);
    } catch {
      run.tin.holder = null;
      run.tin.pose = pose([p.position[0], TIN_HALF[1], p.position[2]]);
      run.tin.velocity = [0, 0, 0];
      run.tin.angularVelocity = [0, 0, 0];
      run.tinRevision++;
    }
  }
  for (const prop of run.props)
    if (prop.holders.includes(id)) {
      releaseProp(run, prop, id, false);
      if (!prop.holders.some(Boolean) && propRecoverable(run, prop))
        recoverProp(run, prop, p.position);
    }
  p.connected = false;
  for (const animal of run.animals) {
    const memory = run.animalMemory[animal.id];
    if (memory.hatTarget === id) {
      memory.hatTarget = null;
      if (animal.behavior === "hat-reach") {
        animal.behavior = "wander";
        animal.remaining = 0;
      }
    }
  }
  updateHats(run);
  run.ready = run.ready.filter((v) => v !== id);
  run.paused = true;
  run.pauseReason = `Disconnected: ${p.name}. Continue without them or wait.`;
  neutralize(run);
}

function recoverable(run: RunState) {
  const p = run.tin.pose.position;
  return (
    p.some((n) => !Number.isFinite(n)) ||
    p[1] < -0.5 ||
    p[1] > 5 ||
    !safe(run, flat(p))
  );
}
export function applyCommand(
  run: RunState,
  id: string,
  input: unknown,
): { frame: PhotoFrame; verdict: PhotoVerdict } | void {
  const cmd = parseMessage(input),
    p = player(run, id),
    seq = cmd.type === "input" ? cmd.value.seq : cmd.seq;
  if (cmd.worldId !== run.worldId)
    throw Error("Stale world command; refresh the reserve");
  if (seq <= p.lastSeq) throw Error("Replayed command sequence");
  p.lastSeq = seq;
  const host = () => {
    if (run.hostId !== id) throw Error("Only the host can do that");
  };
  if (cmd.type === "input") {
    p.yaw = cmd.value.yaw;
    p.pitch = cmd.value.pitch;
    p.inputTick = run.tick;
    p.lastInput = run.paused || run.phase === "exhibition" ? null : cmd.value;
    return;
  }
  if (cmd.type === "start") {
    host();
    if (run.phase !== "camp") throw Error("The outing has already started");
    if (run.players.filter((p) => p.connected).length < 2)
      throw Error("Connect at least two researchers to start");
    if (!nearby(p.position, run.world.camp, 6))
      throw Error("Return to camp to start");
    run.phase = "outing";
    run.paused = false;
    run.pauseReason = "";
    neutralize(run);
    return;
  }
  if (cmd.type === "pause" || cmd.type === "save-and-stop") {
    host();
    if (cmd.type === "save-and-stop") {
      if (run.tin.holder && !run.tin.holder.startsWith("animal:"))
        release(run, player(run, run.tin.holder), true);
      for (const prop of run.props) {
        clearGrips(run, prop);
        prop.holders = [null, null];
        prop.placed = run.world.fixtures.some(
          (f) => f.plankId === prop.id && run.route[f.id].open,
        );
      }
    }
    run.paused = true;
    run.pauseReason =
      cmd.type === "pause" ? "Host paused the outing" : "Saved and stopped";
    neutralize(run);
    return;
  }
  if (cmd.type === "resume") {
    const absent = !run.players.some((p) => p.connected && p.id === run.hostId);
    if (
      run.hostId !== id &&
      !(absent && run.pauseReason.startsWith("Disconnected:"))
    )
      throw Error("Only the host can resume this pause");
    if (run.phase === "exhibition") throw Error("This outing has ended");
    run.paused = false;
    run.pauseReason = "";
    neutralize(run);
    return;
  }
  if (cmd.type === "favorite") {
    const photo = run.album.find((photo) => photo.id === cmd.photoId);
    if (!photo) throw Error("Unknown photo");
    photo.favorites = cmd.selected
      ? [...new Set([...photo.favorites, id])]
      : photo.favorites.filter((playerId) => playerId !== id);
    return;
  }
  if (run.paused) throw Error("The outing is paused");
  if (run.phase === "exhibition") throw Error("This outing has ended");
  if (cmd.type === "ready-end" || cmd.type === "finish") {
    if (
      !run.world.commissions
        .filter((c) => c.required)
        .every((c) => run.completed.includes(c.id))
    )
      throw Error("Complete all six required photo commissions first");
    if (cmd.type === "ready-end") {
      if (!nearby(p.position, run.world.camp, 6))
        throw Error("Return to camp before marking ready");
      run.ready = run.ready.includes(id)
        ? run.ready.filter((v) => v !== id)
        : [...run.ready, id];
      return;
    }
    host();
    if (
      run.players.some(
        (p) =>
          p.connected &&
          (!nearby(p.position, run.world.camp, 6) || !run.ready.includes(p.id)),
      )
    )
      throw Error("Every connected researcher must be at camp and ready");
    run.phase = "exhibition";
    run.paused = true;
    run.pauseReason = "Outing complete";
    neutralize(run);
    return;
  }
  if (cmd.type === "ping") {
    if (distance(eye(p), cmd.point) > 50 || !safe(run, flat(cmd.point)))
      throw Error("Ping a reachable point in the reserve");
    run.pings = run.pings.filter((p) => p.player !== id);
    run.pings.push({
      player: id,
      point: [...cmd.point],
      until: run.tick + 600,
    });
    return;
  }
  if (cmd.type === "recover") {
    const lost = run.props.filter(
      (prop) => !prop.holders.some(Boolean) && propRecoverable(run, prop),
    );
    if (lost.length) {
      const prop = lost.sort(
        (a, b) =>
          distance(a.pose.position, p.position) -
          distance(b.pose.position, p.position),
      )[0];
      recoverProp(
        run,
        prop,
        prop.pose.position.every(Number.isFinite)
          ? prop.pose.position
          : p.position,
      );
      event(run, "recover", p, prop.pose.position);
      observe(
        run,
        "Equipment recovers at the nearest clear authored site without losing route progress.",
      );
      return;
    }
    if (run.tin.holder) throw Error("The tin is currently held");
    if (!recoverable(run))
      throw Error("Nearby equipment and the tin are reachable");
    const points: Vec3[] = [
      run.world.tinStart,
      ...run.world.stations.map(
        (s) => [s.recover[0], s.recover[1] + TIN_HALF[1], s.recover[2]] as Vec3,
      ),
    ];
    const origin = run.tin.pose.position.every(Number.isFinite)
      ? run.tin.pose.position
      : p.position;
    const nearest = points.reduce((a, b) =>
      distance(a, origin) < distance(b, origin) ? a : b,
    );
    run.tin.pose = pose(nearest);
    run.tin.velocity = [0, 0, 0];
    run.tin.angularVelocity = [0, 0, 0];
    run.tinRevision++;
    event(run, "recover", p, nearest);
    observe(
      run,
      "The tin can be recovered without losing bait or photographs.",
    );
    return;
  }
  if (cmd.type === "interact") {
    if (run.tin.holder === id) {
      release(run, p, false);
      return;
    }
    const carrying = heldProp(id, run.props);
    if (carrying) {
      releaseProp(run, carrying, id, true);
      event(run, "place", p, carrying.pose.position);
      return;
    }
    const recovery = recoveryTarget(p, run, PROP_DEFINITIONS, [
      ...run.world.walls,
      ...fixtureBoxes(run.world.fixtures, run.route),
    ]);
    if (recovery) {
      if (recovery.kind === "hat") {
        const hat = run.hats.find((h) => h.owner === recovery.id)!;
        hat.carrier = "owner";
        hat.untilTick = 0;
        updateHats(run);
        observe(
          run,
          "The borrowed hat is back with its original owner, with repeat-theft protection intact.",
        );
      } else {
        const spill = run.spills.find((s) => s.id === recovery.id)!;
        const amount = Math.min(8 - run.spareBait, spill.portions);
        run.spareBait += amount;
        spill.portions -= amount;
        run.spills = run.spills.filter((s) => s.portions > 0);
        observe(
          run,
          "Recovered spilled bait goes back into the shared field-case supplies.",
        );
      }
      event(run, "recover", p, recovery.point);
      return;
    }
    const reachWalls = [
        ...run.world.walls,
        ...fixtureBoxes(run.world.fixtures, run.route),
        ...run.props.flatMap((prop) =>
          propBoxes(prop, PROP_DEFINITIONS[prop.kind]),
        ),
      ],
      target = equipmentTarget(p, run.props, PROP_DEFINITIONS, [
        ...run.world.walls,
        ...fixtureBoxes(run.world.fixtures, run.route),
      ]),
      tinReachable =
        (!run.tin.holder || run.tin.holder?.startsWith("animal:")) &&
        distance(eye(p), run.tin.pose.position) <= 2 &&
        !rayBlocked(eye(p), run.tin.pose.position, reachWalls);
    if (
      target &&
      (!tinReachable ||
        distance(eye(p), target.point) <
          distance(eye(p), run.tin.pose.position))
    ) {
      const prop = run.props.find((value) => value.id === target.propId)!;
      prop.holders[target.handle!] = id;
      prop.placed = false;
      gripOffset(run, prop, target.handle!, p);
      return;
    }
    const gate = run.world.fixtures
        .filter((f) => f.kind === "gate")
        .map((f) => ({ ...f, latch: fixtureLatch(f, run.route) }))
        .filter((f) => f.latch)
        .sort(
          (a, b) => distance(eye(p), a.latch!) - distance(eye(p), b.latch!),
        )[0],
      latch = gate?.latch;
    if (
      latch &&
      distance(eye(p), latch) <= 2 &&
      !rayBlocked(eye(p), latch, [
        ...run.world.walls,
        ...run.props.flatMap((prop) =>
          propBoxes(prop, PROP_DEFINITIONS[prop.kind]),
        ),
      ])
    ) {
      run.route[gate.id].open = !run.route[gate.id].open;
      event(run, "place", p, latch);
      return;
    }
    const heldByOther = run.tin.holder && !run.tin.holder.startsWith("animal:");
    const tooFar = distance(eye(p), run.tin.pose.position) > 2;
    const blocked = rayBlocked(eye(p), run.tin.pose.position, reachWalls);
    if (heldByOther || tooFar || blocked) {
      const clue = run.world.commissions
        .map((c) => ({
          title: c.title,
          text: c.instructions,
          position: run.world.pockets.find((p) => p.id === c.pocket)!.position,
        }))
        .filter(
          (c) =>
            distance(p.position, c.position) <= 3 &&
            !rayBlocked(eye(p), c.position, reachWalls),
        )
        .sort(
          (a, b) =>
            distance(p.position, a.position) - distance(p.position, b.position),
        )[0];
      if (clue) {
        observe(run, `${clue.title}: ${clue.text}`);
        return;
      }
      if (heldByOther) throw Error("Another researcher is holding the tin");
      if (tooFar)
        throw Error("Move closer to reach the tin or inspect a field clue");
      throw Error("The tin is blocked by a wall");
    }
    if (run.tin.holder?.startsWith("animal:")) {
      const r = run.animals.find((a) => a.id === run.tin.holder?.slice(7))!;
      r.behavior = "wander";
      r.remaining = 0;
      run.animalMemory[r.id].habituatedUntilTick = run.tick + 120;
      observe(
        run,
        "The raccoon will give up the tin when you reclaim it close by.",
      );
    }
    run.tin.holder = id;
    run.tinRevision++;
    heldPose(run);
    return;
  }
  if (cmd.type === "drop") {
    const prop = heldProp(id, run.props);
    if (prop) releaseProp(run, prop, id, false);
    else if (run.tin.holder === id) release(run, p, true);
    else throw Error("Pick up the tin or equipment first");
    return;
  }
  if (cmd.type === "use") {
    const cooldown = run.cooldowns[id];
    if (run.tick - cooldown.use < RULES.whistleCooldown * 60)
      throw Error("Wait for the whistle or tin cooldown");
    cooldown.use = run.tick;
    const prop = heldProp(id, run.props);
    if (prop?.kind === "case") {
      prop.open = !prop.open;
      event(run, "place", p, prop.pose.position);
      return;
    }
    if (!prop) {
      const target = equipmentUseTarget(p, run.props, PROP_DEFINITIONS, [
        ...run.world.walls,
        ...fixtureBoxes(run.world.fixtures, run.route),
      ]);
      if (target) {
        const decoy = run.props.find((value) => value.id === target.propId)!;
        if (decoy.open) throw Error("The decoy bait cup is already filled");
        if (!run.spareBait) throw Error("The field case is out of spare bait");
        run.spareBait--;
        decoy.open = true;
        event(run, "bait", p, target.point);
        return;
      }
    }
    if (run.tin.holder === id) {
      const supply = run.props.find(
        (value) =>
          value.kind === "case" &&
          value.open &&
          nearby(value.pose.position, p.position, 2.5),
      );
      if (supply && run.tin.portions < 4 && run.spareBait) {
        const portions = Math.min(4 - run.tin.portions, run.spareBait);
        run.tin.portions += portions;
        run.spareBait -= portions;
        observe(
          run,
          "The open field case refilled the tin from its saved spare bait.",
        );
        return;
      }
      if (
        (nearby(p.position, run.world.camp, 5) ||
          run.world.stations.some((s) => nearby(p.position, s.position, 5))) &&
        (run.tin.portions < 4 || run.spareBait < 8)
      ) {
        run.tin.portions = 4;
        run.spareBait = 8;
        observe(
          run,
          "Camp has spare bait: use the held tin here to refill all four portions.",
        );
        return;
      }
      const patch = run.world.pockets
        .flatMap((p) => p.anchors)
        .find((a) => a.kind === "feed" && nearby(p.position, a.point, 2.5));
      if (patch) {
        if (!run.tin.portions)
          throw Error("The tin is empty; refill at a supply station");
        if (run.baitPatches[patch.id] >= 4)
          throw Error("The feeding patch already has enough bait");
        run.tin.portions--;
        run.baitPatches[patch.id]++;
        event(run, "bait", p, patch.point);
        observe(
          run,
          "Bait placed at the local feeding patch. Give wildlife quiet space.",
        );
        return;
      }
      run.tin.open = true;
      event(run, "rattle", p, run.tin.pose.position);
      event(run, "noise", p, p.position);
      observe(
        run,
        `${p.name} rattled the tin. The raccoon follows open tins and rattles.`,
      );
    } else {
      event(run, "whistle", p, p.position);
      event(run, "noise", p, p.position);
      observe(
        run,
        `${p.name} whistled. The raccoon investigates; nearby herons startle.`,
      );
    }
    return;
  }
  if (cmd.type === "photo") {
    if (run.phase !== "outing")
      throw Error("Start the outing before recording assignment photographs");
    const cooldown = run.cooldowns[id];
    if (run.tick - cooldown.photo < RULES.photoCooldown * 60)
      throw Error("Wait one second before the next photograph");
    cooldown.photo = run.tick;
    const frame = makePhotoFrame(run, id),
      verdict = evaluatePhoto(frame, run.world),
      credits = verdict.credits.filter((c) => !run.completed.includes(c));
    run.completed.push(...credits);
    const assists = [
      ...new Set(
        run.events
          .filter(
            (e) =>
              e.player &&
              e.player !== id &&
              e.tick >= run.tick - 1200 &&
              ["rattle", "whistle", "bait", "place"].includes(e.kind) &&
              frame.animals.some((a) => nearby(a.pose.position, e.point, 12)),
          )
          .map((e) => e.player),
      ),
    ];
    run.album.push({
      id: frame.id,
      photographer: id,
      tick: run.tick,
      credits,
      assists,
      favorites: [],
      incident: null,
      thumbnail: "pending",
    });
    run.pendingPhotos[frame.id] = frame;
    const extras = run.album.filter((p) => !p.credits.length);
    const remove = new Set(extras.slice(0, -21).map((p) => p.id));
    run.album = run.album.filter((p) => !remove.has(p.id));
    for (const id of remove) delete run.pendingPhotos[id];
    if (!credits.length) {
      run.failedSetups++;
      if (run.failedSetups >= 3)
        observe(
          run,
          "If setups keep going wrong, refill the tin at camp. Keep the raccoon 3–8 metres from the heron.",
        );
    }
    return { frame, verdict };
  }
}

export function advanceRun(run: RunState, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0)
    throw Error("Invalid simulation timestep");
  if (run.paused || run.phase === "exhibition") return;
  if (!run.players.some((p) => p.connected)) {
    run.paused = true;
    run.pauseReason = "Waiting for crew";
    neutralize(run);
    return;
  }
  dt = Math.min(dt, 1 / 60);
  run.tick++;
  if (run.phase === "outing") run.seconds += dt;
  const before = new Map(
    run.players.map((p) => [p.id, [...p.position] as Vec3]),
  );
  for (const prop of run.props)
    prop.holders.forEach((id, handle) => {
      const p = id
        ? run.players.find((value) => value.id === id && value.connected)
        : undefined;
      if (p) gripOffset(run, prop, handle, p);
    });
  const playerWalls = (p: Player) => [
    ...run.world.walls,
    ...fixtureBoxes(run.world.fixtures, run.route),
    ...run.props
      .filter((prop) => !prop.holders.includes(p.id) && !prop.placed)
      .flatMap((prop) => propBoxes(prop, PROP_DEFINITIONS[prop.kind])),
  ];
  const separationPoint = (p: Player, point: Vec3): Vec3 | null => {
    const heights = [
        ...run.world.walkables,
        ...fixtureSurfaces(run.world.fixtures, run.route),
      ]
        .map((surface) => surfaceHeight(surface, point[0], point[2]))
        .filter((height): height is number => height !== null)
        .filter((height) => height <= p.position[1] + 0.45),
      height = heights.length ? Math.max(...heights) : null;
    if (height === null) return null;
    const supported: Vec3 = [point[0], height, point[2]];
    return safe(run, supported, playerWalls(p)) ? supported : null;
  };
  for (const p of run.players) {
    if (!p.connected) continue;
    if (p.lastInput && run.tick - p.inputTick <= 15) {
      Object.assign(
        p,
        movePlayer(
          p,
          p.lastInput,
          dt,
          playerWalls(p),
          [
            ...run.world.walkables,
            ...fixtureSurfaces(run.world.fixtures, run.route),
          ],
          playerSpeed(p.id, p.lastInput, run.props),
        ),
      );
    } else p.lastInput = null;
    if (!nearby(p.position, run.world.camp, 6))
      run.ready = run.ready.filter((id) => id !== p.id);
  }
  const pairs =
    carryState.get(run) ??
    new Map<string, { blocked: number; ignore: boolean }>();
  carryState.set(run, pairs);
  for (let i = 0; i < run.players.length; i++)
    for (let j = i + 1; j < run.players.length; j++) {
      const a = run.players[i],
        b = run.players[j],
        key = [a.id, b.id].sort().join("\0"),
        state = pairs.get(key) ?? { blocked: 0, ignore: false },
        separation = Math.hypot(
          a.position[0] - b.position[0],
          a.position[2] - b.position[2],
        );
      if (
        !a.connected ||
        !b.connected ||
        Math.abs(a.position[1] - b.position[1]) > 1.8
      ) {
        pairs.delete(key);
        continue;
      }
      if (state.ignore) {
        if (separation > 0.9) pairs.delete(key);
        else pairs.set(key, state);
        continue;
      }
      if (separation >= 0.7) {
        pairs.delete(key);
        continue;
      }
      const movedA = distance(a.position, before.get(a.id)!),
        movedB = distance(b.position, before.get(b.id)!);
      if (movedA > 0.001 !== movedB > 0.001) {
        state.blocked += dt;
        if (state.blocked >= 1.5) state.ignore = true;
        else if (movedA > movedB) a.position = [...before.get(a.id)!];
        else b.position = [...before.get(b.id)!];
      } else {
        const dx = a.position[0] - b.position[0] || 1,
          dz = a.position[2] - b.position[2],
          length = Math.hypot(dx, dz),
          push = (0.7 - separation) / 2;
        const nextA: Vec3 = [
            a.position[0] + (dx / length) * push,
            a.position[1],
            a.position[2] + (dz / length) * push,
          ],
          nextB: Vec3 = [
            b.position[0] - (dx / length) * push,
            b.position[1],
            b.position[2] - (dz / length) * push,
          ];
        const supportedA = separationPoint(a, nextA),
          supportedB = separationPoint(b, nextB);
        if (supportedA) a.position = supportedA;
        if (supportedB) b.position = supportedB;
      }
      pairs.set(key, state);
    }
  for (const prop of run.props) {
    const holders = prop.holders.flatMap((id, handle) => {
      const p = id
        ? run.players.find((value) => value.id === id && value.connected)
        : undefined;
      return p ? [{ p, handle }] : [];
    });
    if (!holders.length) continue;
    const definition = PROP_DEFINITIONS[prop.kind],
      targetPoint = ({ p, handle }: (typeof holders)[number]): Vec3 => {
        const offset = gripOffset(run, prop, handle, p);
        return p.position.map((value, axis) => value + offset[axis]) as Vec3;
      };
    let targetRotation = prop.pose.rotation;
    if (holders.length === 2) {
      const ordered = holders.sort((a, b) => a.handle - b.handle),
        points = ordered.map(targetPoint),
        localA = definition.handles[ordered[0].handle],
        localB = definition.handles[ordered[1].handle],
        incompatible = () =>
          Math.abs(distance(points[0], points[1]) - distance(localA, localB)) >
          0.15;
      if (incompatible()) {
        for (const { p } of holders) p.position = [...before.get(p.id)!];
        points.splice(0, 2, ...ordered.map(targetPoint));
        if (incompatible()) {
          for (const { p, handle } of holders) {
            prop.holders[handle] = null;
            clearGrips(run, prop, p.id);
          }
          prop.velocity = [0, 0, 0];
          prop.angularVelocity = [0, 0, 0];
          continue;
        }
      }
      targetRotation = alignLocalX(
        points[1].map((value, axis) => value - points[0][axis]) as Vec3,
      );
    } else targetRotation = yawPose([0, 0, 0], holders[0].p.yaw).rotation;
    const rotationDistance = quatAngle(prop.pose.rotation, targetRotation),
      rotationStep = Math.min(Math.PI * dt, rotationDistance),
      nextRotation = slerp(
        prop.pose.rotation,
        targetRotation,
        rotationDistance ? rotationStep / rotationDistance : 1,
      ),
      targets = holders.map(targetPoint),
      centers = holders.map(({ handle }, index) => {
        const offset = propPoint(definition.handles[handle], {
          position: [0, 0, 0],
          rotation: nextRotation,
        });
        return targets[index].map(
          (value, axis) => value - offset[axis],
        ) as Vec3;
      }),
      position = centers.reduce(
        (sum, center) =>
          sum.map(
            (value, axis) => value + center[axis] / centers.length,
          ) as Vec3,
        [0, 0, 0] as Vec3,
      ),
      desired: Pose = { position, rotation: nextRotation },
      endpointError = Math.max(
        ...holders.map(({ handle }, index) =>
          distance(
            propPoint(definition.handles[handle], desired),
            targets[index],
          ),
        ),
      );
    if (endpointError > 0.15) {
      for (const { p, handle } of holders) {
        p.position = [...before.get(p.id)!];
        if (
          distance(
            propPoint(definition.handles[handle], prop.pose),
            targetPoint({ p, handle }),
          ) > 0.15
        ) {
          prop.holders[handle] = null;
          clearGrips(run, prop, p.id);
        }
      }
      prop.velocity = [0, 0, 0];
      prop.angularVelocity = [0, 0, 0];
      continue;
    }
    const moved = sweepProp(run, prop, desired);
    const displacement = desired.position.map(
        (value, axis) => value - prop.pose.position[axis],
      ) as Vec3,
      oldPose = structuredClone(prop.pose);
    if (
      (moved.hit && Math.hypot(...prop.velocity) > 0.5) ||
      (!moved.hit &&
        rotationStep / dt > 2 &&
        Math.hypot(...prop.angularVelocity) <= 2)
    )
      spillCase(run, prop);
    prop.pose = moved.hit ? oldPose : moved.pose;
    prop.velocity = displacement.map((value) => value / dt) as Vec3;
    prop.angularVelocity = [0, rotationStep / dt, 0];
    if (moved.hit) {
      for (const { p } of holders) p.position = [...before.get(p.id)!];
      prop.velocity = [0, 0, 0];
      prop.angularVelocity = [0, 0, 0];
      if (run.tick - run.lastImpactTick > 15) {
        run.lastImpactTick = run.tick;
        event(run, "impact", holders[0].p, prop.pose.position);
        event(run, "noise", holders[0].p, prop.pose.position);
      }
    }
  }
  heldPose(run);
  run.spills = run.spills.filter(
    (s) => s.portions > 0 && s.untilTick > run.tick,
  );
  run.pings = run.pings.filter((p) => p.until > run.tick);
  run.events = run.events.filter((e) => e.tick >= run.tick - 1200);
  if (run.phase === "outing") {
    run.decisionSeconds += dt;
    if (run.decisionSeconds >= 0.1 - 1e-9) {
      run.decisionSeconds = Math.max(0, run.decisionSeconds - 0.1);
      for (const p of run.players)
        if (
          p.connected &&
          p.lastInput?.run &&
          !p.lastInput.crouch &&
          Math.hypot(p.lastInput.x, p.lastInput.z) > 0.1
        )
          event(run, "noise", p, p.position);
      stepAnimals(run, 0.1);
      heldPose(run);
    }
  }
  updateHats(run);
}

export async function attachPhysics(
  run: RunState,
): Promise<{ step(dt: number): void; dispose(): void }> {
  const physics = await createPhysics(
    run.world.physicsBoxes,
    run.tin,
    run.props,
    run.route,
    run.world.fixtures,
  );
  let revision = run.tinRevision,
    holder = run.tin.holder;
  return {
    dispose: () => physics.dispose(),
    step(dt) {
      if (run.paused || run.phase === "exhibition") return;
      if (
        revision !== run.tinRevision ||
        holder !== run.tin.holder ||
        run.tin.holder
      ) {
        physics.setTin(run.tin);
        revision = run.tinRevision;
        holder = run.tin.holder;
      }
      physics.setProps(run.props, run.route);
      const next = physics.step(dt);
      if (!run.tin.holder) {
        run.tin.pose = next.pose;
        run.tin.velocity = next.velocity;
        run.tin.angularVelocity = next.angularVelocity;
      }
      for (const value of next.props) {
        const prop = run.props.find((item) => item.id === value.id)!;
        if (!prop.holders.some(Boolean) && !prop.placed)
          Object.assign(prop, value);
      }
      for (const impact of next.impacts)
        for (const id of impact.sources) {
          const prop = run.props.find((p) => p.id === id);
          if (prop) spillCase(run, prop);
        }
      if (next.impacts.length && run.tick - run.lastImpactTick > 15) {
        run.lastImpactTick = run.tick;
        event(run, "noise", null, next.impacts[0].point);
        observe(
          run,
          "Dropped equipment clanged. Physical impacts can startle the heron.",
        );
      }
    },
  };
}

export function snapshot(run: RunState): Snapshot {
  const {
    version,
    tick,
    seconds,
    phase,
    paused,
    pauseReason,
    players,
    animals,
    tin,
    worldId,
    props,
    route,
    spills,
    hats,
    spareBait,
    baitPatches,
    observations,
    completed,
    album,
    ready,
    pings,
  } = run;
  return structuredClone({
    version,
    tick,
    seconds,
    phase,
    paused,
    pauseReason,
    players,
    animals,
    tin,
    worldId,
    props,
    route,
    spills,
    hats,
    spareBait,
    baitPatches,
    observations,
    completed,
    album,
    ready,
    pings,
  });
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}
export function makePhotoFrame(run: RunState, id: string): PhotoFrame {
  const p = player(run, id);
  return freeze(
    structuredClone({
      id: `${run.worldId}-photo-${run.nextPhoto++}`,
      tick: run.tick,
      photographer: id,
      camera: { position: eye(p), yaw: p.yaw, pitch: p.pitch, fov: 60 },
      players: run.players,
      animals: run.animals,
      tin: run.tin,
      worldId: run.worldId,
      props: run.props,
      route: run.route,
      spills: run.spills,
      hats: run.hats,
    }),
  );
}
function rotate(p: Vec3, q: Quat): Vec3 {
  const [x, y, z, w] = q,
    [a, b, c] = p,
    ix = w * a + y * c - z * b,
    iy = w * b + z * a - x * c,
    iz = w * c + x * b - y * a,
    iw = -x * a - y * b - z * c;
  return [
    ix * w - iw * x - iy * z + iz * y,
    iy * w - iw * y - iz * x + ix * z,
    iz * w - iw * z - ix * y + iy * x,
  ];
}
function tinBlocks(frame: PhotoFrame, from: Vec3, to: Vec3) {
  const q = frame.tin.pose.rotation,
    conjugate: Quat = [-q[0], -q[1], -q[2], q[3]];
  const local = (v: Vec3) =>
    rotate(v.map((n, i) => n - frame.tin.pose.position[i]) as Vec3, conjugate);
  return rayBlocked(local(from), local(to), [
    { id: "tin", min: TIN_HALF.map((n) => -n) as Vec3, max: TIN_HALF },
  ]);
}
export function evaluatePhoto(
  frame: PhotoFrame,
  world: ReserveBlueprint,
): PhotoVerdict {
  if (frame.worldId !== world.id) throw Error("Photo belongs to another world");
  const c = frame.camera,
    occluders = [
      ...world.placements.flatMap((p) => p.occluders),
      ...world.walls,
      ...fixtureBoxes(world.fixtures, frame.route),
    ],
    f = forward(c.yaw, c.pitch),
    right: Vec3 = [Math.cos(c.yaw), 0, -Math.sin(c.yaw)],
    up: Vec3 = [
      Math.sin(c.yaw) * Math.sin(c.pitch),
      Math.cos(c.pitch),
      Math.cos(c.yaw) * Math.sin(c.pitch),
    ];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    scale = Math.tan((c.fov * Math.PI) / 360);
  const reasons: string[] = [];
  const framed: { animal: Animal; center: number; reason: string | null }[] =
    [];
  const qualifies = (a: Animal) => {
    const points = subjectPoints(a, frame.tick).map((local) => {
      const v = rotate(local, a.pose.rotation);
      return v.map((n, i) => n + a.pose.position[i]) as Vec3;
    });
    const projected = points.map((point) => {
      const d = point.map((n, i) => n - c.position[i]) as Vec3,
        depth = dot(d, f);
      return {
        point,
        depth,
        x: dot(d, right) / ((depth * scale * 16) / 9),
        y: dot(d, up) / (depth * scale),
      };
    });
    const inside = projected.filter(
      (p) => p.depth > 0.1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1,
    );
    const feedback = {
      animal: a,
      center: Math.min(...inside.map((p) => Math.hypot(p.x, p.y))),
      reason: null as string | null,
    };
    if (inside.length >= 2) framed.push(feedback);
    if (projected.filter((p) => p.depth > 0.1).length < 2) {
      reasons.push("Subject is behind the camera");
      return false;
    }
    const heights = [0, SUBJECT_HEIGHT[a.species]].map((y) => {
      const point = rotate([0, y, 0], a.pose.rotation).map(
        (n, i) => n + a.pose.position[i] - c.position[i],
      ) as Vec3;
      return dot(point, up) / (dot(point, f) * scale);
    });
    if (Math.abs(heights[1] - heights[0]) / 2 < 0.03) {
      feedback.reason = "Move closer: subject is too small";
      reasons.push("Move closer: subject is too small");
      return false;
    }
    if (inside.length < 2) {
      reasons.push("Keep the subject inside the frame");
      return false;
    }
    if (
      inside.filter(
        (p) =>
          !rayBlocked(c.position, p.point, occluders) &&
          !tinBlocks(frame, c.position, p.point) &&
          !propRayBlocked(c.position, p.point, frame.props, PROP_DEFINITIONS),
      ).length < 2
    ) {
      feedback.reason = "Subject hidden by a solid object";
      reasons.push("Subject hidden by a solid object");
      return false;
    }
    return true;
  };
  const visible = frame.animals.filter(qualifies);
  const ids = new Set(frame.animals.map((a) => a.id));
  if (
    ids.size !== frame.animals.length ||
    frame.animals.some(
      (a) =>
        !world.residents.some((r) => r.id === a.id && r.species === a.species),
    )
  )
    throw Error("Photo resident identity mismatch");
  const visibleIds = new Set(visible.map((a) => a.id));
  const inspection = (a: Animal) =>
    a.species === "raccoon" &&
    a.behavior === "inspect" &&
    frame.tin.open &&
    nearby(a.pose.position, frame.tin.pose.position, 1.5);
  const credits = world.commissions
    .filter((commission) => {
      const pocket = world.pockets.find((p) => p.id === commission.pocket),
        anchor = pocket?.anchors.find((a) => a.id === commission.anchor),
        subjects = commission.subjects.map((id) =>
          frame.animals.find((a) => a.id === id),
        );
      if (
        !anchor ||
        !subjects.length ||
        subjects.some(
          (a) =>
            !a ||
            !visibleIds.has(a.id) ||
            !world.residents.some(
              (r) =>
                r.id === a.id &&
                r.home === pocket!.id &&
                r.anchors.includes(anchor.id),
            ),
        )
      )
        return false;
      const animals = subjects as Animal[],
        a = animals[0];
      if (commission.kind === "behavior" && animals.length === 1) {
        if (a.species === "raccoon")
          return (
            commission.behavior === "wash" &&
            a.behavior === "wash" &&
            nearby(a.pose.position, anchor.point, 1) &&
            frame.tin.open &&
            frame.tin.portions > 0 &&
            nearby(frame.tin.pose.position, anchor.point, 2)
          );
        if (a.species === "deer")
          return (
            commission.behavior === "graze" &&
            a.behavior === "graze" &&
            nearby(a.pose.position, anchor.point, 3)
          );
        if (a.species === "heron")
          return (
            commission.behavior === "preen" &&
            a.behavior === "preen" &&
            nearby(a.pose.position, anchor.point, 8)
          );
        return false;
      }
      if (
        commission.kind === "setup" &&
        animals.length === 1 &&
        ["raccoon", "deer", "heron"].includes(a.species)
      ) {
        const decoy = frame.props.find(
            (p) =>
              p.kind === "decoy" &&
              p.open &&
              !p.holders.some(Boolean) &&
              nearby(p.pose.position, anchor.point, 3),
          ),
          screen = frame.props.find(
            (p) =>
              p.kind === "screen" &&
              !p.holders.some(Boolean) &&
              distance(p.pose.position, frame.camera.position) < 4,
          );
        if (
          !decoy ||
          !screen ||
          !frame.tin.open ||
          !nearby(frame.tin.pose.position, anchor.point, 3) ||
          !nearby(a.pose.position, anchor.point, 3)
        )
          return false;
        return a.species === "raccoon"
          ? inspection(a)
          : a.species === "heron"
            ? a.behavior === "display"
            : a.behavior === "investigate" &&
              nearby(a.pose.position, decoy.pose.position, 2) &&
              nearby(a.target, decoy.pose.position, 2);
      }
      if (commission.kind === "pair" && animals.length === 2) {
        const raccoon = animals.find((a) => a.species === "raccoon"),
          heron = animals.find((a) => a.species === "heron");
        return (
          !!raccoon &&
          !!heron &&
          inspection(raccoon) &&
          heron.behavior === "display" &&
          nearby(heron.pose.position, anchor.point, 3) &&
          distance(flat(raccoon.pose.position), flat(heron.pose.position)) >=
            3 &&
          nearby(raccoon.pose.position, heron.pose.position, 8)
        );
      }
      // The remaining categories and nine new routines are implemented in Task 5.
      return false;
    })
    .map((commission) => commission.id);
  const subject = framed.sort((a, b) => a.center - b.center)[0];
  const hint =
    subject &&
    world.commissions.find((c) => c.subjects.includes(subject.animal.id));
  return {
    credits,
    reason: credits.length
      ? "Commission photograph accepted"
      : (subject?.reason ??
        (subject
          ? `${subject.animal.species}: ${hint?.instructions ?? "Wildlife photograph recorded"}`
          : (reasons[0] ?? "Find a wildlife subject in the frame"))),
  };
}
