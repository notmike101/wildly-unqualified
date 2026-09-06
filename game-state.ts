/** Server-only run state and bounded event/observation bookkeeping. */
import { type ReserveBlueprint } from "./world.ts";
import {
  type PhotoFrame,
  type Player,
  type Snapshot,
  type Vec3,
} from "./shared.ts";
import { type AnimalMemory } from "./encounters.ts";
type Action = {
  kind:
    "rattle" | "whistle" | "noise" | "impact" | "bait" | "recover" | "place";
  player: string;
  point: Vec3;
  tick: number;
};
export type RunState = Snapshot & {
  world: ReserveBlueprint;
  pendingPhotos: Record<string, PhotoFrame>;
  hostId: string | null;
  events: Action[];
  cooldowns: Record<string, { use: number; photo: number }>;
  animalMemory: Record<string, AnimalMemory>;
  decisionSeconds: number;
  nextPhoto: number;
  tinRevision: number;
  lastImpactTick: number;
  failedSetups: number;
};
export const nearby = (a: Vec3, b: Vec3, r: number) =>
  Math.hypot(a[0] - b[0], a[2] - b[2]) <= r;
export const flat = (p: Vec3): Vec3 => [p[0], 0, p[2]];
export const observe = (run: RunState, text: string) => {
  if (!run.observations.includes(text)) run.observations.push(text);
  run.observations = run.observations.slice(-40);
};
export function player(run: RunState, id: string) {
  const p = run.players.find((p) => p.id === id && p.connected);
  if (!p) throw Error("Player is disconnected");
  return p;
}
export function event(
  run: RunState,
  kind: Action["kind"],
  p: Player | null,
  point: Vec3,
) {
  run.events.push({
    kind,
    player: p?.id ?? "tin",
    point: [...point],
    tick: run.tick,
  });
  run.events = run.events.slice(-128);
}
