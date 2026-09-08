import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distance, eye, type Vec3 } from '../../src/shared/shared.ts';
import { evaluatePhoto, advanceRun } from '../../src/server/simulation/game.ts';
import { subjectPoints } from '../../src/shared/world/level.ts';
import { rotate } from '../../src/shared/wildlife/wildlife.ts';
import {
    crew,
    cameraApproach,
    until,
    aim,
    command,
    aimPoint,
    input,
    walkTo,
} from '../helpers/expedition-test-helpers.ts';

test("the bound raccoon's borrowed hat can be photographed and recovered through ordinary actions", (t) => {
    const run = crew(7),
        c = run.world.commissions.find((c) => c.kind === 'incident')!,
        a = run.animals.find((a) => a.id === c.subjects[0])!;

    cameraApproach(run, a.id);

    // Read-only approach guidance selects the exposed side of the bound animal,
    // rather than walking through a neighbour's one-hat interaction radius.

    const neighbors = run.animals.filter(
        (other) => other.species === 'raccoon' && other.id !== a.id,
    );
    const center = [...a.pose.position] as Vec3;
    const angles = Array.from(
        { length: 32 },
        (_, index) => (index * Math.PI) / 16,
    );
    const score = (angle: number) => Math.min(
        ...neighbors.map((other) => distance(
            [center[0] + Math.cos(angle), 0, center[2] + Math.sin(angle)],
            other.pose.position,
        ),
        ),
    );
    const toward = angles.toSorted((a, b) => score(b) - score(a))[0];
    const angle = Math.atan2(
        run.players[0].position[2] - center[2],
        run.players[0].position[0] - center[0],
    );
    const delta = Math.atan2(Math.sin(toward - angle), Math.cos(toward - angle));
    const steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.2));

    for (let index = 0; index <= steps; index++) {
        const at = angle + (delta * index) / steps;

        walkTo(run, [
            center[0] + Math.cos(at) * 4,
            0,
            center[2] + Math.sin(at) * 4,
        ]);
    }
    for (
        let index = 0;
        index < 60 * 150 && run.hats.every((h) => h.carrier !== `animal:${a.id}`);
        index++
    ) {
        const p = run.players[0].position,
            dx = a.pose.position[0] - p[0],
            dz = a.pose.position[2] - p[2],
            d = Math.hypot(dx, dz),
            speed = d > 1 ? Math.min(1, (d - 0.9) * 2) : 0;

        input(
            run,
            (dx / Math.max(d, 1e-9)) * speed,
            (dz / Math.max(d, 1e-9)) * speed,
        );
        advanceRun(run, 1 / 60);
        const otherHat = run.hats.find(
            (h) => h.carrier !== 'owner'
                && h.carrier !== `animal:${a.id}`
                && distance(eye(run.players[0]), h.position) < 1.7,
        );

        if (otherHat) command(run, 'interact');
    }
    const hat = run.hats.find((h) => h.carrier === `animal:${a.id}`);

    t.diagnostic(
        JSON.stringify({
            tick: run.tick,
            player: run.players[0].position,
            animal: a,
            hat: run.hats,
        }),
    );
    assert.ok(
        hat,
        "a close ordinary observer causes the bound raccoon's one shared hat incident",
    );
    aimPoint(
        run,
        a.pose.position.map(
            (v, index) => (v + hat.position[index]) / 2 + (index === 1 ? 0.15 : 0),
        ) as Vec3,
    );
    const result = command(run, 'photo')!;

    assert.ok(result.verdict.credits.includes(c.id), result.verdict.reason);
    const cropped = structuredClone(result.frame);
    const points = subjectPoints(a, run.tick).map(
        (p) => rotate(p, a.pose.rotation).map(
            (v, index) => v + a.pose.position[index],
        ) as Vec3,
    );
    const framed = (point: Vec3, pitch: number) => {
        const [dx, dy, dz] = point.map(
                (v, index) => v - cropped.camera.position[index],
            ),
            yaw = cropped.camera.yaw;
        const depth
            = -Math.sin(yaw) * Math.cos(pitch) * dx
                + Math.sin(pitch) * dy
                - Math.cos(yaw) * Math.cos(pitch) * dz;
        const up
            = Math.sin(yaw) * Math.sin(pitch) * dx
                + Math.cos(pitch) * dy
                + Math.cos(yaw) * Math.sin(pitch) * dz;
        const right = Math.cos(yaw) * dx - Math.sin(yaw) * dz;

        return (
            depth > 0.1
            && Math.abs(up / (depth * Math.tan(Math.PI / 6))) < 1
            && Math.abs(right / ((depth * Math.tan(Math.PI / 6) * 16) / 9)) < 1
        );
    };
    const pitch = Array.from(
        { length: 241 },
        (_, index) => -1.2 + index * 0.01,
    ).find(
        (p) => points.filter((point) => framed(point, p)).length >= 2
            && !framed(hat.position, p),
    );

    assert.notEqual(
        pitch,
        undefined,
        'a real camera tilt can crop the hat while retaining the raccoon',
    );
    cropped.camera.pitch = pitch!;
    assert.ok(
        !evaluatePhoto(cropped, run.world).credits.includes(c.id),
        'a cropped-out hat is not a mishap photograph',
    );
    command(run, 'interact');
    assert.equal(hat.carrier, 'owner', 'ordinary E returns the same hat');
    assert.ok(hat.protectedUntilTick > run.tick);
});

test('an actual new-species action earns its bound behavior commission through the ordinary shutter', () => {
    const run = crew(7);
    const commission = run.world.commissions.find(
        (c) => c.behavior === 'pounce',
    )!;
    const fox = run.animals.find((a) => a.id === commission.subjects[0])!;

    cameraApproach(run, fox.id);
    until(run, () => fox.behavior === 'pounce');
    aim(run, fox);
    const result = command(run, 'photo')!;

    assert.ok(
        !/hidden|small|behind|inside/.test(result.verdict.reason),
        result.verdict.reason,
    );
    assert.ok(
        result.verdict.credits.includes(commission.id),
        `missing exact-instance new behavior credit: ${result.verdict.reason}`,
    );
    assert.ok(run.completed.includes(commission.id));
});

for (const seed of [0, 1, 2])
    test(`seed ${seed} bound passage is earned only after its resident's actual circuit`, () => {
        const run = crew(seed),
            commission = run.world.commissions.find((c) => c.kind === 'passage')!;
        const animal = run.animals.find((a) => a.id === commission.subjects[0])!;

        cameraApproach(run, animal.id);
        const anchor = run.world.pockets
            .find((p) => p.id === commission.pocket)!
            .anchors.find((a) => a.id === commission.anchor)!;

        until(
            run,
            () => animal.behavior === 'passage'
                && distance(animal.pose.position, anchor.point) < 2,
            150,
        );
        aim(run, animal);
        const result = command(run, 'photo')!;

        assert.ok(
            result.verdict.credits.includes(commission.id),
            result.verdict.reason,
        );
        const wrong = structuredClone(result.frame);

        wrong.animals = wrong.animals.filter((a) => a.id !== animal.id);
        assert.ok(
            !evaluatePhoto(wrong, run.world).credits.includes(commission.id),
            'another resident cannot stand in for the bound circuit',
        );
    });

test('one actual beaver landmark photograph earns composition, behavior and optional cameo without waiving cropping', () => {
    const run = crew(7),
        commission = run.world.commissions.find((c) => c.kind === 'composition')!;
    const animal = run.animals.find((a) => a.id === commission.subjects[0])!;
    const landmark = run.world.placements.find(
        (p) => p.id === commission.landmark,
    )!;

    cameraApproach(run, animal.id);
    until(run, () => animal.behavior === 'gnaw');
    aimPoint(
        run,
        animal.pose.position.map(
            (v, index) => (v + landmark.position[index]) / 2 + (index === 1 ? 0.4 : 0),
        ) as Vec3,
    );
    const result = command(run, 'photo')!;

    assert.ok(
        result.verdict.credits.includes(commission.id),
        result.verdict.reason,
    );
    assert.ok(
        result.verdict.credits.includes(
            run.world.commissions.find(
                (c) => c.kind === 'behavior' && c.subjects.includes(animal.id),
            )!.id,
        ),
    );
    assert.ok(
        result.verdict.credits.includes(
            run.world.commissions.find((c) => c.kind === 'cameo')!.id,
        ),
    );

    // Mutate only a saved geometry fixture to isolate the framing predicate; the
    // positive shot above was earned using commands and an actual action.

    const cropped = structuredClone(result.frame);

    cropped.camera.yaw += Math.PI;
    assert.ok(!evaluatePhoto(cropped, run.world).credits.includes(commission.id));
});

for (const seed of [1, 7])
    test(`seed ${seed} calm feeding pair is available without borrowing the tin`, () => {
        const run = crew(seed),
            commission = run.world.commissions.find((c) => c.kind === 'pair')!;
        const animals = commission.subjects.map((id) => run.animals.find((a) => a.id === id)!,
        );

        cameraApproach(run, animals[0].id);
        const anchor = run.world.pockets
            .find((p) => p.id === commission.pocket)!
            .anchors.find((a) => a.id === commission.anchor)!;

        until(
            run,
            () => animals.every(
                (a) => ['graze', 'nibble', 'gnaw', 'preen'].includes(a.behavior)
                    && distance(a.pose.position, anchor.point) < 3,
            ),
            180,
        );
        aimPoint(
            run,
            animals[0].pose.position.map(
                (v, index) => (v + animals[1].pose.position[index]) / 2 + (index === 1 ? 0.45 : 0),
            ) as Vec3,
        );
        const result = command(run, 'photo')!;

        assert.ok(
            result.verdict.credits.includes(commission.id),
            result.verdict.reason,
        );
        // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
        assert.equal(run.tin.holder, null);
    });

for (const [species, behavior, kind] of [
    ['fox', 'pounce', 'passage'],
    ['rabbit', 'nibble', 'feed'],
    ['squirrel', 'cache', 'cache'],
    ['beaver', 'gnaw', 'feed'],
    ['otter', 'groom', 'rest'],
    ['badger', 'dig', 'den'],
    ['owl', 'roost', 'perch'],
    ['woodpecker', 'tap', 'perch'],
    ['mallard', 'dabble', 'water'],
] as const)
    test(`${species} reaches its bound ${behavior} site through actual ticks and can be framed`, () => {
        const run = crew(7),
            resident = run.world.residents.find((r) => r.species === species)!;
        const animal = run.animals.find((a) => a.id === resident.id)!;
        const anchor = run.world.pockets
            .find((p) => p.id === resident.home)!
            .anchors.find(
                (a) => a.kind === kind
                    && resident.anchors.includes(a.id)
                    && !a.id.endsWith('-start'),
            )!;

        cameraApproach(run, animal.id);
        until(
            run,
            () => animal.behavior === behavior
                && distance(animal.pose.position, anchor.point) < 2,
            150,
        );
        aim(run, animal);
        const result = command(run, 'photo')!;

        assert.ok(
            !/hidden|small|behind|inside/.test(result.verdict.reason),
            `${species}: ${result.verdict.reason}`,
        );
    });
