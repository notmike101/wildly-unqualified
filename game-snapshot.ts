/** Copy public snapshots and freeze photo frames before asynchronous capture. */
import { eye, type PhotoFrame, type Snapshot } from "./shared.ts";
import { type RunState, player } from "./game-state.ts";
/**
 * Copy only public run fields for transport, excluding server memory, credentials, and
 * pending photographs.
 *
 * @param run - Authoritative run to copy
 * @returns A detached public snapshot.
 */
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
/**
 * Recursively freeze an acyclic object graph in place. Used only on detached photograph
 * data.
 *
 * @template T - Value type preserved by freezing.
 * @param value - Value to freeze, must not contain cycles
 * @returns The same value, recursively frozen at runtime.
 */
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}
/**
 * Copy and recursively freeze the scene and camera at the shutter tick. Consumes the next
 * photo number before asynchronous image capture.
 *
 * @param run - Authoritative run and photo counter to update
 * @param id - Connected photographer ID
 * @returns An immutable photograph frame detached from live state.
 * @throws {Error} The photographer is missing or disconnected.
 */
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
