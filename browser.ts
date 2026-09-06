// Visible ordinary-controls equipment check. Snapshot reads guide navigation;
// this script never writes game state, grants credit, or calls internal commands.
import assert from "node:assert/strict";
import {
  cp,
  copyFile,
  mkdir,
  readFile,
  writeFile,
  rename,
} from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  chromium,
  type Browser,
  type Page,
  type WebSocketRoute,
} from "playwright";
import {
  PROP_DEFINITIONS,
  PLANK_PLACEMENTS,
  RULES,
  gateLatch,
  WALLS,
  WALKABLES,
  routeBoxes,
  routeSurfaces,
  CAMP,
  HABITAT_SITES,
  WOODLAND_WASH_SITES,
  NAV_NODES,
} from "./level.ts";
import { animalRoute } from "./encounters.ts";
import {
  distance,
  propPoint,
  propBoxes,
  movePlayer,
  heldProp,
  eye,
  surfaceHeight,
  type Player,
  type Snapshot,
  type Vec3,
} from "./shared.ts";

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
    : fileURLToPath(new URL("./web-mvp", import.meta.url)),
  resolve(evidence, "web"),
  {
    recursive: true,
    errorOnExist: true,
    force: false,
  },
);
await mkdir(resolve(evidence, "runtime"));
for (const file of [
  "server.ts",
  "save.ts",
  "game.ts",
  "physics.ts",
  "shared.ts",
  "level.ts",
  "encounters.ts",
])
  await copyFile(
    resumedFrom && process.env.WU_RESUME_CURRENT_RUNTIME !== "1"
      ? resolve(resumedFrom, "runtime", file)
      : resolve("wildly-unqualified", file),
    resolve(evidence, "runtime", file),
  );
if (resumedFrom)
  await cp(resolve(resumedFrom, "data"), resolve(evidence, "data"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
const { startServer } = await import(
  pathToFileURL(resolve(evidence, "runtime/server.ts")).href
);
const serverOptions = {
  host: "127.0.0.1",
  port: 4316,
  origin: process.env.WU_TEST_URL ?? "http://127.0.0.1:4316",
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const snapshot = (p: Page) => p.evaluate(() => window.wildly.snapshot!);
const me = (p: Page) =>
  p.evaluate(() =>
    window.wildly.snapshot!.players.find(
      (x) => x.id === window.wildly.playerId,
    )!,
  );
const wrapped = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
async function hold(p: Page, key: string, ms: number) {
  await p.keyboard.down(key);
  try {
    await sleep(ms);
  } finally {
    await p.keyboard.up(key);
  }
}
async function face(p: Page, point: Vec3) {
  for (let n = 0; n < 16; n++) {
    const player = await me(p);
    const angle = Math.atan2(
      player.position[0] - point[0],
      player.position[2] - point[2],
    );
    const delta = wrapped(angle - player.yaw);
    if (Math.abs(delta) < 0.035) return;
    await hold(
      p,
      delta > 0 ? "ArrowLeft" : "ArrowRight",
      Math.max(20, Math.min(700, (Math.abs(delta) / 1.6) * 1000)),
    );
    await sleep(150 + latency);
  }
  throw Error("Camera could not face the next waypoint with arrow keys");
}
// Read-only route guidance for the UI driver. All actual travel still uses keys.
function detour(player: Player, goal: Vec3, state: Snapshot): Vec3[] {
  const walls = [
    ...WALLS,
    ...routeBoxes(state.route),
    ...state.props
      .filter((p) => !p.placed && !p.holders.includes(player.id))
      .flatMap((p) => propBoxes(p, PROP_DEFINITIONS[p.kind])),
    ...state.players
      .filter((p) => p.connected && p.id !== player.id)
      .map((p) => ({
        id: p.id,
        min: [
          p.position[0] - 0.35,
          p.position[1],
          p.position[2] - 0.35,
        ] as Vec3,
        max: [
          p.position[0] + 0.35,
          p.position[1] + 1.8,
          p.position[2] + 0.35,
        ] as Vec3,
      })),
  ].filter(
    (b) =>
      b.max[0] >= Math.min(player.position[0], goal[0]) - 8 &&
      b.min[0] <= Math.max(player.position[0], goal[0]) + 8 &&
      b.max[2] >= Math.min(player.position[2], goal[2]) - 8 &&
      b.min[2] <= Math.max(player.position[2], goal[2]) + 8,
  );
  const surfaces = [...WALKABLES, ...routeSurfaces(state.route)];
  const reach = (from: Vec3, to: Vec3) => {
    const dx = to[0] - from[0],
      dz = to[2] - from[2],
      length = Math.hypot(dx, dz);
    if (!length) return from;
    const input = {
      seq: 1,
      x: dx / length,
      z: dz / length,
      yaw: 0,
      pitch: 0,
      run: false,
      crouch: false,
    };
    const steps = Math.ceil(length / 0.05);
    let next = from;
    for (let i = 0; i < steps; i++) {
      next = movePlayer(
        { ...player, position: next },
        input,
        length / steps / 3,
        walls,
        surfaces,
      ).position;
      const fraction = (i + 1) / steps;
      if (
        Math.hypot(
          next[0] - from[0] - dx * fraction,
          next[2] - from[2] - dz * fraction,
        ) > 0.01
      )
        return null;
    }
    return Math.hypot(next[0] - to[0], next[2] - to[2]) < 0.01 ? next : null;
  };
  type Node = {
    x: number;
    z: number;
    position: Vec3;
    cost: number;
    parent?: Node;
  };
  const origin: Node = { x: 0, z: 0, position: player.position, cost: 0 };
  const open = [origin],
    seen = new Map([["0,0", 0]]);
  const heuristic = (n: Node) =>
    Math.hypot(n.position[0] - goal[0], n.position[2] - goal[2]);
  for (let expanded = 0; open.length && expanded < 3000; expanded++) {
    open.sort((a, b) => a.cost + heuristic(a) - b.cost - heuristic(b));
    const node = open.shift()!;
    if (heuristic(node) < 1.5 && reach(node.position, goal)) {
      const path = [goal];
      let cursor: Node | undefined = node;
      while (cursor?.parent) {
        path.unshift(cursor.position);
        cursor = cursor.parent;
      }
      const smooth: Vec3[] = [];
      let from = player.position;
      for (let i = 0; i < path.length;) {
        let last = i;
        while (last + 1 < path.length && reach(from, path[last + 1])) last++;
        smooth.push(path[last]);
        from = path[last];
        i = last + 1;
      }
      return smooth;
    }
    for (const dx of [-1, 0, 1])
      for (const dz of [-1, 0, 1]) {
        if (!dx && !dz) continue;
        const x = node.x + dx,
          z = node.z + dz,
          cost = node.cost + 0.5 * Math.hypot(dx, dz),
          key = `${x},${z}`;
        if ((seen.get(key) ?? Infinity) <= cost) continue;
        const target: Vec3 = [
          player.position[0] + x * 0.5,
          node.position[1],
          player.position[2] + z * 0.5,
        ];
        if (
          target[0] < Math.min(player.position[0], goal[0]) - 8 ||
          target[0] > Math.max(player.position[0], goal[0]) + 8 ||
          target[2] < Math.min(player.position[2], goal[2]) - 8 ||
          target[2] > Math.max(player.position[2], goal[2]) + 8
        )
          continue;
        const position = reach(node.position, target);
        if (position) {
          seen.set(key, cost);
          open.push({ x, z, position, cost, parent: node });
        }
      }
  }
  return [];
}
async function walk(p: Page, point: Vec3, tolerance = 0.3, allowDetour = true) {
  let stalled = 0;
  let bestRemaining = Infinity,
    withoutProgress = 0;
  for (let n = 0; n < 160; n++) {
    const before = await me(p);
    const remaining = Math.hypot(
      point[0] - before.position[0],
      point[2] - before.position[2],
    );
    if (remaining < tolerance) return;
    if (remaining < bestRemaining - 0.07) {
      bestRemaining = remaining;
      withoutProgress = 0;
    } else withoutProgress++;
    await face(p, point);
    await hold(
      p,
      "KeyW",
      Math.min(700, Math.max(55, ((remaining - tolerance / 2) / 3) * 1000)),
    );
    await sleep(150 + latency);
    const after = await me(p);
    stalled =
      distance(before.position, after.position) < 0.025 || withoutProgress > 7
        ? stalled + 1
        : 0;
    if (stalled === 3) {
      // Keep walking long enough to exercise the normal stationary-crew escape.
      await hold(p, "KeyW", 2000);
      await sleep(150 + latency);
    }
    if (stalled >= 5) {
      const state = await snapshot(p);
      if (
        allowDetour &&
        (!heldProp(after.id, state.props) ||
          heldProp(after.id, state.props)?.kind === "decoy")
      ) {
        const path = detour(after, point, state);
        if (path.length) {
          log.push({
            elapsedMs: Date.now() - startedAt,
            player: after.name,
            readOnlyRoute: path,
          });
          for (const waypoint of path)
            await walk(p, waypoint, Math.min(tolerance, 0.2), false);
          return;
        }
      }
      await recoverWalk(p, point);
      stalled = 0;
      withoutProgress = 0;
      bestRemaining = Infinity;
    }
  }
  throw Error(`Waypoint time budget exhausted: ${point}`);
}
async function recoverWalk(p: Page, target: Vec3) {
  const player = await me(p),
    path = resolve(evidence, `outing-recovery-${player.name}.json`);
  await writeFile(
    resolve(evidence, `outing-stall-${player.name}.json`),
    JSON.stringify({ player, target, state: await snapshot(p) }, null, 2),
  );
  console.log(
    `Driver paused ${player.name}'s route at a real obstacle. Ordinary key/face recovery file: ${path}`,
  );
  for (let n = 0; n < 1800; n++) {
    let commands: {
      key?: string;
      ms?: number;
      face?: Vec3;
      click?: string;
      target?: Vec3;
      acceptObserverApproach?: boolean;
    }[];
    try {
      commands = JSON.parse(await readFile(path, "utf8"));
    } catch {
      await sleep(500);
      continue;
    }
    assert.ok(Array.isArray(commands));
    await rename(
      path,
      resolve(evidence, `outing-recovery-${player.name}-${Date.now()}.json`),
    );
    for (const command of commands) {
      if (command.target || command.acceptObserverApproach) {
        assert.ok(
          !command.acceptObserverApproach || player.slot >= 2,
          "only an observer approach can be accepted at its actual standing position",
        );
        const destination = command.acceptObserverApproach
          ? (await me(p)).position
          : command.target!;
        assert.ok(
          destination.length === 3 && destination.every(Number.isFinite),
        );
        const clear = clearDestination(
          await me(p),
          destination,
          await snapshot(p),
        );
        target.splice(0, 3, ...clear);
      } else if (command.click) {
        assert.ok(
          [
            "#settings-button",
            "#recover-button",
            '[data-close="settings"]',
            "#pause-button",
            "#resume-button",
          ].includes(command.click),
        );
        await p.locator(command.click).click();
        await sleep(350 + latency);
      } else if (command.face) {
        assert.ok(
          command.face.length === 3 && command.face.every(Number.isFinite),
        );
        await face(p, command.face);
      } else {
        assert.match(
          command.key ?? "",
          /^(Key[WASDEQGC]|Arrow(Left|Right|Up|Down))$/,
        );
        if (command.ms !== undefined) {
          assert.ok(command.ms >= 0 && command.ms <= 15000);
          await hold(p, command.key!, command.ms);
        } else await action(p, command.key!);
      }
    }
    log.push({
      ordinaryRecovery: commands,
      player: player.name,
      elapsedMs: Date.now() - startedAt,
    });
    return;
  }
  throw Error("No ordinary-control recovery supplied in 15 minutes");
}
async function action(p: Page, key: string) {
  const player = await me(p);
  const hint = await p.locator("#context-action").textContent();
  await p.keyboard.press(key);
  await sleep(250 + latency);
  log.push({
    elapsedMs: Date.now() - startedAt,
    player: player.name,
    position: player.position,
    key,
    hint,
    notice: await p.locator("#notice").textContent(),
  });
}
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
async function habitatViews(name: string, center: Vec3) {
  const p = pages[0],
    position = (await me(p)).position;
  await aim(p, [center[0], 1.1, center[2]]);
  await p.screenshot({ path: resolve(evidence, name + "-first-person.png") });
  await aim(p, [position[0], position[1] + 9, position[2] - 6]);
  await p.screenshot({ path: resolve(evidence, name + "-upward-sky.png") });
  await aim(p, [center[0], 1.1, center[2]]);
}
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function clearDestination(player: Player, target: Vec3, state: Snapshot): Vec3 {
  const surfaces = [...WALKABLES, ...routeSurfaces(state.route)];
  const walls = [
    ...WALLS,
    ...routeBoxes(state.route),
    ...state.props
      .filter((p) => !p.placed && !p.holders.includes(player.id))
      .flatMap((p) => propBoxes(p, PROP_DEFINITIONS[p.kind])),
  ];
  const clear = (x: number, z: number): Vec3 | null => {
    const heights = surfaces
      .map((s) => surfaceHeight(s, x, z))
      .filter((h): h is number => h !== null);
    if (!heights.length) return null;
    const y = Math.max(...heights);
    if (
      walls.some(
        (b) =>
          b.max[1] > y + 0.15 &&
          b.min[1] < y + 1.8 &&
          x > b.min[0] - 0.36 &&
          x < b.max[0] + 0.36 &&
          z > b.min[2] - 0.36 &&
          z < b.max[2] + 0.36,
      )
    )
      return null;
    return [x, y, z];
  };
  const original = clear(target[0], target[2]);
  if (original) return original;
  for (let radius = 0.25; radius <= 5; radius += 0.25) {
    const candidates: Vec3[] = [];
    for (let i = 0; i < 32; i++) {
      const candidate = clear(
        target[0] + Math.cos((i * Math.PI) / 16) * radius,
        target[2] + Math.sin((i * Math.PI) / 16) * radius,
      );
      if (candidate) candidates.push(candidate);
    }
    candidates.sort(
      (a, b) => flat(a, player.position) - flat(b, player.position),
    );
    if (candidates.length) {
      log.push({
        diagnosticClearDestination: {
          requested: target,
          selected: candidates[0],
          player: player.name,
        },
      });
      return candidates[0];
    }
  }
  throw Error(`No clear supported standing destination within 5m of ${target}`);
}
async function travel(p: Page, target: Vec3) {
  let state = await snapshot(p),
    player = await me(p);
  target = clearDestination(player, target, state);
  if (
    heldProp(player.id, state.props)?.kind === "decoy" &&
    player.position[0] < -14 &&
    target[0] > -6
  ) {
    for (const point of [
      ...(player.position[2] > -4 ? [[-22, 0, 2] as Vec3] : []),
      [-22, 0, -6],
      [-6, 0, -6],
      [-6, 0, 2],
    ] as Vec3[])
      await walk(p, point, 0.4);
    state = await snapshot(p);
    player = await me(p);
  }
  const node = [...NAV_NODES].sort(
    (a, b) => flat(a.position, target) - flat(b.position, target),
  )[0];
  const path = animalRoute(player.position, node.id, state.route);
  log.push({ diagnosticRoute: path, player: player.name, target });
  for (const point of path) await walk(p, point, 0.4);
  await walk(p, target);
}
async function aim(p: Page, target: Vec3) {
  await face(p, target);
  for (let n = 0; n < 10; n++) {
    const player = await me(p),
      origin = eye(player);
    const angle = Math.atan2(target[1] - origin[1], flat(origin, target));
    const delta = angle - player.pitch;
    if (Math.abs(delta) < 0.025) return;
    await hold(
      p,
      delta > 0 ? "ArrowUp" : "ArrowDown",
      Math.max(20, Math.min(650, Math.abs(delta) * 1000)),
    );
    await sleep(150 + latency);
  }
}
async function photograph(p: Page, target: Vec3) {
  await aim(p, target);
  const before = (await snapshot(p)).album.length;
  await p.locator("#shutter-button").click();
  await p.waitForFunction(
    (n) =>
      window.wildly.snapshot!.album.length > n &&
      window.wildly.snapshot!.album.at(-1)!.thumbnail === "ready",
    before,
    { timeout: 15000 },
  );
  const photo = (await snapshot(p)).album.at(-1)!;
  log.push({ elapsedMs: Date.now() - startedAt, photo, diagnosticAim: target });
  await sleep(1050 + latency);
  return photo;
}
async function portrait(
  p: Page,
  species: "raccoon" | "deer" | "heron",
  assignment: string,
  seconds = 35,
) {
  const started = Date.now();
  while (Date.now() - started < seconds * 1000) {
    const state = await snapshot(p);
    if (state.completed.includes(assignment as never)) return;
    const animal = state.animals.find((a) => a.species === species)!;
    await aim(p, [
      animal.pose.position[0],
      animal.pose.position[1] + (species === "raccoon" ? 0.45 : 0.9),
      animal.pose.position[2],
    ]);
    if (
      ["inspect", "wash", "graze", "investigate", "display", "preen"].includes(
        animal.behavior,
      )
    )
      await photograph(p, [
        animal.pose.position[0],
        animal.pose.position[1] + (species === "raccoon" ? 0.45 : 0.9),
        animal.pose.position[2],
      ]);
    else await sleep(300);
  }
  throw Error(
    `No legitimate ${assignment} photo in ${seconds}s; ${JSON.stringify((await snapshot(p)).animals)}`,
  );
}
async function pickupTin(p: Page) {
  for (let i = 0; i < 8; i++) {
    const state = await snapshot(p),
      player = await me(p);
    if (state.tin.holder === player.id) return;
    const point = state.tin.pose.position;
    await walk(p, [point[0], point[1], point[2] + 0.65], 0.2);
    await face(p, point);
    await action(p, "KeyE");
  }
  throw Error("Ordinary E could not claim the tin");
}
async function pickupDecoy(p: Page) {
  const prop = (await snapshot(p)).props.find((p) => p.kind === "decoy")!;
  const handle = propPoint(PROP_DEFINITIONS.decoy.handles[0], prop.pose);
  const reachable = async () =>
    /Take wildlife decoy handle/.test(
      (await p.locator("#context-action").textContent()) ?? "",
    );
  if (!(await reachable())) {
    try {
      await walk(p, propPoint([0, 0, 0.85], prop.pose), 0.4);
    } catch (error) {
      if (!(await reachable())) throw error;
      log.push({
        recoveredDriverWaypoint: String(error),
        actualPrompt: await p.locator("#context-action").textContent(),
      });
    }
  }
  await face(p, handle);
  await action(p, "KeyE");
  assert.ok(
    (await snapshot(p)).props
      .find((p) => p.kind === "decoy")!
      .holders.includes((await me(p)).id),
  );
}
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
try {
  const room = JSON.parse(
    await readFile(resolve(evidence, "data/room.json"), "utf8"),
  );
  for (let i = 0; i < count; i++) {
    const browser = await chromium.launch({
      channel: "msedge",
      headless: false,
      ignoreDefaultArgs: ["--enable-unsafe-swiftshader"],
    });
    browsers.push(browser);
    const p = await browser.newPage({ viewport: null });
    if (resumedFrom) {
      const issued = Object.entries(
        room.sessions as Record<string, { name: string }>,
      ).find(
        ([, session]) => session.name === ["Rowan", "Fern", "Reed", "Ash"][i],
      );
      assert.ok(
        issued,
        "prior issued session available for browser restoration",
      );
      await p.context().addCookies([
        {
          name: "wu_session",
          value: issued[0],
          url: serverOptions.origin,
          httpOnly: true,
          sameSite: "Strict",
          secure: serverOptions.origin.startsWith("https:"),
        },
      ]);
    }
    pages.push(p);
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("requestfailed", (r) =>
      network.push({
        player: i + 1,
        path: new URL(r.url()).pathname,
        failed: r.failure()?.errorText,
      }),
    );
    p.on("response", (r) => {
      if (r.status() >= 400)
        network.push({
          player: i + 1,
          path: new URL(r.url()).pathname,
          status: r.status(),
        });
    });
    p.on("console", (m) => {
      if (
        m.type() === "error" &&
        !m.text().startsWith("Failed to load resource:")
      )
        if (restarting && m.text().startsWith("WebSocket connection"))
          network.push({
            expectedRestartError: m
              .text()
              .replace(/wss?:\/\/[^ ]+/g, "[owned websocket]"),
          });
        else errors.push(m.text());
    });
    if (latency)
      await p.routeWebSocket("**/ws", (client) => {
        const remote = client.connectToServer(),
          timers = new Set<ReturnType<typeof setTimeout>>();
        for (const [source, target] of [
          [client, remote],
          [remote, client],
        ] as [WebSocketRoute, WebSocketRoute][]) {
          source.onMessage((message) => {
            const timer = setTimeout(() => {
              timers.delete(timer);
              target.send(message);
            }, latency / 2);
            timers.add(timer);
          });
          source.onClose(async (code, reason) => {
            for (const timer of timers) clearTimeout(timer);
            await target.close({ code, reason });
          });
        }
      });
    await p.goto(serverOptions.origin);
    const screen = await p.evaluate(() => ({
      width: window.screen.availWidth,
      height: window.screen.availHeight,
    }));
    const cdp = await p.context().newCDPSession(p);
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    await cdp.send("Browser.setWindowBounds", {
      windowId,
      bounds: {
        windowState: "normal",
        left: (i % 2) * Math.floor(screen.width / 2),
        top:
          count === 4 ? Math.floor(i / 2) * Math.floor(screen.height / 2) : 0,
        width: Math.floor(screen.width / 2),
        height:
          count === 4
            ? Math.floor(screen.height / 2)
            : Math.min(
                screen.height,
                Math.floor(((screen.width / 2) * 9) / 16) + 88,
              ),
      },
    });
    await cdp.detach();
    await p.waitForFunction(
      () => document.body.dataset.ready === "webgpu",
      {},
      { timeout: 60000 },
    );
    if (!resumedFrom) {
      await p.locator("#name").fill(["Rowan", "Fern", "Reed", "Ash"][i]);
      await p.locator("#secret").fill(i ? room.joinSecret : room.hostSecret);
      await p.locator("#join-form button").click();
    }
    await p.waitForFunction(() => !!window.wildly.snapshot);
    await p.context().storageState({
      path: resolve(evidence, `private-browser-${i + 1}.json`),
    });
    assert.deepEqual(await p.evaluate(() => window.wildly.assetErrors), []);
    console.log(`Visible full outing: researcher ${i + 1}/${count} joined.`);
  }
  const [host, friend] = pages;
  await host.locator(resumedFrom ? "#resume-button" : "#start-button").click();
  await host.waitForFunction(() => window.wildly.snapshot?.phase === "outing");
  const initial = await snapshot(host);
  assert.equal(new Set(initial.players.map((p) => p.slot)).size, count);
  const world = initial.world;
  const woodland = HABITAT_SITES.woodland[world.sites.woodland],
    clearing = HABITAT_SITES.clearing[world.sites.clearing],
    wetland = HABITAT_SITES.wetland[world.sites.wetland];
  if (!resumedFrom) {
    const fieldCase = initial.props.find((p) => p.kind === "case")!;
    const handles = PROP_DEFINITIONS.case.handles.map((p) =>
      propPoint(p, fieldCase.pose),
    );
    await walk(host, [handles[0][0] - 0.65, 0, handles[0][2]]);
    await face(host, handles[0]);
    await action(host, "KeyE");
    await host.waitForFunction(() => {
      const p = window.wildly.snapshot!.props.find((p) => p.kind === "case")!;
      return p.holders.some(Boolean) && Math.abs(p.angularVelocity[1]) < 0.01;
    });
    const turnedCase = (await snapshot(host)).props.find(
      (p) => p.kind === "case",
    )!;
    const freeHandle = turnedCase.holders.findIndex((id) => id === null);
    const freePoint = propPoint(
      PROP_DEFINITIONS.case.handles[freeHandle],
      turnedCase.pose,
    );
    const reach = propPoint([freeHandle ? 1.4 : -1.4, 0, 0], turnedCase.pose);
    await walk(friend, reach);
    await face(friend, freePoint);
    await action(friend, "KeyE");
    assert.equal(
      (await snapshot(host)).props
        .find((p) => p.kind === "case")!
        .holders.filter(Boolean).length,
      2,
      "opposite handles claimed through E",
    );
    await action(host, "KeyQ");
    assert.equal(
      (await snapshot(host)).props.find((p) => p.kind === "case")!.open,
      true,
    );
    await sleep(RULES.whistleCooldown * 1000 + latency + 100);
    await action(host, "KeyQ");
    assert.equal(
      (await snapshot(host)).props.find((p) => p.kind === "case")!.open,
      false,
    );
    await hold(host, "ArrowDown", 350);
    await host.screenshot({ path: resolve(evidence, "two-handles.png") });
    await hold(host, "ArrowUp", 350);
    const partner = (await me(friend)).position;
    await photograph(host, [partner[0], partner[1] + 0.8, partner[2]]);
    console.log("Two physical handles and visible case lid controls passed.");
    const startCrew = await Promise.all([me(host), me(friend)]);
    await Promise.all(
      [host, friend].map((p, i) =>
        walk(
          p,
          [startCrew[i].position[0], 0, startCrew[i].position[2] - 4],
          0.45,
        ),
      ),
    );
    const carried = (await snapshot(host)).props.find(
      (p) => p.kind === "case",
    )!;
    assert.ok(
      distance(carried.pose.position, fieldCase.pose.position) > 2.5,
      "case travels with both holders through ordinary walking",
    );
    await action(host, "KeyG");
    assert.equal(
      (await snapshot(friend)).props
        .find((p) => p.kind === "case")!
        .holders.filter(Boolean).length,
      1,
    );
    const spareBefore = (await snapshot(host)).spareBait;
    await action(friend, "KeyQ");
    for (let n = 0; n < 5 && !(await snapshot(host)).spills.length; n++) {
      await hold(friend, "ArrowLeft", 700);
      await hold(friend, "KeyW", 500);
      await sleep(300 + latency);
    }
    assert.ok(
      (await snapshot(host)).spills.length > 0,
      "open case spills through a real turn/contact",
    );
    const spillStarted = Date.now();
    await sleep(3100 + latency);
    await action(friend, "KeyQ");
    const pile = (await snapshot(host)).spills[0];
    const carrying = await me(friend),
      away = flat(carrying.position, pile.position) || 1;
    await walk(
      friend,
      [
        carrying.position[0] +
          ((carrying.position[0] - pile.position[0]) * 3) / away,
        carrying.position[1],
        carrying.position[2] +
          ((carrying.position[2] - pile.position[2]) * 3) / away,
      ],
      0.4,
    );
    await action(friend, "KeyE");
    assert.equal(
      (await snapshot(host)).props
        .find((p) => p.kind === "case")!
        .holders.filter(Boolean).length,
      0,
    );
    for (
      let attempt = 0;
      attempt < 12 && (await snapshot(host)).spills.length;
      attempt++
    ) {
      const spill = (await snapshot(host)).spills[0];
      await walk(
        host,
        [spill.position[0], spill.position[1], spill.position[2] + 0.6],
        0.2,
      );
      await face(host, spill.position);
      await action(host, "KeyE");
    }
    assert.equal(
      (await snapshot(host)).spills.length,
      0,
      "all spill piles recovered through E",
    );
    assert.equal((await snapshot(host)).spareBait, spareBefore);
    coverage.spillRecoveryMs = Date.now() - spillStarted;
    await checkpoint("case-spill-recovered");
    console.log("Shared carry, individual release and stable set-down passed.");
    await Promise.all([walk(host, [-46, 0, 34]), walk(friend, [-45, 0, 35.5])]);
    const latch = gateLatch((await snapshot(host)).route);
    await walk(host, [latch[0], 0, latch[2] + 1.1]);
    await face(host, latch);
    await action(host, "KeyE");
    assert.equal(
      (await snapshot(host)).route.gateOpen,
      true,
      "ordinary latch interaction opens the real route",
    );
    await walk(host, [-44.8, 0, 33]);
    for (const point of [
      [-43, 0, 28],
      [-38, 0, 14],
      [-22, 0, 2],
    ] as Vec3[]) {
      await Promise.all([
        walk(host, point),
        walk(friend, [point[0] - 0.75, point[1], point[2] + 1.3]),
      ]);
    }
    await host.screenshot({
      path: resolve(evidence, "woodland-to-washout.png"),
    });
    console.log(
      "Visible gate opening and both players walking the forest route passed.",
    );
    for (const [i, p] of pages.slice(2).entries()) {
      for (const point of [
        [-46, 0, 34],
        [-44.8, 0, 33],
        [-43, 0, 28],
        [-38, 0, 14],
        [-24, 0, 1 - i * 2],
      ] as Vec3[])
        await walk(p, point);
    }
    const plank = (await snapshot(host)).props.find((p) => p.kind === "plank")!;
    const plankHandle = propPoint(
      PROP_DEFINITIONS.plank.handles[0],
      plank.pose,
    );
    await walk(host, [-22, 0, 5.55]);
    await walk(host, [plankHandle[0], 0, plankHandle[2] + 0.6], 0.16);
    await face(host, plankHandle);
    await action(host, "KeyE");
    assert.ok(
      (await snapshot(host)).props
        .find((p) => p.kind === "plank")!
        .holders.includes((await me(host)).id),
      "staged plank handle reachable from supported bank",
    );
    const carrier = await me(host);
    await face(host, [carrier.position[0], 0, carrier.position[2] - 20]);
    await sleep(650 + latency);
    await walk(friend, [-17, 0, 2]);
    for (let n = 0; n < 20; n++) {
      const current = (await snapshot(host)).props.find(
        (p) => p.kind === "plank",
      )!;
      if (
        distance(current.pose.position, PLANK_PLACEMENTS.right.position) < 0.5
      )
        break;
      await hold(host, "KeyD", 500);
      await sleep(150 + latency);
    }
    await host.screenshot({ path: resolve(evidence, "plank-seat-guide.png") });
    await action(host, "KeyE");
    assert.equal(
      (await snapshot(host)).route.crossing,
      "right",
      "ordinary rotation and push seats the staged plank",
    );
    await walk(host, [-15.5, -1, 5.55]);
    await walk(host, [-15.5, -1, 5]);
    await walk(host, [-10.25, -1, 5], 0.2);
    await walk(host, [-7, 0, 3]);
    await walk(friend, [-15.5, -1, 5]);
    await walk(friend, [-10.25, -1, 5], 0.2);
    await walk(friend, [-8, 0, 5]);
    for (const [i, p] of pages.slice(2).entries()) {
      await walk(p, [-15.5, -1, 5]);
      await walk(p, [-10.25, -1, 5], 0.2);
      await walk(p, [-8, 0, -i * 2]);
    }
    await host.screenshot({ path: resolve(evidence, "crossing-complete.png") });
    console.log(
      "Staged plank claimed, rotated, seated and crossed through ordinary controls.",
    );
    coverage.teamwork = [
      "Opposite-handle case carry and individual release",
      "One crew member seats plank while others wait and cross",
    ];
    await checkpoint("equipment-complete");
    coverage.seed = world.seed;
    coverage.assignments = world.assignments;

    // A live raccoon with no food lure gives its readable reach cue before theft.
    await travel(host, [woodland[0] - 3, 0, woodland[2] + 2]);
    const hatStarted = Date.now();
    for (let attempt = 0; attempt < 30; attempt++) {
      const state = await snapshot(host),
        r = state.animals.find((a) => a.species === "raccoon")!;
      if (state.hats.some((h) => h.carrier === "raccoon")) break;
      await walk(host, r.pose.position, 0.65);
      if (
        (await snapshot(host)).animals.some((a) => a.behavior === "hat-reach")
      ) {
        coverage.hatReachCueObserved = true;
        await host.screenshot({
          path: resolve(evidence, `hat-reach-${attempt}.png`),
        });
      }
      await sleep(1500);
    }
    assert.ok(
      (await snapshot(host)).hats.some((h) => h.carrier === "raccoon"),
      "ordinary proximity causes a telegraphed borrowed hat",
    );
    await checkpoint("hat-borrowed");
    const stolen = (await snapshot(host)).hats.find(
      (h) => h.carrier === "raccoon",
    )!;
    await face(host, stolen.position);
    await hold(host, "KeyS", 1200);
    const hatSubject = (await snapshot(host)).hats.find(
      (h) => h.owner === stolen.owner,
    )!;
    await photograph(host, hatSubject.position);
    for (let attempt = 0; attempt < 25; attempt++) {
      const hat = (await snapshot(host)).hats.find(
        (h) => h.owner === stolen.owner,
      )!;
      if (hat.carrier === "owner") break;
      await walk(host, hat.position, 0.65);
      await face(host, hat.position);
      await action(host, "KeyE");
    }
    assert.equal(
      (await snapshot(host)).hats.find((h) => h.owner === stolen.owner)!
        .carrier,
      "owner",
    );
    coverage.hatRecoveryMs = Date.now() - hatStarted;
    coverage.hatRecoveryRoute =
      "Ordinary proximity produces theft; subsequent E recovery restores the owner. Consult action prompts and checkpoint ticks to distinguish a chase catch from timeout-drop recovery; this timer includes approach and photography.";
    await checkpoint("hat-recovered");
    await travel(friend, [woodland[0] - 3, 0, woodland[2] + 2]);
    for (let attempt = 0; attempt < 30; attempt++) {
      const state = await snapshot(friend),
        r = state.animals.find((a) => a.species === "raccoon")!;
      if (state.hats.some((h) => h.carrier === "raccoon")) break;
      await walk(friend, r.pose.position, 0.65);
      await sleep(1500);
    }
    const secondHat = (await snapshot(host)).hats.find(
      (h) => h.carrier === "raccoon",
    );
    assert.ok(
      secondHat,
      "another unprotected crew member can experience the visible hat incident",
    );
    await checkpoint("hat-chase-before-restart");
    await restart("hatChaseRestart");
    assert.equal(
      (await snapshot(host)).hats.find((h) => h.owner === secondHat.owner)!
        .carrier,
      "owner",
      "server restart safely returns borrowed hat",
    );
    coverage.hatRestartSafeRecovery = true;

    await Promise.all([
      travel(host, [CAMP[0], 0, CAMP[2] - 3]),
      travel(friend, [-50, 0, 48]),
    ]);
    await pickupTin(host);
    await pickupDecoy(friend);
    await Promise.all([
      travel(host, [woodland[0] - 3, 0, woodland[2] + 3]),
      travel(friend, [woodland[0] - 6, 0, woodland[2] + 6]),
      ...pages
        .slice(2)
        .map((p, i) =>
          travel(p, [woodland[0] + 2, 0, woodland[2] + 8 + i * 2]),
        ),
    ]);
    await habitatViews("woodland", woodland);
    for (const [i, p] of pages.slice(0, 2).entries()) {
      await aim(p, [woodland[0], 1.1, woodland[2] + 6]);
      await p.screenshot({
        path: resolve(evidence, `crew-shade-view-${i + 1}.png`),
      });
    }
    await woodlandPhoto();
  } else {
    if (process.env.WU_RESUME_CURRENT_RUNTIME === "1") {
      await friend.locator("#settings-button").click();
      await friend.locator("#recover-button").click();
      await friend.locator('[data-close="settings"]').click();
      await sleep(400 + latency);
      coverage.authoritativeTippedPropRecovery = (
        await snapshot(host)
      ).props.find((p) => p.kind === "decoy")!.pose;
    }
    const state = await snapshot(host),
      decoy = state.props.find((p) => p.kind === "decoy")!;
    await Promise.all([
      travel(host, [
        state.tin.pose.position[0] + 1,
        0,
        state.tin.pose.position[2] + 1,
      ]),
      travel(friend, [decoy.pose.position[0] + 1.4, 0, decoy.pose.position[2]]),
    ]);
    await pickupTin(host);
    await pickupDecoy(friend);
    await checkpoint("resumed-and-reclaimed-equipment");
    const woodlandAssignment = world.assignments.find((a) =>
      a.startsWith("raccoon"),
    )!;
    if (!(await snapshot(host)).completed.includes(woodlandAssignment)) {
      await Promise.all([
        travel(host, [woodland[0] - 3, 0, woodland[2] + 3]),
        travel(friend, [woodland[0] - 6, 0, woodland[2] + 6]),
        ...pages
          .slice(2)
          .map((p, i) =>
            travel(p, [woodland[0] + 2, 0, woodland[2] + 8 + i * 2]),
          ),
      ]);
      await habitatViews("woodland", woodland);
      for (const [i, p] of pages.slice(0, 2).entries()) {
        await aim(p, [woodland[0], 1.1, woodland[2] + 6]);
        await p.screenshot({
          path: resolve(evidence, `crew-shade-view-${i + 1}.png`),
        });
      }
      await woodlandPhoto();
    }
  }

  async function woodlandPhoto() {
    const assignment = world.assignments.find((a) => a.startsWith("raccoon"))!;
    const lurePoint =
      assignment === "raccoon-wash"
        ? WOODLAND_WASH_SITES[world.sites.woodland]
        : ([woodland[0] - 3, 0, woodland[2] + 1] as Vec3);
    // The photographer is in place before the helper starts the bounded behavior.
    await aim(friend, [
      (await me(host)).position[0],
      1.1,
      (await me(host)).position[2],
    ]);
    await friend.screenshot({
      path: resolve(evidence, "outing-rowan-shade-identity.png"),
    });
    await walk(friend, [lurePoint[0] - 5, 0, lurePoint[2] + 5]);
    await aim(friend, [lurePoint[0], 0.45, lurePoint[2]]);
    await walk(host, [lurePoint[0] + 2, 0, lurePoint[2] + 0.7]);
    await face(host, lurePoint);
    await action(host, "KeyQ");
    let finished = false;
    await Promise.all([
      portrait(friend, "raccoon", assignment, 50).finally(() => {
        finished = true;
      }),
      (async () => {
        for (let attempt = 0; attempt < 4 && !finished; attempt++) {
          await sleep(6500);
          if (finished || (await snapshot(host)).completed.includes(assignment))
            return;
          await walk(host, [
            lurePoint[0] + (attempt % 2 ? 2 : -2),
            0,
            lurePoint[2] + 0.7,
          ]);
          await face(host, lurePoint);
          await action(host, "KeyQ");
        }
      })(),
    ]);
    await checkpoint("woodland-assignment");
  }

  async function escort(target: Vec3) {
    const state = await snapshot(host),
      player = await me(host);
    const node = [...NAV_NODES].sort(
      (a, b) => flat(a.position, target) - flat(b.position, target),
    )[0];
    const path = [
      ...animalRoute(player.position, node.id, state.route),
      target,
    ];
    for (const waypoint of path) {
      for (
        let attempt = 0;
        attempt < 100 && flat((await me(host)).position, waypoint) > 0.5;
        attempt++
      ) {
        const here = (await me(host)).position,
          length = flat(here, waypoint),
          amount = Math.min(2.4, length);
        const next: Vec3 = [
          here[0] + ((waypoint[0] - here[0]) * amount) / length,
          waypoint[1],
          here[2] + ((waypoint[2] - here[2]) * amount) / length,
        ];
        await walk(host, next, 0.35);
        let waited = 0;
        while (waited < 18000) {
          const current = await snapshot(host),
            r = current.animals.find((a) => a.species === "raccoon")!;
          if (flat(r.pose.position, current.tin.pose.position) < 4) break;
          await sleep(500);
          waited += 500;
        }
        const current = await snapshot(host),
          r = current.animals.find((a) => a.species === "raccoon")!;
        log.push({
          escortTick: current.tick,
          raccoon: r.pose.position,
          tin: current.tin.pose.position,
          waited,
        });
        if (flat(r.pose.position, current.tin.pose.position) > 11.5)
          throw Error(
            "Open tin escort lost raccoon interest; route/animal stall requires investigation",
          );
      }
    }
  }
  await Promise.all([
    escort([clearing[0] - 7, 0, clearing[2] - 3]),
    travel(friend, [clearing[0] - 5, 0, clearing[2] + 5]),
    ...pages
      .slice(2)
      .map((p, i) => travel(p, [clearing[0] + 7 + i * 2, 0, clearing[2] + 7])),
  ]);
  const deerAssignment = world.assignments.find((a) => a.startsWith("deer"))!;
  await habitatViews("clearing", clearing);
  await aim(host, [clearing[0], 1.1, clearing[2] + 7]);
  await host.screenshot({ path: resolve(evidence, "crew-sun-view.png") });
  if (deerAssignment === "deer-graze")
    await portrait(friend, "deer", deerAssignment, 40);
  const decoyBefore = (await snapshot(host)).props.find(
    (p) => p.kind === "decoy",
  )!;
  await action(friend, "KeyE");
  let decoy = (await snapshot(host)).props.find((p) => p.kind === "decoy")!;
  const cup = propPoint(PROP_DEFINITIONS.decoy.usePoints![0].point, decoy.pose);
  await walk(friend, propPoint([1, 0, -0.6], decoy.pose), 0.2);
  await face(friend, cup);
  await action(friend, "KeyQ");
  assert.equal(
    (await snapshot(host)).props.find((p) => p.kind === "decoy")!.open,
    true,
  );
  await walk(friend, [clearing[0] - 7, 0, clearing[2] + 6]);
  if (deerAssignment === "deer-decoy")
    await portrait(friend, "deer", deerAssignment, 45);
  const priorCompleted = [...(await snapshot(host)).completed],
    movedAt = Date.now();
  await pickupDecoy(friend);
  await walk(friend, [clearing[0] - 5, 0, clearing[2] + 8]);
  await action(friend, "KeyE");
  decoy = (await snapshot(host)).props.find((p) => p.kind === "decoy")!;
  assert.ok(flat(decoy.pose.position, decoyBefore.pose.position) > 1.2);
  await pickupDecoy(friend);
  await walk(friend, [clearing[0] - 4, 0, clearing[2] + 4]);
  await action(friend, "KeyE");
  await walk(friend, [clearing[0] - 7, 0, clearing[2] + 7]);
  assert.deepEqual(
    (await snapshot(host)).completed,
    priorCompleted,
    "moving and restoring decoy never removes earned assignments",
  );
  coverage.decoyRecoveryMs = Date.now() - movedAt;
  await checkpoint("deer-and-decoy-recovery");

  if (count === 4) {
    await Promise.all([
      travel(host, [14, 0, 4]),
      ...pages.slice(1).map((p, i) => travel(p, [12 + i * 2, 0, 10])),
    ]);
    for (const p of pages.slice(1)) await face(p, (await me(host)).position);
    await aim(host, [14, 1, 10]);
    await host.screenshot({
      path: resolve(evidence, "outing-crew-clearing-light.png"),
    });
    await travel(friend, [9, 0, 4]);
    await travel(host, [12, 0, 10]);
    await travel(friend, [12, 0, 4]);
    await face(host, (await me(friend)).position);
    await aim(friend, [12, 1, 10]);
    await friend.screenshot({
      path: resolve(evidence, "outing-rowan-clearing-light.png"),
    });
    coverage.crewViewHats = (await snapshot(host)).hats.map((h) => ({
      owner: h.owner,
      carrier: h.carrier,
    }));
  }

  await Promise.all([
    escort([wetland[0] - 6, 0, wetland[2] + 1]),
    // From the northwest, the setup helper and reeds sit behind the subjects.
    travel(friend, [wetland[0] - 8, 0, wetland[2] - 7]),
    ...pages
      .slice(2)
      .map((p, i) => travel(p, [wetland[0] + 3 + i * 2, 0, wetland[2] + 10])),
  ]);
  const heronAssignment = world.assignments.find((a) => a.startsWith("heron"))!;
  await habitatViews("wetland", wetland);
  if (heronAssignment === "heron-preen")
    await portrait(friend, "heron", heronAssignment, 40);
  for (
    let attempt = 0;
    attempt < 6 && !(await snapshot(host)).completed.includes("pond-pair");
    attempt++
  ) {
    await walk(host, [wetland[0] - 2.2, 0, wetland[2] + 0.6]);
    await sleep(3100 + latency);
    await action(host, "KeyQ");
    await walk(host, [wetland[0] - 5.6, 0, wetland[2] + 0.6]);
    await face(host, [wetland[0] - 5.6, 0, wetland[2] + 10]);
    // Tin remains held; move the setup on subsequent attempts to renew bounded interest.
    if (attempt % 2) await walk(host, [wetland[0] - 5.6, 0, wetland[2] + 2.2]);
    const end = Date.now() + 23000;
    let adjustedAt = 0;
    while (
      Date.now() < end &&
      !(await snapshot(host)).completed.includes("pond-pair")
    ) {
      const state = await snapshot(host),
        r = state.animals.find((a) => a.species === "raccoon")!,
        h = state.animals.find((a) => a.species === "heron")!;
      if (
        (h.behavior === "display" ||
          (h.behavior === "feed" && h.remaining < 2)) &&
        r.behavior !== "inspect" &&
        Date.now() - adjustedAt > 3500
      ) {
        const current = await me(host);
        await walk(host, [
          wetland[0] - 5.6,
          0,
          current.position[2] - wetland[2] > 1.4
            ? wetland[2] + 0.4
            : wetland[2] + 2.2,
        ]);
        await face(host, [wetland[0] - 5.6, 0, wetland[2] + 10]);
        adjustedAt = Date.now();
        continue;
      }
      const center: Vec3 = [
        (r.pose.position[0] + h.pose.position[0]) / 2,
        0.8,
        (r.pose.position[2] + h.pose.position[2]) / 2,
      ];
      await aim(friend, center);
      if (h.behavior === "display") await photograph(friend, center);
      else await sleep(200);
    }
  }
  assert.ok(
    (await snapshot(host)).completed.includes("pond-pair"),
    "actual quiet bait setup and concurrent inspect/display produce pond pair",
  );
  if (!(await snapshot(host)).completed.includes(heronAssignment))
    await portrait(friend, "heron", heronAssignment, 40);
  assert.equal((await snapshot(host)).completed.length, 4);
  await checkpoint("all-four-assignments");
  coverage.photoTeamwork =
    "One researcher carries/adjusts the actual open tin and baits the wetland while the second holds a distant camera angle and uses the shutter during concurrent behaviors.";

  // Authenticated image display is checked in the second real browser.
  await friend.locator("#notebook-button").click();
  await friend.waitForFunction(
    () =>
      Array.from(
        document.querySelectorAll<HTMLImageElement>("#album img"),
      ).filter(
        (i) => i.complete && i.naturalWidth === 640 && i.naturalHeight === 360,
      ).length >= 4,
  );
  coverage.sharedJPEGs = await friend.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>("#album img")).map(
      (i) => ({
        width: i.naturalWidth,
        height: i.naturalHeight,
        path: new URL(i.src).pathname,
      }),
    ),
  );
  coverage.sharedImageRange = await friend.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>("#album img")!,
      canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 36;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, 64, 36);
    const data = ctx.getImageData(0, 0, 64, 36).data;
    let min = 255,
      max = 0;
    for (let i = 0; i < data.length; i += 4) {
      min = Math.min(min, data[i]);
      max = Math.max(max, data[i]);
    }
    return max - min;
  });
  assert.ok(
    Number(coverage.sharedImageRange) > 30,
    "shared photo contains rendered color variation",
  );
  await friend.screenshot({ path: resolve(evidence, "shared-album.png") });
  await friend.locator('[data-close="notebook"]').click();
  await action(host, "KeyE");
  await Promise.all(
    pages.map((p, i) =>
      travel(p, [CAMP[0] + (i % 2) * 2, 0, CAMP[2] + Math.floor(i / 2) * 2]),
    ),
  );
  for (const p of pages) await p.locator("#ready-button").click();
  await host.locator("#finish-button").click();
  await host.waitForFunction(
    () => window.wildly.snapshot!.phase === "exhibition",
  );
  await checkpoint("exhibition");
  if (
    !(await friend
      .locator("#notebook")
      .evaluate((el) => el.hasAttribute("open")))
  )
    await friend.locator("#notebook-button").click();
  const favorite = friend
    .locator("#album button")
    .filter({ hasText: /favorite/i })
    .first();
  await favorite.click();
  await host.waitForFunction(() =>
    window.wildly.snapshot!.album.some((p) => p.favorites.length > 0),
  );
  await friend.locator('[data-close="notebook"]').click();
  await restart("exhibitionRestart");
  await checkpoint("favorites-restored");
  coverage.visibleClientMetrics = await Promise.all(
    pages.map((p) =>
      p.evaluate(() => ({
        backend: window.wildly.backend,
        adapter: window.wildly.adapter,
        p95: window.wildly.p95,
        rtt: window.wildly.rtt,
        render: window.wildly.render,
        visible: document.visibilityState,
      })),
    ),
  );
  if (latency)
    assert.ok(
      (await host.evaluate(() => window.wildly.rtt)) > latency * 0.7,
      "real sockets include the configured round-trip delay",
    );
  coverage.idleRoles =
    count === 4
      ? "Players 3/4 cross and travel, then wait as observers while two agents prepare/photograph animals. No claim of balanced human engagement."
      : "Two agents alternate setup and photography; photographer waits during tin herding.";
  coverage.predominantSolution =
    "Same tin escort plus quiet bait/photo timing; site/assignment variations use the authored graph. Compare distinct seeds in the report.";
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(evidence, "result.json"),
    JSON.stringify(
      {
        scope: `Visible ${count}-player forest MVP full outing through ordinary controls, with labeled read-only diagnostic guidance`,
        coverage,
        count,
        latency,
        transport:
          new URL(serverOptions.origin).protocol === "https:"
            ? "HTTPS/WSS via coordinated proxy to owned backend"
            : "HTTP/WS loopback",
        elapsedMs: Date.now() - startedAt,
        errors,
        network,
        log,
        final: await snapshot(host),
      },
      null,
      2,
    ),
  );
  console.log(`Equipment handling evidence: ${evidence}`);
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
