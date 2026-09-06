/** Bounded file IO, serialized atomic replacement, backups, and room credentials. */
import { randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  copyFile,
  stat,
} from "node:fs/promises";
import { resolve, dirname } from "node:path";
import type { RunState } from "./game.ts";
import { obj, text, id, bool } from "./save-values.ts";
import { decodeSave } from "./save-validation.ts";
export { type ServerConfig, within, loadConfig } from "./server-config.ts";
export { validJPEG } from "./save-validation.ts";

export type RoomCredentials = {
  version: 1;
  joinSecret: string;
  hostSecret: string;
  hostId: string | null;
  sessions: Record<
    string,
    { playerId: string; name: string; pending: boolean }
  >;
};
const LIMIT = 8 * 1024 * 1024;
async function boundedRead(path: string) {
  const info = await stat(path);
  if (info.size > LIMIT || !info.isFile())
    throw Error("Save file exceeds allowed size");
  return readFile(path, "utf8");
}
export async function loadRun(
  dataDir: string,
): Promise<{ run: RunState; images: Map<string, Uint8Array> } | null> {
  const path = resolve(dataDir, "run.json");
  try {
    return decodeSave(await boundedRead(path));
  } catch (error) {
    if (error instanceof Error && /version/i.test(error.message)) throw error;
    try {
      const backup = decodeSave(await boundedRead(path + ".bak"));
      console.warn(
        "Recovered outing from valid backup; the primary save was unavailable or invalid.",
      );
      return backup;
    } catch (backupError) {
      if (
        (error as NodeJS.ErrnoException).code === "ENOENT" &&
        (backupError as NodeJS.ErrnoException).code === "ENOENT"
      )
        return null;
      throw error;
    }
  }
}
const writes = new Map<string, Promise<void>>();
function serialize(path: string, write: () => Promise<void>) {
  const task = (writes.get(path) ?? Promise.resolve())
    .catch(() => {})
    .then(write);
  writes.set(path, task);
  void task
    .finally(() => {
      if (writes.get(path) === task) writes.delete(path);
    })
    .catch(() => {});
  return task;
}
async function replace(
  path: string,
  raw: string,
  validate: (value: string) => unknown,
) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  let previous: string | undefined;
  try {
    previous = await boundedRead(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let valid = previous !== undefined;
  if (previous !== undefined) {
    try {
      validate(previous);
    } catch (error) {
      if (error instanceof Error && /version/i.test(error.message)) throw error;
      valid = false;
    }
  }
  await writeFile(path + ".tmp", raw, { mode: 0o600 });
  if (valid) {
    await copyFile(path, path + ".bak.tmp");
    await rename(path + ".bak.tmp", path + ".bak");
  }
  await rename(path + ".tmp", path);
}
export function saveRun(
  dataDir: string,
  run: RunState,
  images: Map<string, Uint8Array>,
): Promise<void> {
  const path = resolve(dataDir, "run.json");
  let raw: string;
  try {
    const encodedImages = Object.fromEntries(
      [...images].map(([id, bytes]) => [
        id,
        Buffer.from(bytes).toString("base64"),
      ]),
    );
    decodeSave(
      JSON.stringify({
        version: 3,
        run: structuredClone(run),
        images: encodedImages,
      }),
    );
    const saved = structuredClone(run);
    saved.paused = true;
    saved.pauseReason = "Saved for restart";
    saved.tin.holder = null;
    saved.tin.velocity = [0, 0, 0];
    for (const prop of saved.props) {
      prop.holders = [null, null];
      prop.velocity = [0, 0, 0];
      prop.angularVelocity = [0, 0, 0];
    }
    for (const player of saved.players) player.lastInput = null;
    raw = JSON.stringify({
      version: 3,
      run: saved,
      images: encodedImages,
    });
    if (Buffer.byteLength(raw) > LIMIT) throw Error("Save exceeds 8 MiB");
    decodeSave(raw);
  } catch (error) {
    return Promise.reject(error);
  }
  return serialize(path, () => replace(path, raw, decodeSave));
}
function decodeRoom(raw: string): RoomCredentials {
  const v = obj(JSON.parse(raw), [
    "version",
    "joinSecret",
    "hostSecret",
    "hostId",
    "sessions",
  ]);
  if (v.version !== 1) throw Error("Unsupported room version");
  for (const secret of [v.joinSecret, v.hostSecret])
    if (typeof secret !== "string" || !/^[a-f0-9]{32}$/.test(secret))
      throw Error("Invalid room credential");
  if (v.joinSecret === v.hostSecret)
    throw Error("Host and join credentials must differ");
  if (v.hostId !== null) id(v.hostId);
  const sessions = obj(v.sessions);
  if (Object.keys(sessions).length > 8)
    throw Error("Too many private sessions");
  for (const [key, s] of Object.entries(sessions)) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw Error("Invalid private session");
    obj(s, ["playerId", "name", "pending"]);
    id(s.playerId);
    text(s.name, 24);
    bool(s.pending);
  }
  return v as RoomCredentials;
}
export function saveRoom(dataDir: string, room: RoomCredentials) {
  const path = resolve(dataDir, "room.json"),
    raw = JSON.stringify(room);
  decodeRoom(raw);
  return serialize(path, () => replace(path, raw, decodeRoom));
}
export async function loadRoom(dataDir: string): Promise<RoomCredentials> {
  const path = resolve(dataDir, "room.json");
  try {
    return decodeRoom(await boundedRead(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    try {
      return decodeRoom(await boundedRead(path + ".bak"));
    } catch (backupError) {
      if ((backupError as NodeJS.ErrnoException).code !== "ENOENT")
        throw backupError;
    }
    const room: RoomCredentials = {
      version: 1,
      joinSecret: randomBytes(16).toString("hex"),
      hostSecret: randomBytes(16).toString("hex"),
      hostId: null,
      sessions: {},
    };
    await saveRoom(dataDir, room);
    return room;
  }
}
