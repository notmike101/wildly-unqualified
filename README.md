# Wildly Unqualified

**Generated-reserve development build.** Make a wildlife documentary with friends who are extremely bad at remaining unnoticed.

`main` now includes the committed generated-reserve runtime, expanded wildlife, audio, asset work, album requirement tests, and development handoffs. Expansion acceptance is still incomplete. See [the code map and maintenance guide](docs/MAINTAINING.md) for module responsibilities, verification results, and the remaining known failures. The records below describe the separately preserved MVP and prototype, not acceptance of the current source.

The [forest checkpoint](MVP-CHECKPOINT-2026-09-05.md) tracks the three-species, four-commission outing: shared equipment, a physical washout crossing, reactive animals, recoverable mischief, mature canopy and atmospheric sky. Independent reviews pass. One two-player and two distinct four-player outing chains completed in visible browsers, including HTTPS/WSS with 150 ms added delay. Saved-world continuations and driver failures are retained in the evidence. The final production package, visible forest/crew/notebook checks and local migration pass. The accepted prototype, its release and private outing remain preserved separately.

The delivered MVP targeted a **20–30-minute outing for 2–4 friends on separate internet connections**. The approved [generated-reserves expansion](docs/superpowers/specs/2026-09-05-wildly-unqualified-generated-reserves-design.md) targets **40–60 minutes**, a predominantly dense forest, 12 species and 36–48 individual animals. The expansion is partially implemented in current source; the historical baseline below predates it.

This game has its own private repository, [notmike101/wildly-unqualified](https://github.com/notmike101/wildly-unqualified). It includes game source, tests, assets and Blender sources. Parent research, other concepts, local evidence and private saves remain outside the repository. Historical links to those local materials will not resolve in an independent clone.

## Build this repository

Use Node 26.5 or later within major 26. From this game's repository root:

```sh
npm ci
npm run build
npm test
npm run release
```

The release command prints a new portable directory under `.artifacts/wildly-unqualified/releases`. `npm run test:browser` runs the existing visible gameplay driver; it owns port 4316, so do not run it against an occupied play server. The historical `wu:*` script names remain available. Private game data, installed dependencies and generated builds are ignored by Git; back up the entire private data directory separately.

- [Observed verification](VERIFICATION.md): actual tests, screenshots and remaining gates.
- [Visible four-player prototype playtest and user feedback](PLAYTEST-2026-09-05.md), [teamwork/mischief research](../../research/wildly-unqualified-teamwork-and-mischief.md), [approved MVP direction](docs/superpowers/specs/2026-09-05-wildly-unqualified-mvp-design.md), [implementation plan](docs/superpowers/plans/2026-09-05-wildly-unqualified-mvp.md) and [39-model forest library](assets/BRIEF-v3.md).
- [Server runbook](SERVER.md): installation, stop/save, private admission and relocation.
- [Implementation ledger](IMPLEMENTATION.md), [approved design](docs/superpowers/specs/2026-09-05-wildly-unqualified-prototype.md) and [build plan](docs/superpowers/plans/2026-09-05-wildly-unqualified-prototype.md).
- [Original concept](../../research/additional-game-concepts.md#2-wildly-unqualified) and [longer-loop research](../../research/longer-gameplay-loops.md).

The reserve connects camp, deep woodland, a washout, a forest clearing and wooded wetland. A seeded outing selects three species commissions plus a combined raccoon/heron portrait. Carry equipment together, open the return gate, seat the plank or use the dry detour, then create quiet observation angles and bait setups. Raccoons inspect, wash, steal unattended food and occasionally borrow a hat; deer graze or investigate a moved decoy; herons feed, display and preen. Noise, proximity, cover and moved supplies affect their decisions. Return the connected crew to camp after all four commissions, mark ready and finish with a shared exhibition and favorites.

The new low-poly library adds 39 models: eight mature tree silhouettes and 21 other forest pieces, a deer, a researcher, four hats and four equipment assemblies. The world has 718 placements, including 179 mature trees and three reused camp furniture models. See the [forest preview](assets/preview-v3.png), [editable Blender scene](assets/library-v3.blend) and [authorship/validation](assets/PROVENANCE-v3.md). Version 3 was authored and exported in visible foreground Blender. No Blender MCP calls were used. All older models and editable scenes remain preserved.

## Play the fresh forest MVP on this PC

Open your private [MVP host entrance](../.artifacts/wildly-unqualified/MVP-HOST-ACCESS.md), enter a field name and choose **Enter the reserve**. This is a fresh, paused room with no reserved player slots. In Settings, choose **Copy invitation** and share that guest link yourself. At least two players must connect before starting.

The verified server runs on port 4316 through a temporary HTTPS/WSS tunnel. Keep this PC, its game session and the tunnel running. The [launch record](../.artifacts/wildly-unqualified/mvp-launch.json) identifies the exact process, origin and private directory without credentials. Use **Save and stop server** before a restart or move; restart instructions are in the private access file. A restarted tunnel may have a different address.

The clean [portable release](../.artifacts/wildly-unqualified/releases/forest-mvp-1-2026-09-06T03-42-48-626Z/) contains 27 files / 5,343,156 bytes, with no dependencies installed or private data included. Its separate production installation has identical payload hashes. Follow [SERVER.md](SERVER.md) to install the three pinned runtime packages and later move the complete private directory to another server. That home-server environment remains unverified.

## Run a separate local development room

Build from this game's repository root, then use separate private data and port 4314 so an existing internet room stays available:

```powershell
npm.cmd run wu:build
$env:WU_DATA_DIR = '.artifacts/forest-mvp-private-data'
$env:WU_WEB_DIR = 'web-mvp'
$env:WU_BIND_HOST = '127.0.0.1'
$env:WU_PORT = '4314'
$env:WU_PUBLIC_ORIGIN = 'http://127.0.0.1:4314'
node server.ts
```

Use the locally created `room.json` host credential to enter. Copy the guest invite from Settings; independent browser profiles represent different players. At least two connected players are required to start a new outing. The full outing driver uses port 4316, so stop the running MVP room cleanly before repeating that driver. The [server runbook](SERVER.md) covers production installation and HTTPS/WSS configuration.

## Preserved prototype internet room

The internet room was last verified running on this PC on 2026-09-05. Open the private [internet host access file](../.artifacts/wildly-unqualified/INTERNET-HOST-ACCESS.md) and follow its host link. This is the preserved, paused four-player test outing, with four reserved player slots and its earned photographs. Use the host's slot-reassignment controls when admitting a different crew. In Settings, use **Copy invite** and share that guest link yourself. Both the host and guests should use the same HTTPS link; at least two players must connect before starting or resuming play. The four visible agent-test browsers have been closed at the user's request.

Keep this PC, the game process and the tunnel running. The assigned Quick Tunnel URL is temporary and can change on tunnel restart. The secret-free [current launch record](../.artifacts/wildly-unqualified/internet-launch.json) identifies the origin, port, processes and exact private save directory. The current internet saves are in `games/.artifacts/wildly-unqualified/internet-play-data-2026-09-05T20-58-36-319Z`. Preserve that entire directory for migration. [SERVER.md](SERVER.md) describes restart/origin configuration and save transfer.

## Preserved prototype local room

The separate local room is running at [the reserve](http://127.0.0.1:4310). The private [local host access file](../.artifacts/wildly-unqualified/HOST-ACCESS.md) contains this machine's host link. Enter a field name, then use Settings to copy a guest invite. Two independent browser profiles can test locally; tabs sharing a session cookie represent the same player. At least two players must connect before the host starts the outing. This loopback invite works on this PC. The local and internet rooms have separate outings and save directories.

The prototype server's private data is `games/.artifacts/wildly-unqualified/local-data`. Its running process still serves the preserved build. To restart it from the shared `games` directory, use the archived schema-1 server, not the newer schema-2 source:

```powershell
$env:WU_DATA_DIR = 'D:\friendslop-games\games\.artifacts\wildly-unqualified\local-data'
$env:WU_BIND_HOST = '127.0.0.1'
$env:WU_PORT = '4310'
$env:WU_PUBLIC_ORIGIN = 'http://127.0.0.1:4310'
$env:WU_WEB_DIR = 'D:/friendslop-games/games/.artifacts/wildly-unqualified/releases/prototype-1 portable 2026-09-05T20-45-09-720Z/wildly-unqualified/web'
node '.artifacts/wildly-unqualified/releases/prototype-1 portable 2026-09-05T20-45-09-720Z/wildly-unqualified/server.ts'
```

Keep the process running. Use Settings → **Save and stop server** for a completed flush before stopping or moving it. Restart restores the outing paused. The host recovery key and the entire private data directory must travel together when migrating; browser cookies do not transfer between origins. Follow [SERVER.md](SERVER.md) for the portable release and exact configuration.

| Action | Default control |
|---|---|
| Walk / look | WASD / click to capture mouse; arrow keys also turn |
| Run / toggle crouch | Shift / C |
| Claim a reachable handle, place held equipment, recover a hat/spill or use the gate | E |
| Use the shown case lid, decoy cup, tin/bait or whistle action | Q |
| Release held equipment / ping a point | G / F |
| Notebook / release mouse and settings | Tab / Escape |
| Frame / photograph | Viewfinder / Take photo buttons; right / left mouse while mouse-look is captured |

Movement keys, sensitivity, invert-Y and volume can be changed in Settings. Important shared sounds have source captions. There is no integrated voice chat.

## Scope and evidence

The authoritative Node server owns movement, native Box3D equipment physics, animal rules, photo credit and saves. The browser captures actual 640×360 JPEGs from immutable server frames, including equipment, hats and route state. A bounded shared album and per-player favorites survive reconnects and restart. Configurable paths/origin and an allowlisted production release support the later home-server move; that machine is inaccessible and unverified here.

The [verification record](VERIFICATION.md) separates current forest acceptance from historical prototype results. All three current outing chains completed four commissions, returned the connected crew, finished the exhibition and retained shared favorites through restart. They produced 18 actual 640×360 JPEGs in total. The final rules gate passes 111 tests. During wildlife setup, the third and fourth agents often waited; the same tin escort and quiet photography strategy remained prominent across seeds. **Actual 20–30-minute duration, enjoyment, balanced human cooperation and human sessions on separate internet connections have not been established.** The game source and Blender assets are now versioned in the private game-only GitHub repository. Store publication and purchases remain outside the current work.

The business direction remains one purchase per player, with ordinary hosting included. The private browser prototype tests gameplay and internet connectivity before downloadable packaging or store integration. The existing $100/month subscription, free/open-source tools and unpaid owner time remain the cost basis; no paid runtime AI or outsourced labor is assumed.

All previously discovered games remain in the [games index](../README.md) and [research index](../../research/README.md). Selection of this prototype does not delete or replace them.
