import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  cp,
  symlink,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { join } from "node:path";
import { WebSocket } from "ws";
import { startServer } from "../../src/server/server.ts";
import * as Server from "../../src/server/server.ts";
import {
  loadRoom,
  loadRun,
  saveRun,
} from "../../src/server/persistence/save.ts";
import {
  createRun,
  addPlayer,
  applyCommand as applyWorldCommand,
} from "../../src/server/simulation/game.ts";

const origin = "http://127.0.0.1:4310";

function applyCommand(
  run: ReturnType<typeof createRun>,
  id: string,
  input: Record<string, unknown>,
) {
  return applyWorldCommand(run, id, { worldId: run.worldId, ...input });
}

test("only explicit equipment contacts and native tin contacts route to impact cues", () => {
  const eventCueKind = (Server as any).eventCueKind;
  assert.equal(typeof eventCueKind, "function");
  assert.equal(eventCueKind({ kind: "impact", player: "a" }), "impact");
  assert.equal(eventCueKind({ kind: "noise", player: "a" }), undefined);
  assert.equal(eventCueKind({ kind: "noise", player: "tin" }), "impact");
});
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "wu sockets "));
  const webDir = join(root, "web");
  const dataDir = join(root, "private");
  await mkdir(webDir);
  await writeFile(
    join(webDir, "index.html"),
    "<!doctype html><title>Wildly Unqualified</title>",
  );
  const server = await startServer({
    host: "127.0.0.1",
    port: 0,
    origin,
    dataDir,
    webDir,
  });
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });
  return { ...server, root, webDir, dataDir };
}

test("only the compiled web directory and public readiness are served", async (t) => {
  const server = await fixture(t);
  const health = await fetch(server.url + "/healthz");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ready: true,
    build: "forest-expedition-1",
    schema: 3,
  });
  assert.equal((await fetch(server.url + "/")).status, 200);
  await writeFile(join(server.dataDir, "outside.js"), "private");
  await symlink(server.dataDir, join(server.webDir, "escape"), "junction");
  for (const path of [
    "/room.json",
    "/server.ts",
    "/data/room.json",
    "/%2e%2e%2froom.json",
    "/%2e%2e%5croom.json",
    "/escape/outside.js",
  ])
    assert.ok((await fetch(server.url + path)).status >= 400, path);
});

async function admit(
  url: string,
  secret: string,
  name = "Friend",
  cookie = "",
  requestOrigin = origin,
) {
  const response = await fetch(url + "/api/join", {
    method: "POST",
    headers: {
      Origin: requestOrigin,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ name, secret }),
  });
  const identity = (await response.json()) as {
    playerId: string;
    host: boolean;
    pending?: boolean;
    error?: string;
  };
  return {
    response,
    identity,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? cookie,
  };
}

function connect(url: string, cookie: string, requestOrigin = origin) {
  const socket = new WebSocket(url.replace("http:", "ws:") + "/ws", {
    origin: requestOrigin,
    headers: { Cookie: cookie },
  });
  const messages: any[] = [];
  socket.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
  return { socket, messages };
}
function encode(
  client: ReturnType<typeof connect>,
  value: Record<string, unknown>,
) {
  const worldId = client.messages.find((m) => m.type === "world")?.id;
  assert.ok(worldId, "world negotiation precedes gameplay");
  return JSON.stringify({ worldId, ...value });
}
async function until(predicate: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!predicate() && Date.now() < end)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(predicate(), "Expected socket event before timeout");
}

test("nearby friends hear distinct whistle and rattle cues once, without reconnect or restore replay", async (t) => {
  const server = await fixture(t),
    room = await loadRoom(server.dataDir);
  const host = await admit(server.url, room.hostSecret, "Host"),
    guest = await admit(server.url, room.joinSecret, "Guest");
  const first = connect(server.url, host.cookie),
    second = connect(server.url, guest.cookie);
  t.after(() => {
    first.socket.terminate();
    second.socket.terminate();
  });
  await until(
    () =>
      first.messages.some((m) => m.type === "snapshot") &&
      second.messages.some((m) => m.type === "snapshot"),
  );
  let seq = 1;
  first.socket.send(encode(first, { type: "use", seq: seq++ }));
  await until(() =>
    second.messages.some((m) => m.type === "cue" && m.kind === "whistle"),
  );
  assert.equal(
    second.messages.filter((m) => m.type === "cue" && m.kind === "whistle")
      .length,
    1,
  );
  assert.equal(
    second.messages.some((m) => m.type === "cue" && m.kind === "rattle"),
    false,
  );
  for (let i = 0; i < 60; i++) {
    const state = first.messages
        .filter((m) => m.type === "snapshot")
        .at(-1).value,
      p = state.players.find((p: any) => p.id === host.identity.playerId),
      target = state.tin.pose.position;
    const dx = target[0] - p.position[0],
      dz = target[2] - p.position[2],
      length = Math.hypot(dx, dz);
    // At 0.65m the case handle is closer to the eye than the ground tin.
    if (length < 0.4) break;
    first.socket.send(
      encode(first, {
        type: "input",
        value: {
          seq: seq++,
          x: dx / Math.max(length, 1),
          z: dz / Math.max(length, 1),
          yaw: 0,
          pitch: 0,
          run: false,
          crouch: false,
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  first.socket.send(
    encode(first, {
      type: "input",
      value: {
        seq: seq++,
        x: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        run: false,
        crouch: false,
      },
    }),
  );
  first.socket.send(encode(first, { type: "interact", seq: seq++ }));
  await until(
    () =>
      first.messages.filter((m) => m.type === "snapshot").at(-1).value.tin
        .holder === host.identity.playerId,
  );
  await until(
    () =>
      first.messages.filter((m) => m.type === "snapshot").at(-1).value.tick >
      200,
    5000,
  );
  first.socket.send(encode(first, { type: "use", seq: seq++ }));
  await until(() =>
    second.messages.some((m) => m.type === "cue" && m.kind === "rattle"),
  );
  first.socket.send(encode(first, { type: "start", seq: seq++ }));
  first.socket.send(encode(first, { type: "photo", seq: seq++ }));
  await until(() =>
    second.messages.some((m) => m.type === "cue" && m.kind === "shutter"),
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.deepEqual(
    second.messages.filter((m) => m.type === "cue").map((m) => m.kind),
    ["whistle", "rattle", "shutter"],
  );
  second.socket.terminate();
  await until(
    () =>
      first.messages
        .filter((m) => m.type === "snapshot")
        .at(-1)
        .value.players.find((p: any) => p.id === guest.identity.playerId)
        .connected === false,
  );
  const reconnect = connect(server.url, guest.cookie);
  t.after(() => reconnect.socket.terminate());
  await until(() => reconnect.messages.some((m) => m.type === "welcome"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(
    reconnect.messages.some((m) => m.type === "cue"),
    false,
  );
  await server.close();
  const restarted = await startServer({
    host: "127.0.0.1",
    port: 0,
    origin,
    dataDir: server.dataDir,
    webDir: server.webDir,
  });
  t.after(() => restarted.close());
  const restored = connect(restarted.url, host.cookie);
  t.after(() => restored.socket.terminate());
  await until(() => restored.messages.some((m) => m.type === "welcome"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(
    restored.messages.some((m) => m.type === "cue"),
    false,
  );
});

test("real sockets require origin and session, share movement, and reserve four slots", async (t) => {
  const server = await fixture(t);
  const credentials = JSON.parse(
    await readFile(join(server.dataDir, "room.json"), "utf8"),
  );
  assert.equal((await fetch(server.url + "/api/session")).status, 401);
  assert.equal((await admit(server.url, "wrong")).response.status, 403);
  assert.equal(
    (
      await fetch(server.url + "/api/join", {
        method: "POST",
        headers: {
          Origin: "https://evil.invalid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "x", secret: credentials.joinSecret }),
      })
    ).status,
    403,
  );
  const host = await admit(server.url, credentials.hostSecret, "Host");
  const guest = await admit(server.url, credentials.joinSecret, "Guest");
  assert.equal(host.identity.host, true);
  assert.notEqual(host.identity.playerId, guest.identity.playerId);
  assert.match(
    host.response.headers.get("set-cookie")!,
    /HttpOnly; SameSite=Strict/,
  );
  const first = connect(server.url, host.cookie),
    second = connect(server.url, guest.cookie);
  t.after(() => {
    first.socket.terminate();
    second.socket.terminate();
  });
  await until(
    () =>
      first.messages.some((m) => m.type === "snapshot") &&
      second.messages.some((m) => m.type === "snapshot"),
  );
  const initial = second.messages
    .filter((m) => m.type === "snapshot")
    .at(-1)
    .value.players.find((p: any) => p.id === host.identity.playerId)
    .position[0];
  first.socket.send(
    encode(first, {
      type: "input",
      value: {
        seq: 1,
        x: 1,
        z: 0,
        yaw: 0,
        pitch: 0,
        run: false,
        crouch: false,
      },
    }),
  );
  await until(() =>
    second.messages.some(
      (m) =>
        m.type === "snapshot" &&
        m.value.players.some(
          (p: any) => p.id === host.identity.playerId && p.lastSeq === 1,
        ),
    ),
  );
  const moved = second.messages
    .filter((m) => m.type === "snapshot")
    .at(-1)
    .value.players.find((p: any) => p.id === host.identity.playerId);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const stopped = second.messages
    .filter((m) => m.type === "snapshot")
    .at(-1)
    .value.players.find((p: any) => p.id === host.identity.playerId);
  assert.ok(
    stopped.position[0] > initial + 0.2,
    "Authenticated movement must actually move the player",
  );
  assert.ok(stopped.position[0] >= moved.position[0]);
  await new Promise((resolve) => setTimeout(resolve, 350));
  const expired = second.messages
    .filter((m) => m.type === "snapshot")
    .at(-1)
    .value.players.find((p: any) => p.id === host.identity.playerId);
  assert.deepEqual(expired.position, stopped.position);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await admit(server.url, credentials.joinSecret, "Guest " + i)).response
        .status,
      200,
    );
  assert.equal(
    (await admit(server.url, credentials.joinSecret, "Fifth")).response.status,
    409,
  );
  assert.equal(
    (
      await fetch(server.url + "/api/invite", {
        headers: { Cookie: guest.cookie },
      })
    ).status,
    403,
  );
  const invitation = await fetch(server.url + "/api/invite", {
    headers: { Cookie: host.cookie },
  });
  assert.equal(
    ((await invitation.json()) as any).secret,
    credentials.joinSecret,
  );
  assert.equal(
    JSON.stringify(first.messages).includes(credentials.hostSecret),
    false,
  );
});

test("websocket upgrades reject foreign origins, missing sessions, duplicates and oversized messages", async (t) => {
  const server = await fixture(t),
    room = await loadRoom(server.dataDir),
    host = await admit(server.url, room.hostSecret, "Host");
  async function rejected(cookie: string, requestOrigin = origin) {
    return new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(server.url.replace("http:", "ws:") + "/ws", {
        origin: requestOrigin,
        headers: { Cookie: cookie },
      });
      ws.on("unexpected-response", (_req, res) => {
        res.resume();
        resolve(res.statusCode!);
        ws.terminate();
      });
      ws.on("error", () => {});
      ws.on("open", () => {
        ws.terminate();
        reject(Error("Unexpected accepted socket"));
      });
    });
  }
  assert.equal(await rejected(""), 401);
  assert.equal(await rejected(host.cookie, "https://evil.invalid"), 403);
  const client = connect(server.url, host.cookie);
  await until(() => client.messages.some((m) => m.type === "welcome"));
  t.after(() => client.socket.terminate());
  assert.equal(await rejected(host.cookie), 409);
  const closed = new Promise<number>((resolve) =>
    client.socket.once("close", (code) => resolve(code)),
  );
  client.socket.send("x".repeat(16385));
  assert.equal(await closed, 1009);
});

test("zero sockets stay paused and a missing established world never silently resets", async (t) => {
  const server = await fixture(t),
    room = await loadRoom(server.dataDir);
  assert.equal(
    (await admit(server.url, room.hostSecret, "Host")).response.status,
    200,
  );
  assert.equal((await loadRun(server.dataDir))!.run.paused, true);
  await server.close();
  await rm(join(server.dataDir, "run.json"));
  await rm(join(server.dataDir, "run.json.bak"), { force: true });
  await assert.rejects(
    startServer({
      host: "127.0.0.1",
      port: 0,
      origin,
      dataDir: server.dataDir,
      webDir: server.webDir,
    }),
    /world save is missing/i,
  );
});

test("failed final save keeps the server available and permits a repaired retry", async (t) => {
  const server = await fixture(t),
    room = await loadRoom(server.dataDir);
  await admit(server.url, room.hostSecret, "Host");
  await mkdir(join(server.dataDir, "run.json.tmp"));
  await assert.rejects(server.close());
  assert.equal((await fetch(server.url + "/healthz")).status, 200);
  await rm(join(server.dataDir, "run.json.tmp"), { recursive: true });
  await server.close();
  assert.equal((await loadRun(server.dataDir))!.run.paused, true);
});

test("authenticated favorites stay shared in the ended exhibition and across restart", async (t) => {
  const original = await fixture(t),
    room = await loadRoom(original.dataDir);
  const host = await admit(original.url, room.hostSecret, "Host");
  const guest = await admit(original.url, room.joinSecret, "Guest");
  await original.close();
  const saved = (await loadRun(original.dataDir))!;
  for (const p of saved.run.players) addPlayer(saved.run, p.id, p.name);
  applyCommand(saved.run, host.identity.playerId, { type: "start", seq: 1 });
  const frame = applyCommand(saved.run, host.identity.playerId, {
    type: "photo",
    seq: 2,
  })!.frame;
  // Arranged completed goals isolate end/favorite authority; this is not an outing claim.
  saved.run.completed = [
    ...saved.run.world.commissions.filter((c) => c.required).map((c) => c.id),
  ];
  applyCommand(saved.run, host.identity.playerId, {
    type: "ready-end",
    seq: 3,
  });
  applyCommand(saved.run, guest.identity.playerId, {
    type: "ready-end",
    seq: 1,
  });
  applyCommand(saved.run, host.identity.playerId, { type: "finish", seq: 4 });
  await saveRun(original.dataDir, saved.run, saved.images);
  let server = await startServer({
    host: "127.0.0.1",
    port: 0,
    origin,
    dataDir: original.dataDir,
    webDir: original.webDir,
  });
  t.after(() => server.close());
  const first = connect(server.url, host.cookie),
    second = connect(server.url, guest.cookie);
  t.after(() => {
    first.socket.terminate();
    second.socket.terminate();
  });
  await until(() =>
    [first, second].every((client) =>
      client.messages.some((m) => m.type === "snapshot"),
    ),
  );
  first.socket.send(
    encode(first, {
      type: "favorite",
      seq: 5,
      photoId: frame.id,
      selected: true,
    }),
  );
  await until(() =>
    second.messages.some(
      (m) =>
        m.type === "snapshot" &&
        m.value.album[0].favorites.includes(host.identity.playerId),
    ),
  );
  second.socket.send(
    encode(second, {
      type: "favorite",
      seq: 2,
      photoId: frame.id,
      selected: true,
    }),
  );
  await until(() =>
    first.messages.some(
      (m) => m.type === "snapshot" && m.value.album[0].favorites.length === 2,
    ),
  );
  const selection = [host.identity.playerId, guest.identity.playerId];
  await server.close();
  server = await startServer({
    host: "127.0.0.1",
    port: 0,
    origin,
    dataDir: original.dataDir,
    webDir: original.webDir,
  });
  const restarted = connect(server.url, guest.cookie);
  t.after(() => restarted.socket.terminate());
  await until(() => restarted.messages.some((m) => m.type === "snapshot"));
  const restored = restarted.messages.find((m) => m.type === "snapshot").value;
  assert.equal(restored.phase, "exhibition");
  assert.equal(restored.paused, true);
  assert.deepEqual(restored.album[0].favorites, selection);
  restarted.socket.send(
    encode(restarted, {
      type: "favorite",
      seq: 3,
      photoId: frame.id,
      selected: false,
    }),
  );
  await until(() =>
    restarted.messages.some(
      (m) => m.type === "snapshot" && m.value.album[0].favorites.length === 1,
    ),
  );
  assert.deepEqual(
    restarted.messages.filter((m) => m.type === "snapshot").at(-1).value
      .album[0].favorites,
    [host.identity.playerId],
  );
  await server.close();
});

test("restart and relocation retain rule-earned photo credit, pending capture, bait and animals across a new origin with recovered host and reassigned guest", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "wu relocation "));
  t.after(() => rm(root, { recursive: true, force: true }));
  const webDir = join(root, "web"),
    dataDir = join(root, "original");
  await mkdir(webDir);
  await writeFile(
    join(webDir, "index.html"),
    "<!doctype html><title>Private outing</title>",
  );
  const room = await loadRoom(dataDir),
    run = createRun(9);
  for (const id of ["host", "guest", "third", "fourth"]) addPlayer(run, id, id);
  run.hostId = "host";
  run.phase = "outing";
  run.tin.portions = 2;
  run.baitPatches[
    run.world.pockets
      .flatMap((p) => p.anchors)
      .find((a) => a.kind === "feed")!.id
  ] = 1;
  const commission = run.world.commissions.find(
      (c) =>
        c.kind === "behavior" &&
        run.world.residents.find((r) => r.id === c.subjects[0])!.species ===
          "deer",
    )!,
    subject = run.animals.find((a) => a.id === commission.subjects[0])!,
    anchor = run.world.pockets
      .flatMap((p) => p.anchors)
      .find((a) => a.id === commission.anchor)!.point;
  run.players[0].position = [anchor[0], anchor[1], anchor[2] + 5];
  run.players[0].pitch = -0.12;
  subject.pose.position = [...anchor];
  subject.behavior = "graze";
  subject.remaining = 4.25;
  run.tin.open = true;
  run.seconds = 123;
  const captured = applyCommand(run, "host", { type: "photo", seq: 1 });
  assert.ok(captured);
  assert.deepEqual(captured.verdict.credits, [commission.id]);
  assert.deepEqual(run.completed, [commission.id]);
  assert.deepEqual(run.album[0].credits, [commission.id]);
  const frame = captured.frame,
    originalAnimals = structuredClone(run.animals);
  room.hostId = "host";
  const oldGuestCookie = "wu_session=" + "a".repeat(64);
  room.sessions["a".repeat(64)] = {
    playerId: "guest",
    name: "Original guest",
    pending: false,
  };
  const { saveRoom } = await import("../../src/server/persistence/save.ts");
  await saveRoom(dataDir, room);
  await saveRun(dataDir, run, new Map());
  let server = await startServer({
    host: "127.0.0.1",
    port: 0,
    origin,
    dataDir,
    webDir,
  });
  t.after(() => server.close());
  const host = await admit(server.url, room.hostSecret, "Host"),
    client = connect(server.url, host.cookie);
  t.after(() => client.socket.terminate());
  await until(() => client.messages.some((m) => m.type === "photo"));
  assert.deepEqual(
    client.messages.find((m) => m.type === "photo").frame,
    frame,
  );
  const restored = client.messages.find((m) => m.type === "snapshot").value;
  assert.equal(restored.paused, true);
  assert.equal(restored.seconds, 123);
  assert.equal(
    restored.animals.find((a: any) => a.id === subject.id).remaining,
    4.25,
  );
  assert.equal(restored.tin.portions, 2);
  assert.equal(
    restored.baitPatches[
      run.world.pockets
        .flatMap((p) => p.anchors)
        .find((a) => a.kind === "feed")!.id
    ],
    1,
  );
  assert.deepEqual(restored.animals, originalAnimals);
  const pending = await admit(server.url, room.joinSecret, "New guest");
  assert.equal(pending.response.status, 202);
  const invitation = await fetch(server.url + "/api/invite", {
    headers: { Cookie: host.cookie },
  });
  assert.deepEqual(((await invitation.json()) as any).pending, [
    { id: pending.identity.playerId, name: "New guest" },
  ]);
  const reassign = async (cookie: string, slotId: string) =>
    fetch(server.url + "/api/reassign", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slotId,
        admittedPlayerId: pending.identity.playerId,
      }),
    });
  assert.equal((await reassign(pending.cookie, "guest")).status, 403);
  assert.equal((await reassign(host.cookie, "host")).status, 409);
  const originalGuest = connect(server.url, oldGuestCookie);
  await until(() => originalGuest.messages.some((m) => m.type === "welcome"));
  assert.equal((await reassign(host.cookie, "guest")).status, 409);
  originalGuest.socket.terminate();
  await until(
    () =>
      client.messages
        .filter((m) => m.type === "snapshot")
        .at(-1)
        .value.players.find((p: any) => p.id === "guest").connected === false,
  );
  const privateRoom = await readFile(join(dataDir, "room.json"), "utf8");
  await writeFile(
    join(dataDir, "room.json"),
    " ".repeat(7 * 1024 * 1024) + privateRoom,
  );
  const reassignment = reassign(host.cookie, "guest");
  let saving = false;
  for (let i = 0; i < 100; i++) {
    try {
      await stat(join(dataDir, "room.json.tmp"));
      saving = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  assert.ok(saving, "Reassignment reached its real filesystem write");
  const racedUpgrade = await new Promise<number>((resolve) => {
    const ws = new WebSocket(server.url.replace("http:", "ws:") + "/ws", {
      origin,
      headers: { Cookie: oldGuestCookie },
    });
    ws.on("error", () => {});
    ws.on("unexpected-response", (_req, res) => {
      res.resume();
      resolve(res.statusCode!);
      ws.terminate();
    });
    ws.on("open", () => {
      resolve(101);
      ws.terminate();
    });
  });
  assert.ok(
    [401, 409].includes(racedUpgrade),
    "An old credential cannot reconnect during slot reassignment",
  );
  assert.equal((await reassignment).status, 200);
  assert.equal(
    (
      await fetch(server.url + "/api/session", {
        headers: { Cookie: oldGuestCookie },
      })
    ).status,
    401,
  );
  const guestIdentity = await fetch(server.url + "/api/session", {
    headers: { Cookie: pending.cookie },
  });
  assert.equal(((await guestIdentity.json()) as any).playerId, "guest");
  const guestClient = connect(server.url, pending.cookie);
  t.after(() => guestClient.socket.terminate());
  await until(() => guestClient.messages.some((m) => m.type === "welcome"));
  const favorite = (seq: number, selected: boolean, photoId = frame.id) => ({
    type: "favorite",
    seq,
    photoId,
    selected,
  });
  const latest = () =>
    guestClient.messages.filter((m) => m.type === "snapshot").at(-1).value;
  client.socket.send(
    encode(client, { ...favorite(2, true), playerId: "guest" }),
  );
  await until(() =>
    client.messages.some(
      (m) => m.type === "notice" && /Unexpected fields/.test(m.text),
    ),
  );
  client.socket.send(encode(client, favorite(2, true, "photo-unknown")));
  await until(() =>
    client.messages.some(
      (m) => m.type === "notice" && /Unknown photo/i.test(m.text),
    ),
  );
  client.socket.send(encode(client, favorite(3, true)));
  await until(() => latest().album[0].favorites.includes("host"));
  client.socket.send(encode(client, favorite(3, false)));
  await until(() =>
    client.messages.some((m) => m.type === "notice" && /Replayed/.test(m.text)),
  );
  assert.deepEqual(latest().album[0].favorites, ["host"]);
  guestClient.socket.send(encode(guestClient, favorite(1, true)));
  await until(() => latest().album[0].favorites.length === 2);
  guestClient.socket.send(encode(guestClient, favorite(2, true)));
  await until(
    () => latest().players.find((p: any) => p.id === "guest").lastSeq === 2,
  );
  assert.deepEqual(latest().album[0].favorites, ["host", "guest"]);
  guestClient.socket.send(encode(guestClient, favorite(3, false)));
  await until(() => latest().album[0].favorites.length === 1);
  assert.deepEqual(latest().album[0].favorites, ["host"]);
  guestClient.socket.send(encode(guestClient, favorite(4, true)));
  await until(() => latest().album[0].favorites.length === 2);
  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAA//Z",
    "base64",
  );
  const upload = (cookie: string, bytes: Buffer, type = "image/jpeg") =>
    fetch(server.url + "/api/photos/" + frame.id, {
      method: "POST",
      headers: { Origin: origin, Cookie: cookie, "Content-Type": type },
      body: new Uint8Array(bytes),
    });
  assert.equal((await upload(pending.cookie, jpeg)).status, 403);
  assert.equal((await upload(host.cookie, jpeg, "image/png")).status, 415);
  assert.equal((await upload(host.cookie, Buffer.alloc(65537))).status, 413);
  assert.equal((await upload(host.cookie, Buffer.from("invalid"))).status, 400);
  assert.equal((await upload(host.cookie, jpeg)).status, 200);
  assert.equal((await upload(host.cookie, jpeg)).status, 200);
  const photo = await fetch(server.url + "/api/photos/" + frame.id, {
    headers: { Cookie: pending.cookie },
  });
  assert.equal(photo.headers.get("content-type"), "image/jpeg");
  assert.equal(photo.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), jpeg);
  await server.close();
  const oldURL = server.url;
  const movedDir = join(root, "copied private data");
  await cp(dataDir, movedDir, { recursive: true });
  const listener = createServer();
  await new Promise<void>((resolve) =>
    listener.listen(0, "127.0.0.1", resolve),
  );
  const movedPort = (listener.address() as { port: number }).port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const movedOrigin = `http://127.0.0.1:${movedPort}`;
  server = await startServer({
    host: "127.0.0.1",
    port: movedPort,
    origin: movedOrigin,
    dataDir: movedDir,
    webDir,
  });
  assert.notEqual(server.url, oldURL);
  assert.equal(server.url, movedOrigin);
  assert.equal(
    (await admit(server.url, room.hostSecret, "Old-origin request")).response
      .status,
    403,
  );
  const recovered = await admit(
    server.url,
    room.hostSecret,
    "Recovered host",
    "",
    movedOrigin,
  );
  assert.equal(recovered.identity.playerId, "host");
  const recoveredHost = connect(server.url, recovered.cookie, movedOrigin);
  t.after(() => recoveredHost.socket.terminate());
  await until(() => recoveredHost.messages.some((m) => m.type === "welcome"));
  const newGuest = await admit(
    server.url,
    room.joinSecret,
    "Relocated guest",
    "",
    movedOrigin,
  );
  assert.equal(newGuest.response.status, 202);
  const migratedReassignment = await fetch(server.url + "/api/reassign", {
    method: "POST",
    headers: {
      Origin: movedOrigin,
      Cookie: recovered.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      slotId: "guest",
      admittedPlayerId: newGuest.identity.playerId,
    }),
  });
  assert.equal(migratedReassignment.status, 200);
  assert.equal(
    (
      await fetch(server.url + "/api/session", {
        headers: { Cookie: pending.cookie },
      })
    ).status,
    401,
  );
  const recoveredGuest = connect(server.url, newGuest.cookie, movedOrigin);
  t.after(() => recoveredGuest.socket.terminate());
  await until(() => recoveredGuest.messages.some((m) => m.type === "welcome"));
  assert.equal(
    recoveredGuest.messages.find((m) => m.type === "welcome").playerId,
    "guest",
  );
  const restoredPhoto = await fetch(server.url + "/api/photos/" + frame.id, {
    headers: { Cookie: newGuest.cookie },
  });
  assert.equal(restoredPhoto.status, 200);
  assert.deepEqual(Buffer.from(await restoredPhoto.arrayBuffer()), jpeg);
  const saved = (await loadRun(movedDir))!;
  assert.equal(saved.run.seconds, 123);
  assert.equal(saved.run.paused, true);
  assert.equal(saved.run.tin.portions, 2);
  assert.equal(
    saved.run.baitPatches[
      run.world.pockets
        .flatMap((p) => p.anchors)
        .find((a) => a.kind === "feed")!.id
    ],
    1,
  );
  assert.deepEqual(saved.run.animals, originalAnimals);
  assert.deepEqual(saved.run.completed, [commission.id]);
  assert.deepEqual(saved.run.album[0].credits, [commission.id]);
  assert.equal(saved.run.album[0].id, frame.id);
  assert.equal(saved.run.album[0].thumbnail, "ready");
  assert.deepEqual(saved.run.album[0].favorites, ["host", "guest"]);
  assert.deepEqual(
    recoveredGuest.messages.find((m) => m.type === "snapshot").value.album[0]
      .favorites,
    ["host", "guest"],
  );
  assert.equal(Object.keys(saved.run.pendingPhotos).length, 0);
  assert.deepEqual(Buffer.from(saved.images.get(frame.id)!), jpeg);
  const lastHost = recoveredHost.messages
    .filter((m) => m.type === "snapshot")
    .at(-1)
    .value.players.find((p: any) => p.id === "host");
  recoveredHost.socket.send(
    encode(recoveredHost, { type: "resume", seq: lastHost.lastSeq + 1 }),
  );
  await until(() =>
    recoveredGuest.messages.some(
      (m) => m.type === "snapshot" && !m.value.paused && m.value.seconds > 123,
    ),
  );
});

test("authenticated join negotiates one hashed world before state and rejects stale input", async (t) => {
  const { reserveHash } = await import("../../src/shared/world/world.ts");
  const server = await fixture(t),
    room = await loadRoom(server.dataDir),
    host = await admit(server.url, room.hostSecret, "Host"),
    client = connect(server.url, host.cookie);
  t.after(() => client.socket.terminate());
  await until(() => client.messages.some((m) => m.type === "snapshot"));
  assert.deepEqual(
    client.messages.slice(0, 3).map((m) => m.type),
    ["welcome", "world", "snapshot"],
  );
  const world = client.messages[1];
  assert.equal(world.id, world.blueprint.id);
  assert.equal(await reserveHash(world.blueprint), world.hash);
  assert.equal(client.messages[2].value.worldId, world.id);
  assert.equal("world" in client.messages[2].value, false);
  client.socket.send(
    encode(client, {
      type: "input",
      worldId: "old-reserve",
      value: {
        seq: 1,
        x: 1,
        z: 0,
        yaw: 0,
        pitch: 0,
        run: false,
        crouch: false,
      },
    }),
  );
  await until(() =>
    client.messages.some((m) => m.type === "notice" && /world/i.test(m.text)),
  );
  client.socket.send(
    encode(client, {
      type: "input",
      value: {
        seq: 1,
        x: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        run: false,
        crouch: false,
      },
    }),
  );
  await until(() =>
    client.messages.some(
      (m) =>
        m.type === "snapshot" &&
        m.value.players.some((p: any) => p.lastSeq === 1),
    ),
  );
  assert.equal(client.messages.filter((m) => m.type === "world").length, 1);
});
