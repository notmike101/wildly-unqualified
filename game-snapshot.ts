/** Copy public snapshots and freeze photo frames before asynchronous capture. */
import { eye, type PhotoFrame, type Snapshot } from "./shared.ts";
import { type RunState, player } from "./game-state.ts";
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
