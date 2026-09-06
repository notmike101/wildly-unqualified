/** Render crew status, commissions, equipment prompts, and camera guidance. */
import { CREW_COLORS } from "./view.ts";
import {
  PROP_DEFINITIONS,
  fixtureBoxes,
  fixtureLatch,
  subjectPoints,
} from "./level.ts";
import { sightBlocked, rotate } from "./wildlife.ts";
import {
  residentName,
  commissionInstructions,
  type ReserveBlueprint,
} from "./world.ts";
import {
  distance,
  eye,
  heldProp,
  equipmentTarget,
  equipmentUseTarget,
  recoveryTarget,
  propBoxes,
  rayBlocked,
  propRayBlocked,
  type Player,
  type Snapshot,
  type Vec3,
} from "./shared.ts";
import "./style.css";
import type { Settings, Keys } from "./client-settings.ts";
/**
 * Look up a required page element using the caller's expected element type. The page markup
 * must supply this ID.
 *
 * @template T - Expected DOM element subtype; the markup must satisfy this assertion.
 * @param id - Required element ID
 * @returns The existing DOM element; no runtime null or type check is performed.
 */
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const propNames = {
  case: "field case",
  plank: "crossing plank",
  screen: "observation screen",
  decoy: "wildlife decoy",
};
/**
 * Render connection, crew, equipment prompts, commissions, and outing controls from current
 * state. Does not issue commands or mutate the snapshot.
 *
 * @param latest - Latest snapshot, if installed
 * @param world - Matching blueprint, if installed
 * @param localId - Local player ID
 * @param isHost - Whether the local player is host
 * @param rtt - Estimated round-trip latency in milliseconds
 * @param settings - Current preferences and key bindings
 */
export function renderHud(
  latest: Snapshot | undefined,
  world: ReserveBlueprint | undefined,
  localId: string,
  isHost: boolean,
  rtt: number,
  settings: Settings,
) {
  if (!latest) return;
  const s = latest;
  $("connection").textContent =
    `${s.players.filter((p) => p.connected).length}/4 in reserve · ${Math.round(rtt)} ms`;
  const list = $("assignments");
  list.replaceChildren();
  for (const commission of world!.commissions) {
    const li = document.createElement("li");
    li.className = s.completed.includes(commission.id) ? "done" : "";
    li.textContent = `${commission.required ? "" : "Optional: "}${commission.title}`;
    const small = document.createElement("small");
    small.textContent = commissionInstructions(world!, commission);
    li.append(small);
    list.append(li);
  }
  const holder = s.tin.holder?.startsWith("animal:")
    ? "The raccoon has your tin."
    : s.tin.holder === localId
      ? "You are carrying the tin."
      : s.tin.holder
        ? `${s.players.find((p) => p.id === s.tin.holder)?.name ?? "A friend"} has the tin.`
        : "Tin placed in the reserve.";
  const me = s.players.find((p) => p.id === localId);
  const carried = heldProp(localId, s.props);
  const occupied = carried?.holders.filter(Boolean).length ?? 0;
  $("equipment").textContent = carried
    ? `${propNames[carried.kind]} · ${occupied}/${carried.kind === "decoy" ? 1 : 2} handles held${carried.kind === "case" ? ` · lid ${carried.open ? "open" : "closed"} · ${s.spareBait} spare portions` : carried.kind === "decoy" ? ` · bait cup ${carried.open ? "filled" : "empty"}` : ""}`
    : `${holder} · ${s.tin.portions} bait portions · ${s.spareBait} in the field case`;
  const walls = [...world!.walls, ...fixtureBoxes(world!.fixtures, s.route)];
  const reachWalls = [
    ...walls,
    ...s.props.flatMap((prop) => propBoxes(prop, PROP_DEFINITIONS[prop.kind])),
  ];
  const gate = world!.fixtures
      .filter((f) => f.kind === "gate")
      .map((f) => ({ ...f, latch: fixtureLatch(f, s.route) }))
      .filter((f) => f.latch)
      .sort((a, b) =>
        me ? distance(eye(me), a.latch!) - distance(eye(me), b.latch!) : 0,
      )[0],
    latch = gate?.latch;
  const gateReachable =
    !!me &&
    !!latch &&
    distance(eye(me), latch) <= 2 &&
    !rayBlocked(eye(me), latch, [
      ...world!.walls,
      ...s.props.flatMap((prop) =>
        propBoxes(prop, PROP_DEFINITIONS[prop.kind]),
      ),
    ]);
  const target = me && equipmentTarget(me, s.props, PROP_DEFINITIONS, walls);
  const recovery = me && recoveryTarget(me, s, PROP_DEFINITIONS, walls);
  const useTarget =
    me && equipmentUseTarget(me, s.props, PROP_DEFINITIONS, walls);
  const tinReachable =
    !!me &&
    (!s.tin.holder || s.tin.holder?.startsWith("animal:")) &&
    distance(eye(me), s.tin.pose.position) <= 2 &&
    !rayBlocked(eye(me), s.tin.pose.position, reachWalls);
  const targetProp =
    target &&
    me &&
    (!tinReachable ||
      distance(eye(me), target.point) < distance(eye(me), s.tin.pose.position))
      ? s.props.find((p) => p.id === target.propId)
      : undefined;
  /**
   * Turn a configured keyboard code into compact prompt text by stripping Key or Digit
   * prefixes.
   *
   * @param name - Configured action name
   * @returns Display label for the binding.
   */
  const key = (name: keyof Keys) =>
    settings.keys[name].replace(/^(Key|Digit)/, "");
  const clue =
    me &&
    world!.commissions
      .map((c) => ({
        title: c.title,
        position: world!.pockets.find((p) => p.id === c.pocket)!.position,
      }))
      .filter(
        (c) =>
          distance(c.position, me.position) <= 3 &&
          !rayBlocked(eye(me), c.position, reachWalls),
      )
      .sort(
        (a, b) =>
          distance(a.position, me.position) - distance(b.position, me.position),
      )[0];
  const interact = carried
    ? `Place ${propNames[carried.kind]}`
    : s.tin.holder === localId
      ? "Place tin"
      : recovery
        ? recovery.kind === "spill"
          ? "Collect spilled bait"
          : `Retrieve ${s.players.find((p) => p.id === recovery.id)?.name ?? "crew"}'s hat`
        : targetProp
          ? `Take ${propNames[targetProp.kind]} handle ${(target?.handle ?? 0) + 1}`
          : gateReachable
            ? `${s.route[gate.id].open ? "Close" : "Open"} trail gate`
            : tinReachable
              ? s.tin.holder?.startsWith("animal:")
                ? "Reclaim tin"
                : "Pick up tin"
              : clue
                ? `Read ${clue.title}`
                : "";
  const use =
    carried?.kind === "case"
      ? `${carried.open ? "Close" : "Open"} case lid`
      : useTarget?.part === "bait-cup"
        ? s.props.find((prop) => prop.id === useTarget.propId)?.open
          ? "Decoy bait cup filled"
          : "Fill decoy bait cup"
        : s.tin.holder === localId
          ? me &&
            s.tin.portions < 4 &&
            s.spareBait > 0 &&
            s.props.some(
              (prop) =>
                prop.kind === "case" &&
                prop.open &&
                Math.hypot(
                  me.position[0] - prop.pose.position[0],
                  me.position[2] - prop.pose.position[2],
                ) < 2.5,
            )
            ? "Refill tin from case"
            : me &&
                Math.hypot(
                  me.position[0] - world!.camp[0],
                  me.position[2] - world!.camp[2],
                ) <= 5 &&
                (s.tin.portions < 4 || s.spareBait < 8)
              ? "Refill field supplies"
              : me &&
                  world!.pockets.some((p) =>
                    p.anchors.some(
                      (a) =>
                        a.kind === "feed" &&
                        distance(me.position, a.point) < 2.5,
                    ),
                  )
                ? "Bait local feeding patch"
                : "Rattle tin"
          : "Whistle";
  $("context-action").textContent =
    me && !s.paused && s.phase !== "exhibition"
      ? [
          interact && `${key("interact")} · ${interact}`,
          `${key("use")} · ${use}`,
          (carried || s.tin.holder === localId) && `${key("drop")} · Drop`,
        ]
          .filter(Boolean)
          .join("   ")
      : "";
  $("phase-hint").textContent =
    s.phase === "camp"
      ? "Gather at camp. The host begins when at least two friends are here."
      : s.phase === "exhibition"
        ? "A very questionable success. Open the notebook and choose your favorites."
        : world!.commissions
              .filter((c) => c.required)
              .every((c) => s.completed.includes(c.id))
          ? `All six required commissions recorded. Return to camp for the exhibition · ${s.ready.length}/${s.players.filter((p) => p.connected).length} ready.`
          : `${Math.floor(s.seconds / 60)}:${String(Math.floor(s.seconds) % 60).padStart(2, "0")} in the field · Woodland → clearing → wetland. Prepare a route and bring the crew home.`;
  $("start-button").hidden = !(isHost && s.phase === "camp");
  $<HTMLButtonElement>("shutter-button").disabled =
    s.paused || s.phase !== "outing";
  $<HTMLButtonElement>("start-button").disabled =
    s.players.filter((p) => p.connected).length < 2;
  $("pause-banner").hidden =
    !s.paused || s.phase === "camp" || s.phase === "exhibition";
  $("pause-reason").textContent = s.pauseReason;
  $("pause-button").hidden = !isHost || s.phase !== "outing";
  const complete = world!.commissions
    .filter((c) => c.required)
    .every((c) => s.completed.includes(c.id));
  $("ready-button").hidden = !complete || s.phase !== "outing";
  $("finish-button").hidden = !isHost || !complete || s.phase !== "outing";
  /**
   * Test the six-metre horizontal camp radius used by completion controls.
   *
   * @param p - Player to inspect
   * @returns Whether the player is at camp.
   */
  const atCamp = (p: Player) =>
    Math.hypot(
      p.position[0] - world!.camp[0],
      p.position[2] - world!.camp[2],
    ) <= 6;
  const ready = $<HTMLButtonElement>("ready-button");
  ready.textContent = s.ready.includes(localId)
    ? "Ready for exhibition ✓"
    : me && atCamp(me)
      ? "Ready for exhibition"
      : "Return to camp to mark ready";
  ready.disabled = s.paused || !me || !atCamp(me) || s.ready.includes(localId);
  $<HTMLButtonElement>("finish-button").disabled =
    s.paused ||
    !s.players
      .filter((p) => p.connected)
      .every((p) => atCamp(p) && s.ready.includes(p.id));
  $("crew").replaceChildren(
    ...s.players.map((p) => {
      const span = document.createElement("span");
      span.textContent = `${p.slot + 1}. ${p.name}${p.id === localId ? " (you)" : ""}${p.connected ? (s.ready.includes(p.id) ? " · ready ✓" : "") : " · returning"}`;
      span.style.borderColor = `#${CREW_COLORS[p.slot].toString(16).padStart(6, "0")}`;
      return span;
    }),
  );
  const behavior = {
    wander: "exploring",
    approach: "approaching",
    inspect: "inspecting the tin",
    carry: "carrying your tin",
    investigate: "investigating",
    feed: "feeding",
    alert: "alert",
    retreat: "moving away",
    settle: "settling",
    display: "wings spread",
    graze: "grazing",
    wash: "washing food",
    preen: "preening",
    "hat-reach": "reaching for a hat",
    pounce: "pouncing",
    nibble: "nibbling",
    cache: "caching",
    gnaw: "gnawing",
    groom: "grooming",
    dig: "digging",
    roost: "roosting",
    tap: "tapping",
    dabble: "dabbling",
    stalk: "stalking quietly",
    passage: "following a wildlife trail",
    freeze: "holding still",
    bound: "bounding",
    climb: "climbing",
    descend: "climbing down",
    perch: "resting on a perch",
    fly: "flying to a nearby perch",
    swim: "swimming",
    surface: "surfacing",
    sniff: "sniffing the ground",
  };
  $("camera-hint").textContent = me
    ? s.animals
        .filter((a) => {
          return (
            distance(me.position, a.pose.position) < 20 &&
            subjectPoints(a, s.tick).every((local) => {
              const point = rotate(local, a.pose.rotation).map(
                (v, i) => v + a.pose.position[i],
              ) as Vec3;
              return (
                !sightBlocked(world!, eye(me), point, walls) &&
                !propRayBlocked(eye(me), point, s.props, PROP_DEFINITIONS)
              );
            })
          );
        })
        .map((a) => `${residentName(world!, a.id)}: ${behavior[a.behavior]}`)
        .join(" · ") || "Find a clear angle; give wildlife room."
    : "";
}
