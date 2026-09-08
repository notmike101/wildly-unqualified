import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyRuntime } from '../../scripts/release.ts';

const project = fileURLToPath(new URL('../../', import.meta.url));

test('isolated browser runtime retains imports and game-root-relative configuration', async (t) => {
    await mkdir(path.join(project, '.artifacts/reorganization'), {
        recursive: true,
    });
    const root = await mkdtemp(
        path.join(project, '.artifacts/reorganization/runtime with spaces '),
    );
    const owned: { server?: { url: string; close(): Promise<void> } } = {};

    t.after(async () => {
        await owned.server?.close();
        await rm(root, { recursive: true, force: true });
    });
    await copyRuntime(project, root);
    const { loadConfig } = await import(
        pathToFileURL(path.join(root, 'src/server/server-config.ts')).href,
    );

    assert.equal(loadConfig({}).dataDir, path.join(root, 'data-expedition'));
    assert.equal(loadConfig({}).webDir, path.join(root, 'web'));
    assert.equal(
        loadConfig({ WU_DATA_DIR: 'private' }).dataDir,
        path.join(root, 'private'),
    );
    assert.equal(
        loadConfig({ WU_WEB_DIR: 'dist' }).webDir,
        path.join(root, 'dist'),
    );
    assert.throws(() => loadConfig({ WU_DATA_DIR: 'web/private' }), /overlap/);
    await mkdir(path.join(root, 'web'));
    await writeFile(
        path.join(root, 'web/index.html'),
        '<!doctype html><title>Isolated runtime</title>',
    );
    const { startServer } = await import(
        pathToFileURL(path.join(root, 'src/server/server.ts')).href,
    );

    const server: { url: string; close(): Promise<void> } = await startServer({
        ...loadConfig({}),
        port: 0,
    });

    owned.server = server;
    assert.ok(server);
    const response1 = await fetch(server.url + '/healthz');

    assert.equal(response1.status, 200);
    const response2 = await fetch(server.url + '/');

    assert.match(await response2.text(), /Isolated runtime/);
    const response3 = await fetch(server.url + '/src/server/server.ts');

    assert.ok(response3.status >= 400);
    const response4 = await fetch(server.url + '/data-expedition/room.json');

    assert.ok(response4.status >= 400);
    await readFile(path.join(root, 'data-expedition/room.json'));
});
