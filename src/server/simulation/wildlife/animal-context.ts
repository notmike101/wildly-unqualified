/**
Animal memory contract and authored habitat anchor lookup.
 */
import type { RunState } from '../game.ts';
import { type Animal, type Vec3 } from '../../../shared/shared.ts';
export type AnimalMemory = {
    goal: string;
    recentGoals: string[];
    interestPoint: Vec3 | null;
    interestUntilTick: number;
    habituatedUntilTick: number;
    hatTarget: string | null;
};

/**
 * Resolve the resident's allowed habitat anchors. Requires a validated world containing the
 * animal and its home pocket.
 *
 * @param run - Run containing the validated blueprint
 * @param a - Resident animal to look up
 * @returns Matching authored anchors, retaining their world references.
 */
export const anchorsFor = (run: RunState, a: Animal) => {
    const resident = run.world.residents.find((r) => r.id === a.id)!;

    return run.world.pockets
        .find((p) => p.id === resident.home)!
        .anchors.filter((anchor) => resident.anchors.includes(anchor.id));
};

/**
 * Resolve the resident's authored spawn. Requires the animal to belong to the validated
 * world.
 *
 * @param run - Run containing the validated blueprint
 * @param a - Resident animal to look up
 * @returns The blueprint's spawn vector; callers must copy it before mutation.
 */
export const homeFor = (run: RunState, a: Animal): Vec3 => run.world.residents.find((r) => r.id === a.id)!.spawn;

/**
 * Find the first allowed anchor of a kind, falling back to the resident's spawn.
 *
 * @param run - Run containing the validated blueprint
 * @param a - Resident animal to look up
 * @param kind - Requested habitat anchor kind
 * @returns The authored anchor or spawn vector; callers must not mutate it.
 */
export const anchorFor = (run: RunState, a: Animal, kind: string): Vec3 => anchorsFor(run, a).find((anchor) => anchor.kind === kind)?.point
    ?? homeFor(run, a);
