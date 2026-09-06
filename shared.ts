import type { ReserveBlueprint } from "./world.ts";
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Pose = { position: Vec3; rotation: Quat };
export type Box = { id: string; min: Vec3; max: Vec3 };
export type CrewSlot = 0 | 1 | 2 | 3;
export type Habitat = "woodland" | "clearing" | "wetland";
export type Species =
  | "raccoon"
  | "deer"
  | "heron"
  | "fox"
  | "rabbit"
  | "squirrel"
  | "beaver"
  | "otter"
  | "badger"
  | "owl"
  | "woodpecker"
  | "mallard";
export type Behavior =
  | "wander"
  | "approach"
  | "inspect"
  | "carry"
  | "investigate"
  | "feed"
  | "alert"
  | "retreat"
  | "settle"
  | "display"
  | "graze"
  | "wash"
  | "hat-reach"
  | "preen"
  | "pounce"
  | "nibble"
  | "cache"
  | "gnaw"
  | "groom"
  | "dig"
  | "roost"
  | "tap"
  | "dabble";
export type Assignment =
  | "raccoon-inspect"
  | "heron-display"
  | "pond-pair"
  | "raccoon-wash"
  | "deer-graze"
  | "deer-decoy"
  | "heron-preen";
export type WorldConfig = {
  content: "forest-mvp-1";
  seed: number;
  sites: Record<Habitat, 0 | 1>;
  assignments: Assignment[];
};
export type FieldProp = {
  id: string;
  kind: "case" | "plank" | "screen" | "decoy";
  pose: Pose;
  velocity: Vec3;
  angularVelocity: Vec3;
  holders: [string | null, string | null];
  placed: boolean;
  open: boolean;
  spillUntilTick: number;
};
export type PropDefinition = {
  bounds: [Vec3, Vec3];
  solids: { center: Vec3; size: Vec3 }[];
  handles: Vec3[];
  usePoints?: { part: "lid" | "bait-cup"; point: Vec3 }[];
};
export type EquipmentTarget = {
  propId: string;
  handle: number | null;
  part: "handle" | "lid" | "bait-cup";
  point: Vec3;
};
export type RouteState = {
  crossing: "left" | "right" | null;
  gateOpen: boolean;
};
export type FixtureState = Record<
  string,
  { open: boolean; seat: string | null }
>;
export type Spill = {
  id: string;
  position: Vec3;
  portions: number;
  untilTick: number;
};
export type CrewHat = {
  owner: string;
  carrier: "owner" | "ground" | `animal:${string}`;
  position: Vec3;
  untilTick: number;
  protectedUntilTick: number;
};
export type Walkable = {
  id: string;
  min: Vec3;
  max: Vec3;
  axis: 0 | 2;
  heightStart: number;
  heightEnd: number;
};
export type Input = {
  seq: number;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  run: boolean;
  crouch: boolean;
};
export type Player = {
  id: string;
  name: string;
  slot: CrewSlot;
  position: Vec3;
  yaw: number;
  pitch: number;
  lastSeq: number;
  connected: boolean;
  lastInput: Input | null;
  inputTick: number;
};
export type Animal = {
  id: string;
  species: Species;
  behavior: Behavior;
  pose: Pose;
  remaining: number;
  target: Vec3;
};
export type Tin = {
  pose: Pose;
  velocity: Vec3;
  angularVelocity: Vec3;
  holder: string | null;
  portions: number;
  open: boolean;
};
export type PhotoFrame = {
  id: string;
  tick: number;
  photographer: string;
  camera: { position: Vec3; yaw: number; pitch: number; fov: number };
  players: Player[];
  animals: Animal[];
  tin: Tin;
  worldId: string;
  props: FieldProp[];
  route: FixtureState;
  spills: Spill[];
  hats: CrewHat[];
};
export type PhotoVerdict = { credits: string[]; reason: string };
export type PhotoRecord = {
  id: string;
  photographer: string;
  tick: number;
  credits: string[];
  assists: string[];
  favorites: string[];
  incident: "spill" | "hat" | null;
  thumbnail: "pending" | "ready";
};
export type Snapshot = {
  version: 3;
  tick: number;
  seconds: number;
  phase: "camp" | "outing" | "exhibition";
  paused: boolean;
  pauseReason: string;
  players: Player[];
  animals: Animal[];
  tin: Tin;
  worldId: string;
  props: FieldProp[];
  route: FixtureState;
  spills: Spill[];
  hats: CrewHat[];
  spareBait: number;
  baitPatches: Record<string, number>;
  observations: string[];
  completed: string[];
  album: PhotoRecord[];
  ready: string[];
  pings: { player: string; point: Vec3; until: number }[];
};
export type ClientMessage = { worldId: string } & (
  | { type: "input"; value: Input }
  | {
      type:
        | "interact"
        | "use"
        | "photo"
        | "recover"
        | "drop"
        | "start"
        | "pause"
        | "resume"
        | "ready-end"
        | "finish"
        | "save-and-stop";
      seq: number;
    }
  | { type: "ping"; seq: number; point: Vec3 }
  | { type: "favorite"; seq: number; photoId: string; selected: boolean }
);
export type ServerMessage =
  | { type: "world"; id: string; hash: string; blueprint: ReserveBlueprint }
  | { type: "snapshot"; value: Snapshot }
  | { type: "photo"; frame: PhotoFrame; verdict: PhotoVerdict }
  | { type: "notice"; text: string }
  | { type: "welcome"; playerId: string; host: boolean }
  | {
      type: "cue";
      worldId: string;
      id: string;
      kind: "whistle" | "rattle" | "shutter" | "impact" | "alert";
      source: string;
      position: Vec3;
    };
export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const pose = (position: Vec3): Pose => ({
  position: [...position],
  rotation: [0, 0, 0, 1],
});
export const propPoint = (point: Vec3, value: Pose): Vec3 => {
  const [x, y, z, w] = value.rotation,
    tx = 2 * (y * point[2] - z * point[1]),
    ty = 2 * (z * point[0] - x * point[2]),
    tz = 2 * (x * point[1] - y * point[0]);
  return [
    value.position[0] + point[0] + w * tx + y * tz - z * ty,
    value.position[1] + point[1] + w * ty + z * tx - x * tz,
    value.position[2] + point[2] + w * tz + x * ty - y * tx,
  ];
};
export function heldProp(playerId: string, props: FieldProp[]) {
  return props.find((prop) => prop.holders.includes(playerId));
}
function closestTarget(
  player: Player,
  props: FieldProp[],
  definitions: Record<FieldProp["kind"], PropDefinition>,
  occluders: Box[],
  parts: "handles" | "usePoints",
): EquipmentTarget | null {
  const choices: EquipmentTarget[] = [];
  for (const prop of props) {
    const definition = definitions[prop.kind];
    if (!definition || (parts === "handles" && prop.placed)) continue;
    if (parts === "handles") {
      definition.handles.forEach((point, handle) => {
        if (prop.holders[handle] === null)
          choices.push({
            propId: prop.id,
            handle,
            part: "handle",
            point: propPoint(point, prop.pose),
          });
      });
    } else
      for (const { part, point } of definition.usePoints?.filter(
        ({ part }) => part === "bait-cup",
      ) ?? [])
        choices.push({
          propId: prop.id,
          handle: null,
          part,
          point: propPoint(point, prop.pose),
        });
  }
  return (
    choices
      .filter(
        (target) =>
          distance(eye(player), target.point) <= 2 &&
          !rayBlocked(eye(player), target.point, [
            ...occluders,
            ...props.flatMap((prop) =>
              propBoxes(prop, definitions[prop.kind]).filter(
                (box) =>
                  prop.id !== target.propId ||
                  !target.point.every(
                    (value, axis) =>
                      value >= box.min[axis] && value <= box.max[axis],
                  ),
              ),
            ),
          ]),
      )
      .sort(
        (a, b) =>
          distance(eye(player), a.point) - distance(eye(player), b.point),
      )[0] ?? null
  );
}
export function equipmentTarget(
  player: Player,
  props: FieldProp[],
  definitions: Record<FieldProp["kind"], PropDefinition>,
  occluders: Box[],
) {
  return closestTarget(player, props, definitions, occluders, "handles");
}
export function equipmentUseTarget(
  player: Player,
  props: FieldProp[],
  definitions: Record<FieldProp["kind"], PropDefinition>,
  occluders: Box[],
) {
  if (heldProp(player.id, props)) return null;
  return closestTarget(player, props, definitions, occluders, "usePoints");
}
export function recoveryTarget(
  player: Player,
  state: Pick<Snapshot, "props" | "spills" | "hats" | "spareBait" | "tick">,
  definitions: Record<FieldProp["kind"], PropDefinition>,
  walls: Box[],
): { kind: "hat" | "spill"; id: string; point: Vec3 } | null {
  if (heldProp(player.id, state.props)) return null;
  const candidates = [
    ...state.hats
      .filter((h) => h.carrier !== "owner")
      .map((h) => ({ kind: "hat" as const, id: h.owner, point: h.position })),
    ...state.spills
      .filter(
        (s) =>
          state.spareBait < 8 && s.portions > 0 && s.untilTick > state.tick,
      )
      .map((s) => ({ kind: "spill" as const, id: s.id, point: s.position })),
  ];
  return (
    candidates
      .filter(
        (c) =>
          distance(eye(player), c.point) <= 2 &&
          !rayBlocked(eye(player), c.point, walls) &&
          !propRayBlocked(eye(player), c.point, state.props, definitions),
      )
      .sort(
        (a, b) =>
          distance(eye(player), a.point) - distance(eye(player), b.point),
      )[0] ?? null
  );
}
export function propBoxes(prop: FieldProp, definition: PropDefinition): Box[] {
  const [x, y, z, w] = prop.pose.rotation,
    matrix = [
      [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ];
  return definition.solids.map((solid, index) => {
    const center = propPoint(solid.center, prop.pose),
      half = solid.size.map((value) => value / 2) as Vec3,
      extent = matrix.map((row) =>
        row.reduce((sum, value, axis) => sum + Math.abs(value) * half[axis], 0),
      ) as Vec3;
    return {
      id: `${prop.id}-solid-${index}`,
      min: center.map((value, axis) => value - extent[axis]) as Vec3,
      max: center.map((value, axis) => value + extent[axis]) as Vec3,
    };
  });
}
export function propRayBlocked(
  from: Vec3,
  to: Vec3,
  props: FieldProp[],
  definitions: Record<FieldProp["kind"], PropDefinition>,
) {
  return props.some((prop) => {
    const [x, y, z, w] = prop.pose.rotation;
    const local = (point: Vec3) =>
      propPoint(point.map((v, i) => v - prop.pose.position[i]) as Vec3, {
        position: [0, 0, 0],
        rotation: [-x, -y, -z, w],
      });
    return rayBlocked(
      local(from),
      local(to),
      definitions[prop.kind].solids.map((solid, i) => ({
        id: `${prop.id}-${i}`,
        min: solid.center.map((v, a) => v - solid.size[a] / 2) as Vec3,
        max: solid.center.map((v, a) => v + solid.size[a] / 2) as Vec3,
      })),
    );
  });
}
export function playerSpeed(
  playerId: string,
  input: Input,
  props: FieldProp[],
) {
  const held = heldProp(playerId, props);
  if (held && held.kind !== "decoy")
    return held.holders.filter(Boolean).length === 2 ? 2 : 0.8;
  return input.crouch ? 1.4 : input.run ? 5 : 3;
}
export function eye(p: Player): Vec3 {
  return [
    p.position[0],
    p.position[1] + (p.lastInput?.crouch ? 0.9 : 1.6),
    p.position[2],
  ];
}
export function forward(yaw: number, pitch = 0): Vec3 {
  return [
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ];
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Expected object");
  return v as Record<string, unknown>;
}
function keys(v: Record<string, unknown>, allowed: string[]) {
  if (
    Object.keys(v).length !== allowed.length ||
    Object.keys(v).some((k) => !allowed.includes(k))
  )
    throw Error("Unexpected fields");
}
function number(v: unknown, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error("Invalid number");
  return v;
}
export function parseMessage(value: unknown): ClientMessage {
  const m = object(value);
  if (typeof m.worldId !== "string" || !/^[-_a-zA-Z0-9]{1,64}$/.test(m.worldId))
    throw Error("Invalid world ID");
  if (m.type === "input") {
    keys(m, ["type", "worldId", "value"]);
    const v = object(m.value);
    keys(v, ["seq", "x", "z", "yaw", "pitch", "run", "crouch"]);
    number(v.seq, 1, Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(v.seq)) throw Error("Invalid sequence");
    number(v.x, -1, 1);
    number(v.z, -1, 1);
    number(v.yaw, -Math.PI * 4, Math.PI * 4);
    number(v.pitch, -1.45, 1.45);
    if (typeof v.run !== "boolean" || typeof v.crouch !== "boolean")
      throw Error("Invalid buttons");
  } else {
    const names = [
      "interact",
      "use",
      "photo",
      "recover",
      "drop",
      "start",
      "pause",
      "resume",
      "ready-end",
      "finish",
      "save-and-stop",
      "ping",
      "favorite",
    ];
    if (typeof m.type !== "string" || !names.includes(m.type))
      throw Error("Unknown command");
    keys(
      m,
      m.type === "ping"
        ? ["type", "worldId", "seq", "point"]
        : m.type === "favorite"
          ? ["type", "worldId", "seq", "photoId", "selected"]
          : ["type", "worldId", "seq"],
    );
    number(m.seq, 1, Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(m.seq)) throw Error("Invalid sequence");
    if (m.type === "favorite") {
      if (
        typeof m.photoId !== "string" ||
        !/^[-_a-zA-Z0-9]{1,80}$/.test(m.photoId)
      )
        throw Error("Invalid photo ID");
      if (typeof m.selected !== "boolean")
        throw Error("Invalid favorite selection");
    }
    if (m.type === "ping") {
      if (!Array.isArray(m.point) || m.point.length !== 3)
        throw Error("Invalid point");
      m.point.forEach((n) => number(n, -512, 512));
    }
  }
  return structuredClone(value) as ClientMessage;
}
export function rayBlocked(from: Vec3, to: Vec3, boxes: Box[]): boolean {
  return boxes.some((b) => {
    let low = 0,
      high = 1;
    for (let i = 0; i < 3; i++) {
      const d = to[i] - from[i];
      if (Math.abs(d) < 1e-9) {
        if (from[i] < b.min[i] || from[i] > b.max[i]) return false;
        continue;
      }
      let a = (b.min[i] - from[i]) / d,
        c = (b.max[i] - from[i]) / d;
      if (a > c) [a, c] = [c, a];
      low = Math.max(low, a);
      high = Math.min(high, c);
      if (low > high) return false;
    }
    return high > 0.001 && low < 0.995;
  });
}
export function surfaceHeight(
  surface: Walkable,
  x: number,
  z: number,
): number | null {
  if (
    x < surface.min[0] ||
    x > surface.max[0] ||
    z < surface.min[2] ||
    z > surface.max[2]
  )
    return null;
  const start = surface.min[surface.axis],
    length = surface.max[surface.axis] - start,
    t = length ? ((surface.axis === 0 ? x : z) - start) / length : 0;
  return surface.heightStart + (surface.heightEnd - surface.heightStart) * t;
}
export function movePlayer(
  player: Player,
  input: Input,
  dt: number,
  walls: Box[],
  surfaces: Walkable[] = [],
  speedLimit?: number,
): Player {
  const p = {
    ...player,
    position: [...player.position] as Vec3,
    yaw: input.yaw,
    pitch: input.pitch,
  };
  const len = Math.max(1, Math.hypot(input.x, input.z));
  const speed = speedLimit ?? (input.crouch ? 1.4 : input.run ? 5 : 3);
  const x =
    ((input.x * Math.cos(input.yaw) + input.z * Math.sin(input.yaw)) / len) *
    speed;
  const z =
    ((-input.x * Math.sin(input.yaw) + input.z * Math.cos(input.yaw)) / len) *
    speed;
  const penetration = (point: Vec3, height: number, box: Box) => {
    if (box.max[1] <= height + 0.15 || box.min[1] >= height + 1.8)
      return -Infinity;
    return Math.min(
      point[0] - (box.min[0] - 0.35),
      box.max[0] + 0.35 - point[0],
      point[2] - (box.min[2] - 0.35),
      box.max[2] + 0.35 - point[2],
    );
  };
  const time = Math.max(0, Math.min(0.25, dt)),
    steps = Math.max(1, Math.ceil((speed * time) / 0.1));
  for (let n = 0; n < steps; n++)
    for (const axis of [0, 2]) {
      const next = p.position[axis] + ((axis === 0 ? x : z) * time) / steps;
      const point = [...p.position];
      point[axis] = next;
      const heights = surfaces
        .map((surface) => surfaceHeight(surface, point[0], point[2]))
        .filter((height): height is number => height !== null)
        .filter((height) => height <= p.position[1] + 0.45);
      const height = heights.length ? Math.max(...heights) : null;
      if (
        (!surfaces.length || height !== null) &&
        !walls.some((box) => {
          const next = penetration(point as Vec3, height ?? p.position[1], box),
            current = penetration(p.position, p.position[1], box);
          if (next <= 0) return false;
          if (current <= 0) return true;
          const centerX = (box.min[0] + box.max[0]) / 2,
            centerZ = (box.min[2] + box.max[2]) / 2,
            distance = (value: number[]) =>
              (value[0] - centerX) ** 2 + (value[2] - centerZ) ** 2;
          return distance(point) <= distance(p.position) + 1e-9;
        })
      ) {
        p.position[axis] = next;
        if (height !== null) p.position[1] = height;
      }
    }
  return p;
}
