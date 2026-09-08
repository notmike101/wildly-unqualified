/**
Server-only run state and bounded event/observation bookkeeping.
 */
import { type ReserveBlueprint } from '../../shared/world/world.ts';
import {
    type PhotoFrame,
    type Player,
    type Snapshot,
    type Vec3,
} from '../../shared/shared.ts';
import { type AnimalMemory } from './wildlife/encounters.ts';
type Action = {
    kind:
    'rattle' | 'whistle' | 'noise' | 'impact' | 'bait' | 'recover' | 'place';
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

/**
 * Compare horizontal separation against an inclusive radius.
 *
 * @param a - First world position
 * @param b - Second world position
 * @param r - Radius in metres
 * @returns Whether the X/Z distance is at most the radius.
 */
export const isNearby = (a: Vec3, b: Vec3, r: number) => Math.hypot(a[0] - b[0], a[2] - b[2]) <= r;

/**
 * Project a position onto the Y=0 plane.
 *
 * @param p - World position to flatten
 * @returns A new vector retaining X and Z.
 */
export const flat = (p: Vec3): Vec3 => [p[0], 0, p[2]];

/**
 * Append a new notebook observation once and retain the most recent 40 entries.
 *
 * @param run - Authoritative run to update
 * @param text - Observation text
 */
export const observe = (run: RunState, text: string) => {
    if (!run.observations.includes(text)) run.observations.push(text);
    run.observations = run.observations.slice(-40);
};

/**
 * Look up a connected crew member in the authoritative run.
 *
 * @param run - Authoritative run to search
 * @param id - Player ID
 * @returns The live player object; mutations affect the run.
 * @throws {Error} The player is missing or disconnected.
 */
export function player(run: RunState, id: string) {
    const p = run.players.find((p) => p.id === id && p.connected);

    if (!p) throw new Error('Player is disconnected');

    return p;
}

/**
 * Append a tick-stamped action with a copied point and retain the latest 128 events. Events
 * without a player use the tin as their source.
 *
 * @param run - Authoritative event history to update
 * @param kind - Action kind
 * @param p - Acting player, or null for a physical tin event
 * @param point - World-space event position
 */
export function event(
    run: RunState,
    kind: Action['kind'],
    p: Player | null,
    point: Vec3,
) {
    run.events.push({
        kind,
        player: p?.id ?? 'tin',
        point: [...point],
        tick: run.tick,
    });
    run.events = run.events.slice(-128);
}

export { isNearby as nearby };
