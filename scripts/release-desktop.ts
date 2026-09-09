import { copyFile, cp, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { homedir } from 'node:os';
import { buildRelease } from './release.ts';

if (process.platform !== 'win32' || process.arch !== 'x64' || process.versions.node !== '26.5.0')
    throw new Error('Build with Windows x64 and Node 26.5.0 to reproduce this release.');
const root = path.resolve(import.meta.dirname, '..');
const version = '0.1.0-alpha.1';

const output = path.resolve(process.argv[2] ?? path.join(root, '.artifacts', `wildly-unqualified-${version}-windows-x64`));

// Refuse existing destinations through buildRelease before copying any runtime files.

await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
await buildRelease(path.join(output, 'runtime'));
const rustFlags = [
    process.env.CARGO_ENCODED_RUSTFLAGS,
    '-Ctarget-feature=+crt-static',
    `--remap-path-prefix=${root}=wildly-unqualified`,
    `--remap-path-prefix=${process.env.CARGO_HOME ?? path.join(homedir(), '.cargo')}=cargo`,
].filter(Boolean).join('\u{1F}');

execFileSync('cargo', ['build', '--release', '--locked'], {
    cwd: path.join(root, 'desktop'),
    stdio: 'inherit',
    env: { ...process.env, CARGO_ENCODED_RUSTFLAGS: rustFlags },
});
await copyFile(path.join(root, 'desktop/target/release/wildly-unqualified.exe'), path.join(output, 'Wildly Unqualified.exe'));
await copyFile(process.execPath, path.join(output, 'runtime/node.exe'));
await copyFile(path.join(path.dirname(process.execPath), 'LICENSE'), path.join(output, 'runtime/NODE-LICENSE.txt'));
await mkdir(path.join(output, 'runtime/wildly-unqualified/src/desktop'), { recursive: true });
await copyFile(path.join(root, 'src/desktop/server.ts'), path.join(output, 'runtime/wildly-unqualified/src/desktop/server.ts'));
for (const dependency of ['ws', 'box3d-wasm'])
    await cp(await realpath(path.join(root, 'node_modules', dependency)), path.join(output, 'runtime/node_modules', dependency), { recursive: true });

await copyFile(path.join(root, 'desktop/README.md'), path.join(output, 'README.txt'));
await mkdir(path.join(output, 'licenses'));
await copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(output, 'licenses/three.txt'));
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--format-version', '1', '--filter-platform', 'x86_64-pc-windows-msvc'], { cwd: path.join(root, 'desktop'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
const notices: string[] = [];

for (const dependency of metadata.packages) {
    if (!dependency.source) continue;
    const directory = path.dirname(dependency.manifest_path);

    notices.push(`${dependency.name} ${dependency.version}: ${dependency.license ?? 'See included license'}\n`);
    const entries = await readdir(directory, { withFileTypes: true });

    const licenseFiles = entries.filter((file) => file.isFile() && /^(?:license|copying|notice)(?:[.-]|$)/i.test(file.name));

    for (const file of licenseFiles) {
        const content = await readFile(path.join(directory, file.name), 'utf8');

        notices.push(`${file.name}\n${content}\n`);
    }
}
await writeFile(path.join(output, 'licenses/rust-dependencies.txt'), notices.join('\n'));
const nodeBinary = await readFile(process.execPath);

await writeFile(path.join(output, 'BUILD.json'), JSON.stringify({
    version,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    node: process.versions.node,
    nodeSha256: createHash('sha256').update(nodeBinary).digest('hex'),
    tauri: '2.11.5',
}, undefined, 2) + '\n');
console.log(output);
