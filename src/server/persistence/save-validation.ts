/** Validate complete saved runs, frozen photos, and JPEG payloads before restoration. */
import type { RunState } from "../simulation/game.ts";
import { distance } from "../../shared/shared.ts";
import {
  validateReserve,
  type ReserveBlueprint,
} from "../../shared/world/world.ts";
import {
  obj,
  text,
  id,
  num,
  integer,
  bool,
  one,
  list,
  position,
  player,
  tin,
  residentInventory,
  carrier,
  stateBounds,
  props,
  route,
  plankRoute,
  spills,
  hats,
  incidents,
} from "./save-values.ts";
/**
 * Validate a frozen pending frame's camera, crew slots, residents, equipment, and incidents
 * against the saved crew and world. Album metadata is validated separately by validateRun.
 *
 * @param value - Untrusted frozen photo frame
 * @param crew - Saved crew IDs mapped to their stable slot numbers
 * @param world - Validated reserve blueprint
 * @throws {Error} Frame fields, geometry, or crew/world references are invalid.
 */
function photo(
  value: unknown,
  crew: Map<string, number>,
  world: ReserveBlueprint,
) {
  const v = obj(value, [
    "id",
    "tick",
    "photographer",
    "camera",
    "players",
    "animals",
    "tin",
    "worldId",
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
  residentInventory(v.animals, world);
  tin(v.tin);
  const ids = new Set<string>(v.players.map((p: any) => p.id));
  if (
    ids.size !== v.players.length ||
    new Set(v.players.map((p: any) => p.slot)).size !== v.players.length ||
    v.players.some((p: any) => crew.get(p.id) !== p.slot)
  )
    throw Error("Invalid saved frame crew identity or slot");
  carrier(v.tin.holder, ids, world);
  if (!ids.has(v.photographer)) throw Error("Missing saved frame photographer");
  if (v.worldId !== world.id || !v.id.startsWith(world.id + "-photo-"))
    throw Error("Saved frame world mismatch");
  props(v.props, ids, world);
  route(v.route, world);
  plankRoute(v.props, v.route, world);
  spills(v.spills);
  hats(v.hats, ids, world);
  incidents(v, world);
  stateBounds(v, world);
}
/**
 * Check the 64 KiB JPEG limit, supported frame dimensions, segment structure, a scan header,
 * and the final end marker. Does not decode pixels or validate the entropy-coded scan.
 *
 * @param bytes - Encoded JPEG bytes
 * @returns Whether the bytes satisfy the stored-photo JPEG contract.
 */
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
  /**
   * Read a big-endian unsigned 16-bit word from the JPEG buffer.
   *
   * @param offset - Byte offset, the caller must have checked the buffer bounds
   * @returns Decoded segment word.
   */
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
/**
 * Validate the complete versioned run and cross-check blueprint, entities, incidents,
 * album, pending frames, and image ownership. Blueprint validation freezes its graph.
 *
 * @param value - Untrusted saved run
 * @param images - Decoded JPEG buffers indexed by photo ID
 * @returns The validated run object, retaining its input identity.
 * @throws {Error} Any run field, reference, image, or cross-entity invariant is invalid.
 */
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
    "worldId",
    "props",
    "route",
    "spills",
    "hats",
    "spareBait",
    "baitPatches",
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
  if (v.version !== 3)
    throw Error("Unsupported run version; expected version 3");
  const world = validateReserve(v.world),
    assignments = world.commissions.map((c) => c.id);
  v.world = world;
  if (v.worldId !== world.id) throw Error("Saved run world mismatch");
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
  residentInventory(v.animals, world);
  tin(v.tin);

  props(v.props, ids, world);
  route(v.route, world);
  plankRoute(v.props, v.route, world);
  spills(v.spills);
  hats(v.hats, ids, world);
  incidents(v, world);
  stateBounds(v, world);
  integer(v.spareBait, 0, 8);
  const patches = obj(
    v.baitPatches,
    world.pockets.flatMap((p) =>
      p.anchors.filter((a) => a.kind === "feed").map((a) => a.id),
    ),
  );
  Object.values(patches).forEach((portions) => integer(portions, 0, 4));
  list(v.observations, 128, (x) => text(x, 256));
  list(v.completed, 8, (x) => one(x, assignments));
  if (new Set(v.completed).size !== v.completed.length)
    throw Error("Duplicate completed assignments");
  if (v.completed.some((id: string) => !assignments.includes(id)))
    throw Error("Completed assignment was not selected");
  if (
    v.phase === "exhibition" &&
    !world.commissions
      .filter((c) => c.required)
      .every((c) => v.completed.includes(c.id))
  )
    throw Error("Exhibition requires every selected assignment");
  list(v.ready, 4, id);
  if (v.ready.some((playerId: string) => !ids.has(playerId)))
    throw Error("Missing saved ready player");
  carrier(v.tin.holder, ids, world);
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
        (world.residents.find((r) => r.id === name)?.species !== "raccoon" ||
          !ids.has(memory.hatTarget)))
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
  if (Object.keys(pending).length > 64) throw Error("Too many pending photos");
  for (const [key, f] of Object.entries(pending)) {
    id(key);
    photo(f, new Map(v.players.map((p: any) => [p.id, p.slot])), world);
    if (f.id !== key) throw Error("Invalid pending photo id");
  }
  const albumIds = new Set<string>();
  list(v.album, 64, (x) => {
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
    if (!p.id.startsWith(world.id + "-photo-"))
      throw Error("Saved photo world mismatch");
    id(p.photographer);
    if (!ids.has(p.photographer)) throw Error("Missing saved photographer");
    integer(p.tick);
    list(p.credits, 8, (a) => one(a, assignments));
    if (
      new Set(p.credits).size !== p.credits.length ||
      p.credits.some((id: string) => !assignments.includes(id))
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
/**
 * Parse the version-3 save envelope, decode bounded base64 JPEGs, and validate the run.
 * Older versions are rejected without migration.
 *
 * @param raw - UTF-8 JSON save contents
 * @returns Validated run and decoded image map.
 * @throws {Error} JSON, save version, image encoding, or run validation fails.
 */
export function decodeSave(raw: string) {
  const data = obj(JSON.parse(raw));
  if (data.version === 1 || data.version === 2)
    throw Error(
      `Incompatible save version ${data.version}; expected version 3`,
    );
  if (data.version !== 3)
    throw Error("Unsupported save version; expected version 3");
  obj(data, ["version", "run", "images"]);
  const imageData = obj(data.images);
  if (Object.keys(imageData).length > 64) throw Error("Too many saved images");
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
