import { randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  copyFile,
  stat,
} from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunState } from "./game.ts";
import { parseMessage, surfaceHeight, distance } from "./shared.ts";
import { PLANK_PLACEMENTS, WALKABLES, WALLS, routeSurfaces } from "./level.ts";
import { chooseOuting } from "./encounters.ts";

export type ServerConfig = {
  host: string;
  port: number;
  origin: string;
  dataDir: string;
  webDir: string;
};
export type RoomCredentials = {
  version: 1;
  joinSecret: string;
  hostSecret: string;
  hostId: string | null;
  sessions: Record<
    string,
    { playerId: string; name: string; pending: boolean }
  >;
};
const moduleDir = dirname(fileURLToPath(import.meta.url));
const LIMIT = 8 * 1024 * 1024;
export const within = (root: string, path: string) => {
  const r = relative(root, path);
  return r === "" || (!r.startsWith("..") && !isAbsolute(r));
};
export function loadConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const host = env.WU_BIND_HOST ?? "127.0.0.1";
  if (!/^[a-zA-Z0-9.:[\]-]{1,253}$/.test(host))
    throw Error("Invalid bind host");
  const rawPort = env.WU_PORT ?? "4310";
  if (!/^\d+$/.test(rawPort)) throw Error("Invalid port");
  const port = Number(rawPort);
  if (port < 1 || port > 65535) throw Error("Invalid port");
  const origin =
    env.WU_PUBLIC_ORIGIN ??
    `http://${host.includes(":") && !host.startsWith("[") ? `[${host}]` : host}:${port}`;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw Error("Invalid public origin");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.origin !== origin ||
    url.username ||
    url.password
  )
    throw Error("Public origin must be an exact HTTP(S) origin without a path");
  const dataDir = resolve(moduleDir, env.WU_DATA_DIR ?? "data"),
    webDir = resolve(moduleDir, env.WU_WEB_DIR ?? "web");
  if (within(webDir, dataDir) || within(dataDir, webDir))
    throw Error("Private data and public web directories must not overlap");
  return { host, port, origin, dataDir, webDir };
}

function obj(value: unknown, fields?: string[]): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid save object");
  const v = value as Record<string, any>;
  if (
    fields &&
    (Object.keys(v).length !== fields.length ||
      Object.keys(v).some((k) => !fields.includes(k)))
  )
    throw Error("Unknown or missing save fields");
  return v;
}
function text(value: unknown, max = 128) {
  if (typeof value !== "string" || value.length > max)
    throw Error("Invalid saved text");
}
function id(value: unknown) {
  if (typeof value !== "string" || !/^[-_a-zA-Z0-9]{1,80}$/.test(value))
    throw Error("Invalid saved identifier");
}
function num(
  value: unknown,
  min = -Number.MAX_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw Error("Invalid saved number");
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  num(value, min, max);
  if (!Number.isSafeInteger(value)) throw Error("Invalid saved integer");
}
function bool(value: unknown) {
  if (typeof value !== "boolean") throw Error("Invalid saved boolean");
}
function one(value: unknown, choices: string[]) {
  if (typeof value !== "string" || !choices.includes(value))
    throw Error("Invalid saved enum");
}
function list(value: unknown, max: number, check: (v: any) => void) {
  if (!Array.isArray(value) || value.length > max)
    throw Error("Invalid saved list");
  value.forEach(check);
}
function vector(value: unknown, size = 3) {
  if (!Array.isArray(value) || value.length !== size)
    throw Error("Invalid saved vector");
  value.forEach((v) => num(v, -10000, 10000));
}
function position(value: unknown) {
  if (!Array.isArray(value) || value.length !== 3)
    throw Error("Invalid saved position");
  value.forEach((v) => num(v, -100, 100));
}
function pose(value: unknown) {
  const v = obj(value, ["position", "rotation"]);
  position(v.position);
  vector(v.rotation, 4);
  const n = Math.hypot(...v.rotation);
  if (n < 0.9 || n > 1.1) throw Error("Invalid saved quaternion");
}
const assignments = [
  "raccoon-inspect",
  "heron-display",
  "pond-pair",
  "raccoon-wash",
  "deer-graze",
  "deer-decoy",
  "heron-preen",
];
function player(value: unknown) {
  const v = obj(value, [
    "id",
    "name",
    "slot",
    "position",
    "yaw",
    "pitch",
    "lastSeq",
    "connected",
    "lastInput",
    "inputTick",
  ]);
  id(v.id);
  text(v.name, 24);
  integer(v.slot, 0, 3);
  position(v.position);
  num(v.yaw, -Math.PI * 4, Math.PI * 4);
  num(v.pitch, -1.45, 1.45);
  integer(v.lastSeq);
  bool(v.connected);
  integer(v.inputTick);
  if (v.lastInput !== null) parseMessage({ type: "input", value: v.lastInput });
}
function animal(value: unknown) {
  const v = obj(value, [
    "id",
    "species",
    "behavior",
    "pose",
    "remaining",
    "target",
  ]);
  id(v.id);
  one(v.species, ["raccoon", "heron", "deer"]);
  if (v.id !== v.species) throw Error("Invalid animal identity");
  one(v.behavior, [
    "wander",
    "approach",
    "inspect",
    "carry",
    "investigate",
    "feed",
    "alert",
    "retreat",
    "settle",
    "display",
    "graze",
    "wash",
    "preen",
    "hat-reach",
  ]);
  pose(v.pose);
  num(v.remaining, -1, 1e8);
  position(v.target);
}
function tin(value: unknown) {
  const v = obj(value, [
    "pose",
    "velocity",
    "angularVelocity",
    "holder",
    "portions",
    "open",
  ]);
  pose(v.pose);
  vector(v.velocity);
  vector(v.angularVelocity);
  if (v.holder !== null && v.holder !== "animal:raccoon") id(v.holder);
  integer(v.portions, 0, 4);
  bool(v.open);
}
function world(value: unknown) {
  const v = obj(value, ["content", "seed", "sites", "assignments"]);
  if (v.content !== "forest-mvp-1") throw Error("Incompatible world content");
  integer(v.seed, 0, 0xffffffff);
  const sites = obj(v.sites, ["woodland", "clearing", "wetland"]);
  for (const site of Object.values(sites)) integer(site, 0, 1);
  list(v.assignments, 4, (x) => one(x, assignments));
  if (
    v.assignments.length !== 4 ||
    new Set(v.assignments).size !== 4 ||
    !v.assignments.includes("pond-pair") ||
    !v.assignments.some((x: string) =>
      ["raccoon-inspect", "raccoon-wash"].includes(x),
    ) ||
    !v.assignments.some((x: string) =>
      ["deer-graze", "deer-decoy"].includes(x),
    ) ||
    !v.assignments.some((x: string) =>
      ["heron-display", "heron-preen"].includes(x),
    )
  )
    throw Error("Invalid saved assignment selection");
  const expected = chooseOuting(v.seed);
  if (
    Object.keys(expected.sites).some(
      (key) =>
        v.sites[key] !== expected.sites[key as keyof typeof expected.sites],
    ) ||
    expected.assignments.some((id, i) => v.assignments[i] !== id)
  )
    throw Error("Saved selection does not match world seed");
}
const propKinds = new Map([
  ["field-case", "case"],
  ["crossing-plank", "plank"],
  ["folding-screen", "screen"],
  ["wildlife-decoy", "decoy"],
]);
function props(value: unknown, playerIds: Set<string>) {
  list(value, 4, (x) => {
    const v = obj(x, [
      "id",
      "kind",
      "pose",
      "velocity",
      "angularVelocity",
      "holders",
      "placed",
      "open",
      "spillUntilTick",
    ]);
    id(v.id);
    if (propKinds.get(v.id) !== v.kind) throw Error("Invalid saved field prop");
    pose(v.pose);
    vector(v.velocity);
    vector(v.angularVelocity);
    if (!Array.isArray(v.holders) || v.holders.length !== 2)
      throw Error("Invalid saved prop holders");
    for (const holder of v.holders)
      if (holder !== null && !playerIds.has(holder))
        throw Error("Missing saved prop holder");
    bool(v.placed);
    bool(v.open);
    integer(v.spillUntilTick);
  });
  const values = value as any[];
  if (values.length !== 4 || new Set(values.map((x) => x.id)).size !== 4)
    throw Error("Invalid saved field prop inventory");
}
function route(value: unknown) {
  const v = obj(value, ["crossing", "gateOpen"]);
  if (v.crossing !== null) one(v.crossing, ["left", "right"]);
  bool(v.gateOpen);
}
function plankRoute(propValues: any[], routeValue: any) {
  const plank = propValues.find((prop) => prop.kind === "plank"),
    crossing = routeValue.crossing as "left" | "right" | null,
    expected = crossing ? PLANK_PLACEMENTS[crossing] : null;
  if (
    !plank ||
    plank.placed !== Boolean(crossing) ||
    (expected &&
      (plank.holders.some(Boolean) ||
        plank.pose.position.some(
          (value: number, axis: number) =>
            Math.abs(value - expected.position[axis]) > 1e-6,
        ) ||
        plank.pose.rotation.some(
          (value: number, axis: number) =>
            Math.abs(value - expected.rotation[axis]) > 1e-6,
        )))
  )
    throw Error("Saved plank and crossing route disagree");
}
function spills(value: unknown) {
  const seen = new Set<string>();
  list(value, 8, (x) => {
    const v = obj(x, ["id", "position", "portions", "untilTick"]);
    id(v.id);
    if (seen.has(v.id)) throw Error("Duplicate saved spill");
    seen.add(v.id);
    position(v.position);
    integer(v.portions, 1, 1);
    integer(v.untilTick);
  });
}
function hats(value: unknown, playerIds: Set<string>) {
  const owners = new Set<string>();
  list(value, 4, (x) => {
    const v = obj(x, [
      "owner",
      "carrier",
      "position",
      "untilTick",
      "protectedUntilTick",
    ]);
    id(v.owner);
    if (!playerIds.has(v.owner) || owners.has(v.owner))
      throw Error("Invalid saved hat owner");
    owners.add(v.owner);
    one(v.carrier, ["owner", "raccoon", "ground"]);
    position(v.position);
    integer(v.untilTick);
    integer(v.protectedUntilTick);
  });
  if (owners.size !== playerIds.size) throw Error("Missing saved crew hat");
}
function incidents(v: Record<string, any>) {
  for (const prop of v.props) {
    integer(prop.spillUntilTick, 0, v.tick + 120);
    if (prop.kind !== "case" && prop.spillUntilTick !== 0)
      throw Error("Only the case has a spill guard");
  }
  const supported = (point: any) =>
    !WALLS.some(
      (b) =>
        b.max[1] > point[1] + 0.16 &&
        b.min[1] < point[1] + 1.7 &&
        point[0] > b.min[0] - 0.3 &&
        point[0] < b.max[0] + 0.3 &&
        point[2] > b.min[2] - 0.3 &&
        point[2] < b.max[2] + 0.3,
    ) &&
    [...WALKABLES, ...routeSurfaces(v.route)].some((s) => {
      const height = surfaceHeight(s, point[0], point[2]);
      return height !== null && Math.abs(point[1] - height) < 0.01;
    });
  for (const spill of v.spills) {
    integer(spill.untilTick, v.tick + 1, v.tick + 3600);
    if (!supported(spill.position))
      throw Error("Saved spill lacks ground support");
  }
  if (v.hats.filter((h: any) => h.carrier === "raccoon").length > 1)
    throw Error("Multiple raccoon hats");
  for (const hat of v.hats) {
    integer(hat.protectedUntilTick, 0, v.tick + 3600);
    if (hat.carrier === "raccoon") {
      integer(hat.untilTick, v.tick + 1, v.tick + 1800);
      if (
        hat.protectedUntilTick !== hat.untilTick + 1800 ||
        !v.players.some((p: any) => p.id === hat.owner && p.connected)
      )
        throw Error("Contradictory stolen hat");
    } else if (hat.untilTick !== 0)
      throw Error("Only a stolen hat has a drop deadline");
    if (hat.carrier === "ground" && !supported(hat.position))
      throw Error("Saved hat lacks ground support");
  }
  for (const a of v.animals)
    if (a.behavior === "hat-reach") {
      num(a.remaining, 0.000001, 1.2);
      if (
        a.species !== "raccoon" ||
        distance(a.pose.position, a.target) > 1.2 + 1e-6 ||
        v.hats.some((h: any) => h.carrier === "raccoon") ||
        !v.players.some(
          (p: any) =>
            p.connected &&
            distance(p.position, a.target) < 0.8 &&
            v.hats.some(
              (h: any) =>
                h.owner === p.id &&
                h.carrier === "owner" &&
                h.protectedUntilTick <= v.tick,
            ),
        )
      )
        throw Error("Contradictory saved hat reach");
    }
}
function photo(value: unknown, crew: Map<string, number>) {
  const v = obj(value, [
    "id",
    "tick",
    "photographer",
    "camera",
    "players",
    "animals",
    "tin",
    "world",
    "props",
    "route",
    "spills",
    "hats",
  ]);
  id(v.id);
  integer(v.tick);
  id(v.photographer);
  const c = obj(v.camera, ["position", "yaw", "pitch", "fov"]);
  position(c.position);
  num(c.yaw, -Math.PI * 4, Math.PI * 4);
  num(c.pitch, -1.45, 1.45);
  num(c.fov, 1, 179);
  list(v.players, 4, player);
  list(v.animals, 3, animal);
  if (
    v.animals.length !== 3 ||
    new Set(v.animals.map((a: any) => a.id)).size !== 3
  )
    throw Error("Invalid frame animals");
  tin(v.tin);
  const ids = new Set<string>(v.players.map((p: any) => p.id));
  if (
    ids.size !== v.players.length ||
    new Set(v.players.map((p: any) => p.slot)).size !== v.players.length ||
    v.players.some((p: any) => crew.get(p.id) !== p.slot)
  )
    throw Error("Invalid saved frame crew identity or slot");
  if (
    v.tin.holder !== null &&
    v.tin.holder !== "animal:raccoon" &&
    !ids.has(v.tin.holder)
  )
    throw Error("Missing saved frame tin holder");
  if (!ids.has(v.photographer)) throw Error("Missing saved frame photographer");
  world(v.world);
  props(v.props, ids);
  route(v.route);
  plankRoute(v.props, v.route);
  spills(v.spills);
  hats(v.hats, ids);
  incidents(v);
}
export function validJPEG(bytes: Uint8Array) {
  if (
    bytes.length < 8 ||
    bytes.length > 65536 ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes.at(-2) !== 255 ||
    bytes.at(-1) !== 217
  )
    return false;
  const word = (offset: number) => bytes[offset] * 256 + bytes[offset + 1];
  let offset = 2,
    frame = false;
  while (offset < bytes.length - 2) {
    if (bytes[offset++] !== 255) return false;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++],
      length = word(offset);
    if (
      !Number.isFinite(length) ||
      length < 2 ||
      offset + length > bytes.length - 2
    )
      return false;
    if (marker === 218)
      return frame && length >= 6 && offset + length < bytes.length - 2;
    if ([192, 193, 194].includes(marker)) {
      const height = word(offset + 3),
        width = word(offset + 5),
        components = bytes[offset + 7];
      if (
        frame ||
        bytes[offset + 2] !== 8 ||
        ![1, 3].includes(components) ||
        length !== 8 + 3 * components ||
        width < 1 ||
        width > 640 ||
        height < 1 ||
        height > 360
      )
        return false;
      frame = true;
    }
    offset += length;
  }
  return false;
}
function validateRun(
  value: unknown,
  images: Map<string, Uint8Array>,
): RunState {
  const v = obj(value, [
    "version",
    "tick",
    "seconds",
    "phase",
    "paused",
    "pauseReason",
    "players",
    "animals",
    "tin",
    "world",
    "props",
    "route",
    "spills",
    "hats",
    "spareBait",
    "baitPatch",
    "observations",
    "completed",
    "album",
    "ready",
    "pings",
    "pendingPhotos",
    "hostId",
    "events",
    "cooldowns",
    "animalMemory",
    "decisionSeconds",
    "nextPhoto",
    "tinRevision",
    "lastImpactTick",
    "failedSetups",
  ]);
  if (v.version === 1)
    throw Error("Incompatible run version 1; expected version 2");
  if (v.version !== 2) throw Error("Unsupported run version");
  integer(v.tick);
  num(v.seconds, 0);
  one(v.phase, ["camp", "outing", "exhibition"]);
  bool(v.paused);
  text(v.pauseReason, 256);
  list(v.players, 4, player);
  const ids = new Set<string>(v.players.map((p: any) => p.id));
  if (ids.size !== v.players.length) throw Error("Duplicate saved players");
  if (new Set(v.players.map((p: any) => p.slot)).size !== v.players.length)
    throw Error("Duplicate saved crew slots");
  list(v.animals, 3, animal);
  if (
    v.animals.length !== 3 ||
    !v.animals.some((a: any) => a.species === "raccoon") ||
    !v.animals.some((a: any) => a.species === "heron") ||
    new Set(v.animals.map((a: any) => a.species)).size !== v.animals.length ||
    new Set(v.animals.map((a: any) => a.id)).size !== v.animals.length
  )
    throw Error("Invalid animal count or identities");
  tin(v.tin);
  world(v.world);
  props(v.props, ids);
  route(v.route);
  plankRoute(v.props, v.route);
  spills(v.spills);
  hats(v.hats, ids);
  incidents(v);
  integer(v.spareBait, 0, 8);
  integer(v.baitPatch, 0, 4);
  list(v.observations, 128, (x) => text(x, 256));
  list(v.completed, 4, (x) => one(x, assignments));
  if (new Set(v.completed).size !== v.completed.length)
    throw Error("Duplicate completed assignments");
  if (v.completed.some((id: string) => !v.world.assignments.includes(id)))
    throw Error("Completed assignment was not selected");
  if (
    v.phase === "exhibition" &&
    !v.world.assignments.every((id: string) => v.completed.includes(id))
  )
    throw Error("Exhibition requires every selected assignment");
  list(v.ready, 4, id);
  if (v.ready.some((playerId: string) => !ids.has(playerId)))
    throw Error("Missing saved ready player");
  if (
    v.tin.holder !== null &&
    v.tin.holder !== "animal:raccoon" &&
    !ids.has(v.tin.holder)
  )
    throw Error("Missing saved tin holder");
  if (v.hostId !== null) {
    id(v.hostId);
    if (!ids.has(v.hostId)) throw Error("Missing saved host");
  }
  list(v.pings, 32, (x) => {
    const p = obj(x, ["player", "point", "until"]);
    id(p.player);
    if (!ids.has(p.player)) throw Error("Missing saved ping player");
    position(p.point);
    num(p.until);
  });
  list(v.events, 128, (x) => {
    const e = obj(x, ["kind", "player", "point", "tick"]);
    one(e.kind, [
      "rattle",
      "whistle",
      "noise",
      "impact",
      "bait",
      "recover",
      "place",
    ]);
    id(e.player);
    if (e.player !== "tin" && !ids.has(e.player))
      throw Error("Missing saved event player");
    position(e.point);
    integer(e.tick);
  });
  const cooldowns = obj(v.cooldowns);
  if (Object.keys(cooldowns).length > 4) throw Error("Too many cooldowns");
  for (const [key, c] of Object.entries(cooldowns)) {
    id(key);
    if (!ids.has(key)) throw Error("Missing saved cooldown player");
    obj(c, ["use", "photo"]);
    num(c.use);
    num(c.photo);
  }
  const memories = obj(
    v.animalMemory,
    v.animals.map((a: any) => a.id),
  );
  for (const [name, memory] of Object.entries(memories)) {
    obj(memory, [
      "goal",
      "recentGoals",
      "interestPoint",
      "interestUntilTick",
      "habituatedUntilTick",
      "hatTarget",
    ]);
    text(memory.goal, 80);
    list(memory.recentGoals, 4, (x) => text(x, 80));
    if (memory.interestPoint !== null) position(memory.interestPoint);
    integer(memory.interestUntilTick, 0, v.tick + 1800);
    integer(memory.habituatedUntilTick, 0, v.tick + 1800);
    if (memory.hatTarget !== null) id(memory.hatTarget);
    const reaching =
      v.animals.find((a: any) => a.id === name).behavior === "hat-reach";
    if (
      reaching !== (memory.hatTarget !== null) ||
      (memory.hatTarget !== null &&
        (name !== "raccoon" || !ids.has(memory.hatTarget)))
    )
      throw Error("Invalid saved hat target");
    if (
      reaching &&
      !v.players.some(
        (p: any) =>
          p.id === memory.hatTarget &&
          p.connected &&
          distance(
            p.position,
            v.animals.find((a: any) => a.id === name).target,
          ) < 0.8 &&
          v.hats.some(
            (h: any) =>
              h.owner === p.id &&
              h.carrier === "owner" &&
              h.protectedUntilTick <= v.tick,
          ),
      )
    )
      throw Error("Saved hat reach owner disagrees with target");
  }
  num(v.decisionSeconds, 0);
  integer(v.nextPhoto);
  integer(v.tinRevision);
  num(v.lastImpactTick);
  integer(v.failedSetups);
  const pending = obj(v.pendingPhotos);
  if (Object.keys(pending).length > 24) throw Error("Too many pending photos");
  for (const [key, f] of Object.entries(pending)) {
    id(key);
    photo(f, new Map(v.players.map((p: any) => [p.id, p.slot])));
    if (f.id !== key) throw Error("Invalid pending photo id");
  }
  const albumIds = new Set<string>();
  list(v.album, 24, (x) => {
    const p = obj(x, [
      "id",
      "photographer",
      "tick",
      "credits",
      "assists",
      "favorites",
      "incident",
      "thumbnail",
    ]);
    id(p.id);
    id(p.photographer);
    if (!ids.has(p.photographer)) throw Error("Missing saved photographer");
    integer(p.tick);
    list(p.credits, 4, (a) => one(a, assignments));
    if (
      new Set(p.credits).size !== p.credits.length ||
      p.credits.some((id: string) => !v.world.assignments.includes(id))
    )
      throw Error("Invalid photo credit selection");
    list(p.assists, 4, id);
    if (p.assists.some((playerId: string) => !ids.has(playerId)))
      throw Error("Missing saved assisting player");
    list(p.favorites, 4, id);
    if (new Set(p.favorites).size !== p.favorites.length)
      throw Error("Duplicate saved favorite player");
    if (p.favorites.some((playerId: string) => !ids.has(playerId)))
      throw Error("Missing saved favorite player");
    if (p.incident !== null) one(p.incident, ["spill", "hat"]);
    one(p.thumbnail, ["pending", "ready"]);
    if (albumIds.has(p.id)) throw Error("Duplicate photo");
    albumIds.add(p.id);
    if (p.thumbnail === "ready" && (!images.has(p.id) || pending[p.id]))
      throw Error("Missing image or stale pending frame");
    if (p.thumbnail === "pending" && (!pending[p.id] || images.has(p.id)))
      throw Error("Missing pending frame or unexpected image");
    if (
      pending[p.id] &&
      (pending[p.id].photographer !== p.photographer ||
        pending[p.id].tick !== p.tick)
    )
      throw Error("Pending capture does not match its album record");
  });
  for (const key of [...images.keys(), ...Object.keys(pending)])
    if (!albumIds.has(key)) throw Error("Orphan saved image or frame");
  return v as RunState;
}
function decodeSave(raw: string) {
  const data = obj(JSON.parse(raw));
  if (data.version === 1)
    throw Error("Incompatible save version 1; expected version 2");
  if (data.version !== 2) throw Error("Unsupported save version");
  obj(data, ["version", "run", "images"]);
  const imageData = obj(data.images);
  if (Object.keys(imageData).length > 24) throw Error("Too many saved images");
  const images = new Map<string, Uint8Array>();
  for (const [key, value] of Object.entries(imageData)) {
    id(key);
    if (
      typeof value !== "string" ||
      value.length > 87384 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        value,
      )
    )
      throw Error("Invalid image encoding");
    const bytes = Buffer.from(value, "base64");
    if (!validJPEG(bytes)) throw Error("Invalid saved image");
    images.set(key, bytes);
  }
  return { run: validateRun(data.run, images), images };
}
async function boundedRead(path: string) {
  const info = await stat(path);
  if (info.size > LIMIT || !info.isFile())
    throw Error("Save file exceeds allowed size");
  return readFile(path, "utf8");
}
export async function loadRun(
  dataDir: string,
): Promise<{ run: RunState; images: Map<string, Uint8Array> } | null> {
  const path = resolve(dataDir, "run.json");
  try {
    return decodeSave(await boundedRead(path));
  } catch (error) {
    if (error instanceof Error && /version/i.test(error.message)) throw error;
    try {
      const backup = decodeSave(await boundedRead(path + ".bak"));
      console.warn(
        "Recovered outing from valid backup; the primary save was unavailable or invalid.",
      );
      return backup;
    } catch (backupError) {
      if (
        (error as NodeJS.ErrnoException).code === "ENOENT" &&
        (backupError as NodeJS.ErrnoException).code === "ENOENT"
      )
        return null;
      throw error;
    }
  }
}
const writes = new Map<string, Promise<void>>();
function serialize(path: string, write: () => Promise<void>) {
  const task = (writes.get(path) ?? Promise.resolve())
    .catch(() => {})
    .then(write);
  writes.set(path, task);
  void task
    .finally(() => {
      if (writes.get(path) === task) writes.delete(path);
    })
    .catch(() => {});
  return task;
}
async function replace(
  path: string,
  raw: string,
  validate: (value: string) => unknown,
) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  let previous: string | undefined;
  try {
    previous = await boundedRead(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let valid = previous !== undefined;
  if (previous !== undefined) {
    try {
      validate(previous);
    } catch (error) {
      if (error instanceof Error && /version/i.test(error.message)) throw error;
      valid = false;
    }
  }
  await writeFile(path + ".tmp", raw, { mode: 0o600 });
  if (valid) {
    await copyFile(path, path + ".bak.tmp");
    await rename(path + ".bak.tmp", path + ".bak");
  }
  await rename(path + ".tmp", path);
}
export function saveRun(
  dataDir: string,
  run: RunState,
  images: Map<string, Uint8Array>,
): Promise<void> {
  const path = resolve(dataDir, "run.json");
  let raw: string;
  try {
    const encodedImages = Object.fromEntries(
      [...images].map(([id, bytes]) => [
        id,
        Buffer.from(bytes).toString("base64"),
      ]),
    );
    decodeSave(
      JSON.stringify({
        version: 2,
        run: structuredClone(run),
        images: encodedImages,
      }),
    );
    const saved = structuredClone(run);
    saved.paused = true;
    saved.pauseReason = "Saved for restart";
    saved.tin.holder = null;
    saved.tin.velocity = [0, 0, 0];
    for (const prop of saved.props) {
      prop.holders = [null, null];
      prop.velocity = [0, 0, 0];
      prop.angularVelocity = [0, 0, 0];
    }
    for (const player of saved.players) player.lastInput = null;
    raw = JSON.stringify({
      version: 2,
      run: saved,
      images: encodedImages,
    });
    if (Buffer.byteLength(raw) > LIMIT) throw Error("Save exceeds 8 MiB");
    decodeSave(raw);
  } catch (error) {
    return Promise.reject(error);
  }
  return serialize(path, () => replace(path, raw, decodeSave));
}
function decodeRoom(raw: string): RoomCredentials {
  const v = obj(JSON.parse(raw), [
    "version",
    "joinSecret",
    "hostSecret",
    "hostId",
    "sessions",
  ]);
  if (v.version !== 1) throw Error("Unsupported room version");
  for (const secret of [v.joinSecret, v.hostSecret])
    if (typeof secret !== "string" || !/^[a-f0-9]{32}$/.test(secret))
      throw Error("Invalid room credential");
  if (v.joinSecret === v.hostSecret)
    throw Error("Host and join credentials must differ");
  if (v.hostId !== null) id(v.hostId);
  const sessions = obj(v.sessions);
  if (Object.keys(sessions).length > 8)
    throw Error("Too many private sessions");
  for (const [key, s] of Object.entries(sessions)) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw Error("Invalid private session");
    obj(s, ["playerId", "name", "pending"]);
    id(s.playerId);
    text(s.name, 24);
    bool(s.pending);
  }
  return v as RoomCredentials;
}
export function saveRoom(dataDir: string, room: RoomCredentials) {
  const path = resolve(dataDir, "room.json"),
    raw = JSON.stringify(room);
  decodeRoom(raw);
  return serialize(path, () => replace(path, raw, decodeRoom));
}
export async function loadRoom(dataDir: string): Promise<RoomCredentials> {
  const path = resolve(dataDir, "room.json");
  try {
    return decodeRoom(await boundedRead(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    try {
      return decodeRoom(await boundedRead(path + ".bak"));
    } catch (backupError) {
      if ((backupError as NodeJS.ErrnoException).code !== "ENOENT")
        throw backupError;
    }
    const room: RoomCredentials = {
      version: 1,
      joinSecret: randomBytes(16).toString("hex"),
      hostSecret: randomBytes(16).toString("hex"),
      hostId: null,
      sessions: {},
    };
    await saveRoom(dataDir, room);
    return room;
  }
}
