# Wildly Unqualified

Make a wildlife documentary with friends who are extremely bad at remaining
unnoticed. This is the generated-reserve development build; expansion gameplay
acceptance remains incomplete. The [maintenance guide](docs/MAINTAINING.md)
records the current code map, checks and known failures.

The client uses TypeScript, Three.js/WebGPU and Vite; the authoritative Node
server handles multiplayer, simulation and saves. Players need a WebGPU-capable
browser. The current build is `forest-expedition-1`, with save schema **3**;
preserved MVP/prototype releases and their older saves must stay together.

## Development

Use Node **26.5 or later within major 26**, from this game's repository root:

```sh
pnpm install --frozen-lockfile
npm run build
npm test
```

`npm run build` typechecks source, tests and tooling, then writes the Vite web
bundle to `dist/`. `npm test` includes the existing failing expansion requirements;
see the maintenance guide before interpreting its exit status.

For a separate local room, start the server in one PowerShell terminal:

```powershell
$env:WU_DATA_DIR = '.artifacts/development-data'
$env:WU_WEB_DIR = 'dist'
$env:WU_BIND_HOST = '127.0.0.1'
$env:WU_PORT = '4316'
$env:WU_PUBLIC_ORIGIN = 'http://127.0.0.1:5174'
npm start
```

In a second terminal run `npm run dev`, then open
[the Vite development page](http://127.0.0.1:5174). Vite proxies `/api` and `/ws`
to the development server on port 4316. Both ports must be available. If you change
the backend port, update both proxy targets in `vite.config.ts`; if you change the
Vite port, also update `WU_PUBLIC_ORIGIN` to the exact browser origin. Stop your own
development room cleanly first; do not reuse a preserved play server's data.
For serving only the built game, use the matching server origin described in
[the server guide](docs/SERVER.md).

The first server start creates `.artifacts/development-data/room.json` for the
configuration above. Read its `hostSecret` locally and enter it in the join form
with your player name. Keep that credential private. Once the host has joined,
use Settings → **Copy invitation** for guests. Use independent browser profiles
for separate local players; at least two connected players are needed to start.
Choose **Save and stop server** before closing or relocating a room.

Relative `WU_DATA_DIR` and `WU_WEB_DIR` paths resolve from the game root, even
when launching from another working directory. Without overrides they default to
`data-expedition/` and `web/`; the commands above explicitly select separate
development data and the current `dist/` build.

## Project layout

```text
src/
  client/                 Browser entry, session, UI, rendering and audio
  server/                 HTTP/WebSocket server, persistence and simulation
  shared/                 Wire contracts, world generation and shared geometry
  types/                  External declarations
tests/
  client/ server/ shared/  Tests grouped by module owner
  integration/            Server, save, release and expedition scenarios
  e2e/                    Visible browser driver and outing scenarios
  helpers/                Shared test helpers
scripts/                  Portable release tooling
public/                   Exported models and audio copied into the web build
assets/                   Original authoring files, scripts and provenance
docs/                     Maintenance, server guide, designs and history
dist/                     Generated web bundle (ignored)
```

`index.html` and package/build/lint configuration stay at the root. See the
[detailed source map](docs/MAINTAINING.md) for individual module responsibilities.
Original Blender scenes and versioned exports remain intact.

## Checks and packaging

```sh
npm run format:check
npm run lint:docs
npm run lint
npm run build
npm test
npm run release
```

General Airbnb lint has existing style debt; the documentation lint is a separate
gate. The release command packages `dist/` and the allowlisted server runtime into
a new directory under `.artifacts/wildly-unqualified/releases/`. It refuses to
overwrite an existing release. Follow [the server guide](docs/SERVER.md) to install
the pinned production dependencies and start the portable package.

Verification on **2026-09-07**: build/typecheck, formatting, documentation lint and
portable startup/save checks passed. The full suite had **192 passing tests and
14 existing failures**; general lint reported **1,510 errors and 17 warnings**.
Visible two-player startup passed, but the outing driver reproduced the baseline
camera-navigation failure. The server's existing MIME allowlist also does not yet
serve JSON/WAV/OGG, so packaged audio does not imply completed audio integration.
See the [verification record](docs/MAINTAINING.md#responsibility-based-layout-verification--2026-09-07)
for scope and evidence; these are dated results, not a claim that all checks pass.

`npm run test:browser` runs the existing visible outing driver on port **4320** by
default and requires installed **Microsoft Edge** with WebGPU support. Run
`npm run build` first. It copies the built web assets and complete server runtime into an isolated
evidence directory. Set `WU_TEST_PORT` and matching `WU_TEST_URL` to change its port;
`WU_PLAYERS` supports 2 or 4 and `WU_LATENCY_MS` supports 0 or 150. Its historical
outing scenario does not establish full acceptance of the expansion.

The historical `wu:*` npm commands remain aliases. Private saves, room credentials,
browser profiles, dependencies and generated builds stay out of Git. Back up the
**complete private data directory** separately.

## Design and history

- [Generated-reserves design](docs/superpowers/specs/2026-09-05-wildly-unqualified-generated-reserves-design.md)
- [Approved project layout](docs/superpowers/specs/2026-09-07-project-layout-design.md)
- [Preserved MVP checkpoint](docs/history/MVP-CHECKPOINT-2026-09-05.md)
- [Earlier README and local play records](docs/history/README-2026-09-06.md)
- [Earlier verification](docs/history/VERIFICATION.md)

This standalone repository includes the game, tests, exported assets and authoring
sources. Parent research and other game concepts are outside its scope. Historical
machine-local links may not resolve in another clone; they are retained as records,
not current launch instructions.
