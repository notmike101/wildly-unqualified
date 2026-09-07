# Wildly Unqualified: first outing design

Date: 2026-09-05. Status: approved design implemented as a local technical prototype; see [observed verification](../../history/VERIFICATION.md). Human duration, unfamiliar cooperation and separate-internet play remain unverified. User-confirmed: a 20–30-minute outing first, with friends on separate internet connections. Other choices below are explicit, reversible design defaults.

## Purpose and scope

Prove that observing animals, experimenting with friends and preserving the resulting photographs can sustain one connected outing. The test is whether friends affect each other's opportunities and make stories together. Extra cameras alone do not establish cooperation.

### Global constraints

- Target 2–4 players on separate internet connections; prove two clients first and four clients before the complete prototype gate.
- Target one 20–30-minute outing; measure actual sessions and never pad duration with mandatory waiting.
- Use Three.js 0.185.1 WebGPU, box3d-wasm 0.2.0 standard, Blender 5.2.1 LTS and the existing shared games package.
- Require real WebGPU rendering; report unsupported devices clearly and do not silently substitute WebGL or software-rendered performance claims.
- Use the existing $100/month individual subscription, free/open-source tools and unpaid owner time; no paid runtime AI, outsourced labor or required paid host service.
- Keep every existing concept and generic tool intact; no purchases, publication, commits or pushes are authorized by this plan.
- Author assets in an isolated visible, foreground Blender session, as subsequently required by the user; never overwrite the user's working scene or unrelated files.
- Keep the authoritative server portable to the user's home server; configure listen address, port, public origin and data directory without machine-specific source edits.

The private build runs in a desktop browser. First-person controls and simple articulated low-poly animals suit the prepared renderer and make taking a photograph immediate. Windows Edge on the existing machine is the first verified-hardware target; each friend's browser/GPU needs its own compatibility check. Shipping Windows packaging, Steam integration and production networking are separate later decisions.

## The outing: a very questionable field assignment

Camp, a wooded clearing and a reed-lined pond form one freely traversable reserve, approximately 80 by 60 metres. A dry bank overlooks the lower water surface; all walkable ground shares one height, keeping slopes and climbing outside this pass. Paths, landmarks and changes in ground colour orient players. The pond has shallow blocked wading boundaries; nobody can drown or become a spectator.

The team receives three photo assignments together. The host starts outing time from camp once at least two players connect; solo entry can inspect controls but does not establish co-op playability. Notebook hints introduce the easiest first, but the server can credit any valid assignment whenever its conditions occur. There are no level reloads or compulsory gates between encounters. Once all three assignments are complete, connected players return to camp and mark themselves ready; the host ends the outing and opens the exhibition. Disconnected slots do not block that ending after the crew explicitly chooses to continue without them.

| Beat | Intended time, not a timer | Player activity and carried consequence |
|---|---|---|
| Camp and clearing | 3–5 minutes | Learn camera, ping and equipment handling. Photograph the raccoon inspecting an open bait tin. It can steal the actual tin and carry it down the trail. |
| Trail and pond discovery | 6–8 minutes | Follow the thief or retrieve and move the tin themselves. Discover that the heron displays only when the marked feeding patch stays calm and a bait portion is available. Loud approaches and the raccoon can interrupt it. |
| Shared pond setup | 7–10 minutes | Photograph the heron displaying, then both species calmly sharing the pond feeding area in one frame. Split responsibilities between moving the tin, distracting the raccoon, keeping clear and finding an angle. Recover from interruptions without restarting the outing. |
| Return and exhibition | 3–5 minutes | Return to camp, select the funniest pictures from the shared album and end the outing together. See who photographed and who helped create the opportunities. |

These ranges guide encounter density. A group finishing in 12 minutes is useful evidence that the loop needs depth; making animals wait longer is not the remedy. A group taking 40 minutes through confusion calls for clearer cues or fewer steps.

The core comic incident is a visible cause and effect: a friend rattles the tin to help, the raccoon steals it, the heron flees, and the crew must retrieve or redirect the same equipment. Animal location, notebook discoveries, remaining bait and prop ownership persist throughout. The final photograph is a combined behavior setup, not an unrelated minigame.

## Everyone's actions

WASD moves; mouse looks after an explicit click to capture the pointer. Shift runs; C toggles crouch; E picks up/places the nearby tin; Q uses the held tin or the field whistle; right mouse toggles the viewfinder; left mouse takes a photograph; F pings the aimed location; Tab opens the notebook/album; Escape releases the pointer and opens settings. Also provide visible buttons for viewfinder, notebook, settings and leaving the session. Rebindable keys, sensitivity, invert-Y and master volume are local settings. No head bob or camera shake by default.

Every player has a camera and whistle. There is one shared tin containing four bait portions. Tin ownership is exclusive, server-assigned and visible. Placing a tin is reliable; only a deliberate drop gives it physical motion. No free throwing, stacking players, combat, inventory grid or general construction system. A brief whistle cooldown prevents unbroken noise; captions identify the sound source and animal reaction. Running and tin impacts emit short-range noise. A shutter is audible to friends but does not itself scare animals, avoiding punishment for the core action.

At the marked feeding patch, use the held tin to spend one portion. The tin can still attract the raccoon when empty. Depleted bait can be replenished at camp without losing progress; after repeated failed setups, the notebook explicitly points this out. An out-of-bounds or irrecoverably stuck tin returns to the nearest marked recovery point, preserving remaining portions. Recovery is an honest contextual action, not a secret restart.

Players can discover, prepare and photograph simultaneously. With four players, two may choose different shooting angles while others manage the tin or scout the heron's retreat. Roles are neither locked nor mandatory jobs. Pings and text hints support coordination; friends may use their existing voice chat. Integrated voice/video recording is deferred.

## Animal rules and readability

Use one raccoon and one heron, each with an explicit state machine and authored waypoint routes. This deliberately reduces the original full-product three-archetype scope. It does not replace the original concept.

| Animal | States and conditions | Visible communication |
|---|---|---|
| Raccoon | Wander; approach audible rattle/open tin within 12 m; inspect for 4 s; steal an unheld tin; carry toward a pond-side stash; investigate a whistle; recover to wander. A carried tin follows a designated attachment point and cannot simultaneously be player-held or independently simulated. | Masked face, ringed tail, nose tilt toward target, paw-reaching inspection, waddling carry. Head turn precedes movement. A player can reclaim the tin at close range; the raccoon reacts but cannot permanently lock it away. |
| Heron | Feed; become alert if a player runs/noise occurs within 8 m or raccoon approaches within 3 m; retreat to the alternate perch; settle after 5 quiet seconds; display wings for 6 s when bait is present and the feeding area is calm. Bait is consumed only when a display begins. | Long legs/neck/beak, raised head before retreat, short readable wing movement between authored perches, broad wing display. Notebook explains the observed interruption cause. |

Distances and durations are initial tuning constants in one content file, not promises or random hidden thresholds. In the combined photograph the raccoon must be inspecting the tin 3–8 m from the displaying heron. That geometry creates a useful division of attention. There is enough space to photograph both from the bank. Quiet periods allow scouting, framing or equipment movement; no player is assigned a mandatory idle hold action.

Raccoon decisions choose the most recent eligible lure, with a short commitment period to avoid oscillation. Actions by friends can interfere, visibly. Animals never teleport between visible locations; recovery from invalid navigation happens at a hidden retreat point with an explicit diagnostic record. No navmesh package, ecosystem simulation, generative dialogue or image-analysis service is required.

## Photographs, credit and shared album

The viewfinder explains framing and identifies learned subjects without automatically solving the setup. A shot returns either a named assignment credit or a brief reason such as “heron alert,” “subject hidden” or “move closer.” All attempts can produce a local preview; the bounded shared album keeps the three credited pictures plus the latest 21 other valid captures. Completing an assignment twice does not award duplicate progress. Assist labels come from recent relevant actions and are descriptive, not a competitive score.

The server owns subject identity, behavior, positions, occlusion and objective credit. At shutter receipt, after earlier ordered input, it creates an immutable photo frame containing the authoritative camera pose and world transforms. Both evaluation and the client's offscreen rendering use that exact frame. This avoids maintaining a speculative rewind system or scoring one animal pose against an unrelated screenshot. The resulting frame can differ slightly from the live view under latency; test this early and measure the mismatch before expanding content.

A qualifying subject must be in front of the camera, occupy at least 3% of image height, and have at least two of three authored subject points visible inside the frame. Rays to those points are blocked by authored solid occluders and the tin, not decorative grass. The combined assignment requires both qualifying subjects and the specified states in the same frame. The server uses game geometry, never uploaded pixels, to grant credit.

Render a separate 640×360 target with the installed WebGPU renderer. Read back pixels, verify orientation and colour with a known test chart, then create a JPEG thumbnail no larger than 64 KiB. Share it through a session-authenticated bounded HTTP endpoint associated with a server-issued photo ID. Objective credit survives thumbnail failure, showing “image unavailable” with retry. Keep the bounded immutable capture frame in the private save until its image uploads, then remove the frame. On rejoin or slot reassignment, resend pending frames to their photographer so a browser/server restart can regenerate the original credited image. Uploaded imagery is untrusted display material and cannot alter credit. The album uses JPEG-only responses with `nosniff`; no SVG, arbitrary HTML or user filenames. No public gallery or automatic external upload.

## Multiplayer, interruptions and persistence

Use one authoritative Node process with `node:http`, the existing Box3D standard WASM and one added runtime dependency, `ws`. The browser uses its native WebSocket. One process owns one room, up to four player slots, static assets and the album. Physics steps at 60 Hz, creature decisions at 10 Hz, snapshots at 10 Hz and held input at up to 20 Hz. Inputs time out after 250 ms. Clamp elapsed time and catch-up work; a background stall never advances minutes of simulation in one frame.

Players use a small shared, purely mathematical ground controller against authored rectangles; the client predicts its own position and reconciles against the authoritative snapshot's simulation tick. Prediction history records the input held during each fixed movement tick. Reset to the snapshot position, discard history at or before that tick and replay only later ticks; command acknowledgements alone cannot identify elapsed movement time. Snapshots include the accepted held input and its application tick, allowing history gaps to use the server's known state and timeout. Bound history and reset cleanly on pause/rejoin or an excessive clock gap. Other players, animals and loose props interpolate. Box3D actually simulates the loose tin against the reserve's collision boxes; contacts create noise. Players do not push each other. There is no client-authoritative physics, deterministic lockstep or general rollback engine.

The server binds to `127.0.0.1:4310` and serves only the built game directory. A Cloudflare Quick Tunnel supplies remote HTTPS/WSS access to that port. This is a temporary, publicly routable URL with application-level private admission, not a private network. Guests need only the link and a supported browser; the hosting machine must remain running. No paid server is required for this proposed playtest path. Quick Tunnels need no account, are development-only, have a 200 concurrent-request limit and no SSE support. WebSockets are supported by Cloudflare; connections can be terminated during network maintenance, so reconnect is necessary. [Tunnel setup](https://developers.cloudflare.com/tunnel/setup/), [WebSockets](https://developers.cloudflare.com/network/websockets/), checked 2026-09-05. Suitability for this game's latency is still unverified.

Use a random 128-bit join secret in the invite URL fragment, remove it from the address bar after reading, and submit it to `/api/join` over HTTPS. Successful admission creates a random session token in an HttpOnly, SameSite=Strict cookie, Secure for the configured HTTPS origin. Validate the exact configured origin before join, state-changing HTTP and WebSocket upgrades. Use a distinct host credential; knowing the join secret does not grant pause/end administration. Never log secrets or expose saves through the static server. Rate-limit admission attempts, commands and image uploads; enforce four slots, 16 KiB WebSocket messages and finite numeric bounds.

The room host can pause/resume. Disconnect automatically neutralizes input, releases held equipment safely and pauses the shared world with a visible reason. Connected players can explicitly continue without the missing player; otherwise it remains paused. Rejoining restores the same reserved slot and notebook/album, at a validated safe location near the crew, before resuming. A new arrival can join a paused outing without waiting for camp. Host browser loss does not kill the independent server; while the host is absent, connected players may resume after a disconnect pause, but cannot reset/end or change admission. Zero connected players always pauses.

Autosave versioned world state and album every 10 seconds and on pause, assignment credit and end. Store simulation time, animal states and remaining timers, tin transform/ownership/supplies, observations, player slots, photos and objective state. Credentials live in a separate private room file. Serialize writes, write a temporary file and replace the save only after a successful write; retain the last known good copy. Corrupt/unknown-version saves produce a recoverable error, never a silent reset. A restart loads paused, releases stale holders and reconstructs physics; do not serialize WASM pointers. Crash loss is bounded by the last successful save, not claimed zero. Local launch points the data directory into the existing ignored `games/.artifacts/` tree; data never lives inside the served web directory.

### Portability and the later home-server move

The user has a home server that is inaccessible in this session. Host locally now, but make relocation an acceptance requirement. The server must run without Windows APIs, a GPU, Blender, the Codex app, a subscription login or `cloudflared` installed on the same host. Node 26.5+ within major 26, the pinned runtime packages and ordinary filesystem/network access are the runtime requirements. Do not claim support for an untested home-server OS/architecture; record the actual target and test it when access is available.

Use `WU_BIND_HOST` (default `127.0.0.1`), `WU_PORT` (4310), `WU_PUBLIC_ORIGIN` (default `http://127.0.0.1:4310`), `WU_DATA_DIR` and optional `WU_WEB_DIR`. Resolve defaults relative to the server module, not the caller's working directory. Default web/data folders are sibling `web/` and `data/` under the game directory, with generated folders ignored; the local launch instructions explicitly select `games/.artifacts/wildly-unqualified/data` for saves. Validate configuration at startup, including a data directory outside the served tree. A reverse proxy or tunnel provides remote HTTPS and forwards WebSocket upgrades; authentication checks the configured public origin, never blindly trusted forwarded headers.

Produce a versioned portable release directory/ZIP containing the game server/shared TypeScript source, compiled web assets, the shared package manifest and exact lockfile, and a short server runbook. Retain the source layout under `wildly-unqualified/` so imports need no rewriting. From the release root, `npm ci --omit=dev` followed by `node wildly-unqualified/server.ts` must work with no build tool installed. Node's native TypeScript stripping requires erasable syntax and explicit `.ts` imports. Do not bundle `node_modules`, local paths, credentials, saves or development tools. Cloudflare is a replaceable connection method, not a game API dependency. Docker and a service-manager installer are unnecessary until the home server's environment is known.

Moving servers is a controlled stop/copy/start: pause and flush, stop the old process, copy the complete private data directory, deploy the same release, set the new public origin/data path, and start paused. Keep a backup and never run two authoritative writers against the same save. If the origin changes, browser cookies cannot move with it: the host receives an out-of-band recovery credential from the copied room file, re-admits friends and reassigns disconnected slots while paused. The world, supplies and album survive; zero-click browser-session transfer and seamless host migration are not promised. Test this procedure by relocating to another local directory and port, restoring the saved outing and reconnecting all players. That verifies the transfer mechanism, not the inaccessible home server.

## Recognizable MVP assets

Create three character GLBs: one field researcher reused with four outfit colours, one raccoon and one heron. Researcher silhouette: boots, brimmed hat, backpack and visible camera. Raccoon silhouette: short legs, hunched body, face mask and segmented ringed tail. Heron silhouette: long thin legs, S-shaped neck, pointed beak and large separate wings. Names alone must not be necessary to recognize them.

Create one prop/environment GLB containing named reusable meshes for tin, camera, whistle, tent, sign, log, rock, tree and reed cluster. Use original flat-colour materials, metre units, Y-up exports and stable part names. Parent rigid parts for simple pose animation in Three.js; no skinning/retargeting pipeline is needed. Keep collision proxies separate from decorative geometry. The tin origin, camera direction and animal inspection points must match the game manifest.

Game-owned Blender authoring scripts produce versioned source/output in an isolated visible, foreground session. This reflects the user's subsequent instruction; version 1's background CLI provenance is retained honestly, and version 2 was built visibly. Reuse safe export and glTF validation patterns. Validate each GLB, inspect the actual asset render and in-level views, then have humans inspect unlabelled silhouettes at normal play distance when available. A mesh validator cannot establish recognizability. Initial budgets: under 8,000 triangles per animated character and under 100,000 visible triangles for the small reserve; profile actual rendering rather than treating counts as performance evidence.

Add a few original short sounds using Web Audio synthesis or recorded owner-created audio: shutter, whistle, tin rattle, footstep and animal alert. Caption important events and provide volume/mute. No music library purchase, generated texture workflow or outsourced animation. Credit free resources if any are actually introduced; do not invent asset provenance.

## What establishes a successful prototype

1. Two, then four independently controlled real browser clients join, share the same tin/animals/objectives, photograph and finish an outing. At least two humans on separate internet connections must complete the remote gate; local tabs and bots are different evidence.
2. A two-client animal experiment shows that one player's lure changes another's photo opportunity. The final shot depends on carried world state. Every human can identify a consequential contribution; observer notes flag anyone idle for over a minute.
3. Invalid/out-of-view/occluded shots do not credit; valid behavioral shots do. All players see the same credited album, including after reconnect and server restart. Actual images contain the corresponding subjects with correct orientation.
4. Disconnect while holding the tin, mid-display and during a photo upload cannot duplicate equipment, consume a second bait portion, reset progress or strand a player. Restart resumes safely with a visible save result.
5. On the existing RTX 3080 machine, target p95 frame time at or below 33.3 ms at 1280×720 with four clients represented in-world; measure with one rendered viewport for hardware performance. Four browser processes on one GPU are a separate load test. Record every remote tester's hardware, browser, network RTT and experienced problems. A 150 ms RTT simulation is a latency test, not an internet playtest.
6. Conduct one unfamiliar two-person session and one four-person session if volunteers are available. Measure join time, outing duration, confusion, repeated failed setups, photograph latency, meaningful contributions and whether players want another outing. These are small qualitative tests, not market validation.

If behavior is dull, revise the two-species interaction before adding animals. If photo latency is unacceptable, resolve that path before art polish. If the temporary tunnel is unreliable, diagnose its connection and origin configuration first; a different free transport requires renewed documentation and a real test. Paid hosting is not an automatic fallback. If no remote human is available, deliver local technical evidence and mark the remote/human gate pending.

## Explicitly deferred

Full 60–120-minute reserve; third species; procedural expeditions; complex terrain/climbing; ragdolls; general object throwing; crafting; combat; integrated voice; video recording; public matchmaking; accounts/cloud saves; host migration; mobile/controller support; localization; Steam SDK, payments and downloadable packaging. Add these only after the outing's actual tests justify them. The current pass has no additional planned software/service purchase; future publishing fees, actual infrastructure, optional hardware and applicable business/tax costs remain separate real costs, not invented contractor budgets.

## Evidence and design provenance

The [original brief](../../../../../research/additional-game-concepts.md#2-wildly-unqualified), [long-loop findings](../../../../../research/longer-gameplay-loops.md), [RV case study](../../../../../research/rv-there-yet-case-study.md) and [cash assumptions](../../../../../research/cost-assumptions.md) motivate carried consequences, useful participation, safe stopping and the cost limits. This design is an inference from that research, not a proven commercial or gameplay result.

Local planning inspection confirmed the shared package versions, strict scene validator's fixture-only asset paths, minimal Box3D declaration, generic inspector and renderer source. Three.js `Renderer.js` exposes `setRenderTarget` and `readRenderTargetPixelsAsync`; this confirms API presence, not a finished screenshot feature. Context7 returned current `ws` upgrade/authentication/heartbeat documentation and Cloudflare Quick Tunnel documentation. Installed `cloudflared --version` returned 2026.6.1. No tunnel was opened and no multiplayer functionality was verified in this planning pass.
