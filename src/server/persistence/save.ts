/* eslint-disable unicorn/no-null -- Saved room and run contracts use explicit JSON null for empty holders and absent runs. */
/**
Bounded file IO, serialized atomic replacement, backups, and room credentials.
 */
import { randomBytes } from 'node:crypto';
import {
    mkdir,
    readFile,
    writeFile,
    rename,
    copyFile,
    stat,
} from 'node:fs/promises';
import pathModule from 'node:path';
import type { RunState } from '../simulation/game.ts';
import { obj as object, text, id, bool } from './save-values.ts';
import { decodeSave } from './save-validation.ts';
export { type ServerConfig, within, loadConfig } from '../server-config.ts';
export { validJPEG } from './save-validation.ts';

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

/**
 * Read a regular save file as UTF-8 after enforcing the file-size limit.
 *
 * @param path - Filesystem path to the save
 * @returns File contents.
 * @throws {Error} The file is missing, unreadable, nonregular, or larger than the save
 * limit.
 */
async function boundedRead(path: string) {
    const info = await stat(path);

    if (info.size > LIMIT || !info.isFile())
        throw new Error('Save file exceeds allowed size');

    return readFile(path, 'utf8');
}

/**
 * Load the primary run save, falling back to its backup for non-version failures. Version
 * errors stop loading; missing primary and backup mean no existing run.
 *
 * @param dataDirectory - Private data directory
 * @returns Validated run/images, or null only when both files are absent.
 * @throws {Error} Save versions are incompatible or neither available save can be loaded
 * safely.
 */
export async function loadRun(
    dataDirectory: string,
): Promise<{ run: RunState; images: Map<string, Uint8Array> } | null> {
    const path = pathModule.resolve(dataDirectory, 'run.json');

    try {
        return decodeSave(await boundedRead(path));
    } catch (error) {
        if (error instanceof Error && /version/i.test(error.message)) throw error;
        try {
            const backup = decodeSave(await boundedRead(path + '.bak'));

            console.warn(
                'Recovered outing from valid backup; the primary save was unavailable or invalid.',
            );

            return backup;
        } catch (backupError) {
            if (
                (error as NodeJS.ErrnoException).code === 'ENOENT'
                && (backupError as NodeJS.ErrnoException).code === 'ENOENT'
            )
                return null;
            throw error;
        }
    }
}
const writes = new Map<string, Promise<void>>();

/**
 * Queue writes per destination path. Each caller receives its own write failure while later
 * writes can still proceed.
 *
 * @param path - Destination path used as the queue key
 * @param write - Asynchronous write operation
 * @returns Completion of this queued write.
 * @throws {Error} The supplied write operation fails.
 */
function serialize(path: string, write: () => Promise<void>) {
    // Promise chaining captures and installs the next queue entry synchronously.
    /* eslint-disable unicorn/prefer-await */
    const task = (writes.get(path) ?? Promise.resolve())
        .catch(() => {})
        .then(write);

    /* eslint-enable unicorn/prefer-await */
    writes.set(path, task);
    void task
        .finally(() => {
            if (writes.get(path) === task) writes.delete(path);
        })
        .catch(() => {});

    return task;
}

/**
 * Write a validated replacement through a temporary file and rename, retaining only a valid
 * prior file as backup. Creates private directories/files; does not perform an fsync.
 *
 * @param path - Destination save path
 * @param raw - Already validated replacement JSON
 * @param validate - Validator for the existing file before backup
 * @throws {Error} An incompatible prior version or filesystem operation prevents
 * replacement.
 */
async function replace(
    path: string,
    raw: string,
    validate: (value: string) => unknown,
) {
    await mkdir(pathModule.dirname(path), { recursive: true, mode: 0o700 });
    let previous: string | undefined;

    try {
        previous = await boundedRead(path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    let isValid = previous !== undefined;

    if (previous !== undefined) {
        try {
            validate(previous);
        } catch (error) {
            if (error instanceof Error && /version/i.test(error.message)) throw error;
            isValid = false;
        }
    }
    await writeFile(path + '.tmp', raw, { mode: 0o600 });
    if (isValid) {
        await copyFile(path, path + '.bak.tmp');
        await rename(path + '.bak.tmp', path + '.bak');
    }
    await rename(path + '.tmp', path);
}

/**
 * Validate and clone the run, neutralize the saved restart state, and encode images before
 * a serialized atomic replacement. Does not mutate the live run or its images.
 *
 * @param dataDirectory - Private data directory
 * @param run - Live authoritative run to snapshot
 * @param images - JPEG buffers indexed by photo ID
 * @returns Completion of the queued save.
 * @throws {Error} Validation, encoded size, or persistence fails; validation failures are
 * returned as rejected promises.
 */
export function saveRun(
    dataDirectory: string,
    run: RunState,
    images: Map<string, Uint8Array>,
): Promise<void> {
    const path = pathModule.resolve(dataDirectory, 'run.json');
    let raw: string;

    try {
        const encodedImages = Object.fromEntries(
            [...images].map(([id, bytes]) => [
                id,
                Buffer.from(bytes).toString('base64'),
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
        saved.pauseReason = 'Saved for restart';
        saved.tin.holder = null;
        saved.tin.velocity = [0, 0, 0];
        for (const property of saved.props) {
            property.holders = [null, null];
            property.velocity = [0, 0, 0];
            property.angularVelocity = [0, 0, 0];
        }
        for (const player of saved.players) delete player.lastInput;
        raw = JSON.stringify({
            version: 3,
            run: saved,
            images: encodedImages,
        });
        if (Buffer.byteLength(raw) > LIMIT) throw new Error('Save exceeds 8 MiB');
        decodeSave(raw);
    } catch (error) {
        return Promise.reject(error);
    }

    return serialize(path, () => replace(path, raw, decodeSave));
}

/**
 * Parse and validate private room credentials, distinct host/join secrets, and bounded
 * session records.
 *
 * @param raw - UTF-8 room JSON
 * @returns Validated private credentials; never expose this object to clients.
 * @throws {Error} JSON, room version, credential shape, or session data is invalid.
 */
function decodeRoom(raw: string): RoomCredentials {
    const v = object(JSON.parse(raw), [
        'version',
        'joinSecret',
        'hostSecret',
        'hostId',
        'sessions',
    ]);

    if (v.version !== 1) throw new Error('Unsupported room version');
    for (const secret of [v.joinSecret, v.hostSecret])
        if (typeof secret !== 'string' || !/^[a-f0-9]{32}$/.test(secret))
            throw new Error('Invalid room credential');
    if (v.joinSecret === v.hostSecret)
        throw new Error('Host and join credentials must differ');
    if (v.hostId !== null) id(v.hostId);
    const sessions = object(v.sessions);

    if (Object.keys(sessions).length > 8)
        throw new Error('Too many private sessions');
    for (const [key, s] of Object.entries(sessions)) {
        if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid private session');
        const session = object(s, ['playerId', 'name', 'pending']);

        id(session.playerId);
        text(session.name, 24);
        bool(session.pending);
    }

    return v as RoomCredentials;
}

/**
 * Validate private room credentials and queue their atomic replacement. Validation occurs
 * synchronously before queuing.
 *
 * @param dataDirectory - Private data directory
 * @param room - Complete private room state
 * @returns Completion of the queued credential write.
 * @throws {Error} Credentials are invalid or persistence fails.
 */
export function saveRoom(dataDirectory: string, room: RoomCredentials) {
    const path = pathModule.resolve(dataDirectory, 'room.json'),
        raw = JSON.stringify(room);

    decodeRoom(raw);

    return serialize(path, () => replace(path, raw, decodeRoom));
}

/**
 * Load private credentials, consulting the backup only when the primary is absent. If both
 * are absent, create and persist fresh secrets. Corrupt credentials are never silently
 * replaced.
 *
 * @param dataDirectory - Private data directory
 * @returns Validated existing or newly persisted private room state.
 * @throws {Error} Existing credentials are invalid or filesystem operations fail.
 */
export async function loadRoom(dataDirectory: string): Promise<RoomCredentials> {
    const path = pathModule.resolve(dataDirectory, 'room.json');

    try {
        return decodeRoom(await boundedRead(path));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        try {
            return decodeRoom(await boundedRead(path + '.bak'));
        } catch (backupError) {
            if ((backupError as NodeJS.ErrnoException).code !== 'ENOENT')
                throw backupError;
        }
        const room: RoomCredentials = {
            version: 1,
            joinSecret: randomBytes(16).toString('hex'),
            hostSecret: randomBytes(16).toString('hex'),
            hostId: null,
            sessions: {},
        };

        await saveRoom(dataDirectory, room);

        return room;
    }
}
