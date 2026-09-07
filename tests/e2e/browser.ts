import { runOuting } from "./browser-outing.ts";
import { createDriverNavigation } from "./browser-navigation.ts";
import { copyRuntime } from "../../scripts/release.ts";
// Visible ordinary-controls equipment check. Snapshot reads guide navigation;
// this script never writes game state, grants credit, or calls internal commands.
import assert from "node:assert/strict";
import {
  cp,
  copyFile,
  mkdir,
  readFile,
  writeFile,
  access,
} from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type Browser, type Page } from "playwright";
import { type Vec3 } from "../../src/shared/shared.ts";
const output = resolve(".artifacts/wildly-unqualified/mvp-2026-09-05");
const startedAt = Date.now();
const count = Number(process.env.WU_PLAYERS ?? 2);
const latency = Number(process.env.WU_LATENCY_MS ?? 0);
const resumedFrom = process.env.WU_RESUME_FROM
  ? resolve(process.env.WU_RESUME_FROM)
  : null;
assert.ok([2, 4].includes(count) && [0, 150].includes(latency));
const evidence = resolve(output, `outing-${count}p-${latency}ms-${Date.now()}`);
await mkdir(evidence, { recursive: true });
await copyFile(
  fileURLToPath(import.meta.url),
  resolve(evidence, "outing-driver.ts"),
);
await cp(
  resumedFrom && process.env.WU_RESUME_CURRENT_RUNTIME !== "1"
    ? resolve(resumedFrom, "web")
    : fileURLToPath(new URL("../../dist", import.meta.url)),
  resolve(evidence, "web"),
  {
    recursive: true,
    errorOnExist: true,
    force: false,
  },
);
const runtime = resolve(evidence, "runtime");
let serverEntry = resolve(runtime, "src/server/server.ts");
if (resumedFrom && process.env.WU_RESUME_CURRENT_RUNTIME !== "1") {
  await cp(resolve(resumedFrom, "runtime"), runtime, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  try {
    await access(serverEntry);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    // Frozen evidence from before the source reorganization has a flat entry.
    serverEntry = resolve(runtime, "server.ts");
    await access(serverEntry);
  }
} else {
  await copyRuntime(fileURLToPath(new URL("../../", import.meta.url)), runtime);
}
if (resumedFrom)
  await cp(resolve(resumedFrom, "data"), resolve(evidence, "data"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
const { startServer } = await import(pathToFileURL(serverEntry).href);
const serverOptions = {
  host: "127.0.0.1",
  port: Number(process.env.WU_TEST_PORT ?? 4320),
  origin:
    process.env.WU_TEST_URL ??
    `http://127.0.0.1:${process.env.WU_TEST_PORT ?? 4320}`,
  webDir: resolve(evidence, "web"),
  dataDir: resolve(evidence, "data"),
};
let server = await startServer(serverOptions);
let restarting = false;
const browsers: Browser[] = [];
const pages: Page[] = [],
  errors: string[] = [],
  network: unknown[] = [],
  log: unknown[] = [];
const coverage: Record<string, unknown> = {
  guidance:
    "Read-only snapshots, authored routes and local collision calculations guide ordinary keys/buttons. No state writes, teleports or injected credit.",
  humanFunAndDuration: "Not measured: browser agents are not human players.",
};
if (resumedFrom) {
  const prior = JSON.parse(
    await readFile(resolve(resumedFrom, "failure.json"), "utf8").catch(() =>
      readFile(resolve(resumedFrom, "progress.json"), "utf8"),
    ),
  );
  Object.assign(coverage, prior.coverage, {
    resumedFrom,
    continuation:
      "Same saved world and already-issued sessions; no save/world edits. Previously evidenced equipment/hat/woodland stages retained. Runtime/web remain frozen unless compatibleRuntimeCorrection records an approved compatible update.",
    compatibleRuntimeCorrection: process.env.WU_RESUME_CURRENT_RUNTIME === "1",
  });
}
const {
  sleep,
  reserve,
  snapshot,
  me,
  hold,
  face,
  walk,
  action,
  flat,
  travel,
  aim,
  photograph,
  portrait,
  pickupTin,
  pickupDecoy,
} = createDriverNavigation({ latency, evidence, startedAt, log });
/**
 * Persist the latest snapshot, coverage, and log, then save a screenshot and print
 * checkpoint progress.
 *
 * @param name - Evidence filename stem
 * @throws {Error} Snapshot reading, evidence writing, or screenshot capture fails.
 */
async function checkpoint(name: string) {
  const state = await snapshot(pages[0]);
  log.push({
    checkpoint: name,
    elapsedMs: Date.now() - startedAt,
    tick: state.tick,
    completed: state.completed,
  });
  await writeFile(
    resolve(evidence, "progress.json"),
    JSON.stringify({ coverage, log, state }, null, 2),
  );
  await pages[0].screenshot({ path: resolve(evidence, name + ".png") });
  console.log(
    `Outing checkpoint: ${name}; ${state.completed.length}/4 assignments.`,
  );
}
/**
 * Capture first-person habitat and upward-sky screenshots, then restore aim toward the
 * habitat.
 *
 * @param name - Evidence filename stem
 * @param center - Habitat center in world coordinates
 * @throws {Error} Browser aiming or screenshot capture fails.
 */
async function habitatViews(name: string, center: Vec3) {
  const p = pages[0],
    position = (await me(p)).position;
  await aim(p, [center[0], 1.1, center[2]]);
  await p.screenshot({ path: resolve(evidence, name + "-first-person.png") });
  await aim(p, [position[0], position[1] + 9, position[2] - 6]);
  await p.screenshot({ path: resolve(evidence, name + "-upward-sky.png") });
  await aim(p, [center[0], 1.1, center[2]]);
}
/**
 * Save and restart the owned server, wait for crew reconnection, resume if appropriate, and
 * assert album/credit persistence. Records evidence under the supplied label.
 *
 * @param label - Coverage label for this restart
 * @throws {Error} Server restart, reconnection, or persistence assertions fail.
 */
async function restart(label: string) {
  const before = await snapshot(pages[0]);
  restarting = true;
  await server.close();
  await sleep(3600);
  server = await startServer(serverOptions);
  for (const p of pages)
    await p.waitForFunction(
      () =>
        window.wildly.snapshot?.players.find(
          (p) => p.id === window.wildly.playerId,
        )?.connected &&
        document.querySelector("#connection")?.textContent?.includes("/4"),
      null,
      { timeout: 20000 },
    );
  if (before.phase !== "exhibition") {
    await pages[0].locator("#resume-button").click();
    await pages[0].waitForFunction(() => !window.wildly.snapshot!.paused);
  }
  const after = await snapshot(pages[0]);
  restarting = false;
  assert.deepEqual(after.completed, before.completed);
  assert.deepEqual(after.album, before.album);
  coverage[label] = {
    beforeTick: before.tick,
    afterTick: after.tick,
    photos: after.album.length,
  };
}
export type BrowserOutingContext = {
  count: typeof count;
  evidence: typeof evidence;
  resumedFrom: typeof resumedFrom;
  serverOptions: typeof serverOptions;
  browsers: typeof browsers;
  pages: typeof pages;
  errors: typeof errors;
  network: typeof network;
  log: typeof log;
  coverage: typeof coverage;
  latency: typeof latency;
  startedAt: typeof startedAt;
  sleep: typeof sleep;
  reserve: typeof reserve;
  snapshot: typeof snapshot;
  me: typeof me;
  hold: typeof hold;
  face: typeof face;
  walk: typeof walk;
  action: typeof action;
  flat: typeof flat;
  travel: typeof travel;
  aim: typeof aim;
  photograph: typeof photograph;
  portrait: typeof portrait;
  pickupTin: typeof pickupTin;
  pickupDecoy: typeof pickupDecoy;
  restart: typeof restart;
  checkpoint: typeof checkpoint;
  habitatViews: typeof habitatViews;
  isRestarting: () => boolean;
};
try {
  await runOuting({
    count,
    evidence,
    resumedFrom,
    serverOptions,
    browsers,
    pages,
    errors,
    network,
    log,
    coverage,
    latency,
    startedAt,
    sleep,
    reserve,
    snapshot,
    me,
    hold,
    face,
    walk,
    action,
    flat,
    travel,
    aim,
    photograph,
    portrait,
    pickupTin,
    pickupDecoy,
    restart,
    checkpoint,
    habitatViews,
    /**
     * Read live restart status so event handlers do not retain a stale boolean.
     *
     * @returns Whether the driver is currently restarting its server.
     */
    isRestarting: () => restarting,
  });
} catch (error) {
  await writeFile(
    resolve(evidence, "failure.json"),
    JSON.stringify(
      {
        error: String(error),
        coverage,
        errors,
        network,
        views: await Promise.all(
          pages.map((p) =>
            p
              .evaluate(() => ({
                ready: document.body.dataset.ready,
                visible: document.visibilityState,
                status: document.querySelector("#join-status")?.textContent,
                adapter: window.wildly?.adapter,
                assets: window.wildly?.assetErrors,
                render: window.wildly?.render,
                p95: window.wildly?.p95,
              }))
              .catch((error) => ({ error: String(error) })),
          ),
        ),
        log,
        snapshot: pages[0] ? await snapshot(pages[0]).catch(() => null) : null,
      },
      null,
      2,
    ),
  );
  await pages[0]
    ?.screenshot({ path: resolve(evidence, "failure.png") })
    .catch(() => {});
  throw error;
} finally {
  const cleanup = await Promise.allSettled([
    ...browsers.map((browser) => browser.close()),
    server.close(),
  ]);
  const connectionsClosed = browsers.every((browser) => !browser.isConnected());
  await writeFile(
    resolve(evidence, "cleanup.json"),
    JSON.stringify(
      {
        connectionsClosed,
        ownedBrowserCount: browsers.length,
        results: cleanup.map((r) =>
          r.status === "fulfilled" ? r.status : String(r.reason),
        ),
      },
      null,
      2,
    ),
  );
  const saved = JSON.parse(
    await readFile(resolve(evidence, "data/run.json"), "utf8"),
  );
  for (const [id, bytes] of Object.entries(
    saved.images as Record<string, string>,
  )) {
    assert.match(id, /^photo-\d+$/);
    await writeFile(
      resolve(evidence, `outing-${id}.jpg`),
      Buffer.from(bytes, "base64"),
    );
  }
  assert.ok(connectionsClosed, "owned browser control connections are closed");
  assert.ok(
    cleanup.every((r) => r.status === "fulfilled"),
    "owned cleanup completed without errors",
  );
  console.log("Owned outing windows and server closed.");
}
