import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    loadConfig,
    loadRoom,
    loadRun,
    saveRun,
    validJPEG,
} from '../../src/server/persistence/save.ts';
import {
    createRun,
    addPlayer,
    makePhotoFrame,
    advanceRun,
    attachPhysics,
    applyCommand as applyWorldCommand,
    disconnectPlayer,
} from '../../src/server/simulation/game.ts';
import type { Spill } from '../../src/shared/shared.ts';
import { fixtureLatch } from '../../src/shared/world/level.ts';
import { localRecoveryPoint } from '../../src/server/simulation/wildlife/encounters.ts';

test('closing a gate over an existing ground incident preserves save and restore', async (t) => {
    const direction = await mkdtemp(path.join(tmpdir(), 'wu covered incident '));

    t.after(() => rm(direction, { recursive: true, force: true }));
    const run = createRun(9, 'covered-incident'),
        p = addPlayer(run, 'a', 'A');

    addPlayer(run, 'b', 'B');
    applyCommand(run, p.id, { type: 'start', seq: 1 });
    const gate = run.world.fixtures.find((f) => f.kind === 'gate')!;
    let latch = fixtureLatch(gate, run.route)!;

    p.position = [latch[0], 0, latch[2] + 0.5];
    applyCommand(run, p.id, { type: 'interact', seq: 2 });
    assert.equal(run.route[gate.id].open, true);
    const box = gate.closedBoxes[0],
        point: [number, number, number] = [
            (box.min[0] + box.max[0]) / 2,
            0,
            (box.min[2] + box.max[2]) / 2,
        ];

    assert.deepEqual(localRecoveryPoint(run, point), point);
    run.spills = [
        {
            id: 'spill-covered',
            position: point,
            portions: 1,
            untilTick: run.tick + 3600,
        },
    ];
    run.spareBait--;
    run.hats[0].carrier = 'ground';
    run.hats[0].position = [...point];
    await saveRun(direction, run, new Map());
    latch = fixtureLatch(gate, run.route)!;
    p.position = [latch[0], 0, latch[2] + 0.5];
    applyCommand(run, p.id, { type: 'interact', seq: 3 });
    assert.equal(run.route[gate.id].open, false);
    await saveRun(direction, run, new Map());
    const restored = (await loadRun(direction))!.run;

    assert.deepEqual(restored.spills, run.spills);
    assert.deepEqual(restored.hats, run.hats);
    assert.equal(restored.route[gate.id].open, false);
    const solid = run.world.walls.find((b) => b.id === 'boundary-east')!;

    run.spills[0].position = [
        (solid.min[0] + solid.max[0]) / 2,
        0,
        (solid.min[2] + solid.max[2]) / 2,
    ];
    await assert.rejects(saveRun(direction, run, new Map()), /ground support/);
});

/**
 * Submit test command fields with the run world identity.
 *
 * @param run Mutable simulation state for this scenario.
 * @param id Player identifier issuing the command.
 * @param input Command fields to submit with the current world identity.
 * @returns The authoritative command result.
 */
function applyCommand(
    run: ReturnType<typeof createRun>,
    id: string,
    input: Record<string, unknown>,
) {
    return applyWorldCommand(run, id, { worldId: run.worldId, ...input });
}

test('captured props, hat, gate and articulation remain exact after live changes and restart', async (t) => {
    const direction = await mkdtemp(path.join(tmpdir(), 'wu frozen frame '));

    t.after(() => rm(direction, { recursive: true, force: true }));
    const run = createRun();

    addPlayer(run, 'a', 'A');
    addPlayer(run, 'b', 'B');
    applyCommand(run, 'a', { type: 'start', seq: 1 });
    const captured = applyCommand(run, 'a', { type: 'photo', seq: 2 })!.frame;
    const expected = structuredClone(captured);

    run.props[0].pose.position[0] += 2;
    run.props[0].open = true;
    run.route.gate.open = true;
    run.hats[0].carrier = 'ground';
    run.hats[0].position = [...run.players[0].position];
    run.players[0].name = 'Changed';
    run.players[0].yaw = 1;
    run.animals[0].remaining = 3;
    run.animals[0].pose.position[0] += 1;
    run.tin.open = true;
    run.tick += 60;
    assert.throws(() => {
        captured.props[0].pose.position[0] = 0;
    }, TypeError);
    assert.throws(() => {
        captured.hats[0].carrier = 'ground';
    }, TypeError);
    assert.deepEqual(captured, expected);
    await saveRun(direction, run, new Map());
    const restored = (await loadRun(direction))!.run;

    assert.deepEqual(restored.pendingPhotos[captured.id], expected);
    assert.equal(restored.route.gate.open, true);
    assert.equal(restored.pendingPhotos[captured.id].route.gate.open, false);
});

test('saved favorites reject duplicate and foreign crew identities', async (t) => {
    const direction = await mkdtemp(path.join(tmpdir(), 'wu favorites '));

    t.after(() => rm(direction, { recursive: true, force: true }));
    const run = createRun();

    addPlayer(run, 'a', 'A');
    addPlayer(run, 'b', 'B');
    applyCommand(run, 'a', { type: 'start', seq: 1 });
    applyCommand(run, 'a', { type: 'photo', seq: 2 });
    run.album[0].favorites = ['a', 'a'];
    await assert.rejects(
        saveRun(direction, run, new Map()),
        /duplicate.*favorite/i,
    );
    run.album[0].favorites = ['foreign'];
    await assert.rejects(saveRun(direction, run, new Map()), /favorite/i);
});

test('mid-reach and stolen hats persist their actual theft/drop/protection clocks and owner', async (t) => {
    const direction = await mkdtemp(path.join(tmpdir(), 'wu hat incident '));

    t.after(() => rm(direction, { recursive: true, force: true }));
    let run = createRun(9);

    addPlayer(run, 'a', 'A');
    addPlayer(run, 'b', 'B');
    applyCommand(run, 'a', { type: 'start', seq: 1 });
    const commission = run.world.commissions.find(
            (c) => c.kind === 'behavior'
                && run.world.residents.find((r) => r.id === c.subjects[0])!.species
                === 'deer',
        )!,
        deer = run.animals.find((a) => a.id === commission.subjects[0])!,
        anchor = run.world.pockets
            .flatMap((p) => p.anchors)
            .find((a) => a.id === commission.anchor)!.point,
        photographer = run.players[0];

    deer.pose.position = [...anchor];
    deer.behavior = 'graze';
    photographer.position = [anchor[0], anchor[1], anchor[2] + 5];
    photographer.pitch = -0.12;
    assert.ok(
        applyCommand(run, 'a', { type: 'photo', seq: 2 })!.verdict.credits.includes(
            commission.id,
        ),
    );
    run.route.gate.open = true;
    const r = run.animals.find((a) => a.species === 'raccoon')!;

    run.players[0].position = [r.pose.position[0], 0, r.pose.position[2] + 1];
    for (let index = 0; index < 30; index++) advanceRun(run, 1 / 60);
    assert.equal(r.behavior, 'hat-reach');
    const remaining = r.remaining;

    await saveRun(direction, run, new Map());
    run = (await loadRun(direction))!.run;
    assert.equal(run.animals.find((a) => a.id === r.id)!.remaining, remaining);
    applyCommand(run, 'a', { type: 'resume', seq: run.players[0].lastSeq + 1 });
    for (let index = 0; index < 65; index++) advanceRun(run, 1 / 60);
    assert.equal(run.hats[0].carrier, `animal:${r.id}`);
    const until = run.hats[0].untilTick,
        protection = run.hats[0].protectedUntilTick;
    const progress = structuredClone([
        run.world,
        run.completed,
        run.route,
        run.album,
    ]);

    await saveRun(direction, run, new Map());
    run = (await loadRun(direction))!.run;
    assert.equal(run.hats[0].untilTick, until);
    assert.equal(run.hats[0].protectedUntilTick, protection);
    applyCommand(run, 'a', { type: 'resume', seq: run.players[0].lastSeq + 1 });
    while (run.tick < until) advanceRun(run, 1 / 60);
    assert.equal(run.hats[0].carrier, 'ground');
    assert.equal(run.hats[0].untilTick, 0);
    assert.deepEqual([run.world, run.completed, run.route, run.album], progress);
    const pile = run.hats[0].position;

    run.players[1].position = [pile[0], pile[1], pile[2] + 0.4];
    applyCommand(run, 'b', { type: 'interact', seq: run.players[1].lastSeq + 1 });
    assert.equal(run.hats[0].carrier, 'owner');
    assert.equal(run.hats[0].protectedUntilTick, protection);
    disconnectPlayer(run, 'a');
    assert.equal(run.hats[0].carrier, 'owner');
});

test('live and frozen incidents reject contradictory owners, states and far-future deadlines', async (t) => {
    const direction = await mkdtemp(path.join(tmpdir(), 'wu invalid incidents '));

    t.after(() => rm(direction, { recursive: true, force: true }));
    const base = createRun();

    addPlayer(base, 'a', 'A');
    addPlayer(base, 'b', 'B');
    const changes: ((
        s: Pick<
            ReturnType<typeof makePhotoFrame>,
      'spills' | 'hats' | 'tick' | 'props' | 'animals'
        >,
    ) => void)[] = [
        (s) => (s.spills = [
            {
                id: 'spill-1',
                position: [
                    base.world.waters[0].min[0] + 1,
                    0,
                    base.world.waters[0].min[2] + 1,
                ],
                portions: 1,
                untilTick: s.tick + 60,
            },
        ]),
        (s) => Object.assign(s.hats[0], {
            carrier: 'ground',
            position: [
                base.world.waters[0].min[0] + 1,
                0,
                base.world.waters[0].min[2] + 1,
            ],
        }),
        (s) => (s.spills = [
            {
                id: 'spill-1',
                position: [0, 0, 0],
                portions: 2,
                untilTick: s.tick + 60,
            },
        ]),
        (s) => s.hats.pop(),
        (s) => (s.hats[0].owner = 'missing'),
        (s) => (s.hats[0].untilTick = 20),
        (s) => (s.hats[0].protectedUntilTick = s.tick + 3601),
        (s) => Object.assign(s.hats[0], {
            carrier: 'raccoon',
            untilTick: s.tick + 1801,
            protectedUntilTick: s.tick + 3600,
        }),
        (s) => Object.assign(s.hats[0], {
            carrier: 'raccoon',
            untilTick: s.tick + 1800,
            protectedUntilTick: 0,
        }),
        (s) => {
            for (const h of s.hats) {
                Object.assign(h, {
                    carrier: 'raccoon',
                    untilTick: s.tick + 1800,
                    protectedUntilTick: s.tick + 3600,
                });
            }
        },
        (s) => (s.props[0].spillUntilTick = s.tick + 121),
        (s) => (s.props[1].spillUntilTick = 1),
        (s) => (s.spills = [
            {
                id: 'spill-1',
                position: [0, 0, 0],
                portions: 1,
                untilTick: s.tick + 3601,
            },
        ]),
        (s) => (s.spills = [
            { id: 'spill-1', position: [0, 0, 0], portions: 1, untilTick: s.tick },
        ]),
        (s) => (s.spills = [
            {
                id: 'spill-1',
                position: [0, 30, 0],
                portions: 1,
                untilTick: s.tick + 60,
            },
        ]),
        (s) => Object.assign(s.animals[1], { behavior: 'hat-reach', remaining: 1 }),
    ];

    for (const frozen of [false, true]) {
        const items1 = changes.entries();

        for (const [index, change] of items1) {
            const run = structuredClone(base);

            if (frozen) {
                const frame = structuredClone(makePhotoFrame(run, 'a'));

                change(frame);
                run.pendingPhotos[frame.id] = frame;
                run.album = [
                    {
                        id: frame.id,
                        photographer: 'a',
                        tick: frame.tick,
                        credits: [],
                        assists: [],
                        favorites: [],
                        // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
                        incident: null,
                        thumbnail: 'pending',
                    },
                ];
            } else change(run);
            await assert.rejects(
                saveRun(direction, run, new Map()),
                `mutation ${index}, frozen ${frozen}`,
            );
        }
    }
    for (const change of [
        (s: ReturnType<typeof createRun>) => (s.animalMemory[
            s.animals.find((a) => a.species === 'raccoon')!.id
        ].hatTarget = 'missing'),
        (s: ReturnType<typeof createRun>) => (s.animalMemory[
            s.animals.find((a) => a.species === 'raccoon')!.id
        ].hatTarget = 'a'),
        (s: ReturnType<typeof createRun>) => (s.animals[0].behavior = 'hat-reach'),
    ]) {
        const run = structuredClone(base);

        change(run);
        await assert.rejects(saveRun(direction, run, new Map()));
    }
    const run = structuredClone(base),
        r = run.animals.find((a) => a.species === 'raccoon')!;

    applyCommand(run, 'a', { type: 'start', seq: 1 });
    run.players[0].position = [r.pose.position[0], 0, r.pose.position[2] + 1];
    for (let index = 0; index < 12; index++) advanceRun(run, 1 / 60);
    assert.equal(r.behavior, 'hat-reach');
    run.animalMemory[
        run.animals.find((a) => a.species === 'raccoon')!.id
    ].hatTarget = 'b';
    await assert.rejects(
        saveRun(direction, run, new Map()),
        'hat reach memory must name the actual target owner',
    );
    run.animalMemory[
        run.animals.find((a) => a.species === 'raccoon')!.id
    ].hatTarget = 'a';
    for (const frozen of [false, true]) {
        const invalid = structuredClone(run);

        if (frozen) {
            const frame = structuredClone(makePhotoFrame(invalid, 'a'));

            frame.animals.find((a) => a.id === r.id)!.pose.position = [0, 0, 0];
            invalid.pendingPhotos[frame.id] = frame;
            invalid.album = [
                {
                    id: frame.id,
                    photographer: 'a',
                    tick: frame.tick,
                    credits: [],
                    assists: [],
                    favorites: [],
                    // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
                    incident: null,
                    thumbnail: 'pending',
                },
            ];
        } else
            invalid.animals.find((a) => a.id === r.id)!.pose.position = [0, 0, 0];
        await assert.rejects(
            saveRun(direction, invalid, new Map()),
            `distant raccoon, frozen ${frozen}`,
        );
    }
    const covered = structuredClone(base);

    covered.hats[0].carrier = 'ground';
    covered.hats[0].position = [0, 0, 0];
    covered.spills = [
        { id: 'spill-covered', position: [0, 0, 0], portions: 1, untilTick: 60 },
    ];
    covered.props[0].pose.position = [0, 0.325, 0];
    await saveRun(direction, covered, new Map());
});

test('disconnect during a reach safely cancels the target and remains saveable', async (t) => {
    const direction = await mkdtemp(path.join(tmpdir(), 'wu interrupted hat '));

    t.after(() => rm(direction, { recursive: true, force: true }));
    const run = createRun(0);

    addPlayer(run, 'a', 'A');
    addPlayer(run, 'b', 'B');
    applyCommand(run, 'a', { type: 'start', seq: 1 });
    const r = run.animals.find((a) => a.species === 'raccoon')!;

    run.players[0].position = [r.pose.position[0], 0, r.pose.position[2] + 1];
    for (let index = 0; index < 12; index++) advanceRun(run, 1 / 60);
    assert.equal(r.behavior, 'hat-reach');
    disconnectPlayer(run, 'a');
    assert.notEqual(r.behavior, 'hat-reach');
    assert.equal(
        run.animalMemory[run.animals.find((a) => a.species === 'raccoon')!.id]
            .hatTarget,
        // eslint-disable-next-line unicorn/no-null -- The save loader contract returns null for unavailable data.
        null,
    );
    await saveRun(direction, run, new Map());
});

test('a saved case incident guard survives released-body restart contacts and frozen capture', async (t) => {
    const direction = await mkdtemp(path.join(tmpdir(), 'wu spill restart '));

    t.after(() => rm(direction, { recursive: true, force: true }));
    let run = createRun();

    addPlayer(run, 'a', 'A');
    addPlayer(run, 'b', 'B');
    applyCommand(run, 'a', { type: 'start', seq: 1 });
    run.props[0].pose.position = [0, 3, 0];
    run.props[0].open = true;
    let physics = await attachPhysics(run);

    try {
        for (let index = 0; index < 60; index++) {
            advanceRun(run, 1 / 60);
            physics.step(1 / 60);
        }
    } finally {
        physics.dispose();
    }
    assert.equal(run.spills.length, 1);
    assert.equal(run.spareBait, 7);
    const guard = run.props[0].spillUntilTick;
    const frame = makePhotoFrame(run, 'a');

    assert.equal(frame.props[0].spillUntilTick, guard);
    await saveRun(direction, run, new Map());
    run = (await loadRun(direction))!.run;
    assert.equal(run.props[0].spillUntilTick, guard);
    assert.equal(run.spills.length, 1);
    applyCommand(run, 'a', { type: 'resume', seq: run.players[0].lastSeq + 1 });
    physics = await attachPhysics(run);
    try {
        for (let index = 0; index < 90; index++) {
            advanceRun(run, 1 / 60);
            physics.step(1 / 60);
        }
    } finally {
        physics.dispose();
    }
    assert.equal(run.spills.length, 1);
    assert.equal(run.spareBait, 7);
});

test('JPEG uploads require a bounded frame header and an actual scan', () => {
    const jpeg = Buffer.from(
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAA//Z',
        'base64',
    );

    assert.equal(validJPEG(jpeg), true);
    const huge = Buffer.from(jpeg);

    huge.writeUInt16BE(20_000, huge.indexOf(Buffer.from([255, 192])) + 7);
    assert.equal(validJPEG(huge), false);
    assert.equal(
        validJPEG(Buffer.from([255, 216, 255, 224, 0, 2, 255, 217])),
        false,
    );
});

test('configuration is module relative and refuses invalid or publicly served private paths', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const config = loadConfig({
        WU_PORT: '4551',
        WU_DATA_DIR: 'private data',
        WU_WEB_DIR: 'public build',
        WU_PUBLIC_ORIGIN: 'https://game.example',
    });

    assert.equal(config.port, 4551);
    assert.equal(config.origin, 'https://game.example');
    assert.equal(config.dataDir, path.resolve(root, 'private data'));
    assert.equal(config.webDir, path.resolve(root, 'public build'));
    assert.equal(loadConfig({}).dataDir, path.join(root, 'data-expedition'));
    for (const WU_PORT of ['0', '1.5', '65536', '-1', '4310junk', ''])
        assert.throws(() => loadConfig({ WU_PORT }));
    for (const WU_PUBLIC_ORIGIN of [
        'javascript:foo',
        'https://user:pass@example.com',
        'https://example.com/path',
        'https://example.com/',
        'null',
    ])
        assert.throws(() => loadConfig({ WU_PUBLIC_ORIGIN }));
    assert.throws(() => loadConfig({ WU_WEB_DIR: 'public', WU_DATA_DIR: 'public/private' }),
    );
});

test('save snapshots preserve pending frames and image bytes across serialized writes, backup, and rejected corruption', async (t) => {
    const dataDirection = await mkdtemp(path.join(tmpdir(), 'wu save '));

    t.after(() => rm(dataDirection, { recursive: true, force: true }));
    const room = await loadRoom(dataDirection);

    assert.equal(room.joinSecret.length, 32);
    assert.notEqual(room.joinSecret, room.hostSecret);
    assert.deepEqual(await loadRoom(dataDirection), room);
    // eslint-disable-next-line unicorn/no-null -- The save loader contract returns null for unavailable data.
    assert.equal(await loadRun(dataDirection), null);
    const run = createRun();

    addPlayer(run, 'host', 'Host');
    run.hostId = 'host';
    const frame = makePhotoFrame(run, 'host');

    run.pendingPhotos[frame.id] = frame;
    run.album.push({
        id: frame.id,
        photographer: 'host',
        tick: frame.tick,
        credits: [run.world.commissions[0].id],
        assists: [],
        favorites: [],
        // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
        incident: null,
        thumbnail: 'pending',
    });
    run.completed = [run.world.commissions[0].id];
    run.tin.portions = 2;
    run.animals[1].behavior = 'display';
    run.animals[1].remaining = 4.25;
    const first = saveRun(dataDirection, run, new Map());

    run.seconds = 12;
    const second = saveRun(dataDirection, run, new Map());

    await Promise.all([first, second]);
    const loaded = (await loadRun(dataDirection))!;

    assert.equal(loaded.run.seconds, 12);
    assert.equal(loaded.run.tin.portions, 2);
    assert.equal(loaded.run.animals[1].remaining, 4.25);
    assert.equal(loaded.run.version, 3);
    assert.equal(loaded.run.world.content, 'forest-expedition-1');
    assert.equal(loaded.run.players[0].slot, 0);
    assert.equal(loaded.run.props.length, run.world.props.length);
    assert.equal(loaded.run.hats[0].owner, 'host');
    assert.deepEqual(loaded.run.pendingPhotos[frame.id], frame);
    const jpeg = Buffer.from(
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAA//Z',
        'base64',
    );

    loaded.run.album[0].thumbnail = 'ready';
    delete loaded.run.pendingPhotos[frame.id];
    await saveRun(dataDirection, loaded.run, new Map([[frame.id, jpeg]]));
    assert.deepEqual(
        Buffer.from((await loadRun(dataDirection))!.images.get(frame.id)!),
        jpeg,
    );
    await writeFile(path.join(dataDirection, 'run.json'), '{broken');
    const backup = (await loadRun(dataDirection))!;

    assert.equal(backup.run.album[0].thumbnail, 'pending');
    await writeFile(
        path.join(dataDirection, 'run.json'),
        JSON.stringify({ version: 999 }),
    );
    await assert.rejects(loadRun(dataDirection), /version/i);
    const valid = JSON.parse(
        await readFile(path.join(dataDirection, 'run.json.bak'), 'utf8'),
    );

    valid.run.album[0].thumbnail = 'ready';
    await writeFile(path.join(dataDirection, 'run.json'), JSON.stringify(valid));
    await rm(path.join(dataDirection, 'run.json.bak'));
    await assert.rejects(loadRun(dataDirection), /image|pending/i);
});

test('failed filesystem replacement retains the previous valid save', async (t) => {
    const dataDirection = await mkdtemp(path.join(tmpdir(), 'wu write failure '));

    t.after(() => rm(dataDirection, { recursive: true, force: true }));
    const run = createRun();

    await saveRun(dataDirection, run, new Map());
    await mkdir(path.join(dataDirection, 'run.json.tmp'));
    run.seconds = 10;
    await assert.rejects(saveRun(dataDirection, run, new Map()));
    assert.equal((await loadRun(dataDirection))!.run.seconds, 0);
});

test('restart data pauses and releases equipment without mutating the live outing', async (t) => {
    const dataDirection = await mkdtemp(
        path.join(tmpdir(), 'wu restart release '),
    );

    t.after(() => rm(dataDirection, { recursive: true, force: true }));
    const run = createRun();

    addPlayer(run, 'a', 'A');
    run.paused = false;
    run.props[0].holders[0] = 'a';
    run.tin.holder = 'a';
    await saveRun(dataDirection, run, new Map());
    const restored = (await loadRun(dataDirection))!.run;

    assert.equal(restored.paused, true);
    assert.match(restored.pauseReason, /restart|saved/i);
    // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
    assert.deepEqual(restored.props[0].holders, [null, null]);
    // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
    assert.equal(restored.tin.holder, null);
    // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
    assert.deepEqual(run.props[0].holders, ['a', null]);
    assert.equal(run.tin.holder, 'a');
});

test('version-1 outing saves fail with an explicit incompatibility error', async (t) => {
    const dataDirection = await mkdtemp(path.join(tmpdir(), 'wu old save '));

    t.after(() => rm(dataDirection, { recursive: true, force: true }));
    await writeFile(
        path.join(dataDirection, 'run.json'),
        JSON.stringify({ version: 1, run: {}, images: {} }),
    );
    await assert.rejects(loadRun(dataDirection), /incompatible.*version 1/i);
    const before = await readFile(path.join(dataDirection, 'run.json'), 'utf8');

    await assert.rejects(
        saveRun(dataDirection, createRun(), new Map()),
        /incompatible.*version 1/i,
    );
    assert.equal(
        await readFile(path.join(dataDirection, 'run.json'), 'utf8'),
        before,
    );
});

test('pending captures enforce the saved crew identities, slots and tin ownership', async (t) => {
    const dataDirection = await mkdtemp(
        path.join(tmpdir(), 'wu frame references '),
    );

    t.after(() => rm(dataDirection, { recursive: true, force: true }));
    const run = createRun();

    addPlayer(run, 'a', 'A');
    addPlayer(run, 'b', 'B');
    const frame = makePhotoFrame(run, 'a');

    run.pendingPhotos[frame.id] = frame;
    run.album = [
        {
            id: frame.id,
            photographer: 'a',
            tick: frame.tick,
            credits: [],
            assists: [],
            favorites: [],
            // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
            incident: null,
            thumbnail: 'pending',
        },
    ];
    await saveRun(dataDirection, run, new Map());
    for (const corrupt of [
        (f: typeof frame) => {
            f.players[1].slot = f.players[0].slot;
        },
        (f: typeof frame) => {
            f.tin.holder = 'missing';
        },
        (f: typeof frame) => {
            f.players[1].id = 'missing';
            f.hats = [];
        },
    ]) {
        const invalid = structuredClone(run);

        corrupt(invalid.pendingPhotos[frame.id]);
        await assert.rejects(saveRun(dataDirection, invalid, new Map()));
    }
});

test('real Box3D impact events and active animal timers remain saveable', async (t) => {
    const dataDirection = await mkdtemp(path.join(tmpdir(), 'wu impact save '));

    t.after(() => rm(dataDirection, { recursive: true, force: true }));
    const run = createRun();

    addPlayer(run, 'host', 'Host');
    addPlayer(run, 'guest', 'Guest');
    run.phase = 'outing';
    run.tin.pose.position = [10, 3, -12];
    const physics = await attachPhysics(run);

    t.after(() => physics.dispose());
    for (let index = 0; index < 120; index++) {
        advanceRun(run, 1 / 60);
        physics.step(1 / 60);
    }
    assert.ok(
        run.events.some(
            (event) => event.kind === 'noise' && event.player === 'tin',
        ),
    );
    await saveRun(dataDirection, run, new Map());
    const restored = (await loadRun(dataDirection))!;

    assert.ok(restored.run.events.some((event) => event.player === 'tin'));
    assert.ok(restored.run.seconds > 1);
});

test('inconsistent world, identity, inventory and photo references are rejected before replacing a save', async (t) => {
    const dataDirection = await mkdtemp(path.join(tmpdir(), 'wu invalid state '));

    t.after(() => rm(dataDirection, { recursive: true, force: true }));
    const original = createRun();

    addPlayer(original, 'host', 'Host');
    addPlayer(original, 'guest', 'Guest');
    await saveRun(dataDirection, original, new Map());
    for (const corrupt of [
        (run: ReturnType<typeof createRun>) => {
            run.animals[1] = structuredClone(run.animals[0]);
        },
        (run: ReturnType<typeof createRun>) => {
            run.tin.holder = 'missing-player';
        },
        (run: ReturnType<typeof createRun>) => {
            run.completed = ['raccoon-inspect', 'raccoon-inspect'];
        },
        (run: ReturnType<typeof createRun>) => {
            run.players[1].slot = run.players[0].slot;
        },
        (run: ReturnType<typeof createRun>) => {
            run.world.seed = -1;
        },
        (run: ReturnType<typeof createRun>) => {
            run.world.commissions[0].subjects = ['missing-resident'];
        },
        (run: ReturnType<typeof createRun>) => {
            run.props.pop();
        },
        (run: ReturnType<typeof createRun>) => {
            run.props[0].holders[0] = 'missing-player';
        },
        (run: ReturnType<typeof createRun>) => {
            run.props[0].pose.position[0] = run.world.bounds.max[0] + 3;
        },
        (run: ReturnType<typeof createRun>) => {
            run.route[run.world.fixtures.find((f) => f.kind === 'crossing')!.id] = {
                open: true,
                seat: 'left',
            };
        },
        (run: ReturnType<typeof createRun>) => {
            run.props.find((property) => property.kind === 'plank')!.placed = true;
        },
        (run: ReturnType<typeof createRun>) => {
            run.hats[0].owner = 'missing-player';
        },
        (run: ReturnType<typeof createRun>) => {
            run.spills = Array.from({ length: 9 }, (_, index): Spill => ({
                id: `spill-${index}`,
                position: [0, 0, 0],
                portions: 1,
                untilTick: 10,
            }));
        },
        (run: ReturnType<typeof createRun>) => {
            const frame = makePhotoFrame(run, 'host');

            run.pendingPhotos[frame.id] = frame;
            run.album = [
                {
                    id: frame.id,
                    photographer: 'other',
                    tick: frame.tick,
                    credits: [],
                    assists: [],
                    favorites: [],
                    // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
                    incident: null,
                    thumbnail: 'pending',
                },
            ];
        },
    ]) {
        const run = structuredClone(original);

        corrupt(run);
        await assert.rejects(saveRun(dataDirection, run, new Map()));
    }
    // eslint-disable-next-line unicorn/no-null -- The save loader contract returns null for unavailable data.
    assert.equal((await loadRun(dataDirection))!.run.tin.holder, null);
});

test('maximum combined schema-3 photo payload fits with one blueprint and rejects a sixty-fifth photo', async (t) => {
    const direction = await mkdtemp(path.join(tmpdir(), 'wu-max-payload-'));

    t.after(() => rm(direction, { recursive: true, force: true }));
    const run = createRun(2, 'maximum-photo-world');

    for (const id of ['a', 'b', 'c', 'd']) addPlayer(run, id, id.toUpperCase());
    const jpeg = Buffer.from(
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAA//Z',
        'base64',
    );
    const comment = Buffer.alloc(65_536 - jpeg.length);

    comment[0] = 255;
    comment[1] = 254;
    comment.writeUInt16BE(comment.length - 2, 2);
    const maximum = Buffer.concat([
        jpeg.subarray(0, 2),
        comment,
        jpeg.subarray(2),
    ]);

    assert.equal(maximum.length, 65_536);
    assert.equal(validJPEG(maximum), true);
    run.completed = run.world.commissions.map((commission) => commission.id);
    for (const ready of [0, 32, 64]) {
        run.album = [];
        run.pendingPhotos = {};
        const images = new Map<string, Uint8Array>();

        for (let index = 0; index < 64; index++) {
            run.nextPhoto = index + 1;
            const frame = makePhotoFrame(run, 'a');
            const thumbnail = index < ready ? 'ready' : 'pending';

            run.album.push({
                id: frame.id,
                photographer: 'a',
                tick: frame.tick,
                credits: index < 8 ? [run.world.commissions[index].id] : [],
                assists: ['b', 'c', 'd'],
                favorites: ['a', 'b', 'c', 'd'],
                // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
                incident: null,
                thumbnail,
            });
            if (thumbnail === 'ready') images.set(frame.id, maximum);
            else run.pendingPhotos[frame.id] = frame;
        }
        run.nextPhoto = 65;
        await saveRun(direction, run, images);
        const raw = await readFile(path.join(direction, 'run.json'), 'utf8');

        assert.ok(Buffer.byteLength(raw) <= 8 * 1024 * 1024);
        assert.equal(raw.match(/"placements":/g)?.length, 1);
        const restored = (await loadRun(direction))!;

        assert.equal(restored.run.album.length, 64);
        assert.equal(restored.images.size, ready);
        t.diagnostic(
            `${ready} JPEGs + ${64 - ready} frozen frames: ${Buffer.byteLength(raw)} bytes; blueprint ${Buffer.byteLength(JSON.stringify(run.world))} bytes`,
        );
        const extra = makePhotoFrame(run, 'a');

        run.album.push({
            id: extra.id,
            photographer: 'a',
            tick: extra.tick,
            credits: [],
            assists: [],
            favorites: [],
            // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
            incident: null,
            thumbnail: 'pending',
        });
        run.pendingPhotos[extra.id] = extra;
        await assert.rejects(
            saveRun(direction, run, images),
            /many|array|list|length/i,
        );
        assert.equal(await readFile(path.join(direction, 'run.json'), 'utf8'), raw);
    }
});
