import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
    addPlayer,
    applyCommand,
    createRun,
    makePhotoFrame,
} from '../../src/server/simulation/game.ts';
import {
    loadRun,
    saveRun,
    validJPEG,
} from '../../src/server/persistence/save.ts';
import { pose } from '../../src/shared/shared.ts';

// Policy fixtures construct valid saved metadata. They are not earned-outing evidence.

/**
 * Create a deterministic active crew for the scenario.
 *
 * @param seed Deterministic world generation seed.
 * @param worldId World identity used by the test.
 * @returns The initialized simulation run.
 */
function crew(seed = 9, worldId = 'album-policy') {
    const run = createRun(seed, worldId);

    for (const id of ['a', 'b', 'c', 'd']) addPlayer(run, id, id.toUpperCase());
    applyCommand(run, 'a', { type: 'start', worldId: run.worldId, seq: 1 });

    return run;
}
const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAA//Z',
    'base64',
);

// Use the identical JPEG fixture and valid comment padding as save.test.ts.

/**
 * Build a valid JPEG at the retention size limit.
 *
 * @returns JPEG bytes padded to the maximum supported size.
 */
function maximumJPEG() {
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

    return maximum;
}

/**
 * Add a photograph with explicit retention metadata.
 *
 * @param run Mutable simulation state for this scenario.
 * @param images Stored JPEG bytes indexed by photograph identifier.
 * @param credits Commission identifiers credited by the photograph.
 * @param isReady Whether to store the completed JPEG immediately.
 * @param isFavorite Whether the crew favorites this photograph.
 * @returns The recorded photograph identifier.
 */
function record(
    run: ReturnType<typeof crew>,
    images: Map<string, Uint8Array>,
    credits: string[] = [],
    isReady = false,
    isFavorite = false,
) {
    const frame = makePhotoFrame(run, 'a');

    run.album.push({
        id: frame.id,
        photographer: 'a',
        tick: frame.tick,
        credits,
        assists: ['b', 'c', 'd'],
        favorites: isFavorite ? ['a', 'b', 'c', 'd'] : [],
        // eslint-disable-next-line unicorn/no-null -- The serialized game contract represents an empty slot with null.
        incident: null,
        thumbnail: isReady ? 'ready' : 'pending',
    });
    run.completed.push(...credits.filter((id) => !run.completed.includes(id)));
    if (isReady) images.set(frame.id, maximumJPEG());
    else run.pendingPhotos[frame.id] = frame;

    return frame.id;
}

/**
 * Record one photograph for every world commission.
 *
 * @param run Mutable simulation state for this scenario.
 * @param images Stored JPEG bytes indexed by photograph identifier.
 * @returns The credited photograph identifiers.
 */
function credits(
    run: ReturnType<typeof crew>,
    images: Map<string, Uint8Array>,
) {
    return run.world.commissions.map((c) => record(run, images, [c.id]));
}

/**
 * Submit a photograph command as the first crew member.
 *
 * @param run Mutable simulation state for this scenario.
 * @returns The photograph command result.
 */
function shutter(run: ReturnType<typeof crew>) {
    return applyCommand(run, 'a', {
        type: 'photo',
        worldId: run.worldId,
        seq: run.players[0].lastSeq + 1,
    })!;
}

/**
 * Create a private temporary directory owned by this test.
 *
 * @param t Test context that owns cleanup and diagnostics.
 * @returns The temporary directory path.
 */
async function directory(t: TestContext) {
    const direction = await mkdtemp(path.join(tmpdir(), 'wu-album-policy-'));

    t.after(() => rm(direction, { recursive: true, force: true }));

    return direction;
}

test('eight credited photographs leave space for 56 retained extras', async (t) => {
    const run = crew(),
        images = new Map<string, Uint8Array>(),
        direction = await directory(t);
    const protectedIds = credits(run, images);

    for (let index = 0; index < 55; index++) record(run, images);
    await saveRun(direction, run, images);
    const result = shutter(run);

    assert.deepEqual(result.verdict.credits, []);
    assert.equal(run.album.length, 64);
    assert.ok(protectedIds.every((id) => run.album.some((p) => p.id === id)));
    assert.ok(run.pendingPhotos[result.frame.id]);
    await saveRun(direction, run, images);
    assert.equal((await loadRun(direction))!.run.album.length, 64);
});

test('full extras evict only the oldest uncredited unfavorited pending record and frame', async (t) => {
    const run = crew(),
        images = new Map<string, Uint8Array>(),
        direction = await directory(t);
    const protectedIds = credits(run, images);
    const favorite = record(run, images, [], false, true);
    const removable = record(run, images);

    for (let index = 2; index < 56; index++) record(run, images);
    const expected = run.album.map((p) => p.id).filter((id) => id !== removable);

    await saveRun(direction, run, images);
    const result = shutter(run);

    assert.equal(run.album.length, 64);
    assert.deepEqual(
        run.album.map((p) => p.id),
        [...expected, result.frame.id],
    );
    assert.ok(run.album.some((p) => p.id === favorite));
    assert.ok(protectedIds.every((id) => run.album.some((p) => p.id === id)));
    assert.equal(run.pendingPhotos[removable], undefined);
    assert.equal(Object.keys(run.pendingPhotos).length, 64);
    await saveRun(direction, run, images);
});

test('56 favorited extras make uncredited captures preview-only across pending/ready mixtures', async (t) => {
    for (const ready of [0, 28, 56])
        await t.test(`${ready} ready extras`, async (t) => {
            const run = crew(),
                images = new Map<string, Uint8Array>(),
                direction = await directory(t);

            credits(run, images);
            for (let index = 0; index < 56; index++)
                record(run, images, [], index < ready, true);
            await saveRun(direction, run, images);
            const beforeAlbum = structuredClone(run.album),
                beforeFrames = structuredClone(run.pendingPhotos);
            const beforeImages = new Map(
                [...images].map(([id, bytes]) => [id, Buffer.from(bytes)]),
            );
            const result = shutter(run);

            assert.ok(
                result.frame,
                'existing capture return supplies a preview without a new API',
            );
            assert.deepEqual(result.verdict.credits, []);
            assert.equal(
                run.album.length,
                beforeAlbum.length,
                'preview must preserve the protected album',
            );
            assert.deepEqual(
                run.album,
                beforeAlbum,
                'protected extras cannot be replaced by the preview',
            );
            assert.deepEqual(
                run.pendingPhotos,
                beforeFrames,
                'preview must not become an upload obligation',
            );
            assert.deepEqual(images, beforeImages);
            assert.ok(run.album.every((p) => p.id !== result.frame.id));
            await saveRun(direction, run, images);
            const restored = (await loadRun(direction))!;

            assert.deepEqual(restored.run.album, beforeAlbum);
            assert.deepEqual(restored.images, images);
        });
});

test('a new credited capture remains retainable when all 56 extras are favorited', async (t) => {
    const run = crew(),
        images = new Map<string, Uint8Array>(),
        direction = await directory(t);
    const commission = run.world.commissions.find(
        (c) => c.kind === 'behavior'
            && run.world.residents.find((r) => r.id === c.subjects[0])!.species
            === 'deer',
    )!;

    assert.ok(commission);
    const items1 = run.world.commissions.filter((c) => c.id !== commission.id);

    for (const c of items1) record(run, images, [c.id]);
    for (let index = 0; index < 56; index++) record(run, images, [], false, true);
    const oldIds = run.album.map((p) => p.id);
    const anchor = run.world.pockets
        .flatMap((p) => p.anchors)
        .find((a) => a.id === commission.anchor)!;
    const deer = run.animals.find((a) => a.id === commission.subjects[0])!;

    // Arranged photo geometry tests the real evaluator/retention boundary, not a played encounter.

    deer.pose = pose(anchor.point);
    deer.behavior = 'graze';
    run.players[0].position = [
        anchor.point[0],
        anchor.point[1],
        anchor.point[2] + 5,
    ];
    run.players[0].pitch = -0.12;
    await saveRun(direction, run, images);
    const result = shutter(run);

    assert.ok(result.verdict.credits.includes(commission.id));
    assert.equal(run.album.length, 64);
    assert.deepEqual(
        run.album.map((p) => p.id),
        [...oldIds, result.frame.id],
    );
    assert.equal(run.album.filter((p) => p.credits.length).length, 8);
    await saveRun(direction, run, images);
});

test('save validation reserves eight credit slots even when total photo count is only 64', async (t) => {
    const run = crew(),
        images = new Map<string, Uint8Array>(),
        direction = await directory(t);

    const items2 = run.world.commissions.slice(0, 7);

    for (const c of items2) record(run, images, [c.id]);
    for (let index = 0; index < 56; index++) record(run, images);
    await saveRun(direction, run, images);
    const before = await readFile(path.join(direction, 'run.json'));

    record(run, images);
    assert.equal(run.album.length, 64);
    assert.equal(run.album.filter((p) => p.credits.length === 0).length, 57);
    await assert.rejects(saveRun(direction, run, images));
    assert.deepEqual(await readFile(path.join(direction, 'run.json')), before);
});

test('genuine 48-resident world fits eight credit photos plus 56 extras at maximum JPEG mixtures', async (t) => {
    const run = crew(4891, 'max-population-preflight'),
        direction = await directory(t);

    assert.equal(run.animals.length, 48);
    assert.equal(new Set(run.animals.map((a) => a.species)).size, 12);
    const blueprintBytes = Buffer.byteLength(JSON.stringify(run.world));

    assert.ok(blueprintBytes <= 1024 * 1024);
    for (const ready of [0, 32, 64]) {
        run.album = [];
        run.pendingPhotos = {};
        run.completed = [];
        const images = new Map<string, Uint8Array>();

        for (let index = 0; index < 64; index++)
            record(
                run,
                images,
                index < 8 ? [run.world.commissions[index].id] : [],
                index < ready,
                true,
            );
        await saveRun(direction, run, images);
        const raw = await readFile(path.join(direction, 'run.json'));

        assert.ok(raw.byteLength <= 8 * 1024 * 1024);
        assert.equal(raw.toString().match(/"placements":/g)?.length, 1);
        const restored = (await loadRun(direction))!;

        assert.equal(restored.run.animals.length, 48);
        assert.deepEqual(restored.run.world, run.world);
        assert.deepEqual(restored.run.album, run.album);
        assert.deepEqual(restored.run.pendingPhotos, run.pendingPhotos);
        assert.deepEqual(restored.images, images);
        t.diagnostic(
            `${ready} ready / ${64 - ready} pending: ${raw.byteLength} bytes; blueprint ${blueprintBytes}; residents ${run.animals.length}`,
        );
        record(run, images);
        await assert.rejects(saveRun(direction, run, images));
        assert.deepEqual(await readFile(path.join(direction, 'run.json')), raw);
    }
});
