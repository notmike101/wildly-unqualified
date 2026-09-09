/**
Private stdio adapter for the native desktop host.
 */
import { createInterface } from 'node:readline';
import { startServer } from '../server/server.ts';
import { loadConfig } from '../server/server-config.ts';
import { loadRoom } from '../server/persistence/save.ts';

const input = createInterface({ input: process.stdin });
const commands = input[Symbol.asyncIterator]();

try {
    const config = loadConfig(process.env);
    const server = await startServer(config);
    const room = await loadRoom(config.dataDir);

    process.stdout.write(JSON.stringify({ type: 'ready', url: server.url, hostSecret: room.hostSecret }) + '\n');
    for await (const command of commands) {
        if (command !== 'stop') continue;
        try {
            await server.close();
            process.stdout.write(JSON.stringify({ type: 'stopped' }) + '\n');
            break;
        } catch {
            process.stdout.write(JSON.stringify({ type: 'error', message: 'Save failed. Keep the game open, repair storage and close again to retry.' }) + '\n');
        }
    }

    // Also save if the native host exits unexpectedly and closes its pipe.

    await server.close();
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Desktop server failed');
    process.exitCode = 1;
} finally {
    input.close();
    process.stdin.destroy();
}
