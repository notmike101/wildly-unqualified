import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { copyRuntime } from "../../scripts/release.ts";

const project = fileURLToPath(new URL("../../", import.meta.url));

test("isolated browser runtime retains imports and game-root-relative configuration", async (t) => {
  await mkdir(join(project, ".artifacts/reorganization"), { recursive: true });
  const root = await mkdtemp(
    join(project, ".artifacts/reorganization/runtime with spaces "),
  );
  let server: { url: string; close(): Promise<void> } | undefined;
  t.after(async () => {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  });
  await copyRuntime(project, root);
  const { loadConfig } = await import(
    pathToFileURL(join(root, "src/server/server-config.ts")).href
  );
  assert.equal(loadConfig({}).dataDir, join(root, "data-expedition"));
  assert.equal(loadConfig({}).webDir, join(root, "web"));
  assert.equal(
    loadConfig({ WU_DATA_DIR: "private" }).dataDir,
    join(root, "private"),
  );
  assert.equal(loadConfig({ WU_WEB_DIR: "dist" }).webDir, join(root, "dist"));
  assert.throws(() => loadConfig({ WU_DATA_DIR: "web/private" }), /overlap/);
  await mkdir(join(root, "web"));
  await writeFile(
    join(root, "web/index.html"),
    "<!doctype html><title>Isolated runtime</title>",
  );
  const { startServer } = await import(
    pathToFileURL(join(root, "src/server/server.ts")).href
  );
  server = await startServer({ ...loadConfig({}), port: 0 });
  assert.ok(server);
  assert.equal((await fetch(server.url + "/healthz")).status, 200);
  assert.match(
    await (await fetch(server.url + "/")).text(),
    /Isolated runtime/,
  );
  assert.ok((await fetch(server.url + "/src/server/server.ts")).status >= 400);
  assert.ok(
    (await fetch(server.url + "/data-expedition/room.json")).status >= 400,
  );
  await readFile(join(root, "data-expedition/room.json"));
});
