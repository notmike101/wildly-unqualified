import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { test } from 'node:test';

test('desktop process admits its host and persists across graceful restart', { timeout: 30_000 }, async () => {
    const data = await mkdtemp(path.join(tmpdir(), 'wu-desktop-'));
    const root = path.resolve(import.meta.dirname, '../..');

    try {
        let worldId: string | undefined;

        for (let attempt = 0; attempt < 2; attempt++) {
            const child = spawn(process.execPath, [path.join(root, 'src/desktop/server.ts')], {
                env: { ...process.env, WU_DATA_DIR: data, WU_WEB_DIR: path.join(root, 'dist'), WU_PORT: '14319' },
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();

            try {
                const first = await lines.next();

                assert.equal(first.done, false, 'desktop adapter must announce readiness');
                const ready = JSON.parse(first.value!);

                assert.equal(ready.type, 'ready');
                assert.match(ready.hostSecret, /^[\da-f]+$/);
                const response = await fetch(`${ready.url}/api/join`, {
                    method: 'POST',
                    headers: { Origin: ready.url, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Desktop host', secret: ready.hostSecret }),
                });

                assert.equal(response.status, 200);
                if (attempt === 0) {
                    await rename(path.join(data, 'run.json'), path.join(data, 'preserved.json'));
                    await mkdir(path.join(data, 'run.json'));
                    child.stdin.write('stop\n');
                    const failure = await lines.next();

                    assert.equal(JSON.parse(failure.value!).type, 'error');
                    // eslint-disable-next-line unicorn/no-null -- Node reports a running process with null exitCode.
                    assert.equal(child.exitCode, null);
                    await rm(path.join(data, 'run.json'), { recursive: true });
                    await rename(path.join(data, 'preserved.json'), path.join(data, 'run.json'));
                }
                const exited = once(child, 'exit');

                child.stdin.write('stop\n');
                const stopped = await lines.next();

                assert.deepEqual(JSON.parse(stopped.value!), { type: 'stopped' });
                // eslint-disable-next-line unicorn/no-null -- Node reports no termination signal as null.
                assert.deepEqual(await exited, [0, null]);
                const saved = JSON.parse(await readFile(path.join(data, 'run.json'), 'utf8'));
                const currentId = saved.run?.worldId ?? saved.worldId;

                assert.equal(typeof currentId, 'string');
                if (worldId) assert.equal(currentId, worldId);
                worldId = currentId;
            } finally {
                child.kill();
            }
        }
    } finally {
        await rm(data, { recursive: true, force: true });
    }
});

test('desktop saves and exits when its parent disappears during startup', { timeout: 15_000 }, async () => {
    const data = await mkdtemp(path.join(tmpdir(), 'wu-desktop-eof-'));
    const root = path.resolve(import.meta.dirname, '../..');
    const child = spawn(process.execPath, [path.join(root, 'src/desktop/server.ts')], {
        env: { ...process.env, WU_DATA_DIR: data, WU_WEB_DIR: path.join(root, 'dist'), WU_PORT: '14320' },
        stdio: ['pipe', 'ignore', 'pipe'],
    });
    const timeout = setTimeout(() => child.kill(), 10_000);

    try {
        const exited = once(child, 'exit');

        child.stdin.end();
        const [code] = await exited;

        assert.equal(code, 0, 'early EOF must save and stop without forced termination');
        const saved = JSON.parse(await readFile(path.join(data, 'run.json'), 'utf8'));

        assert.equal(saved.version, 3);
    } finally {
        clearTimeout(timeout);
        child.kill();
        await rm(data, { recursive: true, force: true });
    }
});
