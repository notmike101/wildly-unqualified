# Wildly Unqualified Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a recognizable, playable 20–30-minute wildlife-photography outing for 2–4 internet-connected friends, initially hosted on the user's PC and portable to their home server.

**Architecture:** One portable Node process owns the room, animal rules, loose-prop physics, saves and photo credit. A Three.js WebGPU browser client predicts walking, renders shared state and captures server-defined photo frames; a temporary HTTPS/WSS tunnel connects remote testers. Use the prepared shared package, small game-owned modules and filesystem saves rather than an engine framework or hosted backend.

**Tech Stack:** Node 26.5+ within major 26; TypeScript 7.0.2; Three.js 0.185.1; box3d-wasm 0.2.0 standard; Vite 8.2.2; Blender 5.2.1 LTS; native browser WebSocket plus proposed `ws` 8.21.3 and `@types/ws` 8.18.1; existing Node test runner, Playwright 1.63.0 and glTF validator.

**Spec:** [First outing design](../specs/2026-09-05-wildly-unqualified-prototype.md). Approved 2026-09-05; implementation now exists. [Implementation ledger](../../history/IMPLEMENTATION.md) and [observed verification](../../history/VERIFICATION.md) track the executed result and remaining gates. The checkboxes below preserve the approved build checklist rather than claiming every human/internet acceptance item has passed.

## Global Constraints

- Target 2–4 players on separate internet connections; prove two clients first and four clients before the complete prototype gate.
- Target one 20–30-minute outing; measure actual sessions and never pad duration with mandatory waiting.
- Use Three.js 0.185.1 WebGPU, box3d-wasm 0.2.0 standard, Blender 5.2.1 LTS and the existing shared games package.
- Require real WebGPU rendering; report unsupported devices clearly and do not silently substitute WebGL or software-rendered performance claims.
- Use the existing $100/month individual subscription, free/open-source tools and unpaid owner time; no paid runtime AI, outsourced labor or required paid host service.
- Keep every existing concept and generic tool intact; no purchases, publication, commits or pushes are authorized by this plan.
- Author assets in an isolated visible, foreground Blender session, as subsequently required by the user; never overwrite the user's working scene or unrelated files.
- Keep the authoritative server portable to the user's home server; configure listen address, port, public origin and data directory without machine-specific source edits.

## Execution conventions and dependency order

Work from `D:\friendslop-games\games` unless a command says otherwise. Paths in task file lists are relative to that directory. The root currently has no Git repository or CodeGraph index; check again at execution, preserve unrelated work and do not initialize either as a side effect. Do not add commit steps without subsequent user authorization.

Use `superpowers:executing-plans` for the straightforward sequential build. Read applicable development/testing/debugging skills when execution begins. An agent may resolve implementation details and routine failures autonomously within the spec. Do not ask the user to choose filenames, dependencies already selected here, polling intervals or test arrangements. Ask only if evidence forces a material change to the actual game, supported devices or operating costs.

Each task below carries a red/green check for its meaningful behavior. Write the named assertion, run it and observe the intended failure, implement, then run the same check. A syntax/import failure is useful only while introducing a module; before a fix, verify the behavioral assertion itself fails. Do not accept constant-return stubs or production debug shortcuts as gameplay implementation. Keep evidence in the game verification document, with secrets omitted. Formatting/docs changes do not require bespoke unit tests.

Build order: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9. This puts actual multiplayer before content expansion and actual photographs before art polish. Stop adding content if the early cooperation or photo-latency test fails; fix that interaction first.

## Existing code to reuse and limits

| Existing path | Reuse | Do not assume |
|---|---|---|
| `package.json`, `package-lock.json` | Exact shared dependency pins and existing checks | A separate dependency tree per game is needed |
| `_tooling/scene-inspector/main.ts` | WebGPU initialization, GLTFLoader, explicit backend assertion and resource disposal patterns | OrbitControls or inspector UI is a game controller |
| `_tooling/scene-inspector/physics.ts` | Standard WASM initialization, fixed step, contact events and cleanup patterns | `createFixture()` is a general game physics API |
| `_tooling/scene-inspector/scene.ts` | Validation discipline and simple collider conventions | Its fixture-only `fixtures/*.glb` schema can accept the game's level |
| `_environment/smoke-test/box3d.d.ts` | Existing local binding declaration | Missing Body methods have verified signatures; inspect/probe before extending |
| `_environment/smoke-test/browser.ts` | Edge launch, error capture and honest GPU diagnostics | A loopback smoke test establishes internet co-op |
| `_tooling/blender-assets/export_fixture.py` | Safe isolated export and non-overwrite pattern | The cube fixture is a recognizable animal |
| `_tooling/scene-inspector/validate-glb.ts` | Existing asset validation command | Passing glTF validation proves scale, silhouette or animation quality |

Current source inspection confirms `WebGPURenderer.setRenderTarget` and `readRenderTargetPixelsAsync`. Use `await renderer.init()` followed by `renderer.render()`, not deprecated `renderAsync`. Box3D README advertises `setLinearVelocity`, `createCapsule` and ray queries, but this plan only requires verified box creation, pose reading, body removal and fixed stepping for the tin; do not expand the binding surface speculatively.

## File map

Keep related code together; this is a game, not a reusable engine project.

| Planned file | Responsibility |
|---|---|
| `wildly-unqualified/shared.ts` | Wire types, numeric/schema validation, movement and geometry math shared by browser/server |
| `wildly-unqualified/level.ts` | One reserve: static boxes, spawn/perches, subject points, asset names, tuning constants |
| `wildly-unqualified/game.ts` | Authoritative outing, creature states, ownership, observations, photo evaluation and pause/end rules |
| `wildly-unqualified/physics.ts` | Small Box3D adapter for ground and the loose tin; explicit lifecycle |
| `wildly-unqualified/server.ts` | HTTP/WebSocket admission, ordered input, room timing, static files, thumbnail endpoints, startup/shutdown |
| `wildly-unqualified/save.ts` | Versioned state/credentials, serialized atomic saves, backup/recovery and config validation |
| `wildly-unqualified/main.ts` | Join/connection/input, renderer, interpolation/reconciliation and UI binding |
| `wildly-unqualified/view.ts` | Asset instances, simple articulated animation, sound cues and offscreen photo capture |
| `wildly-unqualified/index.html`, `style.css` | Accessible join screen, HUD, notebook/album, settings and pause/end screens |
| `wildly-unqualified/vite.config.ts`, `tsconfig.json` | Separate game build/type checking preserving the inspector |
| `wildly-unqualified/assets/author.py`, `assets/PROVENANCE.md` | Original Blender mesh authoring and actual asset provenance |
| `wildly-unqualified/public/models/*.glb` | Three character GLBs and one named prop/environment library |
| `wildly-unqualified/game.test.ts` | Small meaningful rule/geometry/real-physics checks |
| `wildly-unqualified/server.test.ts` | Real sockets, admission, interruption/save/restore and transfer checks |
| `wildly-unqualified/browser.ts` | Real browser rendering, controls, screenshots and two/four-client acceptance |
| `wildly-unqualified/release.ts`, `SERVER.md`, `VERIFICATION.md` | Portable package, operating/migration runbook and observed results |

Modify shared `package.json`/lock only for the two justified packages and explicit `wu:*` scripts. Modify the root `.gitignore` for generated `games/wildly-unqualified/web/` and `data/`. Add precise Box3D declarations only if runtime inspection proves a necessary missing method. Keep existing `test`, `build`, `test:browser` and fixture scripts working unchanged. Generated output goes to `wildly-unqualified/web/`; local saves and test/release artifacts go to `.artifacts/wildly-unqualified/`.

## Shared contracts

Put these names in `shared.ts`; use ordinary serializable objects, string unions and type-only imports. Complete validation with explicit property checks and finite/bounded numbers, not a new schema library. Positions use metres and player positions refer to feet; the camera offset is 1.6 m standing or 0.9 m crouched. Yaw/pitch use radians, pitch clamps to ±1.45, and the camera's vertical FOV is 60 degrees at 16:9 for captured images. Quaternion order is x/y/z/w. Subject points are authored in local animal coordinates and transformed by the captured pose.

```ts
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Species = "raccoon" | "heron";
export type Behavior = "wander" | "approach" | "inspect" | "carry" |
  "investigate" | "feed" | "alert" | "retreat" | "settle" | "display";
export type Assignment = "raccoon-inspect" | "heron-display" | "pond-pair";
export type Pose = { position: Vec3; rotation: Quat };
export type Box = { id: string; min: Vec3; max: Vec3 };
export type Input = { seq: number; x: number; z: number; yaw: number;
  pitch: number; run: boolean; crouch: boolean };
export type Player = { id: string; name: string; position: Vec3;
  yaw: number; pitch: number; lastSeq: number; connected: boolean;
  lastInput: Input | null; inputTick: number };
export type Animal = { id: string; species: Species; behavior: Behavior;
  pose: Pose; remaining: number; target: Vec3 };
export type Tin = { pose: Pose; velocity: Vec3; angularVelocity: Vec3;
  holder: string | null; portions: number; open: boolean };
// holder is a player id or "animal:raccoon"; null means loose/placed.
export type PhotoFrame = { id: string; tick: number; photographer: string;
  camera: { position: Vec3; yaw: number; pitch: number; fov: number };
  players: Player[]; animals: Animal[]; tin: Tin };
export type PhotoVerdict = { credits: Assignment[]; reason: string };
export type PhotoRecord = { id: string; photographer: string; tick: number;
  credits: Assignment[]; assists: string[]; thumbnail: "pending" | "ready" };
export type ClientMessage =
  | { type: "input"; value: Input }
  | { type: "interact" | "use" | "photo" | "recover"; seq: number }
  | { type: "ping"; seq: number; point: Vec3 }
  | { type: "start" | "pause" | "resume" | "ready-end" | "finish" |
      "save-and-stop"; seq: number };
export type Snapshot = { version: 1; tick: number; seconds: number;
  phase: "camp" | "outing" | "exhibition"; paused: boolean; pauseReason: string;
  players: Player[]; animals: Animal[]; tin: Tin; baitPatch: number;
  observations: string[]; completed: Assignment[]; album: PhotoRecord[] };
export type ServerMessage =
  | { type: "snapshot"; value: Snapshot }
  | { type: "photo"; frame: PhotoFrame; verdict: PhotoVerdict }
  | { type: "notice"; text: string };
```

Use a monotonically increasing command sequence across all messages, including inputs. `lastSeq` acknowledges the latest processed command for that player. The input's sequence and message sequence share that counter. `inputTick` identifies when the server accepted `lastInput`; held input expires 15 simulation ticks later unless refreshed. Sequence acknowledgement is for ordering/replay rejection, not elapsed movement. Snapshot data never includes secrets. `game.ts` owns additional private bookkeeping: recent lure events, end-ready player IDs, creature timers and `pendingPhotos: Record<string, PhotoFrame>`; its `RunState` is versioned save data, not a wire message. Keep thumbnail bytes and pending capture frames out of `Snapshot` so 10 Hz broadcasts do not resend them.

## Task 1: Two players can join and move in the same greybox

**Files:** create `shared.ts`, `level.ts`, `game.ts`, `server.ts`, `main.ts`, `index.html`, `style.css`, `vite.config.ts`, `tsconfig.json`, `game.test.ts`, `server.test.ts`, all under `wildly-unqualified/`; modify shared package/lock and root ignore entries.

**Interfaces:** `parseMessage(value: unknown): ClientMessage`; `movePlayer(player: Player, input: Input, dt: number, walls: Box[]): Player`; `createRun(): RunState`; `snapshot(run: RunState): Snapshot`; `applyCommand(run: RunState, playerId: string, command: ClientMessage): void`; `advanceRun(run: RunState, dt: number): void`; `startServer(options: { port: number; host: string; origin: string; dataDir: string; webDir: string }): Promise<{ url: string; close(): Promise<void> }>`.

- [ ] Add the movement/validation test: diagonal input must not be faster; walking into a solid wall must stop; `NaN`, oversized coordinates, unknown fields/types and replayed sequences must be rejected. Define a player radius of 0.35 m and walk/run speeds of 3/5 m/s in `level.ts`.
- [ ] Run `node --test wildly-unqualified/game.test.ts` and observe the intended failures.
- [ ] Implement normalized XZ movement with swept/sliding tests against expanded rectangles. Keep ground height authored and constant initially. Do not allow endpoint-only collision that tunnels through thin walls on a delayed frame. Clamp `dt` and subdivide movement by distance when necessary.
- [ ] Add a real HTTP/`ws` integration test using ephemeral loopback ports. Two independently authenticated sockets receive distinct player IDs and converge on the same moved player position; a fifth player, wrong secret and incorrect Origin are refused. Test expired input stopping movement.
- [ ] Add `ws` 8.21.3 and `@types/ws` 8.18.1 using exact pins, then implement the one-room server. Use `WebSocketServer({ noServer: true, maxPayload: 16384, perMessageDeflate: false })`, authenticate before upgrade, and use ping/pong cleanup. Join secret/token generation uses `node:crypto.randomBytes`; compare fixed-length credential hashes with `timingSafeEqual` after length checks. Plain names are trimmed to 24 characters and rendered with `textContent`.
- [ ] Implement `/api/join` (bounded JSON body), the session cookie and distinct host admission. Require exact configured Origin for join/mutations/upgrades. Cookie is HttpOnly/SameSite=Strict and Secure for HTTPS configuration. Unauthenticated clients get no world state. Apply simple per-IP join and per-session message limits with bounded map eviction; do not grow a public account system.
- [ ] Serve only allowlisted built files from `webDir`; reject traversal, encoded traversal, directories, symlinks escaping the root and any data path. Set correct MIME types and `nosniff`. Test rejection of `../`, encoded forms, room files and source files. Do not expose the Vite dev server through the tunnel.
- [ ] Build a grey ground/path/camp and two coloured player stand-ins. Reuse the inspector's explicit WebGPU initialization and unsupported-device error. Implement pointer lock, walk/look and labels. Interpolate remote snapshots. Predict own walking with shared math at fixed 60 Hz and keep at most 120 per-tick input records. Anchor the prediction tick estimate to authoritative snapshot ticks plus elapsed monotonic time; correct the estimate gradually for network delay. On a snapshot, reset to its position, discard history through its tick and replay later ticks, preserving held input even when its command sequence is acknowledged. Use `lastInput`/`inputTick` and expiry for missing history, and snap/reset rather than replay an unbounded gap. Test sustained movement, direction change and release under delayed/irregular snapshots: no accumulated speed gain, repeated backward correction from double-counted time or motion after the release is authoritatively reflected. Do not predict tin or animal physics.
- [ ] Add scripts: `wu:dev` = `vite --config wildly-unqualified/vite.config.ts`; `wu:build` = `tsc --noEmit -p wildly-unqualified/tsconfig.json && vite build --config wildly-unqualified/vite.config.ts`; `wu:serve` = `node wildly-unqualified/server.ts`; `wu:test` = `node --test wildly-unqualified/game.test.ts wildly-unqualified/server.test.ts`. Vite game root is resolved from its config module, publicDir is game `public`, output is game `web`, dev port 5174. The game TS config includes game files and the existing Box3D declaration, with strict checking and erasable syntax for server Node execution.
- [ ] Run `npm run wu:test` and `npm run wu:build`; open two real Edge pages and move both via actual inputs. Record WebGPU backend and agreement. Deliverable: a private two-player greybox, not a complete game.

Representative movement assertion (build the player directly in the test, not via a production test mode):

```ts
const input: Input = { seq: 1, x: 1, z: 1, yaw: 0, pitch: 0,
  run: false, crouch: false };
const moved = movePlayer(player, input, 0.1, []);
assert.ok(Math.hypot(moved.position[0], moved.position[2]) <= 0.300001);
assert.throws(() => parseMessage({ type: "input", value: { ...input, x: NaN } }));
```

## Task 2: The shared tin moves, makes noise and has one owner

**Files:** create `wildly-unqualified/physics.ts`; extend `game.ts`, `level.ts`, `main.ts`, `game.test.ts`, `server.test.ts`; extend existing Box3D declaration only if needed.

**Interfaces:** `createPhysics(boxes: Box[], tin: Tin): Promise<TinPhysics>`; `TinPhysics.step(dt: number): { pose: Pose; velocity: Vec3; angularVelocity: Vec3; impacts: Vec3[] }`; `TinPhysics.setTin(tin: Tin): void`; `TinPhysics.dispose(): void`. `setTin` disables/removes the loose body while a player/animal holds it, and recreates it at the released pose. Keep one body for the loose tin, not one per snapshot.

- [ ] Add a real WASM test: release the tin above ground, step it, assert measured Y decreases and settles on the collider, an impact is observed, and dispose/recreate succeeds. First inspect the installed wrapper for necessary velocity/body-destroy methods and run a tiny runtime probe; declare only verified signatures.
- [ ] Run the test red; implement standard-build initialization and actual box/contact simulation using the existing fixture pattern. Step `world.step(1 / 60, 4)` with a bounded accumulator. Capture rotation and both velocities for saves; do not replace simulation with animated falling.
- [ ] Add an ownership race test: two players request the same tin in one tick, exactly one succeeds; release then acquire cannot duplicate it. Reject pickup/use beyond 2 m or through a wall. Set held poses from server player/animal attachment points.
- [ ] Implement reliable pickup/place/use and deliberate drop, collision-noise events, four bait portions and an out-of-bounds recovery point. Held objects do not remain active colliders that fight the holder. No general grab-joint or throwing system.
- [ ] Run rule/socket/physics tests and two-browser interaction. Deliverable: a visible physical tin with shared ownership and recoverable state.

## Task 3: One animal creates a useful co-op photo opportunity

**Files:** extend `level.ts`, `game.ts`, `main.ts`, `game.test.ts`; create `view.ts` for temporary articulated shapes and sound cues.

**Interfaces:** `advanceRun` consumes transient lure/noise events and updates raccoon states; `createView(scene: THREE.Scene): Promise<{ update(state: Snapshot): void; dispose(): void }>` initially builds recognizable temporary body parts. `applyCommand` handles tin rattle, whistle and feeding-patch use under server cooldown/distance checks.

- [ ] Add the causal test: one player's rattle brings the raccoon to an unheld tin; it inspects before stealing; another player's whistle diverts it for the documented commitment interval; the same tin reaches the stash and can be reclaimed.
- [ ] Run red, then implement explicit waypoint movement and state transitions. Choose recent eligible lure once per commitment period. Animal stepping uses simulation seconds, never wall-clock deadlines that expire during pause.
- [ ] Add readable head-turn, paw-reach and carry poses with simple component transforms; include captions for the lure and state change. Model recognition is refined in Task 6, but the temporary animal should already have a face mask and ringed tail.
- [ ] Give both players camera aiming overlays and a provisional server-side “inspection framed” indicator using the eventual geometry rules. No fake saved photographs yet.
- [ ] Run a short two-person/local controlled experiment: player A deliberately attracts the raccoon, player B gets an opportunity, then swap. Record whether behavior/cause was understood and whether either person waited uselessly. If it is dull or ambiguous, adjust these few states and cues before moving on.

## Task 4: Actual shared photographs with server-owned credit

**Files:** extend `shared.ts`, `game.ts`, `server.ts`, `main.ts`, `view.ts`, `game.test.ts`, `server.test.ts`; create `browser.ts`.

**Interfaces:** `makePhotoFrame(run: RunState, playerId: string): PhotoFrame`; `evaluatePhoto(frame: PhotoFrame, occluders: Box[]): PhotoVerdict`; `capturePhoto(renderer: THREE.WebGPURenderer, frame: PhotoFrame): Promise<Blob>`; `POST /api/photos/:id` consumes JPEG bytes from that photo's authenticated photographer; authenticated `GET /api/photos/:id` returns a validated thumbnail or 404.

- [ ] Write table-driven tests for behind-camera, clipped, too-small, occluded, incorrect-state and valid inspection pictures. Use numeric arrangements of subject points and boxes, not mocks returning “visible.” Include a multiple-subject frame and a ray parallel to a box plane.
- [ ] Run red; implement camera basis/projection and slab ray/box intersection in shared math. Require 2 of 3 authored points visible and at least 3% projected subject height. Server-issued frame IDs and immutable copies bind credit to the same pose the client will render.
- [ ] Implement `photo` after preceding ordered inputs. Set a 1-second shutter cooldown, compute credit once, record descriptive assists from recent causal events and send the complete frame. Store the immutable frame in private `pendingPhotos` until successful image upload; resend it to its authenticated photographer on reconnect/reassignment without re-awarding credit. Keep three objective images pinned and rotate up to 21 additional captures. Evict pending frames and image bytes with their records.
- [ ] Implement a dedicated 640×360 `THREE.RenderTarget` with RGBA unsigned-byte texture. Apply the returned frame to scene instances, save/restore live transforms and camera/renderer target in `try/finally`, render synchronously, then read the target asynchronously. Serialize captures so one request cannot overwrite another readback. Verify readback orientation/colour before coding a flip. Encode through Canvas/ImageData to JPEG ≤64 KiB, lowering quality/resolution if needed; reject failed encoding explicitly.
- [ ] Add strict upload byte and JPEG-signature checks, author/ID ownership checks, a small upload rate limit and `image/jpeg`/`nosniff` output. Never infer credit from bytes. An image failure leaves credit intact and offers retry; duplicate retry is idempotent. End a malicious/oversized stream as soon as the limit is exceeded.
- [ ] Add browser checks with a known asymmetric colour chart and actual 3D subject to prove the image is not blank, inverted or a UI-only capture. Fetch the shared thumbnail from the second authenticated browser. Keep gameplay assertions independent of GPU pixels and pixel assertions independent of mocked credit.
- [ ] Measure click-to-preview and live-view/accepted-frame displacement locally and under a controlled 150 ms RTT. Log the limitation if it is noticeable; revise this path before content expansion. Deliverable: both players see real pictures of correctly credited behavior.

Expected rule-level core:

```ts
const verdict = evaluatePhoto(frame, walls);
assert.deepEqual(verdict.credits, ["raccoon-inspect"]);
const hidden = evaluatePhoto(frame, [blockingWall]);
assert.deepEqual(hidden.credits, []);
```

Construct `frame`, `walls` and `blockingWall` directly in that test with the declared geometry. These names describe test inputs, not missing production helper APIs.

## Task 5: Complete the linked outing and recover from mistakes

**Files:** extend `level.ts`, `game.ts`, `view.ts`, `main.ts`, `style.css`, `game.test.ts`, `server.test.ts`.

**Interfaces:** extend the existing `RunState` with all three assignments, heron timers, feeding-patch portions, shared observations and end-ready player IDs. Continue using `applyCommand`, `advanceRun`, `snapshot` and `evaluatePhoto`; do not add an event bus or quest framework.

- [ ] Add a full-rule sequence: photograph inspection, carry/steal the tin to the pond, trigger and interrupt the heron, recover quietly, obtain display and pair photos, return to camp and finish. Preserve the same tin ID, remaining portions and observations across every beat. Also credit a valid pair photo early: assignments must not be locked by tutorial order.
- [ ] Run red; implement the heron state machine and three assignment predicates from the spec. Add measured retreat motion between perches and distinct alert/settle/display poses. Consume bait only on display start, once per transition.
- [ ] Implement notebook discovery by observed events, contextual hints, F pings, bait refill at camp and tin recovery. No arbitrary completion timer or content resets. A failed setup cannot exhaust the only route to completion.
- [ ] Build the connected clearing/trail/pond/bank and camp exhibition. The host's `start` command begins outing time from camp after at least two players connect; a solo session can inspect controls but is not the co-op acceptance path. End only when the objectives are complete and every connected player is at camp and ready; host issues `finish`. Paused disconnected slots do not block the connected crew after they choose to continue.
- [ ] Test interruption during every resource/behavior transition and assert no negative bait, double consumption or duplicate credit. Walk the whole route in two real clients. Deliverable: one complete greybox outing, with duration still unmeasured until human testing.

## Task 6: Replace stand-ins with recognizable, coherent models

**Files:** create `assets/author.py`, `assets/PROVENANCE.md`, `public/models/researcher.glb`, `raccoon.glb`, `heron.glb`, `field-kit.glb`; extend `view.ts`, `level.ts`, `browser.ts` under `wildly-unqualified/`.

**Interfaces:** stable GLB nodes `Head`, `Body`, `LegL`, `LegR`, `WingL`, `WingR`, `Tail`, `TinGrip`, `CameraGrip` as applicable; asset manifest maps named meshes/parts to poses, attachment points and authored subject points. Runtime asset paths are same-origin `/models/*.glb` only.

- [ ] Read existing Blender isolation/export helpers and inspect the available game-owned session before use. The user's subsequent visibility requirement supersedes the original background-session instruction: all new Blender work must be visible and foreground, with the UI updating during construction. Preserve unrelated GUI scenes.
- [ ] Author original recognizable researcher, raccoon and heron from low-poly meshes with separate moving parts, coherent palette and scale. Reuse one researcher with four material variants. Author one named mesh library for the tin/camera/whistle/tent/sign/log/rock/tree/reeds. One procedural source script is enough; retain an isolated versioned `.blend` if useful for edits.
- [ ] Export Y-up GLBs with metre scale and stable names. Refuse overwriting unrelated existing output; use a new version or a verified game-owned output directory. Record actual authorship, tool version, dimensions and triangle counts in PROVENANCE.
- [ ] Run `npm run validate:glb --` with each actual output path. Inspect warnings and errors; fix material/node/scale mistakes rather than silencing validation.
- [ ] Replace temporary shapes with GLTFLoader instances and animate named parts from animal state. Keep collision boxes simple and separate. Share geometry/material resources carefully and dispose once on room exit.
- [ ] Capture real WebGPU turntables, unlabelled silhouettes and in-level views. Verify the heron's feet meet the bank, raccoon tin attachment is plausible, cameras point forward and interactable tin is visually distinguishable from scenery. Have a human identify the two animals without name labels at play distance when available.
- [ ] Add original/synthesized event sounds, captions and volume controls. Verify readable focus states, non-colour-only player identity, Escape/pointer-lock behavior, sensitivity/invert-Y, key rebinding and reduced-motion default. Deliverable: a coherent MVP scene, not high-fidelity art.

## Task 7: Pause, save, rejoin and restart without losing the outing

**Files:** create `wildly-unqualified/save.ts`; extend `server.ts`, `game.ts`, `main.ts`, `server.test.ts` and `game.test.ts`.

**Interfaces:** `loadRun(dataDir: string): Promise<{ run: RunState; images: Map<string, Uint8Array> } | null>`; `saveRun(dataDir: string, run: RunState, images: Map<string, Uint8Array>): Promise<void>`; `loadRoom(dataDir: string): Promise<RoomCredentials>`; `loadConfig(env: NodeJS.ProcessEnv): ServerConfig`. `ServerConfig` has validated `host`, `port`, `origin`, `dataDir`, `webDir`. `RoomCredentials` stores private host/join/session material and never enters snapshot serialization. The on-disk envelope is `{ version: 1, run, images: Record<string, string> }`, with image values validated base64; load converts those values to the returned map.

- [ ] Add a failure test for disconnect while holding the tin: movement stops, the tin is released once, the room pauses, and a reconnect restores the existing slot without duplicating it. Connected friends can resume a disconnect pause; ordinary guests cannot manually reset/end the outing.
- [ ] Run red; implement role checks and pause/admission rules. Pause freezes physics, AI timers and active outing time. Clear stale client inputs before resume. Reserve disconnected slots; host can explicitly release/reassign them while paused, never silently evict a connected player.
- [ ] Test serialized save/restore while the heron is displaying and while a thumbnail is pending. Assert completed assignments, portions, album bytes, pending immutable frames, animal timer, simulation time and player identities survive. Rejoin after restarting before upload, render the saved pending frame, upload its image and verify the original credited pose and exactly one credit. Reload starts paused with all sockets disconnected and stale holders safely released; reconstruct actual physics from saved poses/velocities.
- [ ] Implement version 1 plain JSON, with JPEG bytes encoded as bounded base64, maximum 8 MiB save payload and bounded record counts. Copy a consistent run/image snapshot before awaiting filesystem work. Serialize writes, write to a sibling temporary file, replace the primary after success and retain a valid backup. Persist image bytes, ready metadata and removal of their pending frame together after upload. A failed write reports “save failed” and keeps the previous valid save. Do not report a successful pause-and-save until the flush resolves.
- [ ] Test disk-write rejection without overwriting the previous save, corrupt primary with valid backup, unknown schema version, missing images and two rapid overlapping save requests. Do not swallow errors into a fresh run. Graceful shutdown stops admission, pauses, awaits the final flush, closes sockets and disposes physics; test `close()` rather than relying only on Windows signal behavior.
- [ ] Add authenticated host `POST /api/reassign` consuming `{ slotId: string, admittedPlayerId: string }`, allowed only while paused with a disconnected target slot; invalidate the slot's prior session token and bind the admitted guest to it atomically. For a full reserved room after migration, join creates a bounded pending admission with no active avatar until host reassignment, so four disconnected slots do not lock everybody out. Provide host recovery via `/api/join` using the distinct copied host credential. Implement the typed `save-and-stop` command and parser coverage. Credentials are separate from world save, never sent to guests, and transfer only through the private data directory. Deliverable: a recoverable outing across browser loss and process restart.

## Task 8: Local hosting, private internet test and portable release

**Files:** create `wildly-unqualified/release.ts`, `SERVER.md`; extend config/server, `server.test.ts`, `browser.ts`, package scripts and game README.

**Interfaces:** `npm run wu:release` runs `node wildly-unqualified/release.ts`; release copies runtime source layout plus compiled assets and the unchanged shared package/lock into `.artifacts/wildly-unqualified/releases/<version>/`. It excludes saves, credentials, `node_modules`, Blender/development sources and absolute machine paths. Optional ZIP is a standard archive of that directory, not the only usable delivery format.

- [ ] Add config tests for relative/default paths resolved against the server module, a non-default port, exact public origin, malformed ports/origins and data-dir-inside-web rejection. Defaults are `127.0.0.1:4310`, sibling `web/` and sibling `data/`. Configure local data explicitly under `.artifacts/wildly-unqualified/data`. The application must not import Cloudflare APIs or Windows process utilities.
- [ ] Run red; implement those checks and document the platform-neutral Node entry point. Add `/healthz` containing only readiness/build/schema version, without private state. Fail clearly when the game build is absent or the data path is unwritable.
- [ ] Build and test locally, then start a temporary tunnel only as part of the authorized prototype test. Use the installed CLI: `& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://127.0.0.1:4310`. It prints an assigned HTTPS URL. Set that exact URL as `WU_PUBLIC_ORIGIN`, restart the game server safely, and use the HTTPS origin for the host browser too. The tunnel may show 502 until the app is ready. Do not disable origin validation, create a paid service or open router ports to bypass a setup failure.
- [ ] Verify HTTPS page assets and authenticated WSS, then reconnect after an intentional connection loss. Record real RTT, image upload behavior and the actual public-origin check. Keep the invite fragment and credentials out of logs/screenshots. Do not send invites to others without the user's explicit sending authorization; provide the user a copyable invitation.
- [ ] Package only `wildly-unqualified/{server,save,game,physics,shared,level}.ts`, the built `wildly-unqualified/web/`, SERVER.md, package.json and package-lock.json. Before fixing this allowlist, trace all actual runtime imports so no module is missing. Use type-only imports for renderer declarations; the server must never import browser/view/DOM modules at runtime. Runtime dependencies can use the existing shared lock; no second independently maintained manifest is needed.
- [ ] In a fresh release directory whose path contains spaces, run `npm ci --omit=dev`, set a fresh data directory/non-default port, and start `node wildly-unqualified/server.ts` from a different working directory using its absolute path. Request health and join with real sockets. Assert the copied web bundle loads without Vite, Blender, Codex or a GPU on the server side. Inspect archive entries for private data/path leaks.
- [ ] Exercise the transfer procedure: complete at least one assignment, pause/flush/stop, copy the complete data directory to a second local location, start the same release on another port, recover host access, re-admit/reassign player slots and resume with the same album/bait/animal state. Keep the old instance stopped. This proves local relocation, not the inaccessible home server.
- [ ] Write SERVER.md with installation/start/stop, config table, data backup/restore, recovery credentials, HTTPS/WSS proxy requirements, health check and rollback to the same compatible release. Document that a changed origin invalidates browser cookies, requiring re-admission; it does not discard the saved outing. No Docker/service-manager setup until the home-server environment is known.

Planned local command sequence, after implementation (PowerShell):

```powershell
Set-Location D:\friendslop-games\games
npm.cmd run wu:build
$env:WU_DATA_DIR = 'D:\friendslop-games\games\.artifacts\wildly-unqualified\data'
npm.cmd run wu:serve
```

Start the tunnel in a second terminal. After it gives the actual URL, use the safe stop action, set `WU_PUBLIC_ORIGIN` to that URL in the server terminal and restart. For a home-server deployment use the same Node command and configuration in that machine's shell; no hardcoded Windows path is part of the server. Preserve the credential/data directory privately when copying. The developer does not currently have home-server access.

## Task 9: Verify the complete experience and hand off honest evidence

**Files:** finish `wildly-unqualified/browser.ts`, `VERIFICATION.md`, `README.md`, `SERVER.md`; update shared indexes to point at observed status, preserving other games.

- [ ] Run `npm run wu:test` and `npm run wu:build`. Add `wu:test:browser` for `node wildly-unqualified/browser.ts`; it starts/stops its own temporary test server or requires an explicit safe test origin, uses isolated credentials/data and performs real browser inputs. Production has no test-only endpoints that award objectives or teleport players.
- [ ] Run the existing shared `npm test`, `npm run build`, `npm run format:check` and the established generic browser smoke procedure from `_environment/SETUP.md`. Add a game-only formatting check, keeping the old globs intact. Investigate failures; do not rewrite unrelated tools to make this game pass.
- [ ] Exercise two, then four independently controlled clients: admission, movement, exclusive tin, both animal rules, actual photo/album, three assignments, end, disconnect/rejoin, save/restart and relocation. Use deterministic known rule setups only in unit tests; end-to-end route completion must drive actual gameplay, not an injected finished snapshot.
- [ ] Capture backend/adapter, browser/version, errors, load times, click-to-photo delay, RTT, p95 frame time and save/reconnect outcomes. Keep a real screenshot of each animal, shared album and the completed outing. Device screenshots and automated assertions do not prove the animals are funny.
- [ ] Conduct a two-person unfamiliar playtest on separate internet connections, followed by a four-person test when participants are available. Record actual duration, contribution/idle periods, misunderstood reactions, repeated recovery, best photo and desire to try again. Ask about their actions and confusion, not leading questions about whether the concept is great. Do not recruit/contact people automatically.
- [ ] Fix the smallest supported gameplay/usability issues, repeat only affected checks, and run a skeptical final review of scope, networking, portability and claims. Use the Superpowers verification-before-completion skill before declaring any gate passed.
- [ ] Record each result as VERIFIED, IMPLEMENTED OR CONFIGURED BUT UNVERIFIED, BLOCKED, or DEFERRED WITH REASON. A missing remote volunteer is a pending human gate, not a reason to label local bot traffic “internet playtested.” An inaccessible home server remains unverified even after the local transfer passes.
- [ ] Deliver the playable local URL, user-controlled invite instructions, portable release path, save location, stop/resume procedure, measured test results and limitations. Do not publish a site, purchase hosting or push/commit. Preserve all original concepts.

## Completion and review checkpoints

| Checkpoint | Must be demonstrable | Do not claim yet |
|---|---|---|
| After Task 2 | Two real clients and one authoritative physical tin | Animal cooperation, remote suitability |
| After Task 4 | One friend changes another's opportunity; actual shared image with correct credit | A sustained complete outing |
| After Task 7 | Complete linked outing with readable animals, safe pause/rejoin/save | 20–30-minute measured fun or portable home-server operation |
| After Task 8 | Private HTTPS/WSS test and portable release restored in a second local location | Tested operation on the inaccessible home server |
| After Task 9 | Explicit technical results plus available remote human evidence | Market success, full-product content hours or shipping-platform readiness |

No calendar estimate is asserted: animal behavior, capture latency and remote play are unresolved work, not measured AI delivery speed. Current expected incremental tool/service spend for the private test is zero; actual home electricity/bandwidth and later publishing/infrastructure costs depend on use. Keep the user's existing subscription and unpaid time assumptions intact.

## Plan self-review record

The plan has been reviewed inline against the actual package/scripts, fixture validator, Box3D declaration, renderer capture APIs and the user's confirmed scope. Key corrections incorporated: multiplayer is internet-capable from the early architecture; physics is genuinely authoritative; photo credit and rendered pose share one frame; a disconnected player does not wait until camp; an exhausted/stolen tin cannot end the run; saved timers use simulation time; browser credentials are handled explicitly when moving origins; the server has no required dependence on this PC, Blender or Cloudflare. One independent skeptical design review identified two additional material gaps, now corrected: pending photo frames survive restart until image upload, and held-input reconciliation is tied to simulation ticks rather than command acknowledgements alone. Execution must still verify every claimed runtime property. No game source, assets, tunnel or server has been created by writing this plan.
