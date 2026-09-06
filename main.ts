import { renderReassign, installJoinForm } from "./client-admission.ts";
import { renderHud } from "./hud.ts";
import { settings, setupSettings } from "./client-settings.ts";
import { api } from "./client-api.ts";
import { interpolateSnapshot } from "./client-interpolation.ts";
import { initializeGraphics } from "./client-graphics.ts";
import { renderNotebook, drawMap } from "./notebook.ts";
import * as THREE from "three/webgpu";
import {
  createView,
  capturePhoto,
  alignLocalCarry,
  playSound,
  CREW_COLORS,
} from "./view.ts";
import { PROP_DEFINITIONS, fixtureBoxes, fixtureSurfaces } from "./level.ts";
import {
  validateReserve,
  reserveHash,
  type ReserveBlueprint,
} from "./world.ts";
import {
  distance,
  eye,
  forward,
  movePlayer,
  playerSpeed,
  propBoxes,
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
const pressed = new Set<string>();
let crouch = false,
  yaw = 0,
  pitch = 0,
  seq = 0,
  localId = "",
  isHost = false,
  closing = false,
  socket: WebSocket | undefined;
let world: ReserveBlueprint | undefined,
  worldReady = false,
  installEpoch = 0,
  installingId = "",
  queuedSnapshot: Snapshot | undefined;
/**
 * Resolve a commission's display title from the installed world.
 *
 * @param id - Commission ID
 * @returns Commission title, or the supplied ID if no match exists.
 */
const commissionTitle = (id: string) =>
  world?.commissions.find((c) => c.id === id)?.title ?? id;
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
Object.defineProperty(window, "wildly", {
  /**
   * Expose read-only diagnostic values for the acceptance driver, copying mutable
   * snapshot/error data and reporting renderer/frame metrics.
   *
   * @returns Diagnostic state; the world reference is the installed frozen blueprint.
   */
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

/**
 * Replace the transient notice text and restart its 6.5-second dismissal timer.
 *
 * @param message - User-facing message
 */
function notify(message: string) {
  $("notice").textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => ($("notice").textContent = ""), 6500);
}
/**
 * Allocate a sequence number and send a simple gameplay command for the installed world.
 *
 * @param type - Command kind without input, ping, or favorite-specific fields
 */
function command(
  type: Exclude<ClientMessage["type"], "input" | "ping" | "favorite">,
) {
  send({ type, seq: ++seq });
}
type WithoutWorld<T> = T extends { worldId: string }
  ? Omit<T, "worldId">
  : never;
/**
 * Attach the installed world ID and send only while the world and socket are ready. Tracks
 * recent input timestamps for RTT estimation.
 *
 * @param message - Client message without its world ID
 */
function send(message: WithoutWorld<ClientMessage>) {
  if (!worldReady || !world || socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ ...message, worldId: world.id }));
  if (message.type === "input") {
    sent.set(message.value.seq, performance.now());
    if (sent.size > 100) sent.delete(sent.keys().next().value!);
  }
}
/**
 * Read current key state and view angles into the wire input shape without incrementing the
 * sequence.
 *
 * @returns Fresh input object using the current sequence.
 */
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
/**
 * Clear pressed movement keys and, when connected, send an updated input sequence so the
 * server stops stale movement.
 */
function neutralize() {
  pressed.clear();
  if (socket?.readyState === WebSocket.OPEN)
    send({ type: "input", value: { ...input(), seq: ++seq } });
}
/**
 * Apply one 1/60-second movement step using the installed world's geometry and snapshot
 * equipment limits.
 *
 * @param p - Starting predicted player
 * @param held - Held input for this tick
 * @param state - Snapshot supplying route and prop state
 * @returns New predicted player state.
 */
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
/**
 * Clear movement, release pointer lock, and open a page dialog. Refreshes notebook or
 * host-reassignment content when applicable.
 *
 * @param id - Dialog element ID
 */
function showDialog(id: string) {
  neutralize();
  document.exitPointerLock();
  const d = $<HTMLDialogElement>(id);
  if (!d.open) d.showModal();
  if (id === "notebook") {
    renderNotebook(latest, localId, commissionTitle, toggleFavorite);
    drawMap(latest, world, CREW_COLORS);
  }
  if (id === "settings")
    void renderReassign(() => ({ isHost, latest }), notify);
}
/**
 * Toggle viewfinder mode and update camera controls and reticle visibility.
 */
function toggleCamera() {
  viewfinder = !viewfinder;
  document.body.classList.toggle("camera-view", viewfinder);
  $("viewfinder").hidden = !viewfinder;
  $("reticle").hidden = viewfinder;
  $("camera-button").textContent = viewfinder ? "Lower camera" : "Viewfinder";
}
/**
 * Send current view input before requesting an authoritative shutter frame. Does nothing
 * before admission.
 */
function takePhoto() {
  if (!localId) return;
  send({ type: "input", value: { ...input(), seq: ++seq } });
  command("photo");
}
/**
 * Request pointer lock on the renderer canvas after admission.
 */
function lookAround() {
  if (!localId) return;
  void renderer.domElement.requestPointerLock();
}

/**
 * Install the admitted identity and host controls. Pending sessions poll for slot
 * assignment; active sessions reveal the HUD and connect the socket.
 *
 * @param session - Public admission identity returned by the server
 * @param session.playerId - Stable admitted player identifier
 * @param session.host - Whether the player owns the host role
 * @param session.pending - Whether host slot reassignment is still required
 */
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
/**
 * Validate the blueprint identity/hash and asynchronously replace the scene. Epoch checks
 * discard obsolete loads; failures dispose the candidate view and notify the player.
 *
 * @param message - Server world message containing blueprint, ID, and digest
 */
async function installWorld(
  message: Extract<ServerMessage, { type: "world" }>,
) {
  const epoch = ++installEpoch;
  installingId = message.id;
  worldReady = false;
  latest = undefined;
  prior = undefined;
  predicted = undefined;
  history.clear();
  sent.clear();
  heard.clear();
  pressed.clear();
  queuedSnapshot = undefined;
  for (const [id, pending] of pendingFrames)
    if (pending.frame.worldId !== message.id) pendingFrames.delete(id);
  $("connection").textContent = "Loading reserve...";
  let nextView: Awaited<ReturnType<typeof createView>> | undefined;
  try {
    const blueprint = validateReserve(message.blueprint);
    if (
      message.id !== blueprint.id ||
      (await reserveHash(blueprint)) !== message.hash
    )
      throw Error("Reserve digest or identity mismatch");
    if (epoch !== installEpoch) return;
    const nextScene = new THREE.Scene();
    nextView = await createView(nextScene, blueprint);
    if (epoch !== installEpoch) {
      nextView.dispose();
      return;
    }
    if (nextView.errors.length) throw Error(nextView.errors.join("; "));
    view?.dispose();
    view = nextView;
    scene = nextScene;
    world = blueprint;
    worldReady = true;
    reconnectAttempt = 0;
    camera.position.set(
      blueprint.camp[0],
      blueprint.camp[1] + 1.6,
      blueprint.camp[2],
    );
    document.body.dataset.world = blueprint.id;
    const pending = queuedSnapshot;
    queuedSnapshot = undefined;
    if (pending) receive(pending);
    for (const { frame, verdict } of pendingFrames.values())
      if (frame.worldId === blueprint.id) queuePhoto(frame, verdict);
  } catch (error) {
    nextView?.dispose();
    if (epoch !== installEpoch) return;
    worldReady = false;
    assetErrors.push(String(error));
    notify(
      `Reserve could not be loaded. Refreshing connection: ${String(error)}`,
    );
    socket?.close();
  }
}
/**
 * Connect to the same-origin game socket and install handlers for identity, worlds,
 * snapshots, cues, and photo frames. Stale socket callbacks cannot replace newer connection
 * state.
 */
function openSocket() {
  if (closing) return;
  clearTimeout(retryTimer);
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,
  );
  /** Show transport connection before the server supplies crew and world state. */
  socket.onopen = () => {
    $("connection").textContent = "Connected · finding crew";
  };
  const connection = socket;
  /**
   * Dispatch a server message only while this socket remains the active connection.
   * Parsing failures become user notices rather than escaping the event handler.
   *
   * @param e - WebSocket message carrying server JSON
   */
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
      if (
        m.type === "cue" &&
        worldReady &&
        m.worldId === world?.id &&
        !heard.has(m.id)
      ) {
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
  /** Invalidate world loads and prediction after disconnection, then schedule restoration. */
  socket.onclose = () => {
    if (socket !== connection) return;
    ++installEpoch;
    worldReady = false;
    predicted = undefined;
    latest = undefined;
    prior = undefined;
    neutralize();
    history.clear();
    $("connection").textContent = closing ? "Server stopped" : "Reconnecting…";
    if (!closing) {
      notify("Connection interrupted. The crew can pause while you return.");
      scheduleReconnect();
    }
  };
  /** Show a transport error; the close handler owns reconnection scheduling. */
  socket.onerror = () => {
    $("connection").textContent = "Connection unavailable";
  };
}
/**
 * Schedule session restoration with bounded exponential backoff. Authorization failures
 * return to admission; transient failures retry.
 */
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
/**
 * Accept snapshots for the installing world, queue them during loading, and reconcile
 * prediction against authoritative sequences. Updates feedback, RTT, HUD, and exhibition
 * dialog state.
 *
 * @param state - Incoming authoritative snapshot
 */
function receive(state: Snapshot) {
  if (state.version !== 3 || state.worldId !== installingId) {
    worldReady = false;
    predicted = undefined;
    socket?.close();
    return;
  }
  if (!worldReady || state.worldId !== world?.id) {
    queuedSnapshot = state;
    return;
  }
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
/**
 * Render HUD state and refresh notebook/map content only while the notebook is open.
 */
function updateHud() {
  renderHud(latest, world, localId, isHost, rtt, settings);
  if ($<HTMLDialogElement>("notebook").open) {
    renderNotebook(latest, localId, commissionTitle, toggleFavorite);
    drawMap(latest, world, CREW_COLORS);
  }
}
/**
 * Request the inverse of the local player's current favorite selection for an existing
 * album record.
 *
 * @param photoId - Photo ID in the current album
 */
function toggleFavorite(photoId: string) {
  const current = latest?.album.find((p) => p.id === photoId);
  if (current)
    send({
      type: "favorite",
      seq: ++seq,
      photoId,
      selected: !current.favorites.includes(localId),
    });
}
/**
 * Serialize frozen-frame capture and upload, restoring live rendering after each capture.
 * Drops obsolete world completions and retains pending frames on failure for retry.
 *
 * @param frame - Frozen server-authorized shutter frame
 * @param verdict - Server scoring result shown beside the preview
 */
function queuePhoto(frame: PhotoFrame, verdict: PhotoVerdict) {
  photoChain = photoChain
    .then(async () => {
      if (!latest || !worldReady || !world || frame.worldId !== world.id)
        return;
      const captureEpoch = installEpoch;
      const start = performance.now();
      const blob = await capturePhoto(
        renderer,
        scene,
        frame,
        world,
        () => {
          view.centerShadows(frame.camera.position);
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
          );
        },
        () => {
          if (latest && worldReady) {
            view.update(latest, localId);
            view.centerShadows(camera.position.toArray() as Vec3);
          }
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
/**
 * Initialize WebGPU and the render/prediction loop, consume invite fragments, and try
 * restoring a session. Rendering owns the resize listener for the page lifetime.
 *
 * @throws {Error} Graphics initialization fails; the startup caller displays the failure.
 */
async function start() {
  const graphics = await initializeGraphics(notify, neutralize);
  ({ renderer, scene, camera, adapterInfo } = graphics);
  const { resize } = graphics;
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
      const renderState = interpolateSnapshot(
        latest,
        prior,
        Math.min(1, (now - latestAt) / 100),
      );
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
/**
 * Remove the invite fragment from the current history entry while preserving the path and
 * query.
 */
function historyReplace() {
  window.history.replaceState(null, "", location.pathname + location.search);
}
installJoinForm(acceptSession);
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-close]"))
  /**
   * Close the dialog identified by this button's data-close attribute.
   *
   * @returns No value after requesting dialog closure.
   */
  b.onclick = () => $<HTMLDialogElement>(b.dataset.close!).close();
/**
 * Open and refresh the notebook from the toolbar.
 *
 * @returns No value after opening the dialog.
 */
$("notebook-button").onclick = () => showDialog("notebook");
/**
 * Open settings and refresh host admission controls from the toolbar.
 *
 * @returns No value after opening the dialog.
 */
$("settings-button").onclick = () => showDialog("settings");
$("enter-controls").onclick = lookAround;
/** Enter pointer-look controls when an admitted player clicks the unlocked viewport. */
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
  /**
   * Send the gameplay command associated with this toolbar button.
   *
   * @returns No value after attempting command dispatch.
   */
  $(id).onclick = () => command(type);
/** Request the host's save-and-stop action and show immediate progress feedback. */
$("stop-button").onclick = () => {
  command("save-and-stop");
  notify("Saving the outing and stopping the server…");
};
/** Record an intentional departure, stop reconnect attempts, and reload into admission. */
$("leave-button").onclick = () => {
  closing = true;
  sessionStorage.setItem("wu-left", "1");
  clearTimeout(retryTimer);
  neutralize();
  socket?.close();
  location.reload();
};
/**
 * Copy the host's private invitation link, reporting request or clipboard failures.
 *
 * @returns No value; request and clipboard failures are displayed asynchronously.
 */
$("invite-button").onclick = () =>
  void api("/api/invite")
    .then(async (info) => {
      await navigator.clipboard.writeText(
        `${location.origin}/#key=${encodeURIComponent(info.secret)}`,
      );
      notify("Private invitation copied. Share it with your crew.");
    })
    .catch((e) => notify(String(e)));
/** Retry locally retained photo frames or explain how to recover saved pending captures. */
$("retry-photos").onclick = () => {
  for (const p of pendingFrames.values()) queuePhoto(p.frame, p.verdict);
  if (!pendingFrames.size)
    notify(
      "No local pending frames. Rejoining also restores saved pending photos.",
    );
};
setupSettings();
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
