/** Validate individual saved entities and their geometry/identity relationships. */
import { parseMessage, surfaceHeight, distance } from "./shared.ts";
import { fixtureBoxes, fixtureSurfaces } from "./level.ts";
import { RESERVE_SPECIES, type ReserveBlueprint } from "./world.ts";
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
export function text(value: unknown, max = 128) {
  if (typeof value !== "string" || value.length > max)
    throw Error("Invalid saved text");
}
export function id(value: unknown) {
  if (typeof value !== "string" || !/^[-_a-zA-Z0-9]{1,80}$/.test(value))
    throw Error("Invalid saved identifier");
}
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
export function integer(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
) {
  num(value, min, max);
  if (!Number.isSafeInteger(value)) throw Error("Invalid saved integer");
}
export function bool(value: unknown) {
  if (typeof value !== "boolean") throw Error("Invalid saved boolean");
}
export function one(value: unknown, choices: string[]) {
  if (typeof value !== "string" || !choices.includes(value))
    throw Error("Invalid saved enum");
}
export function list(value: unknown, max: number, check: (v: any) => void) {
  if (!Array.isArray(value) || value.length > max)
    throw Error("Invalid saved list");
  value.forEach(check);
}
function vector(value: unknown, size = 3) {
  if (!Array.isArray(value) || value.length !== size)
    throw Error("Invalid saved vector");
  value.forEach((v) => num(v, -10000, 10000));
}
export function position(value: unknown) {
  if (!Array.isArray(value) || value.length !== 3)
    throw Error("Invalid saved position");
  value.forEach((v) => num(v, -512, 512));
}
function pose(value: unknown) {
  const v = obj(value, ["position", "rotation"]);
  position(v.position);
  vector(v.rotation, 4);
  const n = Math.hypot(...v.rotation);
  if (n < 0.9 || n > 1.1) throw Error("Invalid saved quaternion");
}
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
export function incidents(v: Record<string, any>, world: ReserveBlueprint) {
  for (const prop of v.props) {
    integer(prop.spillUntilTick, 0, v.tick + 120);
    if (prop.kind !== "case" && prop.spillUntilTick !== 0)
      throw Error("Only the case has a spill guard");
  }
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
