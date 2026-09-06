/** Read-only route guidance and ordinary keyboard/button navigation for the visible acceptance driver. */
import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { type Page } from "playwright";
import { PROP_DEFINITIONS } from "./level.ts";
import { fixtureBoxes, fixtureSurfaces } from "./level.ts";
import type { ReserveBlueprint } from "./world.ts";
import { animalRoute } from "./encounters.ts";
import {
  distance,
  propPoint,
  propBoxes,
  movePlayer,
  heldProp,
  eye,
  surfaceHeight,
  type FixtureState,
  type Player,
  type Snapshot,
  type Vec3,
} from "./shared.ts";
export function createDriverNavigation({
  latency,
  evidence,
  startedAt,
  log,
}: {
  latency: number;
  evidence: string;
  startedAt: number;
  log: unknown[];
}) {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let activeWorld: ReserveBlueprint | undefined;
  const reserve = () => {
    if (!activeWorld) throw Error("Generated world not loaded");
    return activeWorld;
  };
  const routeBoxes = (state: FixtureState) =>
    fixtureBoxes(reserve().fixtures, state);
  const routeSurfaces = (state: FixtureState) =>
    fixtureSurfaces(reserve().fixtures, state);
  const snapshot = async (p: Page) => {
    const state = await p.evaluate(() => window.wildly.snapshot!);
    if (state.worldId !== activeWorld?.id)
      activeWorld = (await p.evaluate(() => window.wildly.world)) ?? undefined;
    if (state.worldId !== reserve().id) throw Error("Driver world mismatch");
    return state;
  };
  const me = (p: Page) =>
    p.evaluate(() =>
      window.wildly.snapshot!.players.find(
        (x) => x.id === window.wildly.playerId,
      )!,
    );
  const wrapped = (angle: number) =>
    Math.atan2(Math.sin(angle), Math.cos(angle));
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
      ...reserve().walls,
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
    const surfaces = [...reserve().walkables, ...routeSurfaces(state.route)];
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
  async function walk(
    p: Page,
    point: Vec3,
    tolerance = 0.3,
    allowDetour = true,
  ) {
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
  const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  function clearDestination(
    player: Player,
    target: Vec3,
    state: Snapshot,
  ): Vec3 {
    const surfaces = [...reserve().walkables, ...routeSurfaces(state.route)];
    const walls = [
      ...reserve().walls,
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
    throw Error(
      `No clear supported standing destination within 5m of ${target}`,
    );
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
    const node = [...reserve().navNodes].sort(
      (a, b) => flat(a.position, target) - flat(b.position, target),
    )[0];
    const path = animalRoute(player.position, node.id, {
      world: reserve(),
      route: state.route,
    });
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
    log.push({
      elapsedMs: Date.now() - startedAt,
      photo,
      diagnosticAim: target,
    });
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
        [
          "inspect",
          "wash",
          "graze",
          "investigate",
          "display",
          "preen",
        ].includes(animal.behavior)
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
  return {
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
  };
}
