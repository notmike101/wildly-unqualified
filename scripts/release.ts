import {
  mkdir,
  readFile,
  copyFile,
  cp,
  readdir,
  lstat,
  writeFile,
} from "node:fs/promises";
import { resolve, dirname, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = [
  "src/server/server.ts",
  "src/server/server-config.ts",
  "src/server/server-http.ts",
  "src/server/persistence/save.ts",
  "src/server/persistence/save-validation.ts",
  "src/server/persistence/save-values.ts",
  "src/server/simulation/game.ts",
  "src/server/simulation/game-commands.ts",
  "src/server/simulation/game-lifecycle.ts",
  "src/server/simulation/game-simulation.ts",
  "src/server/simulation/game-snapshot.ts",
  "src/server/simulation/game-state.ts",
  "src/server/simulation/game-support.ts",
  "src/server/simulation/equipment.ts",
  "src/server/simulation/physics.ts",
  "src/server/simulation/photo.ts",
  "src/server/simulation/wildlife/animal-behavior.ts",
  "src/server/simulation/wildlife/animal-context.ts",
  "src/server/simulation/wildlife/animal-navigation.ts",
  "src/server/simulation/wildlife/animal-routines.ts",
  "src/server/simulation/wildlife/encounters.ts",
  "src/server/simulation/wildlife/raccoon.ts",
  "src/shared/shared.ts",
  "src/shared/world/forest-models.ts",
  "src/shared/world/legacy-level.ts",
  "src/shared/world/level-data.ts",
  "src/shared/world/level.ts",
  "src/shared/world/subject-geometry.ts",
  "src/shared/world/world.ts",
  "src/shared/world/world-data.ts",
  "src/shared/world/world-geometry.ts",
  "src/shared/world/world-validation.ts",
  "src/shared/wildlife/support-meshes.ts",
  "src/shared/wildlife/wildlife-data.ts",
  "src/shared/wildlife/wildlife.ts",
];
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
    const sourcePath = resolve(sourceRoot, file);
    const source = await readFile(sourcePath, "utf8");
    for (const { fileName } of ts.preProcessFile(source, true, true)
      .importedFiles) {
      if (!fileName.startsWith(".")) continue;
      const dependency = relative(
        sourceRoot,
        resolve(dirname(sourcePath), fileName),
      )
        .split(sep)
        .join("/");
      if (!runtime.includes(dependency))
        throw Error(`Runtime import missing from release: ${dependency}`);
    }
  }
  for (const file of runtime) {
    const target = resolve(destination, file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(sourceRoot, file), target);
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
  destination = resolve(
    root,
    ".artifacts/wildly-unqualified/releases",
    "forest-expedition-1-" + new Date().toISOString().replace(/[:.]/g, "-"),
  ),
) {
  const output = resolve(destination),
    web = resolve(root, "dist");
  await readFile(resolve(web, "index.html"));
  for (const file of await readdir(web, { recursive: true }))
    if ((await lstat(resolve(web, file))).isSymbolicLink())
      throw Error("Release web assets must not contain symbolic links");
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  await copyRuntime(root, resolve(output, "wildly-unqualified"));
  await writeFile(
    resolve(output, "wildly-unqualified/server.ts"),
    'import { runServer } from "./src/server/server.ts";\nawait runServer();\n',
  );
  const manifest = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  manifest.scripts = { start: "node wildly-unqualified/server.ts" };
  await writeFile(
    resolve(output, "package.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  await copyFile(
    resolve(root, "package-lock.json"),
    resolve(output, "package-lock.json"),
  );
  await copyFile(resolve(root, "docs/SERVER.md"), resolve(output, "SERVER.md"));
  await cp(web, resolve(output, "wildly-unqualified/web"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  return output;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(await buildRelease(process.argv[2]));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Release failed");
    process.exitCode = 1;
  }
}
