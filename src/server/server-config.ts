/**
Server environment configuration and private/public directory separation.
 */
import pathModule from 'node:path';
import { fileURLToPath } from 'node:url';
export type ServerConfig = {
    host: string;
    port: number;
    origin: string;
    dataDir: string;
    webDir: string;
};
const gameDirectory = pathModule.resolve(pathModule.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Check lexical path containment using relative paths. This does not resolve symlinks;
 * server startup separately checks real paths.
 *
 * @param root - Candidate parent directory
 * @param path - Candidate child path
 * @returns Whether the path equals or is inside the root under this containment check.
 */
export const within = (root: string, path: string) => {
    const r = pathModule.relative(root, path);

    return r === '' || (!r.startsWith('..') && !pathModule.isAbsolute(r));
};

/**
 * Validate server environment settings and resolve private/public paths relative to the
 * game root. Reject overlapping directories and non-exact HTTP(S) origins.
 *
 * @param environment - Environment values, including optional WU_* overrides
 * @returns Normalized bind, origin, and directory configuration.
 * @throws {Error} Host, port, origin, or private/public directory separation is invalid.
 */
export function loadConfig(environment: NodeJS.ProcessEnv): ServerConfig {
    const host = environment.WU_BIND_HOST ?? '127.0.0.1';

    if (!/^[a-zA-Z0-9.:[\]-]{1,253}$/.test(host))
        throw new Error('Invalid bind host');
    const rawPort = environment.WU_PORT ?? '4310';

    if (!/^\d+$/.test(rawPort)) throw new Error('Invalid port');
    const port = Number(rawPort);

    if (port < 1 || port > 65_535) throw new Error('Invalid port');
    const origin
        = environment.WU_PUBLIC_ORIGIN
            ?? `http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${port}`;
    let url: URL;

    try {
        url = new URL(origin);
    } catch {
        throw new Error('Invalid public origin');
    }
    if (
        !['http:', 'https:'].includes(url.protocol)
        || url.origin !== origin
        || url.username
        || url.password
    )
        throw new Error('Public origin must be an exact HTTP(S) origin without a path');
    const dataDirectory = pathModule.resolve(gameDirectory, environment.WU_DATA_DIR ?? 'data-expedition'),
        webDirectory = pathModule.resolve(gameDirectory, environment.WU_WEB_DIR ?? 'web');

    if (within(webDirectory, dataDirectory) || within(dataDirectory, webDirectory))
        throw new Error('Private data and public web directories must not overlap');

    return { host, port, origin, dataDir: dataDirectory, webDir: webDirectory };
}
