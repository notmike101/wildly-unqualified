/** Public game API. Implementations are grouped by lifecycle, commands, simulation, and snapshots. */
export { type RunState } from "./game-state.ts";
export { evaluatePhoto } from "./photo.ts";

export { advanceRun } from "./game-simulation.ts";
export {
  createRun,
  addPlayer,
  disconnectPlayer,
  attachPhysics,
} from "./game-lifecycle.ts";
export { applyCommand } from "./game-commands.ts";
export { snapshot, makePhotoFrame } from "./game-snapshot.ts";
