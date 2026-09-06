import {
  mkdir,
  readFile,
  copyFile,
  cp,
  readdir,
  lstat,
} from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const gameDir = dirname(fileURLToPath(import.meta.url)),
  root = gameDir;
const runtime = [
  "server.ts",
  "save.ts",
  "game.ts",
  "game-state.ts",
  "equipment.ts",
  "photo.ts",
  "world-data.ts",
  "world-geometry.ts",
  "world-validation.ts",
  "physics.ts",
  "shared.ts",
  "level.ts",
  "encounters.ts",
  "world.ts",
  "wildlife.ts",
  "wildlife-data.ts",
  "support-meshes.ts",
];
export async function buildRelease(
  destination = resolve(
    root,
    ".artifacts/wildly-unqualified/releases",
    "forest-expedition-1-" + new Date().toISOString().replace(/[:.]/g, "-"),
  ),
) {
  const output = resolve(destination),
    web = resolve(gameDir, "web-mvp");
  await readFile(resolve(web, "index.html"));
  for (const file of runtime) {
    const source = await readFile(resolve(gameDir, file), "utf8");
    for (const match of source.matchAll(
      /(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s*['"](\.[^'"]+)['"]/g,
    )) {
      const dependency = relative(gameDir, resolve(gameDir, match[1]));
      if (!runtime.includes(dependency))
        throw Error(`Runtime import missing from release: ${dependency}`);
    }
  }
  for (const file of await readdir(web, { recursive: true }))
    if ((await lstat(resolve(web, file))).isSymbolicLink())
      throw Error("Release web assets must not contain symbolic links");
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  await mkdir(resolve(output, "wildly-unqualified"));
  for (const file of runtime)
    await copyFile(
      resolve(gameDir, file),
      resolve(output, "wildly-unqualified", file),
    );
  for (const file of ["package.json", "package-lock.json"])
    await copyFile(resolve(root, file), resolve(output, file));
  await copyFile(resolve(gameDir, "SERVER.md"), resolve(output, "SERVER.md"));
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
