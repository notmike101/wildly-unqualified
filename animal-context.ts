/** Animal memory contract and authored habitat anchor lookup. */
import type { RunState } from "./game.ts";
import { type Animal, type Vec3 } from "./shared.ts";
export type AnimalMemory = {
  goal: string;
  recentGoals: string[];
  interestPoint: Vec3 | null;
  interestUntilTick: number;
  habituatedUntilTick: number;
  hatTarget: string | null;
};
export const anchorsFor = (run: RunState, a: Animal) => {
  const resident = run.world.residents.find((r) => r.id === a.id)!;
  return run.world.pockets
    .find((p) => p.id === resident.home)!
    .anchors.filter((anchor) => resident.anchors.includes(anchor.id));
};
export const homeFor = (run: RunState, a: Animal): Vec3 =>
  run.world.residents.find((r) => r.id === a.id)!.spawn;
export const anchorFor = (run: RunState, a: Animal, kind: string): Vec3 =>
  anchorsFor(run, a).find((anchor) => anchor.kind === kind)?.point ??
  homeFor(run, a);
