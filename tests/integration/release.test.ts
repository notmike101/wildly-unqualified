import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRelease } from '../../scripts/release.ts';

test('portable release contains the exact runtime lock and no credentials or development sources', async (t) => {
    const root = await mkdtemp(path.join(tmpdir(), 'wu release '));

    t.after(() => rm(root, { recursive: true, force: true }));
    const destination = path.join(root, 'portable release with spaces');

    await buildRelease(destination);
    const source = fileURLToPath(new URL('../../', import.meta.url));

    for (const file of ['package-lock.json'])
        assert.equal(
            await readFile(path.join(destination, file), 'utf8'),
            await readFile(path.join(source, file), 'utf8'),
        );
    const sourcePackage = JSON.parse(
        await readFile(path.join(source, 'package.json'), 'utf8'),
    );
    const releasePackage = JSON.parse(
        await readFile(path.join(destination, 'package.json'), 'utf8'),
    );

    assert.deepEqual(releasePackage, {
        ...sourcePackage,
        scripts: { start: 'node wildly-unqualified/server.ts' },
    });
    const response1 = await readdir(
        path.join(destination, 'wildly-unqualified'),
        {
            recursive: true,
        },
    );

    assert.deepEqual(
        response1
            .filter((file) => file.endsWith('.ts'))
            .map((file) => file.replaceAll('\\', '/'))
            .toSorted((a, b) => a.localeCompare(b)),
        [
            'server.ts',
            'src/server/simulation/wildlife/animal-behavior.ts',
            'src/server/simulation/wildlife/animal-context.ts',
            'src/server/simulation/wildlife/animal-navigation.ts',
            'src/server/simulation/wildlife/animal-routines.ts',
            'src/server/simulation/wildlife/encounters.ts',
            'src/server/simulation/equipment.ts',
            'src/shared/world/forest-models.ts',
            'src/server/simulation/game-commands.ts',
            'src/server/simulation/game-lifecycle.ts',
            'src/server/simulation/game-simulation.ts',
            'src/server/simulation/game-snapshot.ts',
            'src/server/simulation/game-state.ts',
            'src/server/simulation/game-support.ts',
            'src/server/simulation/game.ts',
            'src/shared/world/legacy-level.ts',
            'src/shared/world/level-data.ts',
            'src/shared/world/level.ts',
            'src/server/simulation/photo.ts',
            'src/server/simulation/physics.ts',
            'src/server/simulation/wildlife/raccoon.ts',
            'src/server/persistence/save-validation.ts',
            'src/server/persistence/save-values.ts',
            'src/server/persistence/save.ts',
            'src/server/server-config.ts',
            'src/server/server-http.ts',
            'src/server/server.ts',
            'src/shared/shared.ts',
            'src/shared/world/subject-geometry.ts',
            'src/shared/wildlife/support-meshes.ts',
            'src/shared/wildlife/wildlife-data.ts',
            'src/shared/wildlife/wildlife.ts',
            'src/shared/world/world-data.ts',
            'src/shared/world/world-geometry.ts',
            'src/shared/world/world-validation.ts',
            'src/shared/world/world.ts',
        ].toSorted((a, b) => a.localeCompare(b)),
    );
    assert.equal(
        await readFile(
            path.join(destination, 'wildly-unqualified/web/index.html'),
            'utf8',
        ),
        await readFile(path.join(source, 'dist/index.html'), 'utf8'),
        'package the current generated-reserve build',
    );
    assert.deepEqual(
        await readFile(
            path.join(destination, 'wildly-unqualified/web/models/forest-kit-v3.glb'),
        ),
        await readFile(path.join(source, 'dist/models/forest-kit-v3.glb')),
        'include the authored mature forest',
    );
    await assert.rejects(buildRelease(destination), /exist/i);
    const entries = await readdir(destination, { recursive: true });

    assert.equal(
        entries.some((p) => /(?:^|[\\/])(?:node_modules|data|data-expedition|tests|scripts|client|room\.json|run\.json|assets[\\/]author\.py)(?:$|[\\/])/.test(
            p,
        ),
        ),
        false,
    );
});
