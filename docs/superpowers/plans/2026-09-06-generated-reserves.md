# Generated Reserves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved dense procedural forest, twelve wildlife species, six required/two optional photography objectives, peaceful audio and portable 40–60-minute expedition flow.

**Architecture:** A validated immutable reserve blueprint supplies geometry, wildlife anchors and commissions to the server, client, navigation and frozen photographs. Reuse current physics, low-poly models and explicit animal state machines; add only the world generator and native audio modules that have distinct responsibilities. The current schema-2 MVP remains available from its preserved release/data folder while schema 3 is developed.

**Tech stack:** Node >=26.5.0 <27, TypeScript 7.0.2, Three.js 0.185.1 WebGPU, Box3D 0.2.0 standard WASM, ws 8.21.3, Vite 8.2.2, node:test, Playwright 1.63.0 and visible Blender.

**Spec:** [Approved generated-reserves design](../specs/2026-09-05-wildly-unqualified-generated-reserves-design.md).

## Global constraints

- This repository contains only Wildly Unqualified. Private GitHub: `notmike101/wildly-unqualified`. Parent research, other games, credentials, private saves, local artifacts and generated builds stay outside tracked content.
- Make frequent commits between coherent verified changes and a commit at every milestone. Push intermediate branch checkpoints and milestone commits; independently verify privacy and remote/local SHA equality. No published-history rewrite.
- Target **40–60-minute outings**; human pacing and enjoyment remain unverified until real sessions establish them. Never use forced waiting or recovery chores to pad duration.
- Approximately **384 × 320 m**, **70% dense forest, 20% lighter woodland and 10% open ground**, with roughly five percentage points of seed variation. Dense stands target 70–90% projected canopy coverage and must look dense in real camera views.
- **12 species and 36–48 persistent, photographable individuals per reserve**. Species: raccoon, deer, heron, fox, rabbit, squirrel, beaver, otter, badger, owl, woodpecker, mallard. Decorative animals do not count.
- **Six required photo objectives and two optional objectives**, requiring at least five species including two added species, across at least five encounter areas. All twelve species must have supported objective templates.
- Four-metre equipment corridors and six metres of overhead handling clearance remain beneath the forest canopy. Validate full routes, alternate approaches, camera positions and recovery points.
- All new models are authored in **visible foreground Blender**, using new versioned source/export files. Preserve existing scenes and assets; claim MCP only when actually exercised. All browser gameplay tests are visible; close only owned test processes.
- Keep server authority, frozen scene photographs, JPEG upload limits, origin/session validation, safe atomic saves/backups, room credentials and portable self-hosting. No external AI runtime or paid service.
- Save schema 3, content `forest-expedition-1`; new private data directory. Blueprint <=1 MiB, save <=8 MiB, photos <=64 total and <=64 KiB each. Test the maximum combined payload.
- One shared tin, case, screen and decoy; each permanent crossing has its own local plank. One active hat incident, renewable local supplies, short recoveries and no four-person-only locks.

## Workspace, commit ownership and evidence

The game-only baseline is `70415e2` (tag `forest-mvp-1-baseline`); standalone build/lock/types are `cbbf7c9`. Both were pushed privately. A fresh clone outside the parent tree passed install, build and all 111 tests. Development uses branch `feat/generated-reserves` in `.worktrees/expedition`.

Controller owns integration order and pushes. Each worker stages only its assigned files and commits after focused verification. Independent workers may author disjoint files, but do not format/test files while another worker is mutating them. Cross-cutting integration tasks execute sequentially. Never reset another worker's changes. Baseline test evidence is reusable for unchanged files; rerun focused checks after actual changes and full gates at milestone boundaries.

Keep the tracked high-level record in `docs/superpowers/plans/2026-09-06-generated-reserves-progress.md`; task briefs/reports and detailed logs live in ignored `.superpowers/sdd/2026-09-06-generated-reserves/`. Write every material ruling and its consequence to the record. Existing local evidence under the parent `.artifacts` folder is historical; do not copy private runs into Git.

## Shared interfaces

Task 1 owns `world.ts`. Use the existing `Vec3`, `Pose`, `Box`, `Walkable`, `WorldPlacement` and `NavNode` primitives. New runtime state will use the blueprint's stable IDs; it must not address an animal by species or a route by one global boolean.

```ts
export const RESERVE_SPECIES = [
  "raccoon",
  "deer",
  "heron",
  "fox",
  "rabbit",
  "squirrel",
  "beaver",
  "otter",
  "badger",
  "owl",
  "woodpecker",
  "mallard",
] as const;
export type ReserveSpecies = (typeof RESERVE_SPECIES)[number];
export type Anchor = {
  id: string;
  point: Vec3;
  kind:
    | "ground"
    | "water"
    | "perch"
    | "wash"
    | "feed"
    | "rest"
    | "retreat"
    | "passage"
    | "cache"
    | "den";
  links: string[];
};
export type Resident = {
  id: string;
  species: ReserveSpecies;
  home: string;
  spawn: Vec3;
  anchors: string[];
  group: string | null;
};
export type Commission = {
  id: string;
  required: boolean;
  kind:
    | "behavior"
    | "setup"
    | "composition"
    | "passage"
    | "pair"
    | "cameo"
    | "incident";
  subjects: string[];
  pocket: string;
  anchor: string | null;
  landmark: string | null;
  behavior: string | null;
  title: string;
  instructions: string;
};
export type Fixture = {
  id: string;
  kind: "gate" | "crossing";
  position: Vec3;
  yaw: number;
  closedBoxes: Box[];
  openSurfaces: Walkable[];
  seats: Record<string, Pose>;
  plankId: string | null;
  latch: Vec3 | null;
};
export type ReserveBlueprint = {
  id: string;
  content: "forest-expedition-1";
  seed: number;
  attempt: number;
  bounds: Box;
  camp: Vec3;
  tinStart: Vec3;
  pockets: {
    id: string;
    habitat: "woodland" | "clearing" | "wetland";
    position: Vec3;
    anchors: Anchor[];
  }[];
  stations: { id: string; position: Vec3; recover: Vec3 }[];
  density: {
    id: string;
    min: Vec3;
    max: Vec3;
    kind: "dense" | "light" | "open";
  }[];
  placements: WorldPlacement[];
  walkables: Walkable[];
  waters: Box[];
  trails: { id: string; points: Vec3[]; width: number }[];
  navNodes: NavNode[];
  walls: Box[];
  physicsBoxes: Box[];
  fixtures: Fixture[];
  residents: Resident[];
  commissions: Commission[];
  props: {
    id: string;
    kind: "case" | "plank" | "screen" | "decoy";
    pose: Pose;
  }[];
};
export function generateReserve(
  seed: number,
  worldId: string,
): ReserveBlueprint;
export function validateReserve(value: unknown): ReserveBlueprint;
export function reserveHash(world: ReserveBlueprint): Promise<string>;
```

`worldId` is a fresh outing ID supplied by the server, even if a seed repeats. Generation is deterministic for `(seed, worldId)`; layout comparisons can ignore `id`. `reserveHash` uses native Web Crypto SHA-256 over the validated JSON representation. Persist the resolved blueprint and ID. Do not regenerate an existing save with current code.

Task 4 makes `shared.ts` export the twelve-species union and uses commission instance IDs for credit/completion. The wire protocol adds one `{type:'world', id, hash, blueprint}` message at join/outing change; snapshots and all gameplay commands include `worldId`. Existing welcome/session admission remains separate. Photo IDs include the outing ID. Unsupported/mismatched world messages stop prediction and request refresh rather than using stale geometry.

## Task 1: Validated procedural world data

**Files:** create `world.ts`, `world.test.ts`; modify `level.ts` only to export existing placement/geometry helpers needed by generation. Do not change live state or rendering yet.

**Consumes:** static asset/prop definitions, imported primitive types and current surface/collision helpers. **Produces:** all shared world interfaces above and a deterministic complete blueprint.

- [ ] Write and run the failing seed/constraint test before implementation:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { generateReserve, validateReserve, RESERVE_SPECIES } from "./world.ts";
test("generated reserves contain reachable diverse commissioned wildlife", () => {
  for (const seed of [
    0,
    1,
    0xffffffff,
    ...Array.from({ length: 256 }, (_, i) => i * 65537),
  ]) {
    const world = generateReserve(seed, "seed-check");
    assert.deepEqual(validateReserve(structuredClone(world)), world);
    assert.deepEqual(generateReserve(seed, "seed-check"), world);
    assert.equal(
      new Set(world.residents.map((a) => a.species)).size,
      RESERVE_SPECIES.length,
    );
    assert.ok(world.residents.length >= 36 && world.residents.length <= 48);
    const required = world.commissions.filter((c) => c.required);
    assert.equal(required.length, 6);
    assert.equal(world.commissions.length, 8);
    assert.ok(new Set(required.map((c) => c.pocket)).size >= 5);
    const used = new Set(
      required
        .flatMap((c) => c.subjects)
        .map((id) => world.residents.find((a) => a.id === id)!.species),
    );
    assert.ok(used.size >= 5);
  }
});
```

Run `node --test world.test.ts`; expected initial failure: missing module/export. Then implement the complete generation/validation path, not a constant test fixture.

- [ ] Use a small seeded PRNG, 64 m cells, quarter turns and authored module anchors. Reserve trail/camera/handling corridors first. Connect eight main habitats with a connected graph and two useful return loops; water/gates have valid fallbacks. Place two stations and local crossing planks.
- [ ] Compose dense/light/open zones with broad connected stands. Instantiate existing mature-tree models outside protected bounds. Derive movement, occlusion and physics from the same transforms. Keep saved data within 1 MiB; repeated model collision definitions can be derived from the versioned asset catalog rather than redundantly embedded per submesh.
- [ ] Populate 36–48 residents across all twelve species and their ground/perch/water anchors. Bind the six-plus-two commissions only after validating their prerequisites. Include at least five species and five required pockets, with meaningful different tools and local compatible pairs.
- [ ] Validate finite numbers, bounded strings/counts, known models/species, unique IDs, legal references, supported anchor transitions, every required camera approach, carrying corridor, detour and recovery point. Reject malformed data and unreachable objectives. Generation retries are bounded/deterministic and failure is explicit.
- [ ] Extend `world.test.ts` with real graph traversal/clearance checks, high-bit seed diversity, wrong references, out-of-bounds objects, missing tool/subject, blocked entrance, invalid density and oversized data. Use production geometry, not a duplicate generator in tests.
- [ ] Run focused tests, `npm run build`, and the full suite after exports change. Commit `feat: generate validated dense reserve blueprints`; report actual seed coverage and any limits.

## Task 2: Nine wildlife models and their habitat props

**Files:** create `assets/author-v4.py`, `assets/wildlife-shapes-v4.py`, `assets/library-v4.blend`, `assets/manifest-v4.json`, `assets/check-v4.mjs`, `assets/PROVENANCE-v4.md`, previews, `public/models/wildlife-kit-v4.glb`, `public/models/wildlife-habitat-v4.glb`. Preserve every version-1/2/3 path.

**Consumes:** original `assets/author.py` helpers and established metre/Y-up/forward-minus-Z export convention. **Produces:** individually addressable roots `Fox`, `Rabbit`, `Squirrel`, `Beaver`, `Otter`, `Badger`, `Owl`, `Woodpecker`, `Mallard`; habitat roots `BeaverLodge`, `BranchPile`, `BadgerDen`, `SquirrelCache`.

- [ ] Inspect the existing Blender window and source before use. Save work only to a new v4 scene. Keep Blender visible and foreground during staged modeling. Use actual Blender geometry/export operations; never `--background` or pretend MCP exists.
- [ ] Define a manifest/check contract before modeling: exact roots, metre bounds, positive applied scale, grounded origins, at least head/body photograph attachment points, semantic `partName`, and per-species animation pivots. Quadrupeds need body/head/legs/tail; squirrel needs forepaws; beaver a broad flat tail; birds need body/head/wings plus feet or trunk-cling points.
- [ ] Verify the empty/unbuilt contract fails, then create representative fox, squirrel and owl models and inspect them at researcher scale. Continue through the other six species, showing actual staged work and recognizable silhouettes. Recolors cannot supply distinct species.
- [ ] Build lodge/branch pile, den entrance and cache detail. Den openings need hollow geometry/proxies; wildlife props do not add terrain destruction or a crafting inventory.
- [ ] Export stable local roots, meshes and pivots, and record source/export hashes and dimensions. Validate each GLB using installed `gltf-validator` and actual `GLTFLoader`, including `userData.partName` suffix handling. The checker must compare exported geometry/bounds and attachments against the manifest and require all nine species.
- [ ] Render a full gallery and action-pose contact sheet for inspection. Save the actual visible Blender scene. Commit in coherent model groups, then milestone `feat: add nine distinct forest wildlife models and habitat props`. Final in-game animation/collision acceptance follows Tasks 4–5.

## Task 3: Native soundscape module and licensed samples

**Files:** create `audio.ts`, `audio.test.ts`, `public/audio/manifest.json`, selected audio files, `assets/audio/PROVENANCE.md` and any original synthesis source. Do not edit `main.ts`, `view.ts` or `shared.ts` during this independent task.

**Produces:**

```ts
export type AudioSettings = {
  master: number;
  effects: number;
  ambience: number;
  music: number;
};
export type AudioCue = {
  id: string;
  kind: string;
  position: [number, number, number];
  species?: string;
  material?: string;
};
export function createAudio(): {
  unlock(): Promise<void>;
  settings(value: AudioSettings): void;
  listener(
    position: [number, number, number],
    forward: [number, number, number],
  ): void;
  environment(value: {
    habitat: "woodland" | "clearing" | "wetland";
    waterDistance: number;
  }): void;
  cue(value: AudioCue): void;
  pause(value: boolean): void;
  dispose(): void;
};
```

- [ ] Acquire only selected files with verified CC0 source/license evidence from the spec, or generate original material without borrowed samples/melodies. Capture creator/source/download URL, license, source/delivery hash, edits and loop points. Inspect archives; omit unused packs and commercial-game music.
- [ ] Test cue selection, duplicate IDs, finite settings and lifecycle behavior before implementing those branches. Run `node --test audio.test.ts`; record actual red and green evidence. Keep browser-only native audio creation deferred until a user gesture.
- [ ] Implement one AudioContext, master/effects/ambience/music gains, cached short buffers, finite positional audibility and native panners. At most 12 effects/two ambience beds; music starts disabled. Avoid immediately repeated footstep variants and doubled distance attenuation. Do not change authoritative animal noise behavior.
- [ ] Support quiet wind/birds/local water and distinct shutter, whistle, tin, wood, surface steps and useful species/action cues. Original synthesis can fill missing small effects; keep the source and actual audible review status. No claim of listening based on waveform analysis alone.
- [ ] Pause on disconnect/hidden state; resume one set of loops without replaying missed events. Dispose nodes/timers; failed fetch/decode/autoplay degrades to captions without stopping gameplay.
- [ ] Run focused tests, compile and asset-license manifest checks. Commit `feat: add native forest audio and documented sound assets`. Visible gesture, listening and actual spatial acceptance happen in Task 7.

## Task 4: Run one generated world through the actual game

**Files:** `shared.ts`, `game.ts`, `encounters.ts`, `physics.ts`, `save.ts`, `server.ts`, `main.ts`, `view.ts`, `forest-view.ts`, `level.ts`, `release.ts`; corresponding existing tests. Depends on Task 1; use Task 2 assets when ready. This is the one owner of cross-cutting runtime migration.

**Consumes:** `ReserveBlueprint`, residents/fixtures/commissions and current game rules. **Produces:** schema-3 runs, one world message per join, world-scoped snapshots/commands/photos, a playable generated reserve and exact restored geometry.

- [ ] Add failing integration cases showing two independently generated worlds cannot share movement walls, navigation cache, spawn/patch positions or photo occluders. Exercise real production calls: `createRun`, `advanceRun`, `makePhotoFrame`, `evaluatePhoto`, `attachPhysics`, save/load and actual sockets.
- [ ] Replace runtime global geometry imports with the run's blueprint. Keep static asset/prop constants in `level.ts`. All consumers use the same placements/walkables, fixtures and world identity. Rebuild the view/physics only on world change, not each snapshot; key navigation by actual world plus fixture state.
- [ ] Server creates a unique outing ID with its random seed, validates the generated blueprint, calculates its hash and sends `{type:'world', id, hash, blueprint}` after authenticated welcome. Snapshots carry the world ID and mutable state. Reject stale commands; namespace cues/photos. The client gates movement/capture on its matching loaded world.
- [ ] Split animal identity from species; give tin/hat carriers explicit IDs, patch portions by anchor ID, fixtures by fixture ID and props by their generated IDs. Create all 36–48 residents and render their species roots. Persist all resident memory and release stale grips/inputs safely.
- [ ] Use schema 3/content `forest-expedition-1`, exact saved blueprint and strict reference validation. Reject schema 1/2 without changing it. Frozen frames contain the world ID and capture-time state, with one saved blueprint. Validate the matching world before both rule checks and image reconstruction.
- [ ] Adapt client prediction, generated notebook map, landmarks, camera markers, labels, photo bounds, water mesh, sky/shadows and forest batching. Spatially group tree instances; protect ground corridors beneath crowns and retain readable shade. No synchronous full-world rebuild in a frame loop.
- [ ] Validate boundary cases and current security/physics contracts with the updated existing suites, run full tests/build, and inspect a visible client at camp/dense canopy/clearing/water before milestone `feat: run authoritative generated reserves end to end`. Do not call the full loop complete until Task 5 passes.

## Task 5: Species routines and the complete expedition loop

**Files:** `encounters.ts`, `game.ts`, `shared.ts`, `world.ts`, `view.ts`, `main.ts`, `level.ts` and associated tests. Depends on Tasks 1, 2 and 4.

**Produces:** all twelve distinct routines, ground/perch/water movement, six required/two optional instance-bound photo goals, local stations and regular recoverable cooperation.

- [ ] First write a failing test per genuinely different movement/behavior family: grounded food/stalking passage, climb/perch transition, swimming/surfacing. Use actual world anchors and ticks; do not force a passing behavior value into the run. Run the focused tests and record the failure before adding behavior.
- [ ] Add fox stalk/pounce, rabbit freeze/bound, squirrel climb/cache, beaver branch work, otter surface/groom, badger sniff/dig, owl roost/perch flight, woodpecker cling/tap and mallard paddle/preen. Share movement/perception helpers, not identical responses under different names. All path transitions remain bounded and unobstructed, with local retries after disturbance.
- [ ] Drive the v4 pivots from actual immutable behavior/tick state; use species-specific subject points and low/overhead/water camera approaches. Resolve semantic imported names through the established helper. Every action must be visible in an actual JPEG.
- [ ] Evaluate commission instances against bound residents, anchor/landmark, behavior and geometric framing. Add landmark composition and track-led passage evidence. At least five species/two new species participate per outing; all twelve have reachable templates across seeds. Multiple legitimate credits can come from one excellent photograph.
- [ ] Integrate two nearby tasks using different tools on each loop; one tin/case/screen/decoy, locally supplied permanent planks, two refill/recovery stations, reachable detours and safe returning-player positions. Gate completion on the six required IDs only; optional cameo/mishap goals never block return/exhibition.
- [ ] Preserve one active hat incident/repeat protection and causal spills. Far-away actors retain identity and state with bounded less-frequent decisions; four split players must activate their regions. No invisible replacement population, cross-map escort requirement or compulsory wait timer.
- [ ] Exercise actual movement/commands to reach every photo family, disturbance/retry, disconnect and resource exhaustion/replenishment. Run full tests/build, then a visible two-player complete loop with captured photographs. Commit coherent species/goal groups and milestone `feat: complete varied wildlife photography expeditions`.

## Task 6: Bounded albums and safe next-reserve transitions

**Files:** `game.ts`, `save.ts`, `server.ts`, `shared.ts`, `main.ts`, `index.html`, tests. Depends on Tasks 4–5.

**Produces:** unified 64-photo retention, protected credits/favorites, extras download/deletion, host-only next reserve and preserved private archives.

- [ ] Add failing tests for eight separately credited pictures plus extras, all extra slots favorited, pending-frame mixtures, failed archive/save and stale old-world actions/uploads. Use the real serialized save boundary and temp directories; never live data.
- [ ] Apply one shared total/cap policy to runtime, upload, validator and UI. Reserve eight credit slots; retain at most 56 extras, evict only old uncredited/unfavorited extras, and show preview-only status if favorites fill the extra allocation. Earned credit can always be retained. Remove bytes/frames consistently when an eligible extra is removed.
- [ ] Add `next-reserve` as a host-only action in exhibition, refused while any capture is pending. Stop mutation/admission, drain old saves, archive the completed run under its unique ID, generate/validate a new world, durably write it and then swap live state. Preserve identities/credentials and enter camp paused.
- [ ] Reuse a matching archive on retry; refuse a mismatched one. A generation, archive or save failure leaves the previous outing usable. Old uploads/commands cannot refer to new photos. Never overwrite archives or silently delete a failed save.
- [ ] Measure maximum 48-resident/64-photo/blueprint payloads against 8 MiB; preserve validation limits and explain an explicit failure if data cannot fit. Test atomic retry, crash boundaries and copied-directory relocation with authentic sessions and images. Commit `feat: preserve expedition albums and safely start the next reserve`.

## Task 7: Integrate and audibly verify the forest soundscape

**Files:** `main.ts`, `view.ts`, `index.html`, `style.css`, `audio.ts`, `server.ts` cue metadata where justified, tests and audio provenance. Depends on Tasks 3–5.

- [ ] Connect `createAudio()` to Join/Continue gesture, saved settings, predicted camera listener, actual world habitat/water and deduplicated authoritative cues. Remove the old oscillator player and its nonzero distant-volume floor.
- [ ] Add effects/ambience/music controls with accessible labels; music defaults off. Preserve the master preference and captions. Supply actual species/material metadata for relevant events, with quiet local shutter/UI effects.
- [ ] In a visible production client, use ordinary controls to unlock, mute, turn/walk around sound sources, pause/reconnect and return from a hidden page. Verify one set of loops, absolute mute, bounded sources and no replay of missed cues. Four-browser tests keep only the intentionally auditioned listener audible through user-facing settings.
- [ ] Listen to each selected cue and a sustained mix; inspect clipping/loop seams and ensure music leaves quiet space. Document exactly what was heard and by whom; do not convert a successful decoder into a listening claim. Critical game information remains visible with sound muted.
- [ ] Verify license/credit payloads in the portable release, compile/test and measure decoded memory. Commit `feat: integrate adjustable positional forest audio`.

## Task 8: Full visible acceptance and portable release

**Files:** update `browser.ts`, `release.ts`/test, `README.md`, `SERVER.md`, `VERIFICATION.md`, a new expedition checkpoint; local evidence is ignored. Depends on Tasks 1–7.

- [ ] Update the existing ordinary-input browser driver for generated maps/objectives and four active roles. Use snapshot/geometry reads only to guide normal keys/buttons. No injected movement, teleports, unlocked goals or artificial credits. Run one two-player and two different four-player outings; one four-player run uses real HTTPS/WSS and the existing 150 ms delay path.
- [ ] Each run completes six required goals, obtains real JPEGs, uses regular co-op equipment, recovers mischief, returns the connected crew, exhibits/favorites, restarts/reconnects and starts a different reserve. Record interruptions and failures honestly; rotate tasks and flag unavoidable idle time over 90 seconds.
- [ ] Inspect all twelve species' real rendered poses/photos, dense forest default and open contrast, clear equipment routes, water/sky, names and colors. Run 256-seed constraints plus edge cases. Test all target anchors and two simultaneous worlds.
- [ ] Measure a moving dense-forest viewport and four separated players at maximum population. Report frame intervals, server steps, network/memory and four-window contention separately; optimize spatial batching/decision frequency without cutting the approved forest/species/population scope.
- [ ] Run `npm test`, `npm run build`, `npm run format:check`, v4 asset checks and `npm run release`. Install the release in a fresh location with `npm ci --omit=dev`. Relocate a copied private run to another local port/origin and verify world hash, JPEG bytes, favorites, supplies and resumed behavior. Preserve original data hashes.
- [ ] Document human duration/fun/listening gates still unverified by automation. Provide the own-PC playable room, private access instructions and portable release after verified acceptance; preserve the old MVP. Close only owned test browsers and temporary listeners.
- [ ] Obtain whole-branch review, resolve actionable findings, commit the milestone, merge the approved expansion into main when gates pass, tag `forest-expedition-1`, push and verify private visibility plus remote SHA. Do not claim the inaccessible home server was tested.

## Dependency and review order

Tasks 1, 2 and 3 can run independently in their assigned files. Task 4 follows Task 1; Task 2 may continue its visible asset work while Task 4 uses the ready exports. Task 5 waits for the completed models and generated runtime. Tasks 6 and 7 follow the gameplay integration and must coordinate their shared `main.ts`/protocol edits sequentially. Task 8 is the final acceptance gate. Each task gets a focused spec/quality review of its actual commit range; tests reported on unchanged reviewed code need not be rerun by a reviewer.

Implementation is authorized. Routine conflicts are resolved and logged; do not ask the user whether to continue between tasks.
