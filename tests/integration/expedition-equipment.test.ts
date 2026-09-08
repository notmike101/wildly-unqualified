import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceRun, type RunState } from '../../src/server/simulation/game.ts';
import { animalRoute } from '../../src/server/simulation/wildlife/encounters.ts';
import {
    PROP_DEFINITIONS,
    fixtureBoxes,
} from '../../src/shared/world/level.ts';
import {
    distance,
    propertyPoint,
    propertyBoxes,
    isRayBlocked,
    type FieldProperty,
    type Vec3,
} from '../../src/shared/shared.ts';
import { rotate, xyz } from '../../src/shared/wildlife/wildlife.ts';
import {
    crew,
    input,
    command,
    walkTo,
    cameraApproach,
    until,
    aim,
} from '../helpers/expedition-test-helpers.ts';

// Read-only guidance follows the generated four-metre trail edges. Progress
// always comes from ordinary input, E/Q and production ticks.

/**
 * Find the lowest cost path through generated trail nodes.
 *
 * @param run Mutable simulation state for this scenario.
 * @param from Starting navigation node identifier.
 * @param to Destination navigation node identifier.
 * @returns Ordered world positions along the selected route.
 */
function trail(run: RunState, from: string, to: string) {
    const nodes = new Map(run.world.navNodes.map((n) => [n.id, n]));
    const open = new Set([from]),
        costs = new Map([[from, 0]]),
        previous = new Map<string, string>();

    while (open.size > 0) {
        const id = [...open].toSorted((a, b) => costs.get(a)! - costs.get(b)!)[0];

        open.delete(id);
        if (id === to) {
            const result = [nodes.get(id)!.position];
            let cursor = id;

            while (previous.has(cursor)) {
                cursor = previous.get(cursor)!;
                result.unshift(nodes.get(cursor)!.position);
            }

            return result;
        }
        for (const next of nodes.get(id)!.links) {
            const cost
                = costs.get(id)!
                    + distance(nodes.get(id)!.position, nodes.get(next)!.position);

            if (cost < (costs.get(next) ?? Infinity)) {
                costs.set(next, cost);
                previous.set(next, id);
                open.add(next);
            }
        }
    }
    throw new Error('no generated equipment trail');
}

/**
 * Carry equipment toward the target using player controls.
 *
 * @param run Mutable simulation state for this scenario.
 * @param property Equipment item to carry through ordinary player input.
 * @param target Desired equipment position.
 * @param shouldDetour Whether to try intermediate points around obstacles.
 */
function carryTo(
    run: RunState,
    property: FieldProperty,
    target: Vec3,
    shouldDetour = true,
) {
    const bounds = propertyBoxes(property, PROP_DEFINITIONS[property.kind]);
    const min = [0, 1, 2].map(
        (index) => Math.min(...bounds.map((b) => b.min[index]))
            - property.pose.position[index],
    );
    const max = [0, 1, 2].map(
        (index) => Math.max(...bounds.map((b) => b.max[index]))
            - property.pose.position[index],
    );
    const obstacles = [
        ...run.world.walls,
        ...fixtureBoxes(run.world.fixtures, run.route),
        ...run.props
            .filter((p) => p.id !== property.id)
            .flatMap((p) => propertyBoxes(p, PROP_DEFINITIONS[p.kind])),
    ].map((b) => ({
        id: b.id,
        min: b.min.map((v, index) => v - max[index] - 0.025) as Vec3,
        max: b.max.map((v, index) => v - min[index] + 0.025) as Vec3,
    }));
    const at = (p: Vec3): Vec3 => [p[0], property.pose.position[1], p[2]];
    const isClear = (a: Vec3, b: Vec3) => !isRayBlocked(at(a), at(b), obstacles);

    if (shouldDetour && !isClear(property.pose.position, target)) {
        const middle = target.map(
            (v, index) => (v + property.pose.position[index]) / 2,
        ) as Vec3;
        const candidates = [1, 2, 3, 4, 5].flatMap((radius) => Array.from(
            { length: 16 },
            (_, index) => [
                middle[0] + Math.cos((index * Math.PI) / 8) * radius,
                0,
                middle[2] + Math.sin((index * Math.PI) / 8) * radius,
            ] as Vec3,
        ),
        );
        const via = candidates.find(
            (p) => isClear(property.pose.position, p) && isClear(p, target),
        );

        assert.ok(
            via,
            `no ordinary local carry shouldDetour for ${property.id} to ${target}`,
        );
        carryTo(run, property, via, false);
    }
    for (
        let left = 180 * 60;
        Math.hypot(
            property.pose.position[0] - target[0],
            property.pose.position[2] - target[2],
        ) > 0.2;
        left--
    ) {
        assert.ok(
            left > 0,
            `ordinary ${property.kind} carry stalled: player ${run.players[0].position}, prop ${property.pose.position}, target ${target}`,
        );
        const dx = target[0] - property.pose.position[0],
            dz = target[2] - property.pose.position[2],
            length = Math.max(1, Math.hypot(dx, dz));

        input(run, dx / length, dz / length, 0, 0, false);
        advanceRun(run, 1 / 60);
    }
    input(run);
}

/**
 * Move a crew member into range and pick up equipment.
 *
 * @param run Mutable simulation state for this scenario.
 * @param kind Required fixture or behavior kind.
 * @returns The selected equipment item.
 */
function pickUp(run: RunState, kind: 'screen' | 'decoy') {
    const property = run.props.find((p) => p.kind === kind)!;
    const handle = propertyPoint(
        PROP_DEFINITIONS[kind].handles[kind === 'screen' ? 1 : 0],
        property.pose,
    );

    if (kind === 'decoy') {
        walkTo(run, [handle[0] + 1, 0, run.players[0].position[2]]);
        walkTo(run, [handle[0] + 1, 0, handle[2] + 0.65]);
    }
    walkTo(
        run,
        kind === 'screen'
            ? [handle[0] + 0.5, 0, handle[2]]
            : [handle[0], 0, handle[2] + 0.65],
    );
    command(run, 'interact');
    assert.ok(property.holders.includes('a'), `ordinary E should select ${kind}`);

    return property;
}

test('ordinary equipment transport and a replenished tin earn a rabbit feeding setup', (t) => {
    const run = crew(23),
        c = run.world.commissions.find((c) => c.kind === 'setup')!,
        a = run.animals.find((a) => a.id === c.subjects[0])!;
    const pocket = run.world.pockets.find((p) => p.id === c.pocket)!,
        feed = pocket.anchors.find((a) => a.id === c.anchor)!.point;
    const yaw = run.world.placements.find(
        (p) => p.id === pocket.id + '-landmark',
    )!.yaw;
    const local = (offset: Vec3) => rotate(offset, xyz([0, yaw, 0])).map((v, index) => v + feed[index]) as Vec3;
    const camera = run.world.navNodes
        .filter((n) => n.id.startsWith(pocket.id + '-camera-'))
        .toSorted(
            (a, b) => distance(a.position, feed) - distance(b.position, feed),
        )[0];

    for (const kind of ['decoy', 'screen'] as const) {
        if (kind === 'screen') {
            const items1 = animalRoute(run.players[0].position, 'camp', run);

            for (const point of items1) walkTo(run, point);
        }
        const property = pickUp(run, kind);

        const items2 = trail(run, 'camp', camera.id);

        for (const point of items2) carryTo(run, property, point);
        carryTo(
            run,
            property,
            local(kind === 'decoy' ? [-1.2, 0, 1.2] : [2.3, 0, 3]),
        );
        command(run, 'interact');
        assert.ok(!property.holders.some(Boolean));
        if (kind === 'decoy') {
            const cup = propertyPoint(
                PROP_DEFINITIONS.decoy.usePoints![0].point,
                property.pose,
            );

            walkTo(run, [cup[0] + 0.65, 0, cup[2]]);
            command(run, 'use');
            assert.ok(property.open, 'ordinary Q fills the decoy cup');
        }
    }
    const items3 = animalRoute(run.players[0].position, 'camp', run);

    for (const point of items3) walkTo(run, point);
    walkTo(run, [run.tin.pose.position[0], 0, run.tin.pose.position[2] - 0.7]);
    command(run, 'interact');
    assert.equal(run.tin.holder, 'a');
    command(run, 'use');
    assert.equal(
        run.spareBait,
        8,
        'camp replaces the portion used in the actual decoy',
    );
    cameraApproach(run, a.id);
    walkTo(run, local([1.2, 0, 1.2]));
    command(run, 'interact');
    assert.ok(run.tin.open && !run.tin.holder);
    walkTo(run, camera.position);
    until(run, () => a.behavior === 'feed', 120);
    aim(run, a);
    const result = command(run, 'photo')!;

    t.diagnostic(
        JSON.stringify({
            seed: 23,
            tick: run.tick,
            animal: a.id,
            credits: result.verdict.credits,
            propPositions: run.props
                .filter((p) => p.kind !== 'plank')
                .map((p) => [p.kind, p.pose.position]),
        }),
    );
    assert.ok(result.verdict.credits.includes(c.id), result.verdict.reason);
});
