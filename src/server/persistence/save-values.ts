/** Validate individual saved entities and their geometry/identity relationships. */
import { parseMessage, surfaceHeight, distance } from "../../shared/shared.ts";
import { fixtureBoxes, fixtureSurfaces } from "../../shared/world/level.ts";
import {
  RESERVE_SPECIES,
  type ReserveBlueprint,
} from "../../shared/world/world.ts";
/**
 * Require a non-array object, optionally with an exact field set.
 *
 * @param value - Untrusted saved value
 * @param fields - Exact required field names, or omission to check only object shape
 * @returns The same object as a record; no clone is made.
 * @throws {Error} The value is not an object or its fields do not match.
 */
export function obj(value: unknown, fields?: string[]): Record<string, any> {
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
/**
 * Require a string within the maximum character count; an empty string is allowed.
 *
 * @param value - Untrusted saved text
 * @param max - Maximum characters, default 128
 * @throws {Error} The value is not a string or exceeds the limit.
 */
export function text(value: unknown, max = 128) {
  if (typeof value !== "string" || value.length > max)
    throw Error("Invalid saved text");
}
/**
 * Require a 1–80 character saved identifier containing only letters, digits, hyphens, or
 * underscores.
 *
 * @param value - Untrusted saved identifier
 * @throws {Error} The identifier has an invalid type, length, or character.
 */
export function id(value: unknown) {
  if (typeof value !== "string" || !/^[-_a-zA-Z0-9]{1,80}$/.test(value))
    throw Error("Invalid saved identifier");
}
/**
 * Require a finite number within inclusive bounds.
 *
 * @param value - Untrusted saved number
 * @param min - Inclusive minimum, default negative maximum safe integer
 * @param max - Inclusive maximum, default maximum safe integer
 * @throws {Error} The value is nonnumeric, nonfinite, or outside the bounds.
 */
export function num(
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
/**
 * Require a safe integer within inclusive bounds.
 *
 * @param value - Untrusted saved integer
 * @param min - Inclusive minimum, default 0
 * @param max - Inclusive maximum, default maximum safe integer
 * @throws {Error} Numeric bounds or safe-integer validation fails.
 */
export function integer(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
) {
  num(value, min, max);
  if (!Number.isSafeInteger(value)) throw Error("Invalid saved integer");
}
/**
 * Require a boolean without coercing truthy values.
 *
 * @param value - Untrusted saved boolean
 * @throws {Error} The value is not a boolean.
 */
export function bool(value: unknown) {
  if (typeof value !== "boolean") throw Error("Invalid saved boolean");
}
/**
 * Require a string from an explicit enum allowlist.
 *
 * @param value - Untrusted saved enum value
 * @param choices - Permitted string values
 * @throws {Error} The value is not one of the permitted strings.
 */
export function one(value: unknown, choices: string[]) {
  if (typeof value !== "string" || !choices.includes(value))
    throw Error("Invalid saved enum");
}
/**
 * Require a bounded array and validate each member with the supplied checker.
 *
 * @param value - Untrusted saved array
 * @param max - Maximum number of entries
 * @param check - Validator invoked for each entry
 * @throws {Error} The value is not a bounded array or an entry validator fails.
 */
export function list(value: unknown, max: number, check: (v: any) => void) {
  if (!Array.isArray(value) || value.length > max)
    throw Error("Invalid saved list");
  value.forEach(check);
}
/**
 * Require a fixed-size numeric vector with each component between -10,000 and 10,000.
 *
 * @param value - Untrusted saved vector
 * @param size - Required component count, default 3
 * @throws {Error} Vector shape or a component is invalid.
 */
function vector(value: unknown, size = 3) {
  if (!Array.isArray(value) || value.length !== size)
    throw Error("Invalid saved vector");
  value.forEach((v) => num(v, -10000, 10000));
}
/**
 * Require three finite position components, each between -512 and 512.
 *
 * @param value - Untrusted saved position
 * @throws {Error} Position shape or a component is invalid.
 */
export function position(value: unknown) {
  if (!Array.isArray(value) || value.length !== 3)
    throw Error("Invalid saved position");
  value.forEach((v) => num(v, -512, 512));
}
/**
 * Require position/rotation fields and a four-component quaternion with magnitude between
 * 0.9 and 1.1. Does not normalize accepted quaternions.
 *
 * @param value - Untrusted saved pose
 * @throws {Error} Pose fields, position, or quaternion validation fails.
 */
function pose(value: unknown) {
  const v = obj(value, ["position", "rotation"]);
  position(v.position);
  vector(v.rotation, 4);
  const n = Math.hypot(...v.rotation);
  if (n < 0.9 || n > 1.1) throw Error("Invalid saved quaternion");
}
/**
 * Validate a saved crew record, including identity, slot, view angles, sequence, and
 * optional held input.
 *
 * @param value - Untrusted saved player
 * @throws {Error} A player field or embedded input message is invalid.
 */
export function player(value: unknown) {
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
  if (v.lastInput !== null)
    parseMessage({ type: "input", worldId: "saved-input", value: v.lastInput });
}
/**
 * Validate a saved resident's identity, species, behavior, pose, target, and remaining
 * timer.
 *
 * @param value - Untrusted saved animal
 * @throws {Error} A resident field is invalid.
 */
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
  one(v.species, [...RESERVE_SPECIES]);
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
    "pounce",
    "nibble",
    "cache",
    "gnaw",
    "groom",
    "dig",
    "roost",
    "tap",
    "dabble",
    "stalk",
    "passage",
    "freeze",
    "bound",
    "climb",
    "descend",
    "perch",
    "fly",
    "swim",
    "surface",
    "sniff",
  ]);
  pose(v.pose);
  num(v.remaining, -1, 1e8);
  position(v.target);
}
/**
 * Validate saved tin pose, velocities, holder syntax, portions, and lid state. Holder
 * existence is checked separately.
 *
 * @param value - Untrusted saved tin
 * @throws {Error} A tin field is invalid.
 */
export function tin(value: unknown) {
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
  if (v.holder !== null)
    id(
      typeof v.holder === "string" && v.holder.startsWith("animal:")
        ? v.holder.slice(7)
        : v.holder,
    );
  integer(v.portions, 0, 4);
  bool(v.open);
}
/**
 * Require exactly the blueprint's resident inventory, with unique IDs and matching species.
 *
 * @param value - Untrusted saved animal array
 * @param world - Validated reserve blueprint
 * @throws {Error} A resident is malformed, duplicated, missing, or inconsistent with the
 * blueprint.
 */
export function residentInventory(value: unknown, world: ReserveBlueprint) {
  list(value, 48, animal);
  const animals = value as any[];
  if (
    animals.length !== world.residents.length ||
    new Set(animals.map((a) => a.id)).size !== animals.length ||
    animals.some(
      (a) =>
        !world.residents.some((r) => r.id === a.id && r.species === a.species),
    )
  )
    throw Error("Invalid animal count or identities");
}
/**
 * Validate an optional tin holder as a known player or a resident raccoon.
 *
 * @param value - Saved holder identifier or null
 * @param ids - Known player IDs
 * @param world - Validated reserve blueprint
 * @throws {Error} The holder does not identify an allowed player or raccoon.
 */
export function carrier(value: any, ids: Set<string>, world: ReserveBlueprint) {
  if (value === null || ids.has(value)) return;
  if (
    typeof value !== "string" ||
    !value.startsWith("animal:") ||
    !world.residents.some(
      (r) => r.id === value.slice(7) && r.species === "raccoon",
    )
  )
    throw Error("Missing saved tin holder");
}
/**
 * Check saved entity positions and animal targets against the reserve's horizontal bounds
 * and permitted vertical range. Requires validated entity shapes.
 *
 * @param v - Saved run record
 * @param world - Validated reserve blueprint
 * @throws {Error} A saved position lies outside the permitted bounds.
 */
export function stateBounds(v: Record<string, any>, world: ReserveBlueprint) {
  const points = [
    ...v.players.map((p: any) => p.position),
    ...v.animals.flatMap((a: any) => [a.pose.position, a.target]),
    v.tin.pose.position,
    ...v.props.map((p: any) => p.pose.position),
    ...v.spills.map((s: any) => s.position),
    ...v.hats.map((h: any) => h.position),
  ];
  for (const point of points)
    if (
      [0, 2].some(
        (axis) =>
          point[axis] < world.bounds.min[axis] - 2 ||
          point[axis] > world.bounds.max[axis] + 2,
      ) ||
      point[1] < -8 ||
      point[1] > 64
    )
      throw Error("Saved position outside world bounds");
}
/**
 * Require the exact authored prop inventory with valid poses, velocities, holder
 * references, and state fields.
 *
 * @param value - Untrusted saved prop array
 * @param playerIds - Known player IDs
 * @param world - Validated reserve blueprint
 * @throws {Error} Prop fields, identities, inventory, or holder references are invalid.
 */
export function props(
  value: unknown,
  playerIds: Set<string>,
  world: ReserveBlueprint,
) {
  const propKinds = new Map(world.props.map((p) => [p.id, p.kind]));
  list(value, world.props.length, (x) => {
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
  if (
    values.length !== world.props.length ||
    new Set(values.map((x) => x.id)).size !== world.props.length
  )
    throw Error("Invalid saved field prop inventory");
}
/**
 * Validate the exact fixture-state map and each seat/open combination against the reserve.
 *
 * @param value - Untrusted saved route state
 * @param world - Validated reserve blueprint
 * @throws {Error} Fixture fields or state combinations are invalid.
 */
export function route(value: unknown, world: ReserveBlueprint) {
  const states = obj(
    value,
    world.fixtures.map((f) => f.id),
  );
  for (const fixture of world.fixtures) {
    const state = obj(states[fixture.id], ["open", "seat"]);
    bool(state.open);
    if (state.seat !== null) one(state.seat, Object.keys(fixture.seats));
  }
  fixtureBoxes(world.fixtures, states);
}
/**
 * Require each crossing plank's placed flag and seated pose to agree with the saved route.
 *
 * @param propValues - Validated saved prop records
 * @param routeValue - Validated saved fixture state
 * @param world - Validated reserve blueprint
 * @throws {Error} A crossing plank is missing or contradicts its route state.
 */
export function plankRoute(
  propValues: any[],
  routeValue: any,
  world: ReserveBlueprint,
) {
  for (const fixture of world.fixtures.filter((f) => f.kind === "crossing")) {
    const plank = propValues.find((p) => p.id === fixture.plankId),
      state = routeValue[fixture.id],
      expected = state.seat ? fixture.seats[state.seat] : null;
    if (
      !plank ||
      plank.placed !== state.open ||
      (expected &&
        (plank.holders.some(Boolean) ||
          plank.pose.position.some(
            (v: number, a: number) => Math.abs(v - expected.position[a]) > 1e-6,
          ) ||
          plank.pose.rotation.some(
            (v: number, a: number) => Math.abs(v - expected.rotation[a]) > 1e-6,
          )))
    )
      throw Error("Saved plank and crossing route disagree");
  }
}
/**
 * Validate at most eight uniquely identified, single-portion bait spills and their
 * positions/deadlines.
 *
 * @param value - Untrusted saved spill array
 * @throws {Error} Spill fields, count, or uniqueness are invalid.
 */
export function spills(value: unknown) {
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
/**
 * Require exactly one hat per saved player and validate owners, carrier identities,
 * positions, and timers.
 *
 * @param value - Untrusted saved hat array
 * @param playerIds - Known player IDs
 * @param world - Validated reserve blueprint
 * @throws {Error} Hats are malformed, missing, duplicated, or reference invalid
 * owners/carriers.
 */
export function hats(
  value: unknown,
  playerIds: Set<string>,
  world: ReserveBlueprint,
) {
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
    one(v.carrier, [
      "owner",
      "ground",
      ...world.residents
        .filter((r) => r.species === "raccoon")
        .map((r) => `animal:${r.id}`),
    ]);
    position(v.position);
    integer(v.untilTick);
    integer(v.protectedUntilTick);
  });
  if (owners.size !== playerIds.size) throw Error("Missing saved crew hat");
}
/**
 * Validate incident deadlines, ground support, single-raccoon hat ownership, and active
 * hat-reach consistency against the current tick and crew.
 *
 * @param v - Saved run with already validated entity shapes
 * @param world - Validated reserve blueprint
 * @throws {Error} Spill, hat, or hat-reach state contradicts the run's timing, support, or
 * ownership rules.
 */
export function incidents(v: Record<string, any>, world: ReserveBlueprint) {
  for (const prop of v.props) {
    integer(prop.spillUntilTick, 0, v.tick + 120);
    if (prop.kind !== "case" && prop.spillUntilTick !== 0)
      throw Error("Only the case has a spill guard");
  }
  /**
   * Check incident ground support and clearance against static walls; movable leaves are
   * intentionally excluded from the obstruction check.
   *
   * @param point - Incident world position
   * @returns Whether the incident point is supported and clear.
   */
  const supported = (point: any) =>
    // A movable leaf can close over a previously valid incident.
    !world.walls.some(
      (b) =>
        b.max[1] > point[1] + 0.16 &&
        b.min[1] < point[1] + 1.7 &&
        point[0] > b.min[0] - 0.3 &&
        point[0] < b.max[0] + 0.3 &&
        point[2] > b.min[2] - 0.3 &&
        point[2] < b.max[2] + 0.3,
    ) &&
    [...world.walkables, ...fixtureSurfaces(world.fixtures, v.route)].some(
      (s) => {
        const height = surfaceHeight(s, point[0], point[2]);
        return height !== null && Math.abs(point[1] - height) < 0.01;
      },
    );
  for (const spill of v.spills) {
    integer(spill.untilTick, v.tick + 1, v.tick + 3600);
    if (!supported(spill.position))
      throw Error("Saved spill lacks ground support");
  }
  if (v.hats.filter((h: any) => h.carrier.startsWith("animal:")).length > 1)
    throw Error("Multiple raccoon hats");
  for (const hat of v.hats) {
    integer(hat.protectedUntilTick, 0, v.tick + 3600);
    if (hat.carrier.startsWith("animal:")) {
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
        v.hats.some((h: any) => h.carrier.startsWith("animal:")) ||
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
