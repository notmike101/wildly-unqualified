import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRelease } from "./release.ts";

test("portable release contains the exact runtime lock and no credentials or development sources", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "wu release "));
  t.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, "portable release with spaces");
  await buildRelease(destination);
  const source = dirname(fileURLToPath(import.meta.url));
  for (const file of ["package.json", "package-lock.json"])
    assert.equal(
      await readFile(join(destination, file), "utf8"),
      await readFile(join(source, file), "utf8"),
    );
  assert.deepEqual(
    (await readdir(join(destination, "wildly-unqualified"))).sort(),
    [
      "animal-behavior.ts",
      "animal-context.ts",
      "animal-navigation.ts",
      "animal-routines.ts",
      "encounters.ts",
      "equipment.ts",
      "forest-models.ts",
      "game-commands.ts",
      "game-lifecycle.ts",
      "game-simulation.ts",
      "game-snapshot.ts",
      "game-state.ts",
      "game-support.ts",
      "game.ts",
      "legacy-level.ts",
      "level-data.ts",
      "level.ts",
      "photo.ts",
      "physics.ts",
      "raccoon.ts",
      "save-validation.ts",
      "save-values.ts",
      "save.ts",
      "server-config.ts",
      "server-http.ts",
      "server.ts",
      "shared.ts",
      "subject-geometry.ts",
      "support-meshes.ts",
      "web",
      "wildlife-data.ts",
      "wildlife.ts",
      "world-data.ts",
      "world-geometry.ts",
      "world-validation.ts",
      "world.ts",
    ].sort(),
  );
  assert.equal(
    await readFile(
      join(destination, "wildly-unqualified/web/index.html"),
      "utf8",
    ),
    await readFile(join(source, "web-mvp/index.html"), "utf8"),
    "package the current generated-reserve build",
  );
  assert.deepEqual(
    await readFile(
      join(destination, "wildly-unqualified/web/models/forest-kit-v3.glb"),
    ),
    await readFile(join(source, "web-mvp/models/forest-kit-v3.glb")),
    "include the authored mature forest",
  );
  await assert.rejects(buildRelease(destination), /exist/i);
  const entries = await readdir(destination, { recursive: true });
  assert.equal(
    entries.some((p) =>
      /(?:^|[\\/])(?:node_modules|data|room\.json|run\.json|assets[\\/]author\.py)(?:$|[\\/])/.test(
        p,
      ),
    ),
    false,
  );
});
