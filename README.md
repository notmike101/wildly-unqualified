# Wildly Unqualified

Make a wildlife documentary with friends who are extremely bad at remaining
unnoticed. This is the generated-reserve development build; expansion gameplay
acceptance remains incomplete. The [maintenance guide](docs/MAINTAINING.md)
records the current code map, checks and known failures.

The client uses TypeScript, Three.js/WebGPU and Vite; the authoritative Node
server handles multiplayer, simulation and saves. Players need a WebGPU-capable
browser. The current build is `forest-expedition-1`, with save schema **3**;
preserved MVP/prototype releases and their older saves must stay together.

The reserve has a gentle 24-minute atmospheric cycle: 12 minutes of daylight,
3 minutes of sunset, 6 minutes of moonlit night, and 3 minutes of dawn. Nights
keep paths and wildlife readable and do not change animal behavior, movement,
or photo scoring. The shared simulation clock keeps the crew synchronized,
stops while paused, and resumes from saves. Photographs retain the lighting
at their captured tick, including pending images rendered later.

## Development

Use Node **26.5 or later within major 26** and pnpm, from this game's repository root:

```sh
pnpm install --frozen-lockfile
npm run build
npm test
```

`npm run build` typechecks source, tests and tooling, then writes the Vite web
bundle to `dist/`. `npm test` runs all Node unit and integration tests, including
the expansion requirements. Build first so the release tests have current assets.

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

The Windows desktop build uses a small Tauri 2 launcher and the shared WebView2
runtime, with the existing Node server bundled alongside it. See
[desktop packaging and research](docs/DESKTOP.md) and the
[player instructions](desktop/README.md). Build on Windows x64 with Node 26.5.0,
Rust and Visual Studio C++ build tools using `npm run release:desktop`.
The output is under `.artifacts/`; players do not install these development tools.

```sh
npm run format:check
npm run typecheck
npm run lint
npm run build
npm test
npm run release
```

ESLint checks code style and JSDoc; there is no separate `lint:docs` script.
The release command packages `dist/` and the allowlisted server runtime into
a new directory under `.artifacts/wildly-unqualified/releases/`. It refuses to
overwrite an existing release. Follow [the server guide](docs/SERVER.md) to install
the pinned production dependencies and start the portable package.

Verification on **2026-09-07**: all **209 Node tests pass**, with no skipped tests;
build/typecheck and ESLint pass. Portable packaging, a frozen-lockfile production
installation, health and HTML serving also pass. See the
[test repair record](docs/MAINTAINING.md#test-suite-repair--2026-09-07) for scope.
The separate visible browser outing is not passing: it still needs its controls
and historical four-assignment scenario migrated to the generated reserve.
The server's existing MIME allowlist also does not yet serve JSON/WAV/OGG, so
packaged audio does not imply completed audio integration.

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
