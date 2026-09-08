# Maintaining Wildly Unqualified

This is the current source map. The dated MVP checkpoints and OMP handoffs are historical evidence and unfinished-work references. They do not describe a fully accepted expansion. The responsibility-based layout changes file locations and tooling paths, not game rules, save formats, or wildlife routines.

## Directory boundaries

Vite uses the root `index.html` and bundles `src/client/main.ts` into ignored
`dist/`. Static model/audio URLs remain in `public/`; `assets/` contains
editable authoring sources and provenance, not browser modules. Original versioned
assets and the preserved `web/` / `web-mvp/` builds have not moved.

| Directory | Responsibility |
| --- | --- |
| `src/client/session/` | Admission, HTTP requests and local preferences |
| `src/client/ui/` | HUD, notebook and styles |
| `src/client/rendering/` | Graphics, scene/model lifetime, interpolation and photo capture |
| `src/client/audio/` | Audio engine and retained sound feedback |
| `src/server/` | Server entry point, configuration and HTTP helpers |
| `src/server/persistence/` | Atomic saves, credentials and save validation |
| `src/server/simulation/` | Authoritative game state, rules, physics and scoring |
| `src/server/simulation/wildlife/` | Animal decisions, navigation and encounters |
| `src/shared/world/` | Reserve generation/validation, level and collision catalogs |
| `src/shared/wildlife/` | Shared animal poses and measured geometry |
| `src/shared/shared.ts` | Wire contracts, command validation and shared calculations |
| `src/types/` | External declarations |
| `tests/` | Tests grouped by owner, integration scenarios, E2E and helpers |
| `scripts/` | Release tooling |
| `docs/history/` | Earlier checkpoints, runbooks and verification records |

Client/shared runtime modules must not depend on server modules. Server simulation
uses shared geometry; rendering uses the same geometry without importing server
state or filesystem/network services. Keep relative imports and existing public
exports; do not add aliases or duplicate barrel modules just to shorten paths.

The portable release and browser snapshots use `copyRuntime` in
`scripts/release.ts`, which checks local imports with the already-installed
TypeScript compiler API and copies only the explicit runtime allowlist with its
nested paths. Frozen browser evidence may still have the older flat runtime;
the driver detects that entry point when resuming it. Adding a server/shared
runtime dependency requires updating the allowlist and release-content test.

Server-relative paths resolve against the game root, not `src/server/` or the
shell working directory. In a portable release that root is `wildly-unqualified/`.
See [the server guide](SERVER.md) for source/portable startup commands.

## Follow a game action

1. `src/client/main.ts` connects input, session state, prediction, and rendering. Browser components receive the state or callbacks they need; they do not import the entry point. Admission callbacks read current state after asynchronous requests, rather than retaining a stale snapshot.
2. `src/server/server.ts` owns the room, HTTP/WebSocket lifecycle, authoritative tick loop, and persistence scheduling. `src/server/server-http.ts` provides bounded request parsing, safe paths, tokens, and responses. `src/shared/shared.ts` defines wire messages, validates commands, and supplies shared geometry.
3. `src/server/simulation/game.ts` is the compatible public API. `src/server/simulation/game-commands.ts` applies player commands; `src/server/simulation/game-simulation.ts` advances the run. Both use `src/server/simulation/game-support.ts` for shared run operations and `src/server/simulation/equipment.ts` for grips, swept movement, seating, release, and recovery. Their caches remain keyed by run identity.
4. `src/server/simulation/wildlife/encounters.ts` schedules and dispatches wildlife decisions. Navigation, shared behavior, raccoon behavior, and species routines have separate modules listed below. `src/shared/wildlife/wildlife.ts` supplies calibrated poses and sight checks; `src/shared/wildlife/wildlife-data.ts` and `src/shared/wildlife/support-meshes.ts` retain measured asset data. Existing incomplete behavior remains documented below.
5. `src/server/simulation/game-snapshot.ts` copies snapshots and freezes photo frames. `src/server/simulation/photo.ts` scores those frames independently of later live movement. `src/client/rendering/photo-capture.ts` produces the image and restores renderer state. The live view owns its scene resources; extracted scenery creation still registers materials with that owner so disposal remains complete.
6. `src/server/persistence/save.ts` owns file IO, serialized atomic replacement, backups, and room credentials. `src/server/persistence/save-validation.ts` validates complete runs and photographs using the entity validators in `src/server/persistence/save-values.ts`. `scripts/release.ts` retains an explicit portable runtime allowlist.

## Where to make a change

| Change | Modules |
| --- | --- |
| Run creation, crew admission/disconnection, physics lifetime | `src/server/simulation/game-lifecycle.ts` |
| Player command rules | `src/server/simulation/game-commands.ts` |
| Per-tick movement, equipment, and wildlife scheduling | `src/server/simulation/game-simulation.ts` |
| Spawn safety, carried tin, release, recoverable incidents | `src/server/simulation/game-support.ts` |
| Server-only state and bounded event/observation bookkeeping | `src/server/simulation/game-state.ts` |
| Animal paths, collision checks, walking, and recovery positions | `src/server/simulation/wildlife/animal-navigation.ts` |
| Animal memory and habitat lookup | `src/server/simulation/wildlife/animal-context.ts` |
| Shared animal goals, disturbance, and lure approaches | `src/server/simulation/wildlife/animal-behavior.ts` |
| Raccoon investigation, theft, and washing | `src/server/simulation/wildlife/raccoon.ts` |
| Species-specific routine stages and transitions | `src/server/simulation/wildlife/animal-routines.ts` |
| HUD status, equipment prompts, camera guidance | `src/client/ui/hud.ts` |
| Observations, album controls, reserve map | `src/client/ui/notebook.ts` |
| Join form and host slot reassignment | `src/client/session/client-admission.ts` |
| Same-origin JSON requests and HTTP error status | `src/client/session/client-api.ts` |
| Preferences and key binding controls | `src/client/session/client-settings.ts` |
| WebGPU device, viewport, and device-loss handling | `src/client/rendering/client-graphics.ts` |
| Render-only snapshot interpolation | `src/client/rendering/client-interpolation.ts` |
| Model loading and transient-load retries | `src/client/rendering/view-assets.ts` |
| Static signs, markers, tracks, branch piles | `src/client/rendering/view-scenery.ts` |
| Actor/equipment updates and scene lifetime | `src/client/rendering/view.ts`; forest terrain/shadows in `src/client/rendering/forest-view.ts` |
| Camera range and crew colors | `src/client/rendering/view-constants.ts` |
| Forest audio / retained MVP feedback sounds | `src/client/audio/audio.ts` / `src/client/audio/legacy-sound.ts` |
| Environment settings and private/public directory separation | `src/server/server-config.ts` |

The acceptance driver is also separated: `tests/e2e/browser.ts` owns setup, failure evidence, and cleanup; `tests/e2e/browser-navigation.ts` owns read-only guidance and ordinary keyboard/button navigation; `tests/e2e/browser-outing.ts` retains the historical outing scenario. Its context contains the existing shared evidence arrays and callbacks. Restart status is a getter so browser event callbacks see the current value. Importing the navigation or scenario modules does not launch a server or browser.

## Follow a reserve

| Module | Responsibility |
| --- | --- |
| `src/shared/world/world-data.ts` | Blueprint types, species/routine data, resident names, commission descriptions. |
| `src/shared/world/world-geometry.ts` | Shared placement, terrain, fixture, corridor, camera, and canopy calculations. |
| `src/shared/world/world-validation.ts` | Complete blueprint validation, freezing, and hashing at trust boundaries. |
| `src/shared/world/world.ts` | Seeded generation, trails, commission binding, and bounded generation retries. |
| `src/shared/world/level.ts` | Generated fixture geometry and compatible public exports for the catalog. |
| `src/shared/world/level-data.ts` | Equipment dimensions, rules, and retained MVP landmark constants. |
| `src/shared/world/forest-models.ts` | Authored model collision catalog and placement transforms. |
| `src/shared/world/legacy-level.ts` | Preserved MVP forest layout, trails, and route geometry. |
| `src/shared/world/subject-geometry.ts` | Articulation and photo subject geometry shared by rendering and scoring. |

Existing callers can continue importing the public reserve API from `src/shared/world/world.ts` and run/photo API from `src/server/simulation/game.ts`. Their exports forward to the extracted modules. Internal reserve modules depend on data and geometry directly, avoiding a runtime dependency back into the generator. Server state imports in equipment and encounter code are types, not runtime initialization dependencies.

The extracted modules form no local runtime import cycles. Prefer importing a specific implementation module inside a subsystem; keep the compatible API modules for existing callers. Keep application startup in `src/client/main.ts`, `src/server/server.ts`, or `tests/e2e/browser.ts`, rather than adding startup side effects to reusable modules.

Keep world generation deterministic. Generation and validation deliberately share the same geometry calculations. Keep validation at the network/save boundary, authoritative commands on the server, and photographs frozen before asynchronous image capture. Do not regenerate a saved outing from its seed in place of its validated blueprint.

## Local checks

Use the existing pinned dependencies and Node 26.5+ within major 26, from the game repository root:

```sh
pnpm install --frozen-lockfile
npm run build
npm run format:check
npm run lint
npm test
```

Tests live under `tests/client`, `tests/server`, `tests/shared`, and `tests/integration`, with the visible browser driver under `tests/e2e` and reusable test helpers under `tests/helpers`. The npm test glob discovers all `tests/**/*.test.ts`; historical handoff drafts are excluded. `tests/server/game.test.ts`, the `tests/integration/expedition-*.test.ts` files, and `tests/shared/world.test.ts` exercise the extracted code through its existing public API. `tests/integration/release.test.ts` checks the portable package's exact runtime contents, including the new server modules. When adding a runtime module, update the allowlist in `scripts/release.ts` and its expectation in `tests/integration/release.test.ts`. Browser-only modules are included by the existing build.

The complete suite includes a large deterministic seed sweep and takes several minutes on the development machine. `npm run test:browser` is the existing visible gameplay driver and uses port 4320 by default (override `WU_TEST_PORT` and set a matching `WU_TEST_URL`); its historical acceptance results are separate from the Node suite. Current test repairs and dated prior checks are recorded below.

## Test suite repair — 2026-09-07

The starting suite had 206 tests: 191 passing and 15 failing. After the repairs,
`npm test` passes **209/209**, with zero skipped, cancelled or TODO tests, in
225.906 seconds. `npm run build` (including typecheck) and `npm run lint` pass;
Vite still reports its existing large-bundle warning.

- Album retention now permits 56 extras plus eight separately credited photos,
  protects favorites and credits, and evicts the oldest eligible extra. Saturated
  protected albums produce previews without an upload obligation. Save validation
  rejects excess extras, repeated credits across photos, and credits absent from
  the completed ledger. The shutter also enforces the total 64-photo bound.
- Upload rollback restores a pending frame only if its album record still exists.
  A real socket/upload regression gates the filesystem write, creates an actual
  filesystem obstruction, and proves eviction survives the failed save and rejoin.
- Deer investigations remain stationary around an unchanged reachable decoy until
  interest expires. The regression checks pose stability, expiry and relocation.
- Wildlife fixtures now observe actual bounded transitions and shared bait use.
  They retain exact-resident credit, food-removal, theft, recovery and framing
  checks; supported Mallard behavior and legitimate optional cameos are tested
  explicitly. Relocation waits for the snapshot it reads, rather than just welcome.
- Portable releases now copy `pnpm-lock.yaml` and `pnpm-workspace.yaml`. The release
  test, frozen-lockfile production installation, health and HTML checks pass.

This result covers the complete Node suite, not the separate historical visible
browser outing. That driver still needs input-capture and generated-scenario
migration. A diagnostic run verified ordinary JPEG upload, equipment handles,
lid controls, shared carry, release and spill creation, then stopped at pointer
capture throttling. Both owned browsers and the server closed. Unfinished driver
changes were removed from the working tree and retained in the ignored
`.artifacts/tests-passing/browser-investigation.patch` for continuation.

Full test logs and lint evidence are under `.artifacts/tests-passing/`; browser
failure and cleanup evidence is under
`.artifacts/wildly-unqualified/mvp-2026-09-05/outing-2p-0ms-1788832644938/`.
The dated records below preserve their historical results.

## Responsibility-based layout verification — 2026-09-07

The approved [layout design and exact move manifest](superpowers/specs/2026-09-07-project-layout-design.md)
cover 82 existing files and the new isolated-runtime regression test. The original
README and MVP server guide are also retained in `docs/history/`. Public assets,
editable authoring files, package lock and pinned dependencies are unchanged.

After normalizing import paths, formatting and trailing import commas, the
executable syntax of **50 runtime TypeScript files is unchanged**. The two
intentional runtime adaptations are the game-root path anchor in
`src/server/server-config.ts` and the reusable command-line startup function in
`src/server/server.ts`. Independent review found no unresolved imports or
client/shared dependencies on server code.

| Check | Observed result |
| --- | --- |
| Production build and TypeScript check | Pass; existing large-bundle warning remains |
| Recursive formatting check | Pass |
| Recursive documentation lint | Pass |
| General Airbnb lint | 1,510 errors and 17 warnings; pre-existing style debt remains |
| Full Node test suite | 206 tests: 192 pass, the same 14 existing failures; none skipped |
| Final runtime-copy, release and save tests | 19/19 pass |
| Independent release, runtime-copy and audio tests | 22/22 pass |
| Production-only portable installation | Three runtime packages installed, no TypeScript or Vite |
| Portable launcher from a different working directory | Health, HTML, JS, CSS, model assets, authenticated WebSocket, relative data path, save-and-stop pass |

The isolated baseline was commit `9b62155`. Build, formatting and documentation
lint passed; general lint had 1,511 errors and 17 warnings. Its initial full test
run measured 205 tests, 190 passing and 15 failing because build and tests were
started concurrently and the release test raced the first build. That release
test passed when rerun after the build. Excluding that harness race leaves the
same 14 named expansion failures as the post-move run; the full corrected
191/14 baseline total is derived, not a separately repeated measurement.

The new isolated-runtime check failed before `copyRuntime` existed and passes
afterward. It imports the copied server without source files alongside it,
checks default and relative configuration roots and overlap rejection, serves
an isolated page, and verifies that source and private room files are inaccessible.

Two visible Edge clients joined and rendered through real WebGPU with no page
errors or final asset errors. The existing outing scenario then failed with
`Camera could not face the next waypoint with arrow keys`. The baseline reproduced
the same first-approach failure after repairing only its ignored test harness's
incomplete runtime-copy list. This is not full gameplay acceptance. The owned
browsers and servers closed successfully.

Resuming with the updated driver was also exercised against both original flat
runtime evidence and new nested runtime evidence. Both restored the saved world
and two players, then encountered the same camera-navigation limitation at a
later travel step. Frozen-runtime compatibility passes startup/rejoin checks;
neither continuation is claimed as a completed outing.

The existing server MIME allowlist still rejects JSON/WAV/OGG. The portable
smoke check confirms audio exports are copied byte-for-byte, but does not claim
that packaging completes the unfinished audio-serving integration.

Detailed command logs, baseline archive, source comparison, portable smoke report
and browser logs are local under `.artifacts/reorganization/`. Browser snapshots,
screenshots and cleanup records are under
`.artifacts/wildly-unqualified/mvp-2026-09-05/`. Private test data stays ignored.

> The following dated sections retain their original module paths and results.

## Merge and verification record — 2026-09-06

Merged the generated-reserve branch, committed species-routine work and OMP bootstrap/handoff history, and the album-retention requirement tests into `main`. Audio and wildlife asset branch changes were already present as equivalent commits in the reserve branch. The handoff conflict retained the later verified bootstrap resume point.

The five unfinished files in `.worktrees/routines` remain untouched. Their versioned copies under `docs/handoff/omp/drafts/` preserve the tentative investigation change and validation preparation without promoting them to runtime code. No new wildlife, album policy, or development routine was implemented in this cleanup.

Before refactoring, the merged full suite reported **205 tests: 191 passing and 14 failing**, with no skipped or TODO tests. Eight failed test records belong to the unfinished album-retention requirements (including a parent and its three subtests); the other six match the existing [wildlife validation findings](superpowers/reviews/2026-09-06-wildlife-validation-findings.md). Those findings distinguish stale test assumptions, a confirmed unstable investigation, and unresolved causes. The suspected saved-goal parser issue in that record also remains outside this cleanup.

After refactoring, the complete suite again reported **205 tests: 191 passing and 14 failing**, with every named outcome identical to the merged baseline. The production build, format check, and portable release test passed. No tests were disabled or weakened.

The refactor preserves 86 original game/reserve declarations after formatting, removes one unused animal lookup, and replaces the duplicate rotation helper with the identical calculation already in `wildlife.ts`. Notebook rendering now receives state and a favorite callback explicitly. No gameplay rules or dependencies were added; full expansion acceptance remains open.

## Second modularity pass — 2026-09-06

Split the remaining large production files into the responsibility groups above. The second pass preserves the formatted bodies of all 142 original declarations in `game.ts`, `encounters.ts`, `level.ts`, and `save.ts`; scene and browser extraction makes their dependencies explicit. Existing public imports remain compatible, and portable releases include every extracted server module. No runtime source file exceeds 1,000 lines; larger test files remain scenario records rather than being rewritten as part of the runtime cleanup.

| Entry point | Before this pass | After |
| --- | ---: | ---: |
| `game.ts` | 1,275 | 13 |
| `encounters.ts` | 1,363 | 236 |
| `level.ts` | 1,252 | 123 |
| `save.ts` | 994 | 199 |
| `main.ts` | 1,262 | 727 |
| `view.ts` | 915 | 708 |
| `server.ts` | 827 | 735 |
| `browser.ts` | 1,664 | 309 |

The production build, formatting, portable-release test, and dependency-cycle check pass. The full suite again reports **205 tests: 191 passing and 14 failing**, with every named outcome matching the pre-cleanup baseline. No tests were skipped, disabled, or weakened. This is a source modularity pass, not fresh visual/multiplayer acceptance of the expansion.

## TypeScript documentation and linting — 2026-09-06

Implementation functions, classes, methods, named helpers, and assigned event handlers now have JSDoc. This includes the extracted runtime modules and the retained browser/release/test-helper code. Short inline predicates and callbacks are explained by their surrounding function; test scenarios, generated data, and external API declaration signatures are outside the documentation gate.

Write comments immediately above the declaration or method they describe. Explain behavior first, then use `@param`, `@returns`, `@throws`, and `@template` where applicable:

- Describe units, meaningful defaults, input constraints, and null/empty/fallback behavior.
- Say whether a function mutates authoritative state, returns a copy, or shares a cached reference. Explain resource ownership and disposal obligations.
- Describe asynchronous completion and rejection conditions. Only document errors the implementation can actually produce or propagate; distinguish validation from authorization.
- Keep TypeScript as the source of parameter and return types. Do not repeat `{Type}` annotations on `@param` or `@returns`. `@throws {Error}` identifies the error category; TypeScript has no checked exception signature.
- Document the role of a generic type with `@template`, and describe object parameter properties where their meaning is not conveyed by the root parameter.
- Keep tiny helpers short. Do not add empty tags, speculative behavior, or prose that merely repeats the function name. Change the comment alongside the implementation.

Examples of the intended detail are `capturePhoto` in `photo-capture.ts`, `loadRun` and `loadRoom` in `save.ts`, and `movePlayer` in `shared.ts`. Their contracts explain renderer restoration, different backup policies, and collision/position ownership respectively.

`npm run lint:docs` runs the strict TypeScript JSDoc rules, including parameter/return descriptions and missing declarations. Empty-comment autofixing is disabled. Both lint commands use the same exported documentation configuration.

`npm run lint` adopts [Airbnb Extended](https://github.com/eslint-config/airbnb-extended)'s non-React base and TypeScript configurations, with its required plugins and Prettier compatibility. This command also checks JSDoc. **The repository is not yet Airbnb-clean:** this pass records **1,528 existing style findings (1,511 errors and 17 warnings)**, principally `for...of`, parameter mutation, combined variable declarations, explicit `.ts` imports, and sequential `await` in loops. These rules remain enabled and visible. Applying their fixes indiscriminately would change important runtime and driver behavior, so this documentation pass does not rewrite those constructs or suppress the findings. Reproduce the full report with `npm run lint`; use `npm run lint:docs` for the passing documentation gate.

The build still uses **TypeScript 7.0.2**, pinned under the `typescript-native` npm alias and invoked explicitly by `npm run typecheck` (also part of `npm run build`). ESLint's TypeScript tooling requires the classic compiler API, so **TypeScript 6.0.3** occupies the `typescript` dependency used by lint tools. Use `npm run typecheck` for the production compiler rather than relying on which `tsc` executable npm places on PATH. ESLint 9 is pinned to the Airbnb package's supported peer range. These are development dependencies; game runtime dependencies are unchanged.

Verification for this pass: documentation changed in **52 TypeScript files**; comparison of the executable syntax trees for **all 77 TypeScript files** found no code changes. A clean `npm ci`, strict JSDoc check, formatting check, and TypeScript 7 production build pass. The complete suite reports **205 tests: 191 passing and the same 14 failing**, with every named outcome matching the merged baseline and no skipped or TODO tests. The full Airbnb command remains failing for the explicitly recorded style debt above. No new browser acceptance is claimed.
