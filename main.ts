import * as THREE from "three/webgpu";
import {
  createView,
  capturePhoto,
  alignLocalCarry,
  playSound,
  CREW_COLORS,
  CAMERA_FAR,
} from "./view.ts";
import { PROP_DEFINITIONS, fixtureBoxes, fixtureSurfaces, fixtureLatch } from "./level.ts";
import { validateReserve, reserveHash, type ReserveBlueprint } from "./world.ts";
import {
  distance,
  eye,
  forward,
  movePlayer,
  heldProp,
  equipmentTarget,
  equipmentUseTarget,
  recoveryTarget,
  playerSpeed,
  propBoxes,
  rayBlocked,
  propRayBlocked,
  type ClientMessage,
  type Input,
  type PhotoFrame,
  type PhotoVerdict,
  type Player,
  type ServerMessage,
  type Snapshot,
  type Vec3,
} from "./shared.ts";
import "./style.css";
declare global {
  interface Window {
    readonly wildly: {
      snapshot: Snapshot | null;
      world: ReserveBlueprint | null;
      playerId: string;
      backend: string;
      adapter: unknown;
      assetErrors: string[];
      camera: number[];
      rtt: number;
      p95: number;
      render: {
        drawCalls: number;
        triangles: number;
        geometries: number;
        textures: number;
        estimatedBytes: number;
      } | null;
    };
  }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const keyDefaults = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  run: "ShiftLeft",
  crouch: "KeyC",
  interact: "KeyE",
  use: "KeyQ",
  drop: "KeyG",
  ping: "KeyF",
  notebook: "Tab",
};
type Keys = typeof keyDefaults;
type Settings = {
  sensitivity: number;
  invert: boolean;
  volume: number;
  keys: Keys;
};
let settings: Settings = {
  sensitivity: 1,
  invert: false,
  volume: 0.5,
  keys: { ...keyDefaults },
};
try {
  const stored = JSON.parse(localStorage.getItem("wu-settings") ?? "null");
  if (stored) {
    settings.sensitivity = Math.max(
      0.3,
      Math.min(3, Number(stored.sensitivity) || 1),
    );
    settings.invert = !!stored.invert;
    settings.volume = Math.max(0, Math.min(1, Number(stored.volume) || 0));
    for (const key of Object.keys(keyDefaults) as (keyof Keys)[])
      if (typeof stored.keys?.[key] === "string")
        settings.keys[key] = stored.keys[key];
  }
} catch {
  /* Corrupt local preferences never block admission. */
}
const pressed = new Set<string>();
let crouch = false,
  yaw = 0,
  pitch = 0,
  seq = 0,
  localId = "",
  isHost = false,
  closing = false,
  socket: WebSocket | undefined;
let world: ReserveBlueprint | undefined, worldReady = false, installEpoch = 0, installingId = "", queuedSnapshot: Snapshot | undefined;
const commissionTitle = (id: string) => world?.commissions.find(c => c.id === id)?.title ?? id;
let latest: Snapshot | undefined,
  prior: Snapshot | undefined,
  latestAt = 0,
  predicted: Player | undefined,
  predTick = 0,
  rtt = 70,
  stepDistance = 0,
  viewfinder = false;
const history = new Map<number, Input>(),
  sent = new Map<number, number>();
let view: Awaited<ReturnType<typeof createView>>,
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera;
let noticeTimer = 0,
  photoTimer = 0,
  lastImageUrl = "",
  photoChain = Promise.resolve(),
  albumSignature = "",
  retryTimer = 0,
  reconnectAttempt = 0;
const pendingFrames = new Map<
    string,
    { frame: PhotoFrame; verdict: PhotoVerdict }
  >(),
  frameTimes: number[] = [];
const assetErrors: string[] = [];
let adapterInfo: unknown;
const heard = new Set<string>();
const propNames = {
  case: "field case",
  plank: "crossing plank",
  screen: "observation screen",
  decoy: "wildlife decoy",
};
Object.defineProperty(window, "wildly", {
  get: () => ({
    snapshot: latest ? structuredClone(latest) : null,
    world: world ?? null,
    playerId: localId,
    backend: "WebGPU",
    adapter: adapterInfo,
    assetErrors: [...assetErrors],
    camera: camera?.position.toArray(),
    rtt,
    render: renderer
      ? {
          drawCalls: renderer.info.render.drawCalls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          estimatedBytes: renderer.info.memory.total,
        }
      : null,
    p95:
      frameTimes.slice().sort((a, b) => a - b)[
        Math.floor(frameTimes.length * 0.95)
      ] ?? 0,
  }),
});

function notify(message: string) {
  $("notice").textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => ($("notice").textContent = ""), 6500);
}
function saveSettings() {
  localStorage.setItem("wu-settings", JSON.stringify(settings));
}
function command(
  type: Exclude<ClientMessage["type"], "input" | "ping" | "favorite">,
) {
  send({ type, seq: ++seq });
}
type WithoutWorld<T> = T extends {worldId: string} ? Omit<T, "worldId"> : never;
function send(message: WithoutWorld<ClientMessage>) {
  if (!worldReady || !world || socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({...message, worldId: world.id}));
  if (message.type === "input") {
    sent.set(message.value.seq, performance.now());
    if (sent.size > 100) sent.delete(sent.keys().next().value!);
  }
}
function input(): Input {
  return {
    seq,
    x:
      (pressed.has(settings.keys.right) ? 1 : 0) -
      (pressed.has(settings.keys.left) ? 1 : 0),
    z:
      (pressed.has(settings.keys.back) ? 1 : 0) -
      (pressed.has(settings.keys.forward) ? 1 : 0),
    yaw,
    pitch,
    run: pressed.has(settings.keys.run),
    crouch,
  };
}
function neutralize() {
  pressed.clear();
  if (socket?.readyState === WebSocket.OPEN)
    send({ type: "input", value: { ...input(), seq: ++seq } });
}
function predictStep(p: Player, held: Input, state: Snapshot): Player {
  return movePlayer(
    p,
    held,
    1 / 60,
    [
      ...world!.walls,
      ...fixtureBoxes(world!.fixtures, state.route),
      ...state.props
        .filter((prop) => !prop.holders.includes(p.id) && !prop.placed)
        .flatMap((prop) => propBoxes(prop, PROP_DEFINITIONS[prop.kind])),
    ],
    [...world!.walkables, ...fixtureSurfaces(world!.fixtures, state.route)],
    playerSpeed(p.id, held, state.props),
  );
}
function showDialog(id: string) {
  neutralize();
  document.exitPointerLock();
  const d = $<HTMLDialogElement>(id);
  if (!d.open) d.showModal();
  if (id === "notebook") {
    renderNotebook();
    drawMap();
  }
  if (id === "settings") void renderReassign();
}
function toggleCamera() {
  viewfinder = !viewfinder;
  document.body.classList.toggle("camera-view", viewfinder);
  $("viewfinder").hidden = !viewfinder;
  $("reticle").hidden = viewfinder;
  $("camera-button").textContent = viewfinder ? "Lower camera" : "Viewfinder";
}
function takePhoto() {
  if (!localId) return;
  send({ type: "input", value: { ...input(), seq: ++seq } });
  command("photo");
}
function lookAround() {
  if (!localId) return;
  void renderer.domElement.requestPointerLock();
}

async function api(path: string, body?: unknown) {
  const response = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      Error(result.error ?? `Request failed (${response.status})`),
      { status: response.status },
    );
  return result;
}
async function acceptSession(session: {
  playerId: string;
  host: boolean;
  pending?: boolean;
}) {
  sessionStorage.removeItem("wu-left");
  localId = session.playerId;
  isHost = session.host;
  if (session.pending) {
    $("join-status").textContent =
      "Waiting for the host to assign your returning field slot…";
    retryTimer = window.setTimeout(
      () =>
        void api("/api/session")
          .then(acceptSession)
          .catch(() => {
            $("join-status").textContent =
              "Waiting for the server to restore your field slot…";
            scheduleReconnect();
          }),
      1500,
    );
    return;
  }
  $("join").hidden = true;
  $("hud").hidden = false;
  $("invite-button").hidden = !isHost;
  $("stop-button").hidden = !isHost;
  openSocket();
}
async function installWorld(message: Extract<ServerMessage, {type: "world"}>) {
  const epoch = ++installEpoch;
  installingId = message.id; worldReady = false;
  latest = undefined; prior = undefined; predicted = undefined;
  history.clear(); sent.clear(); heard.clear(); pressed.clear(); queuedSnapshot = undefined;
  for (const [id, pending] of pendingFrames) if (pending.frame.worldId !== message.id) pendingFrames.delete(id);
  $("connection").textContent = "Loading reserve�";
  let nextView: Awaited<ReturnType<typeof createView>> | undefined;
  try {
    const blueprint = validateReserve(message.blueprint);
    if (message.id !== blueprint.id || await reserveHash(blueprint) !== message.hash) throw Error("Reserve digest or identity mismatch");
    if (epoch !== installEpoch) return;
    const nextScene = new THREE.Scene();
    nextView = await createView(nextScene, blueprint);
    if (epoch !== installEpoch) { nextView.dispose(); return; }
    if (nextView.errors.length) throw Error(nextView.errors.join("; "));
    view?.dispose(); view = nextView; scene = nextScene; world = blueprint; worldReady = true;
    camera.position.set(blueprint.camp[0], blueprint.camp[1] + 1.6, blueprint.camp[2]);
    document.body.dataset.world = blueprint.id;
    const pending = queuedSnapshot; queuedSnapshot = undefined;
    if (pending) receive(pending);
    for (const {frame, verdict} of pendingFrames.values()) if (frame.worldId === blueprint.id) queuePhoto(frame, verdict);
  } catch (error) {
    nextView?.dispose();
    if (epoch !== installEpoch) return;
    worldReady = false; assetErrors.push(String(error));
    notify(`Reserve could not be loaded. Refreshing connection: ${String(error)}`);
    socket?.close();
  }
}
function openSocket() {
  if (closing) return;
  clearTimeout(retryTimer);
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,
  );
  socket.onopen = () => {
    reconnectAttempt = 0;
    $("connection").textContent = "Connected · finding crew";
  };
  const connection = socket;
  socket.onmessage = (e) => {
    if (socket !== connection) return;
    try {
      const m = JSON.parse(e.data) as ServerMessage;
      if (m.type === "welcome") {
        localId = m.playerId;
        isHost = m.host;
      }
      if (m.type === "world") void installWorld(m);
      if (m.type === "notice") notify(m.text);
      if (m.type === "cue" && worldReady && m.worldId === world?.id && !heard.has(m.id)) {
        heard.add(m.id);
        if (heard.size > 128) heard.delete(heard.values().next().value!);
        const d = predicted ? distance(eye(predicted), m.position) : 0;
        playSound(m.kind, settings.volume * Math.max(0.05, 1 - d / 24));
        const who =
          latest?.players.find((p) => p.id === m.source)?.name ??
          (m.kind === "impact" ? "Field equipment" : "Wildlife");
        if (m.kind !== "shutter")
          notify(`${who} · ${m.kind === "impact" ? "clatter" : m.kind}`);
      }
      if (m.type === "photo" && m.frame.worldId === installingId) {
        pendingFrames.set(m.frame.id, { frame: m.frame, verdict: m.verdict });
        if (worldReady) queuePhoto(m.frame, m.verdict);
      }
      if (m.type === "snapshot") receive(m.value);
    } catch (error) {
      notify(`Connection data could not be read: ${String(error)}`);
    }
  };
  socket.onclose = () => {
    if (socket !== connection) return;
    ++installEpoch; worldReady = false; predicted = undefined; latest = undefined; prior = undefined;
    neutralize();
    history.clear();
    $("connection").textContent = closing ? "Server stopped" : "Reconnecting…";
    if (!closing) {
      notify("Connection interrupted. The crew can pause while you return.");
      scheduleReconnect();
    }
  };
  socket.onerror = () => {
    $("connection").textContent = "Connection unavailable";
  };
}
function scheduleReconnect() {
  if (closing) return;
  clearTimeout(retryTimer);
  retryTimer = window.setTimeout(
    () =>
      void api("/api/session")
        .then(acceptSession)
        .catch((error) => {
          if ([401, 403].includes(error.status)) {
            localId = "";
            $("join").hidden = false;
            $("hud").hidden = true;
            $("join-status").textContent =
              "Reconnect with your invitation or host key.";
          } else {
            $("connection").textContent = "Waiting for the server…";
            scheduleReconnect();
          }
        }),
    Math.min(10000, 1000 * 2 ** Math.min(4, reconnectAttempt++)),
  );
}
function receive(state: Snapshot) {
  if (state.version !== 3 || state.worldId !== installingId) { worldReady = false; predicted = undefined; socket?.close(); return; }
  if (!worldReady || state.worldId !== world?.id) { queuedSnapshot = state; return; }
  if (latest && state.observations.length > latest.observations.length)
    notify(state.observations.at(-1)!);
  prior = latest;
  latest = state;
  latestAt = performance.now();
  const p = state.players.find((p) => p.id === localId);
  if (p) {
    const before = prior?.players.find((p) => p.id === localId);
    const moved = before ? distance(before.position, p.position) : 0;
    if (state.paused || moved > 2) stepDistance = 0;
    else stepDistance += moved;
    if (stepDistance >= (p.lastInput?.run ? 1.35 : 0.9)) {
      playSound(
        "footstep",
        settings.volume * (p.lastInput?.crouch ? 0.15 : 0.4),
      );
      stepDistance = 0;
    }
    seq = Math.max(seq, p.lastSeq);
    const stamp = sent.get(p.lastSeq);
    if (stamp !== undefined)
      rtt = 0.8 * rtt + 0.2 * (performance.now() - stamp);
    for (const k of sent.keys()) if (k <= p.lastSeq) sent.delete(k);
    const end = predTick;
    predicted = structuredClone(p);
    predTick = state.tick;
    if (state.paused || end - state.tick > 120 || end < state.tick) {
      history.clear();
    } else {
      for (const k of history.keys()) if (k <= state.tick) history.delete(k);
      while (predTick < end) {
        const held =
          history.get(predTick + 1) ??
          (predTick - p.inputTick < 15 ? p.lastInput : null);
        if (held) predicted = predictStep(predicted, held, state);
        predTick++;
      }
    }
    if (!prior) {
      yaw = p.yaw;
      pitch = p.pitch;
    }
  }
  updateHud();
  if (state.phase === "exhibition" && prior?.phase !== "exhibition")
    showDialog("notebook");
}
function updateHud() {
  if (!latest) return;
  const s = latest;
  $("connection").textContent =
    `${s.players.filter((p) => p.connected).length}/4 in reserve · ${Math.round(rtt)} ms`;
  const list = $("assignments");
  list.replaceChildren();
  for (const commission of world!.commissions) {
    const li = document.createElement("li"); li.className = s.completed.includes(commission.id) ? "done" : "";
    li.textContent = `${commission.required ? "" : "Optional � "}${commission.title}`;
    const small = document.createElement("small"); small.textContent = commission.instructions; li.append(small); list.append(li);
  }
  const holder =
    s.tin.holder?.startsWith("animal:")
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
  const gate = world!.fixtures.filter(f => f.kind === "gate").map(f => ({...f, latch: fixtureLatch(f, s.route)})).filter(f => f.latch).sort((a,b) => me ? distance(eye(me), a.latch!) - distance(eye(me), b.latch!) : 0)[0], latch = gate?.latch;
  const gateReachable =
    !!me && !!latch &&
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
  const key = (name: keyof Keys) =>
    settings.keys[name].replace(/^(Key|Digit)/, "");
  const clue =
    me &&
    world!.commissions.map(c => ({title: c.title, position: world!.pockets.find(p => p.id === c.pocket)!.position})).filter(
      (c) =>
        distance(c.position, me.position) <= 3 &&
        !rayBlocked(eye(me), c.position, reachWalls),
    ).sort(
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
              : me && world!.pockets.some(p => p.anchors.some(a => a.kind === "feed" && distance(me.position, a.point) < 2.5))
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
        : world!.commissions.filter(c => c.required).every(c => s.completed.includes(c.id))
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
  const complete = world!.commissions.filter(c => c.required).every(c => s.completed.includes(c.id));
  $("ready-button").hidden = !complete || s.phase !== "outing";
  $("finish-button").hidden = !isHost || !complete || s.phase !== "outing";
  const atCamp = (p: Player) =>
    Math.hypot(p.position[0] - world!.camp[0], p.position[2] - world!.camp[2]) <= 6;
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
    pounce: "pouncing", nibble: "nibbling", cache: "caching", gnaw: "gnawing", groom: "grooming", dig: "digging", roost: "roosting", tap: "tapping", dabble: "dabbling",
  };
  $("camera-hint").textContent = me
    ? s.animals
        .filter((a) => {
          const point: Vec3 = [
            a.pose.position[0],
            a.pose.position[1] + 0.7,
            a.pose.position[2],
          ];
          return (
            distance(me.position, a.pose.position) < 20 &&
            !rayBlocked(eye(me), point, walls) &&
            !propRayBlocked(eye(me), point, s.props, PROP_DEFINITIONS)
          );
        })
        .map((a) => `${a.species}: ${behavior[a.behavior]}`)
        .join(" · ") || "Find a clear angle; give wildlife room."
    : "";
  if ($<HTMLDialogElement>("notebook").open) {
    renderNotebook();
    drawMap();
  }
}
function renderNotebook() {
  if (!latest) return;
  $("observations").replaceChildren(
    ...(latest.observations.length
      ? latest.observations
      : [
          "An open tin attracts curious noses. Try rattling it in the woodland, then give the visitor space.",
          "The pond feeding patch is marked by a pale ring. Bring the tin.",
        ]
    ).map((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    }),
  );
  const signature = JSON.stringify([
    latest.album,
    latest.players.map((p) => [p.id, p.name]),
    localId,
  ]);
  if (signature === albumSignature) return;
  albumSignature = signature;
  $("album").replaceChildren();
  if (!latest.album.length) {
    const p = document.createElement("p");
    p.className = "fine";
    p.textContent =
      "The best evidence has not happened yet. Everyone can take pictures.";
    $("album").append(p);
  }
  for (const photo of [...latest.album].reverse()) {
    const f = document.createElement("figure");
    f.dataset.photoId = photo.id;
    if (photo.thumbnail === "ready") {
      const image = document.createElement("img");
      image.src = `/api/photos/${encodeURIComponent(photo.id)}`;
      image.alt = photo.credits.length
        ? photo.credits.map((c) => commissionTitle(c)).join(", ")
        : "A shared field photograph";
      image.loading = "lazy";
      f.append(image);
    } else {
      const pending = document.createElement("div");
      pending.className = "pending";
      pending.textContent = "Image pending · credit saved";
      f.append(pending);
    }
    const caption = document.createElement("figcaption");
    caption.textContent = `${latest.players.find((p) => p.id === photo.photographer)?.name ?? "Researcher"} · ${photo.credits.map((c) => commissionTitle(c)).join(" / ") || "Field moment"}${photo.assists.length ? " · helped by " + photo.assists.map((id) => latest!.players.find((p) => p.id === id)?.name ?? "a friend").join(", ") : ""}`;
    f.append(caption);
    if (photo.incident) {
      const incident = document.createElement("small");
      incident.className = "fine";
      incident.textContent =
        photo.incident === "hat"
          ? "Caught the hat thief"
          : "Spilled snacks, excellent evidence";
      f.append(incident);
    }
    if (photo.thumbnail === "ready") {
      const b = document.createElement("button");
      const selected = photo.favorites.includes(localId);
      b.textContent = selected ? "★ Favorite" : "☆ Favorite";
      b.setAttribute("aria-pressed", String(selected));
      b.onclick = () => {
        const current = latest?.album.find((p) => p.id === photo.id);
        if (current)
          send({
            type: "favorite",
            seq: ++seq,
            photoId: photo.id,
            selected: !current.favorites.includes(localId),
          });
      };
      f.append(b);
      if (photo.favorites.length) {
        const crew = document.createElement("small");
        crew.className = "favorite-crew";
        crew.textContent =
          "Selected by " +
          photo.favorites
            .map(
              (id) =>
                latest!.players.find((p) => p.id === id)?.name ?? "Researcher",
            )
            .join(", ");
        f.append(crew);
      }
    }
    $("album").append(f);
  }
}
function drawMap() {
  if (!latest || !world) return;
  const c = $<HTMLCanvasElement>("map").getContext("2d")!;
  c.fillStyle = "#e3ddbf";
  c.fillRect(0, 0, 360, 260);
  const scale = Math.min(336 / (world.bounds.max[0] - world.bounds.min[0]), 236 / (world.bounds.max[2] - world.bounds.min[2]));
  const point = (p: number[]) => [180 + p[0] * scale, 130 + p[2] * scale];
  c.strokeStyle = "#b0a16e";
  c.lineWidth = 3;
  for (const trail of world.trails) {
    c.beginPath();
    for (const [i, p] of trail.points.entries()) {
      const [x, y] = point(p);
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  }
  c.fillStyle = "#7f9f8f";
  for (const water of world.waters) { const a = point(water.min), b = point(water.max); c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
  c.font = "9px system-ui";
  const labels: [string, Vec3][] = [["CAMP", world.camp], ...world.stations.map(s => ["SUPPLIES", s.position] as [string, Vec3]), ...world.pockets.map(p => [p.id.toUpperCase() + " " + p.habitat, p.position] as [string, Vec3])];
  for (const [name, p] of labels) { const [x,y] = point(p); c.fillStyle = "#4b6144"; c.fillText(name, x - 18, y - 8); }
  for (const node of world.navNodes.filter(n => n.id.includes("-camera-"))) { const [x,y] = point(node.position); c.fillStyle = "#ad955b"; c.fillRect(x-1,y-1,2,2); }
  latest.players
    .filter((p) => p.connected)
    .forEach((p) => {
      const [x, y] = point(p.position);
      c.fillStyle = `#${CREW_COLORS[p.slot].toString(16).padStart(6, "0")}`;
      c.beginPath();
      c.arc(x, y, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#142c24";
      c.font = "9px system-ui";
      c.fillText(String(p.slot + 1), x - 2.5, y + 3);
    });
  const [tx, ty] = point(latest.tin.pose.position);
  c.fillStyle = "#b2832d";
  c.fillRect(tx - 3, ty - 3, 6, 6);
}
function queuePhoto(frame: PhotoFrame, verdict: PhotoVerdict) {
  photoChain = photoChain
    .then(async () => {
      if (!latest || !worldReady || !world || frame.worldId !== world.id) return;
      const captureEpoch = installEpoch;
      const start = performance.now();
      const blob = await capturePhoto(
        renderer,
        scene,
        frame,
        world,
        () => { view.centerShadows(frame.camera.position);
          view.update(
            {
              ...latest!,
              tick: frame.tick,
              players: frame.players,
              animals: frame.animals,
              tin: frame.tin,
              worldId: frame.worldId,
              props: frame.props,
              route: frame.route,
              spills: frame.spills,
              hats: frame.hats,
            },
            frame.photographer,
            true,
          ); },
        () => {
          if (latest && worldReady) { view.update(latest, localId); view.centerShadows(camera.position.toArray() as Vec3); }
        },
      );
      if (captureEpoch !== installEpoch || frame.worldId !== world?.id) return;
      if (lastImageUrl) URL.revokeObjectURL(lastImageUrl);
      lastImageUrl = URL.createObjectURL(blob);
      $<HTMLImageElement>("photo-preview").src = lastImageUrl;
      $("photo-result").textContent = verdict.credits.length
        ? verdict.credits.map((c) => commissionTitle(c)).join(" · ")
        : verdict.reason;
      $("photo-toast").hidden = false;
      clearTimeout(photoTimer);
      photoTimer = window.setTimeout(
        () => ($("photo-toast").hidden = true),
        8000,
      );
      const response = await fetch(
        `/api/photos/${encodeURIComponent(frame.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: blob,
        },
      );
      if (!response.ok)
        throw Error(
          `Image upload failed (${response.status}). Credit is safe; retry in notebook.`,
        );
      pendingFrames.delete(frame.id);
      $("photo-toast").dataset.latency = String(
        Math.round(performance.now() - start),
      );
    })
    .catch((e) => notify(String(e)));
}
async function renderReassign() {
  if (!isHost || !latest) return;
  try {
    const info = await api("/api/invite");
    const waiting: { id: string; name: string }[] = info.pending ?? [];
    $("reassign").hidden = waiting.length === 0;
    $("reassign-list").replaceChildren();
    for (const p of waiting) {
      const row = document.createElement("p");
      row.textContent = p.name + " → ";
      const select = document.createElement("select");
      for (const slot of latest.players.filter((p) => !p.connected)) {
        const option = document.createElement("option");
        option.value = slot.id;
        option.textContent = slot.name;
        select.append(option);
      }
      row.append(select);
      const b = document.createElement("button");
      b.textContent = "Restore slot";
      b.onclick = () =>
        void api("/api/reassign", {
          slotId: select.value,
          admittedPlayerId: p.id,
        })
          .then(() => renderReassign())
          .catch((e) => notify(String(e)));
      row.append(b);
      $("reassign-list").append(row);
    }
  } catch (e) {
    notify(String(e));
  }
}
async function start() {
  if (!navigator.gpu)
    throw Error(
      "WebGPU is unavailable. Use an up-to-date desktop browser with hardware acceleration.",
    );
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw Error("No WebGPU adapter is available on this device.");
  adapterInfo = {
    vendor: adapter.info.vendor,
    architecture: adapter.info.architecture,
    device: adapter.info.device,
    description: adapter.info.description,
    isFallbackAdapter: adapter.info.isFallbackAdapter,
  };
  const device = await adapter.requestDevice();
  renderer = new THREE.WebGPURenderer({ antialias: true, device });
  await renderer.init();
  if (
    !(renderer.backend as unknown as { isWebGPUBackend?: boolean })
      .isWebGPUBackend
  )
    throw Error("A real WebGPU backend is required.");
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, CAMERA_FAR);
  camera.position.set(0, 1.6, 0);
  $("viewport").append(renderer.domElement);
  renderer.domElement.setAttribute(
    "aria-label",
    "Explore Willowmere wildlife reserve",
  );
  const resize = () => {
    const w = Math.min(innerWidth, (innerHeight * 16) / 9),
      h = (w * 9) / 16,
      x = (innerWidth - w) / 2,
      y = (innerHeight - h) / 2;
    renderer.setSize(w, h);
    Object.assign(renderer.domElement.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
    Object.assign($("viewfinder").style, {
      inset: "auto",
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
  };
  resize();

  document.body.dataset.ready = "webgpu";
  device.lost.then((info) => {
    notify(
      `Graphics device lost: ${info.message}. Reload to rejoin; the server keeps the outing.`,
    );
    neutralize();
  });
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now(),
      dt = Math.min(0.1, (now - last) / 1000);
    frameTimes.push(now - last);
    if (frameTimes.length > 1200) frameTimes.shift();
    last = now;
    if (document.pointerLockElement || !$<HTMLDialogElement>("settings").open) {
      if (pressed.has("ArrowLeft")) yaw += dt * 1.6;
      if (pressed.has("ArrowRight")) yaw -= dt * 1.6;
      if (pressed.has("ArrowUp")) pitch = Math.min(1.45, pitch + dt);
      if (pressed.has("ArrowDown")) pitch = Math.max(-1.45, pitch - dt);
    }
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    if (latest && worldReady && view?.worldId === latest.worldId) {
      if (predicted && !latest.paused && latest.phase !== "exhibition") {
        const target =
          latest.tick +
          Math.floor((now - latestAt + Math.min(150, rtt / 2)) / (1000 / 60));
        let count = 0;
        while (predTick < target && count++ < 15) {
          const held = input();
          predicted = predictStep(predicted, held, latest);
          history.set(++predTick, held);
        }
        for (const k of history.keys())
          if (k < predTick - 120) history.delete(k);
      }
      const renderState: Snapshot = {
        ...latest,
        players: latest.players.map((p) => ({
          ...p,
          position: [...p.position],
        })),
        animals: latest.animals.map((a) => ({
          ...a,
          pose: { ...a.pose, position: [...a.pose.position] },
        })),
        tin: {
          ...latest.tin,
          pose: { ...latest.tin.pose, position: [...latest.tin.pose.position] },
        },
        props: latest.props.map((prop) => ({
          ...prop,
          pose: {
            position: [...prop.pose.position],
            rotation: [...prop.pose.rotation],
          },
        })),
      };
      const alpha = Math.min(1, (now - latestAt) / 100);
      if (prior && !latest.paused) {
        for (const p of renderState.players) {
          const before = prior.players.find((x) => x.id === p.id);
          if (before)
            p.position = p.position.map(
              (n, i) => before.position[i] + (n - before.position[i]) * alpha,
            ) as [number, number, number];
        }
        for (const a of renderState.animals) {
          const before = prior.animals.find((x) => x.id === a.id);
          if (before)
            a.pose.position = a.pose.position.map(
              (n, i) =>
                before.pose.position[i] + (n - before.pose.position[i]) * alpha,
            ) as [number, number, number];
        }
        renderState.tin.pose.position = renderState.tin.pose.position.map(
          (n, i) =>
            prior!.tin.pose.position[i] +
            (n - prior!.tin.pose.position[i]) * alpha,
        ) as [number, number, number];
        for (const prop of renderState.props) {
          const before = prior.props.find((p) => p.id === prop.id);
          if (
            !before ||
            before.placed !== prop.placed ||
            before.holders.some((id, i) => id !== prop.holders[i])
          )
            continue;
          prop.pose.position = prop.pose.position.map(
            (n, i) =>
              before.pose.position[i] + (n - before.pose.position[i]) * alpha,
          ) as [number, number, number];
          prop.pose.rotation = new THREE.Quaternion(...before.pose.rotation)
            .slerp(new THREE.Quaternion(...prop.pose.rotation), alpha)
            .toArray() as [number, number, number, number];
        }
      }
      if (predicted) alignLocalCarry(renderState, localId, predicted.position);
      view.update(renderState, localId);
      if (predicted) {
        camera.position.set(...eye({ ...predicted, lastInput: input() }));
        camera.rotation.set(pitch, yaw, 0, "YXZ");
      }
    }
    if (worldReady) view.centerShadows(camera.position.toArray() as Vec3);
    renderer.render(scene, camera);
  });
  window.addEventListener("resize", resize);
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has("key")) {
    $<HTMLInputElement>("secret").value = fragment.get("key")!;
    historyReplace();
  }
  if (sessionStorage.getItem("wu-left") !== "1")
    try {
      await acceptSession(await api("/api/session"));
    } catch {
      /* A fresh visitor enters an invitation normally. */
    }
}
function historyReplace() {
  window.history.replaceState(null, "", location.pathname + location.search);
}
$<HTMLFormElement>("join-form").onsubmit = async (e) => {
  e.preventDefault();
  const button = $("join-form").querySelector("button")!;
  button.disabled = true;
  $("join-status").textContent = "Joining the field crew…";
  try {
    let secret = $<HTMLInputElement>("secret").value.trim();
    try {
      if (secret.includes("://"))
        secret =
          new URLSearchParams(new URL(secret).hash.slice(1)).get("key") ??
          secret;
    } catch {}
    await acceptSession(
      await api("/api/join", {
        name: $<HTMLInputElement>("name").value.trim(),
        secret,
      }),
    );
    $<HTMLInputElement>("secret").value = "";
  } catch (error) {
    $("join-status").textContent = String(error);
  } finally {
    button.disabled = false;
  }
};
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-close]"))
  b.onclick = () => $<HTMLDialogElement>(b.dataset.close!).close();
$("notebook-button").onclick = () => showDialog("notebook");
$("settings-button").onclick = () => showDialog("settings");
$("enter-controls").onclick = lookAround;
$("viewport").onclick = () => {
  if (localId && !document.pointerLockElement) lookAround();
};
$("camera-button").onclick = toggleCamera;
$("shutter-button").onclick = takePhoto;
for (const [id, type] of [
  ["start-button", "start"],
  ["pause-button", "pause"],
  ["resume-button", "resume"],
  ["ready-button", "ready-end"],
  ["finish-button", "finish"],
  ["recover-button", "recover"],
] as const)
  $(id).onclick = () => command(type);
$("stop-button").onclick = () => {
  command("save-and-stop");
  notify("Saving the outing and stopping the server…");
};
$("leave-button").onclick = () => {
  closing = true;
  sessionStorage.setItem("wu-left", "1");
  clearTimeout(retryTimer);
  neutralize();
  socket?.close();
  location.reload();
};
$("invite-button").onclick = () =>
  void api("/api/invite")
    .then(async (info) => {
      await navigator.clipboard.writeText(
        `${location.origin}/#key=${encodeURIComponent(info.secret)}`,
      );
      notify("Private invitation copied. Share it with your crew.");
    })
    .catch((e) => notify(String(e)));
$("retry-photos").onclick = () => {
  for (const p of pendingFrames.values()) queuePhoto(p.frame, p.verdict);
  if (!pendingFrames.size)
    notify(
      "No local pending frames. Rejoining also restores saved pending photos.",
    );
};
$<HTMLInputElement>("sensitivity").value = String(settings.sensitivity);
$<HTMLInputElement>("invert").checked = settings.invert;
$<HTMLInputElement>("volume").value = String(settings.volume);
for (const id of ["sensitivity", "invert", "volume"])
  $(id).onchange = () => {
    settings.sensitivity = Number($<HTMLInputElement>("sensitivity").value);
    settings.invert = $<HTMLInputElement>("invert").checked;
    settings.volume = Number($<HTMLInputElement>("volume").value);
    saveSettings();
  };
for (const action of Object.keys(keyDefaults) as (keyof Keys)[]) {
  const label = document.createElement("label");
  label.textContent = action;
  const control = document.createElement("input");
  control.value = settings.keys[action];
  control.readOnly = true;
  control.setAttribute("aria-label", `Rebind ${action}`);
  control.onkeydown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.code === "Escape") return;
    settings.keys[action] = e.code;
    control.value = e.code;
    saveSettings();
  };
  label.append(control);
  $("bindings").append(label);
}
window.addEventListener("keydown", (e) => {
  if (
    !localId ||
    e.target instanceof HTMLInputElement ||
    document.querySelector("dialog[open]")
  )
    return;
  if (
    Object.values(settings.keys).includes(e.code) ||
    e.code.startsWith("Arrow")
  )
    e.preventDefault();
  pressed.add(e.code);
  if (e.repeat) return;
  if (e.code === settings.keys.crouch) crouch = !crouch;
  if (e.code === settings.keys.interact) command("interact");
  if (e.code === settings.keys.drop) command("drop");
  if (e.code === settings.keys.use) command("use");
  if (e.code === settings.keys.notebook) showDialog("notebook");
  if (e.code === settings.keys.ping && predicted) {
    const p = eye(predicted),
      f = forward(yaw, pitch);
    const t = f[1] < -0.05 ? Math.min(30, -p[1] / f[1]) : 12;
    send({
      type: "ping",
      seq: ++seq,
      point: [p[0] + f[0] * t, 0, p[2] + f[2] * t],
    });
  }
  if (e.code === "Escape") showDialog("settings");
});
window.addEventListener("keyup", (e) => pressed.delete(e.code));
window.addEventListener("blur", neutralize);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) neutralize();
});
window.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement) {
    yaw -= e.movementX * 0.002 * settings.sensitivity;
    pitch = Math.max(
      -1.45,
      Math.min(
        1.45,
        pitch -
          e.movementY *
            0.002 *
            settings.sensitivity *
            (settings.invert ? -1 : 1),
      ),
    );
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  }
});
window.addEventListener("mousedown", (e) => {
  if (document.pointerLockElement) {
    if (e.button === 0) takePhoto();
    if (e.button === 2) toggleCamera();
  }
});
window.addEventListener("contextmenu", (e) => {
  if (localId) e.preventDefault();
});
document.addEventListener("pointerlockchange", () => {
  $("enter-controls").hidden = !!document.pointerLockElement;
  if (!document.pointerLockElement) neutralize();
});
setInterval(() => {
  if (localId && socket?.readyState === WebSocket.OPEN)
    send({ type: "input", value: { ...input(), seq: ++seq } });
}, 50);
void start().catch((error) => {
  $("join-status").textContent = String(error);
  console.error(error);
});
