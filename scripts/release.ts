import {
    mkdir,
    readFile,
    copyFile,
    cp,
    readdir,
    lstat,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = new Set([
    'src/server/server.ts',
    'src/server/server-config.ts',
    'src/server/server-http.ts',
    'src/server/persistence/save.ts',
    'src/server/persistence/save-validation.ts',
    'src/server/persistence/save-values.ts',
    'src/server/simulation/game.ts',
    'src/server/simulation/game-commands.ts',
    'src/server/simulation/game-lifecycle.ts',
    'src/server/simulation/game-simulation.ts',
    'src/server/simulation/game-snapshot.ts',
    'src/server/simulation/game-state.ts',
    'src/server/simulation/game-support.ts',
    'src/server/simulation/equipment.ts',
    'src/server/simulation/physics.ts',
    'src/server/simulation/photo.ts',
    'src/server/simulation/wildlife/animal-behavior.ts',
    'src/server/simulation/wildlife/animal-context.ts',
    'src/server/simulation/wildlife/animal-navigation.ts',
    'src/server/simulation/wildlife/animal-routines.ts',
    'src/server/simulation/wildlife/encounters.ts',
    'src/server/simulation/wildlife/raccoon.ts',
    'src/shared/shared.ts',
    'src/shared/world/forest-models.ts',
    'src/shared/world/legacy-level.ts',
    'src/shared/world/level-data.ts',
    'src/shared/world/level.ts',
    'src/shared/world/subject-geometry.ts',
    'src/shared/world/world.ts',
    'src/shared/world/world-data.ts',
    'src/shared/world/world-geometry.ts',
    'src/shared/world/world-validation.ts',
    'src/shared/wildlife/support-meshes.ts',
    'src/shared/wildlife/wildlife-data.ts',
    'src/shared/wildlife/wildlife.ts',
]);

/**
 * Verify that every relative import of a runtime file is in the release allowlist.
 *
 * @param sourceRoot - Repository root used to resolve import paths
 * @param sourcePath - Absolute path of the file being checked
 * @param source - TypeScript source text of the file being checked
 * @throws {Error} A relative import is missing from the release allowlist.
 */
function assertRuntimeImports(
    sourceRoot: string,
    sourcePath: string,
    source: string,
): void {
    for (const { fileName } of ts.preProcessFile(source, true, true).importedFiles) {
        if (!fileName.startsWith('.')) continue;
        const dependency = path.relative(
            sourceRoot,
            path.resolve(path.dirname(sourcePath), fileName),
        )
            .split(path.sep)
            .join('/');

        if (!runtime.has(dependency))
            throw new Error(`Runtime import missing from release: ${dependency}`);
    }
}

/**
 * Copy the explicit server/shared runtime with its relative directory structure.
 * Validate local imports before copying so releases and browser snapshots cannot
 * silently omit a runtime dependency.
 *
 * @param sourceRoot - Game root containing the source runtime
 * @param destination - Game root to create inside a release or browser snapshot
 * @returns Resolves when every allowed runtime module has been copied.
 * @throws {Error} A source or dependency is absent, or a filesystem operation fails.
 */
export async function copyRuntime(
    sourceRoot: string,
    destination: string,
): Promise<void> {
    for (const file of runtime) {
        const sourcePath = path.resolve(sourceRoot, file);
        const source = await readFile(sourcePath, 'utf8');

        assertRuntimeImports(sourceRoot, sourcePath, source);
    }
    for (const file of runtime) {
        const target = path.resolve(destination, file);

        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(path.resolve(sourceRoot, file), target);
    }
}

/**
 * Create a portable release from dist and the explicit runtime allowlist.
 * Reject symlinked web assets and existing release destinations.
 *
 * @param destination - New output directory, defaults to a timestamped artifacts path
 * @returns Absolute release directory path.
 * @throws {Error} The build is missing, an import is absent from the allowlist, web assets
 * contain symlinks, or filesystem operations fail.
 */
export async function buildRelease(
    destination = path.resolve(
        root,
        '.artifacts/wildly-unqualified/releases',
        'forest-expedition-1-' + new Date().toISOString().replaceAll(/[:.]/g, '-'),
    ),
) {
    const output = path.resolve(destination),
        web = path.resolve(root, 'dist');

    await readFile(path.resolve(web, 'index.html'));
    const webFiles = await readdir(web, { recursive: true });

    for (const file of webFiles) {
        const stats = await lstat(path.resolve(web, file));

        if (stats.isSymbolicLink())
            throw new Error('Release web assets must not contain symbolic links');
    }
    await mkdir(path.dirname(output), { recursive: true });
    await mkdir(output);
    await copyRuntime(root, path.resolve(output, 'wildly-unqualified'));
    await writeFile(
        path.resolve(output, 'wildly-unqualified/server.ts'),
        'import { runServer } from "./src/server/server.ts";\nawait runServer();\n',
    );
    const manifest = JSON.parse(
        await readFile(path.resolve(root, 'package.json'), 'utf8'),
    );

    manifest.scripts = { start: 'node wildly-unqualified/server.ts' };
    await writeFile(
        path.resolve(output, 'package.json'),
        JSON.stringify(manifest, undefined, 2) + '\n',
    );
    for (const file of ['pnpm-lock.yaml', 'pnpm-workspace.yaml'])
        await copyFile(path.resolve(root, file), path.resolve(output, file));
    await copyFile(path.resolve(root, 'docs/SERVER.md'), path.resolve(output, 'SERVER.md'));
    await cp(web, path.resolve(output, 'wildly-unqualified/web'), {
        recursive: true,
        errorOnExist: true,
        force: false,
    });

    return output;
}

if (
    process.argv[1]
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
    try {
        console.log(await buildRelease(process.argv[2]));
    } catch (error) {
        console.error(error instanceof Error ? error.message : 'Release failed');
        process.exitCode = 1;
    }
}
