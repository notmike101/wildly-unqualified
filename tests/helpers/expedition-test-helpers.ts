import assert from 'node:assert/strict';
import {
    createRun,
    addPlayer,
    applyCommand,
    advanceRun,
    type RunState,
} from '../../src/server/simulation/game.ts';
import { animalRoute } from '../../src/server/simulation/wildlife/encounters.ts';
import {
    distance,
    eye,
    type Vec3,
    type Animal,
} from '../../src/shared/shared.ts';
import { subjectPoints } from '../../src/shared/world/level.ts';
import { rotate } from '../../src/shared/wildlife/wildlife.ts';

/**
 * Submit the next sequenced command for a player.
 *
 * @param run Mutable simulation state for this scenario.
 * @param type type.
 * @returns The authoritative command result.
 */
export function command(run: RunState, type: string) {
    return applyCommand(run, 'a', {
        worldId: run.worldId,
        type,
        seq: run.players[0].lastSeq + 1,
    });
}

/**
 * Create a deterministic active crew for the scenario.
 *
 * @param seed Deterministic world generation seed.
 * @returns The initialized simulation run.
 */
export function crew(seed = 7) {
    const run = createRun(seed, `field-${seed}`);

    addPlayer(run, 'a', 'A');
    addPlayer(run, 'b', 'B');
    command(run, 'start');

    return run;
}

/**
 * Submit movement/view input for the first crew member. Running is the inverse of the
 * crouch flag in this test helper.
 *
 * @param run - Test run to update
 * @param x - Horizontal input axis, default 0
 * @param z - Forward/back input axis, default 0
 * @param yaw - Yaw in radians, default 0
 * @param pitch - Pitch in radians, default 0
 * @param isCrouch - Crouch when true, otherwise run, default true
 * @throws {Error} Production input validation fails.
 */
export function input(
    run: RunState,
    x = 0,
    z = 0,
    yaw = 0,
    pitch = 0,
    isCrouch = true,
) {
    const p = run.players[0];

    applyCommand(run, p.id, {
        worldId: run.worldId,
        type: 'input',
        value: {
            seq: p.lastSeq + 1,
            x,
            z,
            yaw,
            pitch,
            run: !isCrouch,
            crouch: isCrouch,
        },
    });
}

/**
 * Advance ordinary movement toward a point for at most 120 simulated seconds, then
 * neutralize movement.
 *
 * @param run - Test run to update
 * @param target - World destination
 * @throws {AssertionError} The ordinary approach does not reach its tolerance before the
 * budget expires.
 */
export function walkTo(run: RunState, target: Vec3) {
    for (
        let left = 60 * 120;
        distance(run.players[0].position, target) > 0.12;
        left--
    ) {
        assert.ok(
            left > 0,
            `ordinary approach stalled at ${run.players[0].position} toward ${target}`,
        );
        const p = run.players[0].position,
            dx = target[0] - p[0],
            dz = target[2] - p[2],
            length = Math.max(1, Math.hypot(dx, dz));

        input(run, dx / length, dz / length, 0, 0, false);
        advanceRun(run, 1 / 60);
    }
    input(run);
}

/**
 * Walk the first test player through an authored route to the resident's camera node,
 * falling back to the nearest home-camera node.
 *
 * @param run - Test run to update
 * @param residentId - Resident ID in the test blueprint
 * @returns Selected authored camera node.
 * @throws {AssertionError} No actual route exists or a waypoint stalls.
 */
export function cameraApproach(run: RunState, residentId: string) {
    const r = run.world.residents.find((r) => r.id === residentId)!;
    const node
        = run.world.navNodes.find((n) => n.id === `${r.home}-camera-${r.species}`)
            ?? run.world.navNodes
                .filter((n) => n.id.startsWith(`${r.home}-camera-`))
                .toSorted(
                    (a, b) => distance(a.position, r.spawn) - distance(b.position, r.spawn),
                )[0];
    const route = animalRoute(run.players[0].position, node.id, run);

    assert.ok(route.length, 'actual camera route exists');
    for (const target of route) walkTo(run, target);

    return node;
}

/**
 * Aim the first test player's camera at the midpoint of the resident's first two
 * articulated photo samples.
 *
 * @param run - Test run to update
 * @param a - Animal being photographed
 */
export function aim(run: RunState, a: Animal) {
    const points = subjectPoints(a, run.tick).map(
        (p) => rotate(p, a.pose.rotation).map(
            (v, index) => v + a.pose.position[index],
        ) as Vec3,
    );
    const point = points[0].map((v, index) => (v + points[1][index]) / 2) as Vec3;

    aimPoint(run, point);
}

/**
 * Submit stationary crouched input with view angles aimed from the first player's eye to a
 * point.
 *
 * @param run - Test run to update
 * @param point - World-space camera target
 */
export function aimPoint(run: RunState, point: Vec3) {
    const from = eye(run.players[0]),
        dx = point[0] - from[0],
        dy = point[1] - from[1],
        dz = point[2] - from[2];

    input(run, 0, 0, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
}

/**
 * Wait until the expected socket condition is satisfied.
 *
 * @param run Mutable simulation state for this scenario.
 * @param isPredicate Condition that must become true before the deadline.
 * @param seconds Duration to advance at the production tick rate.
 */
export function until(run: RunState, isPredicate: () => boolean, seconds = 90) {
    for (let index = 0; index < seconds * 60; index++) {
        if (isPredicate()) return;
        input(run);
        advanceRun(run, 1 / 60);
    }
    assert.ok(
        isPredicate(),
        'expected local action did not occur through production ticks',
    );
}
