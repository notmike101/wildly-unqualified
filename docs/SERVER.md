# Wildly Unqualified server

The current source is the **forest-expedition-1** development build, using save
schema **3**. Its gameplay acceptance remains incomplete. The preserved MVP and
prototype releases use older schemas; keep their original runtime and private
data together. This file describes the current source and newly packaged releases.

The server requires Node **26.5 or later within major 26**. It uses the pinned
`box3d-wasm`, `three` and `ws` runtime dependencies. It needs no GPU, Blender, Vite,
or development dependencies after packaging. Players need a compatible WebGPU
browser. Operation on another home-server OS/architecture requires verification.

## Build and run from source

From the game repository root:

```powershell
npm ci
npm run build
$env:WU_DATA_DIR = '.artifacts/development-data'
$env:WU_WEB_DIR = 'dist'
$env:WU_BIND_HOST = '127.0.0.1'
$env:WU_PORT = '4314'
$env:WU_PUBLIC_ORIGIN = 'http://127.0.0.1:4314'
npm start
```

Open the configured origin. `npm start` runs `src/server/server.ts`. For Vite hot
reload, use the separate two-terminal instructions in the repository README.
Keep production and development rooms on separate ports and private directories.

## Package and start a portable release

After building, run `npm run release`. The builder creates a new timestamped
`forest-expedition-1-*` directory under `.artifacts/wildly-unqualified/releases/`
and refuses to overwrite an existing destination. To choose a new destination:

```sh
npm run release -- "D:/releases/forest expedition"
```

The package contains the pinned package/lockfile, this runbook, a small
`wildly-unqualified/server.ts` launcher, the explicit nested server/shared runtime
under `wildly-unqualified/src/`, and the compiled `dist/` assets under
`wildly-unqualified/web/`. Its package manifest exposes the portable `start`
command. Tests, browser source, authoring files, installed dependencies and private
data are excluded. The builder rejects symlinked web assets and omitted local
runtime imports.

From the portable release directory:

```sh
npm ci --omit=dev
npm start
```

The established command `node wildly-unqualified/server.ts` also works. Its
absolute path can be launched from a different working directory. Relative
configuration paths resolve against the **game root** (`wildly-unqualified/` in
a release), not the shell's current directory or the nested server source folder.
Choose your own private data path and origin before starting; inherited `WU_*`
variables from a development terminal still apply.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `WU_BIND_HOST` | `127.0.0.1` | Listening interface |
| `WU_PORT` | `4310` | TCP port, 1–65535 |
| `WU_PUBLIC_ORIGIN` | HTTP origin derived from host/port | Exact browser origin including a nonstandard port; no trailing slash, path, query or credentials |
| `WU_DATA_DIR` | `data-expedition` under the game root | Private room credentials, saved world, images and backups |
| `WU_WEB_DIR` | `web` under the game root | Compiled public assets; set to `dist` in a source checkout |

Absolute data/web paths remain supported. Keep private data outside the served
web tree. Both lexical overlap and real-path overlap are rejected, including
symlink aliases. On Windows use an account-private directory with appropriate
ACLs. Do not expose it through a web or file server.

Moving source files does not relocate existing saves. The old `web/`, `web-mvp/`
and already-created portable releases remain preserved; a new build writes only
`dist/`. Do not point current schema-3 source at the older prototype/MVP data.

## Admission, saving and relocation

The first start creates private `room.json`. Read its `hostSecret` locally to
admit the host through the join form; keep it out of logs and screenshots. Use
Settings → Copy invitation to obtain a guest link and share it yourself. The
guest invitation does not grant host administration. Independent browser
profiles represent distinct players; at least two players must connect to start.

Keep the server process running during play. Settings → Save and stop server
waits for persistence before closing. Ctrl+C/SIGTERM use graceful shutdown where
the platform delivers those signals. A failed final save keeps the room paused
so storage can be repaired and the stop retried. Restart restores the saved
outing paused. Browser cookies are tied to their origin; a moved room may require
re-admission and host slot reassignment.

To relocate a room:

1. Pause, save and stop it successfully. Keep the original server stopped.
2. Back up the **complete private data directory**, including room credentials,
   saved world, images and backups. Do not copy only `run.json`.
3. Install the same compatible release at the destination and configure the
   private data path and exact browser origin. Only one server may write a room.
4. Start it, recover host admission using the retained host credential, and check
   saved photographs and crew state before resuming. Retain the untouched backup.

Do not edit saves or convert schemas by hand. Incompatible or invalid saved state
is rejected; recovery from a valid backup is reported by the server.

## Serving and verification

Only the configured compiled web tree is served. Source, credentials, private
saves, traversal paths and symlink escapes must remain inaccessible.
`GET /healthz` reports readiness, build and schema without exposing room state.

The existing static MIME allowlist does not yet serve JSON, WAV or OGG files.
Audio exports are retained in the package, but packaging them does not complete
the expansion's audio integration. This limitation also exists in the source
before the folder reorganization.

For internet play, use HTTPS with a proxy forwarding both HTTP and WebSocket
Upgrade requests. Configure `WU_PUBLIC_ORIGIN` to the exact HTTPS browser origin;
the server validates Origin rather than trusting forwarded-origin headers. Keep
those checks enabled. Public HTTPS/WSS and separate-internet human sessions are
distinct from local packaging checks.

Build before `npm test`, because release tests inspect the generated bundle.
See `docs/MAINTAINING.md` in the source repository for current test results and
known expansion failures. A portable smoke check should install production-only
dependencies, start the absolute launcher from another working directory, request
health/HTML/assets, establish an authenticated WebSocket, and save/stop cleanly.
