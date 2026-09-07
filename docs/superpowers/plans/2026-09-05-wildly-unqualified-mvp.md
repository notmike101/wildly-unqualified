# Wildly Unqualified Forest MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver a complete 2–4-player forest photography outing with physical teamwork, light mischief, mature woodland assets and a coherent sky, targeting 20–30 minutes of human play.

**Architecture:** Extend the existing authoritative Node game and WebGPU browser. One authored world describes placement, collision, sight lines and navigation. Bounded encounter choices and saved physical props create variety; the existing immutable photograph and portable-server pipeline remains authoritative.

**Tech Stack:** TypeScript 7.0.2, Three.js 0.185.1/WebGPU, box3d-wasm 0.2.0 standard, ws 8.21.3, Node 26.5.x, visible Blender 5.2.1 LTS, existing Node tests and Playwright.

**Spec:** [Approved direction and forest correction](../specs/2026-09-05-wildly-unqualified-mvp-design.md). Read the [39-model asset brief](../../../assets/BRIEF-v3.md) alongside this plan.

**Checkpoint:** shared world/state and forest/identity rendering are implemented; 39 assets are exported. The longer gameplay, full habitat review and MVP release are unfinished. Delegated workers hit the account usage limit. See [current evidence and exact next work](../../history/MVP-CHECKPOINT-2026-09-05.md).

## Global constraints

- Target a 20–30-minute outing for 2–4 friends on separate internet connections; duration and enjoyment require human measurement.
- Keep the stylized low-poly finish; mature trees stand approximately 18–32 metres tall.
- Main equipment routes remain at least four metres wide and six metres clear overhead.
- Build 29 forest/environment models, one articulated deer, one researcher body, four removable hats and four equipment assemblies: 39 planned authored models/geometric variants.
- Author and inspect assets in visible foreground Blender; preserve both original scenes and all original model files. Never use background Blender. Only claim MCP use after an actual connected MCP operation.
- Retain Three.js/WebGPU, Box3D, TypeScript and the authoritative Node/WebSocket server. No new runtime dependency or service is required.
- Use the existing $100 individual subscription, free/open-source tools and unpaid owner time; no paid host tier or runtime AI.
- Preserve accepted photographs, completed commissions and prepared route work through mishaps, disconnection and restart.
- Keep the server configurable by bind address, port, public origin and private data directory. Preserve the prototype release/save directory and use a new MVP data directory.
- Preserve all other concepts and generic tools. This workspace has no Git repository; do not initialize one or fabricate commits. Record task verification in the ledger instead.
- Keep any browser playtests visible and close their owned browsers afterwards. Do not reopen the four old player profiles for ordinary checks.

## Execution and file ownership

Use the current workspace and task. The user already authorized asset delegation; an asset worker can own `assets/*v3*` and the five new GLBs while the coordinator handles contracts and renderer integration. Gameplay work may be delegated only after the shared contract is written. Do not run competing implementers on `shared.ts`, `level.ts`, `game.ts` or `view.ts`. Review actual results between tasks, and resolve routine details without another workflow-preference question.

New production files are limited to two focused modules: `forest-view.ts` for static forest/sky rendering and `encounters.ts` for wildlife decisions and commission selection. Both serve existing large modules. Keep holding, command authority, progression and snapshots in `game.ts`; no entity framework, generic event bus or content scripting language.

All file paths below are relative to `D:\friendslop-games\games\wildly-unqualified`. Run npm commands from `D:\friendslop-games\games`. The current release allowlist in `release.ts` must include the new server-side `encounters.ts`; browser-only `forest-view.ts` is bundled by Vite.

## Task 1: shared world, stable crew identity and versioned state

**Files:** modify `shared.ts`, `level.ts`, `game.ts`, `save.ts`, `server.ts`, `main.ts`, `game.test.ts`, `shared.test.ts`, `save.test.ts`; create `level.test.ts`.

**Interfaces:** retain `createRun`, `addPlayer`, `advanceRun`, `applyCommand`, `snapshot`, `makePhotoFrame`, `movePlayer`, `loadRun`, `saveRun`. Extend `createRun(seed = 1): RunState`; the server supplies an integer seed for each genuinely new outing. Define the following shared types before parallel gameplay/client work:

```ts
export type CrewSlot = 0 | 1 | 2 | 3;
export type Habitat = "woodland" | "clearing" | "wetland";
export type WorldConfig = {
  content: "forest-mvp-1";
  seed: number;
  sites: Record<Habitat, 0 | 1>;
  assignments: Assignment[];
};
export type FieldProp = {
  id: string;
  kind: "case" | "plank" | "screen" | "decoy";
  pose: Pose;
  velocity: Vec3;
  angularVelocity: Vec3;
  holders: [string | null, string | null];
  placed: boolean;
  open: boolean;
};
export type RouteState = {
  crossing: "left" | "right" | null;
  gateOpen: boolean;
};
export type Spill = {
  id: string;
  position: Vec3;
  portions: number;
  untilTick: number;
};
export type CrewHat = {
  owner: string;
  carrier: "owner" | "raccoon" | "ground";
  position: Vec3;
  untilTick: number;
  protectedUntilTick: number;
};
export type Walkable = {
  id: string;
  min: Vec3;
  max: Vec3;
  axis: 0 | 2;
  heightStart: number;
  heightEnd: number;
};
```

Add `slot: CrewSlot` to `Player`; add `world`, `props`, `route`, `spills`, `hats` and `spareBait` to snapshot version `2`. Add `favorites: string[]` and `incident: "spill" | "hat" | null` to `PhotoRecord`. `PhotoFrame` freezes the same added world/prop/route/spill/hat state. Expand `Species` with `deer`, `Behavior` with `graze`, `wash`, `preen`, and `Assignment` with `raccoon-wash`, `deer-graze`, `deer-decoy`, `heron-preen`. Keep the existing three assignment IDs valid.

In `level.ts` export:

```ts
export type WorldPlacement = {
  id: string;
  model: string;
  position: Vec3;
  yaw: number;
  scale: Vec3;
  solids: Box[];       // already transformed to world space
  occluders: Box[];    // also includes relevant canopy/branch masses
};
export type NavNode = { id: string; position: Vec3; links: string[] };
export const CONTENT_VERSION = "forest-mvp-1" as const;
// Typed authored arrays, populated in this task and refined with asset bounds.
export const WORLD_PLACEMENTS: WorldPlacement[];
export const WALKABLES: Walkable[];
export const NAV_NODES: NavNode[];
export const TRAILS: { id: string; points: Vec3[]; width: number }[];
export function routeBoxes(route: RouteState): Box[];
export function routeSurfaces(route: RouteState): Walkable[];
```

The declarations above specify names/types, not uninitialized production exports. Use actual authored values: world bounds X ±78/Z ±68, camp `[-48,0,45]`, woodland `[-38,0,14]`, washout `[-14,-1,2]`, clearing `[21,0,14]`, wetland `[39,0,-30]`. Connect camp→woodland→washout→clearing→wetland, a dry washout detour, and a west-side return path. Place the second site for each habitat 8–12 m from its first with another clear approach. Keep all positions inside existing ±100 command bounds. Build `WALLS` and `PHYSICS_BOXES` from placements and terrain; remove the independent decorative tree placement loop in Task 2.

- [x] Capture a hash list of the preserved prototype release and private `run.json` without printing credentials. Record it under a new MVP evidence directory. Continue development on a new data directory, never the reserved four-player outing.
- [x] Add regression checks for persistent slots and incompatible saves. Use real functions:

```ts
const run = createRun(41);
addPlayer(run, "a", "Ash");
addPlayer(run, "b", "Reed");
const slots = new Map(run.players.map(p => [p.id, p.slot]));
disconnectPlayer(run, "a");
addPlayer(run, "a", "Ash");
assert.equal(run.players.find(p => p.id === "a")!.slot, slots.get("a"));
assert.equal(new Set(run.players.map(p => p.slot)).size, 2);
assert.equal(snapshot(run).version, 2);
assert.equal(snapshot(run).world.content, "forest-mvp-1");
```

- [x] Run `node --test wildly-unqualified/game.test.ts wildly-unqualified/save.test.ts` and record the expected missing-state assertion failures before implementation.
- [x] Write the shared types and initial values. Choose the first free slot on new admission; reconnection preserves it. Enforce unique slots, a uint32 seed, exactly four unique known assignments with one per habitat plus `pond-pair`, four known prop IDs, maximum four hats, maximum eight spills, bounded transforms and valid referenced player IDs. Room credentials keep their existing independent schema.
- [x] Expand every save validator and initial/pending-photo fixture together. Save envelope/run versions become 2; an existing version-1 save throws an explicit incompatible-version error before writes. Retain atomic writes, backup handling, JPEG and upload limits. Do not auto-convert old coordinates.
- [x] In `level.test.ts`, walk sampled full trail segments using the production `movePlayer` and world solids to catch blocked routes. Cover a bank ramp separately. Extend movement with `surfaces: Walkable[] = []`, selecting the highest supported surface within the allowed step height and interpolating ramp height. Server and prediction receive the same surfaces. Reject movement into deep/unsupported washout areas; the dry detour remains supported.
- [x] Run `npm.cmd run wu:test` and `npm.cmd run wu:build`. Update every actual snapshot consumer and fixture; do not hide missing new fields behind casts. Record results in `IMPLEMENTATION.md`.

## Task 2: a convincing forest scene with solid scenery, sky and readable crew

**Files:** create `forest-view.ts`; modify `view.ts`, `main.ts`, `style.css`, `level.ts`, `browser.ts`; create version-3 authoring sources/initial model exports specified by `assets/BRIEF-v3.md`.

**Interfaces:** `createView(scene: THREE.Scene)` retains its call shape and returned `update`, `dispose`, `errors`. New renderer helper:

```ts
export function addForest(
  scene: THREE.Scene,
  assets: Map<string, THREE.Group>,
): { dispose(): void };
```

It consumes `WORLD_PLACEMENTS`, `TRAILS` and `WALKABLES`. `view.update` consumes snapshot version 2 and uses `Player.slot` for identity. Every live/capture update shares the same static world and sky.

- [x] Author the representative pine, oak, fallen log and fern in visible foreground Blender. Preserve existing scenes; inspect the real window and capture evidence of actual staged creation. Export grounded named objects and collider metadata using new version-3 paths. Pause batching if the first-person scale/composition is poor.
- [x] Add a visible browser check that loads real WebGPU, visits an authored forest camera position through ordinary controls and captures eye-level/upward images. Assert no asset-load or shader errors; judge mature-tree silhouette, canopy enclosure and horizon visually. A GLB validator cannot establish those qualities.
- [x] Import the installed addon using the verified API:

```ts
import { SkyMesh } from "three/addons/objects/SkyMesh.js";
const sky = new SkyMesh();
sky.scale.setScalar(10000);
sky.cloudSpeed.value = 0;
sky.cloudCoverage.value = 0.35;
sky.cloudDensity.value = 0.35;
sky.sunPosition.value.set(-0.45, 0.75, 0.4).normalize();
scene.add(sky);
```

Treat cloud/light values as the starting composition. Match directional light to `sunPosition`, tune exposure/hemisphere fill and set fog to the resulting horizon hue. Confirm the installed shader's depth behavior, camera far plane and shadow bounds. Both `main.ts` and `capturePhoto` currently construct cameras with far 160; use the same final far plane in both.
- [x] Replace the existing trig tree scatter and prototype ground slab with shared placements and authored terrain/paths. Repeated static mesh geometry/material pairs use `THREE.InstancedMesh` where practical; keep interactive objects individually addressable. Reuse existing loader/material disposal logic and release sky/material/instance resources exactly once.
- [x] Build crew accents on a large torso/pack area and removable hats; use four distinct slots with colors, numbers and shape cues. Overhead names are escaped DOM text or a canvas label, clipped by distance/occlusion; never interpret a supplied field name as HTML. Render labels only in the live HUD. Match roster and ping colors to the same slot mapping.
- [x] Walk into actual tree trunks, logs and rocks; verify clipping is blocked in both prediction and server snapshots. Check four-metre routes and screen/camera openings. Record four crew members in shade and in the clearing, plus an actual JPEG without labels.
- [x] Run `npm.cmd run wu:build`, `npm.cmd run wu:test`, and the visible browser checks. Record shader, screenshot and frame-time results before building the rest of the tree variants.

## Task 3: transport, placement and shared collision

**Files:** modify `physics.ts`, `game.ts`, `shared.ts`, `level.ts`, `view.ts`, `main.ts`, `physics.test.ts`, `game.test.ts`, `shared.test.ts`; author `expedition-kit-v3.glb` through the asset brief.

**Interfaces:** keep `applyCommand` as the only command-authority entry point and reuse `interact`, `use`, `drop`, `recover`. Extend the existing physics interface rather than add a separate engine:

```ts
export type ReservePhysics = {
  setTin(tin: Tin): void;
  setProps(props: FieldProp[], route: RouteState): void;
  step(dt: number): PhysicsState & { props: FieldProp[] };
  dispose(): void;
};
export function createPhysics(
  boxes: Box[], tin: Tin, props?: FieldProp[], route?: RouteState,
): Promise<ReservePhysics>;
```

`PhysicsState` retains its existing tin pose, velocities and impacts. `attachPhysics` synchronizes only changed bodies/ownership and route statics; it must not recreate every prop body on every tick. Retain 60 Hz physics, 10 Hz snapshots and bounded input timeout.

- [x] Write tests exercising two simultaneous claims on the same handle, one player claiming two objects, a release on disconnect, and a held object's attempted movement through an authored solid. One handle has one owner; case/screen/plank have two; decoy has one usable handle. Compare final authoritative geometry, not just a boolean collision helper.
- [x] Run `node --test wildly-unqualified/physics.test.ts wildly-unqualified/game.test.ts` before the implementation and record the behavioral failures.
- [x] Derive handles and solid proxies from the authored prop data. `E` selects the nearest visible reachable handle within 2 m; the second player can claim the other free handle. A player already holding equipment uses `E` to place and `G` to release. A held tin blocks claiming another prop and vice versa. Existing `Q` remains use: lid when handling the case, bait cup when targeting the decoy, tin/whistle otherwise. Show the actual chosen action before input.
- [x] Move one-holder heavy props at 0.8 m/s, two-holder props at 2 m/s initially; the decoy remains normal walking speed. Update the two end positions from holder movement, derive orientation, and sweep the full prop bounds in at most 0.1 m / 5-degree increments. Stop at the first solid contact. Bound angular speed and impulses; sliding contact and audible scrape explain interruption. Player movement must not tunnel through props or be trapped inside their own handle geometry.
- [x] Seat the plank only within 0.75 m and 20 degrees of a marked bank pose. Store `route.crossing` and replace loose physics with a stable collider/walkable surface. Toggle the return gate when its latch is reached; update render and collision from saved `gateOpen`. Ensure the detour remains available with an unplaced plank.
- [x] Add gentle player separation. If a stationary player prevents escape for 1.5 seconds, temporarily ignore that pair's body contact until separated, while still enforcing world/prop solids. Test the doorway obstruction case and disable separation for disconnected players.
- [x] Drop/recover stuck props at the nearest authored reachable safe point. A lost last holder cannot leave floating or owner-locked equipment. Save/restart while carrying releases handles and restores paused without losing supplies.
- [x] Run focused tests, `npm.cmd run wu:build`, and a visible two/four-person crossing. Record carry contact and recovery under the existing 150 ms added network-delay path.

## Task 4: reactive animals and selected commissions

**Files:** create `encounters.ts`, `encounters.test.ts`; modify `game.ts`, `level.ts`, `shared.ts`, `save.ts`, `view.ts`, `main.ts`, `game.test.ts`, `save.test.ts`, `release.ts`; author `deer-v3.glb`.

**Interfaces:** expose only these helpers from `encounters.ts`:

```ts
export type AnimalMemory = {
  goal: string;
  recentGoals: string[];
  interestPoint: Vec3 | null;
  interestUntilTick: number;
  habituatedUntilTick: number;
};
export function chooseOuting(seed: number): WorldConfig;
export function stepAnimals(run: RunState, dt: number): void;
export function animalRoute(from: Vec3, toNode: string, route: RouteState): Vec3[];
```

Use a type-only import of `RunState` to avoid an executable circular dependency. `RunState` gains `animalMemory: Record<string, AnimalMemory>` and removes obsolete fixed-waypoint bookkeeping once callers migrate. This server-only memory is validated/saved; the browser still receives readable `Animal.behavior`, target and pose.

- [x] Test seed determinism, a different valid site/commission selection across a set of seeds, all selected goals being reachable, and avoidance of the previous goal when another suitable choice exists. Test causal noise and lure changes without taking random luck as success:

```ts
assert.deepEqual(chooseOuting(71), chooseOuting(71));
const selections = new Set(Array.from({length: 12}, (_, seed) =>
  JSON.stringify(chooseOuting(seed))));
assert.ok(selections.size > 1);
const run = createRun(71);
assert.equal(run.world.assignments.length, 4);
assert.ok(run.world.assignments.includes("pond-pair"));
```

- [x] Run `node --test wildly-unqualified/encounters.test.ts` and record expected failures before implementation.
- [x] Implement a small seeded tie-break for valid authored sites and commissions. Traverse the small navigation graph with a simple visited-node search; use collision-checked links and the saved route state. Do not add a pathfinding package or a full ecosystem.
- [x] Move existing raccoon/heron decisions into `stepAnimals`, preserving their visible cues. Add deer grazing, scan/alert, cautious decoy approach and retreat. Implement raccoon wash and heron preen poses at their appropriate sites. Reads of accessible bait, player exposure, noise, cover and nearby species determine transitions before seeded goal selection.
- [x] End raccoon inspection after its bounded interest even if a player keeps holding the open tin. Turn away/look elsewhere before choosing another goal; unchanged lure is ignored briefly, and changed placement can restore interest. Test that a held tin cannot sustain inspect forever while a repeated reasonable setup can still earn a portrait.
- [x] Adapt `evaluatePhoto` to selected behavior commissions, three species' authored subject points and all shared occluders. Keep size/framing/line-of-sight requirements and the original combined portrait. The same frame can satisfy multiple selected requirements, but nonselected alternatives never silently replace assigned work.
- [x] Render distinct limb/head/ear reactions using named pivots. Replace hardcoded `completed.length === 3` / fixed notebook entries with `world.assignments`. Update hints to the current site and readable observations.
- [x] Run all rules/save checks and the build. Walk a visible outing with each species reacting to actual controls and photograph the selected states. Record any confusion or unreachable situation, not merely successful seed selection.

## Task 5: three recoverable sources of mischief

**Files:** modify `game.ts`, `encounters.ts`, `shared.ts`, `view.ts`, `main.ts`, `game.test.ts`, `encounters.test.ts`, `save.test.ts`; author the headwear and researcher assets.

**Interfaces:** reuse the `spills`, `hats`, `FieldProp.open` and existing cue/observation paths. No sabotage score or new action currency. Extend cue kinds only for a readable spill or hat event; include its actual player/source location through the existing safe message structure.

- [x] Add scenario tests: one sharp collision of an open case consumes at most one spare portion; a closed case never spills; a stolen hat is recoverable and drops by 1,800 ticks; accepted assignments remain unchanged after all three incidents.
- [x] Run `node --test wildly-unqualified/game.test.ts wildly-unqualified/encounters.test.ts` and record expected failures.
- [x] Trigger a spill only from meaningful case acceleration/contact while open, with a two-second per-case incident guard. Place one visible portion on the nearest supported surface. Add it to raccoon interest candidates; `E` retrieves an unconsumed pile into available supplies. Bound piles to eight, expire consumed/old piles and allow camp resupply when depleted.
- [x] Have the decoy's moved position and bait cup affect deer/raccoon interest through the ordinary wildlife rules. A teammate can restore or improve its position immediately. Unchanged lures lose interest; no hidden random sabotage roll or objective reset is introduced.
- [x] Telegraph a raccoon hat attempt with look/reach within 1.2 m. Move that owner's hat to the raccoon's attachment, allow close retrieval with `E`, and drop at a nearby reachable node within 30 seconds. Protect that owner for 60 seconds from immediate repeat theft. The owner retains camera/control/name/number at all times.
- [x] Render the separate hat models on their actual mounts, visible piles and case lid. Catch references to a removed player/animal during save validation and safe recovery. No permanent item disappearance is an acceptable joke.
- [x] Verify each incident in a visible multiplayer setup and save/restart midway through a hat chase. Run the focused tests and build; record seconds-to-recovery and any player-control loss.

## Task 6: immutable photographs and a finished shared exhibition

**Files:** modify `shared.ts`, `game.ts`, `view.ts`, `main.ts`, `server.ts`, `save.ts`, `style.css`, `game.test.ts`, `server.test.ts`, `save.test.ts`, `browser.ts`.

**Interfaces:** retain `capturePhoto(renderer, scene, frame, apply, restore): Promise<Blob>`. Both callbacks must now apply/restore props, hats, route geometry and any dynamic occluders, as well as characters and tin. Add one strictly parsed command:

```ts
type FavoriteMessage = {
  type: "favorite";
  seq: number;
  photoId: string;
  selected: boolean;
};
```

Include it in `ClientMessage`. Exclude it from the existing zero-payload `command` helper and use `send` with the structured fields. Only the authenticated player's favorite entry can change; at most four unique player IDs per photo.

- [x] Write a regression that freezes a frame, moves a prop/hat and opens the gate, then verifies the old frame remains unchanged. Add a socket test that rejects an unknown photo ID, an extra supplied player ID and replayed favorite sequence.
- [x] Run the affected Node tests before implementation. Preserve the existing rejection behavior for invalid JPEGs, photo ownership and trusted-server credit.
- [x] Freeze all visible world/prop/hat state in `makePhotoFrame`. Use that exact frame's collision/animal state for `evaluatePhoto`. Apply it to the capture renderer, restore live state in `finally`, and keep the static sky identical after reconnection. Include optional incident captions only when witnessed in the frame.
- [x] Persist per-player favorites in `PhotoRecord.favorites`; update notebook/exhibition from authoritative snapshots instead of local button toggles. Add clear completion/readiness feedback and a shared selection state without requiring a separate voting minigame.
- [x] Test return/end with all connected players, a disconnected slot and resumption after restart. In four-window layouts, room actions, readiness and exhibition controls must stay reachable without obscured click targets.
- [x] Capture actual 640×360 JPEGs containing forest, sky, equipment and a hat incident. Verify no HUD labels, correct restore, bounded upload size and shared display after restart. Run `npm.cmd run wu:test`, `npm.cmd run wu:build`, and the visible full-loop browser check.

## Task 7: finish the forest library and compose all three habitats

**Files:** complete all new version-3 files/GLBs in `assets/BRIEF-v3.md`; refine `level.ts`, `forest-view.ts`, `view.ts`, `assets/check.mjs`, `level.test.ts`.

**Interfaces:** use the exact 39 exported names and attachment contract in the asset brief. Every gameplay-relevant placement shares its manifest-derived proxy between physics, navigation and photo occlusion. Keep material names `CrewAccent` and required body/hat/handle pivots stable.

- [x] Finish eight mature tree silhouettes, large deadwood, banks/stone, floor detail, wetland vegetation and route landmarks in the visible Blender session. The representative composition from Task 2 establishes scale and finish. Preserve both old libraries and write a new v3 source scene, manifest and previews.
- [x] Verify the exact model count/names and bounds in the manifest; inspect grounded origins, articulation and openings with the real GLTFLoader. Run:

```powershell
npm.cmd run validate:glb -- wildly-unqualified/public/models/forest-kit-v3.glb wildly-unqualified/public/models/deer-v3.glb wildly-unqualified/public/models/researcher-forest-v3.glb wildly-unqualified/public/models/headwear-v3.glb wildly-unqualified/public/models/expedition-kit-v3.glb
node wildly-unqualified/assets/check.mjs wildly-unqualified/public/models wildly-unqualified/assets/manifest-v3.json
```

- [x] Compose varied stands of tall trees, forested outer silhouettes, canopy gaps and distinct banks. Place roots/deadwood around useful observation angles. Main paths and required approach sites remain clear. Re-run production movement along route segments after placement changes; do not accept cosmetic previews as collision evidence.
- [x] Inspect first-person camp, deep woodland, clearing, water and upward/horizon views. Compare adjacent tree variants, crew identification in shade, sky/fog agreement and equipment readability. Correct scale, repeated silhouettes or density problems before adding further decorations.
- [x] Measure real single-viewport frame time and memory/draw-call changes, including dense canopy and sky. Optimize repeated static instances/materials first. Record four-window contention separately; do not reduce the forest to small props to make a screenshot benchmark pass.
- [x] Run the relevant level/build/asset checks, save screenshots and update provenance with the actual authoring mechanism. The 39-model inventory remains incomplete until each entry is exported, integrated where applicable and inspected.

## Task 8: portable release and visible complete outings

**Files:** modify `release.ts`, `release.test.ts`, `browser.ts`, `README.md`, `SERVER.md`, `IMPLEMENTATION.md`, `VERIFICATION.md`; create new evidence files under `../.artifacts/wildly-unqualified/` without reusing the prototype's private data.

**Interfaces:** retain `buildRelease(destination)` and `startServer(config)`; default new release name/build marker is `forest-mvp-1`. Add `encounters.ts` to the explicit runtime allowlist. Static model/sky code is bundled into the release; no dependency on asset-authoring tools exists at runtime.

- [x] Run the focused release test with a new destination; confirm the import guard includes `encounters.ts`. Confirm no v1 scene/save/release hashes changed, and an MVP process refuses a version-1 data directory without rewriting it.
- [x] Build a fresh allowlisted release and start it from a different working directory using production-only dependencies and new port/data paths. Save a rule-earned photo, stop cleanly, transfer the complete MVP data directory and host recovery key, and verify restored state/album/favorites on a second local configuration. Do not claim home-server verification.
- [x] Run `npm.cmd run wu:test`, `npm.cmd run wu:build`, `npm.cmd run wu:format:check`, then the existing shared package tests/build/format gate once. Record commands and outcomes; do not repeatedly broaden green checks without a new issue.
- [x] Run two four-player outings with different seeds and one two-player outing in visible browsers. Use ordinary keyboard/buttons for progression; read-only diagnostics may support navigation but must be labeled. No teleportation, injected credit or forced animal state counts as end-to-end play. Exercise one run with `WU_LATENCY_MS=150`, plus actual HTTPS/WSS transport.
- [x] Each run covers join, crew recognition, both teamwork problem types, selected species commissions, recovery from each incident, actual shared JPEGs, camp return, exhibition, favorites and reconnect. Capture action/timing logs and final state. Record stalls, idle roles and whether the same solution dominates both seeds.
- [x] Close only the owned test browser profiles and verify their control connections are gone. Keep unrelated browsers and the user's Blender session intact.
- [x] Report technical completion separately from human duration, enjoyment and separate-network play. Human tests remain unmeasured until actual people are available; do not fabricate them or contact people without authorization. Update the launch/runbook around the new preserved MVP room, without exposing host credentials.

## Plan self-review

- [x] Covers the user's six prototype observations, physical co-op choice, light mischief, mature-forest correction, skybox and expanded assets.
- [x] Keeps one continuous forest: deep woodland, sunlit forest clearing and wooded wetland.
- [x] Includes 39 explicit model entries, visible authoring, current shader documentation and in-game visual checks.
- [x] Defines shared state before gameplay/client delegation and updates save/capture/release consumers together.
- [x] Preserves private admission, existing assets/concepts, portable hosting and the accepted prototype's saved outing.
- [x] Specifies actual tests and meaningful end-to-end evidence without claiming human playtime from agent runs.

The direction is approved. Execute these tasks with review checkpoints; no additional approval of the same forest correction or routine tool/workflow choices is needed.

Technical acceptance closed on 2026-09-05 local / 2026-09-06 UTC. The [current checkpoint](../../history/MVP-CHECKPOINT-2026-09-05.md) and [verification record](../../history/VERIFICATION.md) identify final build `index-C-4DfThH.js`, 111 passing game tests, the three completed visible outing chains and their preserved interruptions, final visual evidence, actual production-release migration and the fresh own-PC room. Human duration, enjoyment, contribution balance, separate-network human play and the inaccessible home server remain separate unmeasured gates.
