# Maintaining Wildly Unqualified

This is the current source map. The dated MVP checkpoints and OMP handoffs are historical evidence and unfinished-work references. They do not describe a fully accepted expansion. This cleanup changes module boundaries, not game rules, save formats, or wildlife routines.

## Follow a game action

1. `main.ts` connects input, session state, prediction, and rendering. Browser components receive the state or callbacks they need; they do not import the entry point. Admission callbacks read current state after asynchronous requests, rather than retaining a stale snapshot.
2. `server.ts` owns the room, HTTP/WebSocket lifecycle, authoritative tick loop, and persistence scheduling. `server-http.ts` provides bounded request parsing, safe paths, tokens, and responses. `shared.ts` defines wire messages, validates commands, and supplies shared geometry.
3. `game.ts` is the compatible public API. `game-commands.ts` applies player commands; `game-simulation.ts` advances the run. Both use `game-support.ts` for shared run operations and `equipment.ts` for grips, swept movement, seating, release, and recovery. Their caches remain keyed by run identity.
4. `encounters.ts` schedules and dispatches wildlife decisions. Navigation, shared behavior, raccoon behavior, and species routines have separate modules listed below. `wildlife.ts` supplies calibrated poses and sight checks; `wildlife-data.ts` and `support-meshes.ts` retain measured asset data. Existing incomplete behavior remains documented below.
5. `game-snapshot.ts` copies snapshots and freezes photo frames. `photo.ts` scores those frames independently of later live movement. `photo-capture.ts` produces the image and restores renderer state. The live view owns its scene resources; extracted scenery creation still registers materials with that owner so disposal remains complete.
6. `save.ts` owns file IO, serialized atomic replacement, backups, and room credentials. `save-validation.ts` validates complete runs and photographs using the entity validators in `save-values.ts`. `release.ts` retains an explicit portable runtime allowlist.

## Where to make a change

| Change | Modules |
| --- | --- |
| Run creation, crew admission/disconnection, physics lifetime | `game-lifecycle.ts` |
| Player command rules | `game-commands.ts` |
| Per-tick movement, equipment, and wildlife scheduling | `game-simulation.ts` |
| Spawn safety, carried tin, release, recoverable incidents | `game-support.ts` |
| Server-only state and bounded event/observation bookkeeping | `game-state.ts` |
| Animal paths, collision checks, walking, and recovery positions | `animal-navigation.ts` |
| Animal memory and habitat lookup | `animal-context.ts` |
| Shared animal goals, disturbance, and lure approaches | `animal-behavior.ts` |
| Raccoon investigation, theft, and washing | `raccoon.ts` |
| Species-specific routine stages and transitions | `animal-routines.ts` |
| HUD status, equipment prompts, camera guidance | `hud.ts` |
| Observations, album controls, reserve map | `notebook.ts` |
| Join form and host slot reassignment | `client-admission.ts` |
| Same-origin JSON requests and HTTP error status | `client-api.ts` |
| Preferences and key binding controls | `client-settings.ts` |
| WebGPU device, viewport, and device-loss handling | `client-graphics.ts` |
| Render-only snapshot interpolation | `client-interpolation.ts` |
| Model loading and transient-load retries | `view-assets.ts` |
| Static signs, markers, tracks, branch piles | `view-scenery.ts` |
| Actor/equipment updates and scene lifetime | `view.ts`; forest terrain/shadows in `forest-view.ts` |
| Camera range and crew colors | `view-constants.ts` |
| Forest audio / retained MVP feedback sounds | `audio.ts` / `legacy-sound.ts` |
| Environment settings and private/public directory separation | `server-config.ts` |

The acceptance driver is also separated: `browser.ts` owns setup, failure evidence, and cleanup; `browser-navigation.ts` owns read-only guidance and ordinary keyboard/button navigation; `browser-outing.ts` retains the historical outing scenario. Its context contains the existing shared evidence arrays and callbacks. Restart status is a getter so browser event callbacks see the current value. Importing the navigation or scenario modules does not launch a server or browser.

## Follow a reserve

| Module | Responsibility |
| --- | --- |
| `world-data.ts` | Blueprint types, species/routine data, resident names, commission descriptions. |
| `world-geometry.ts` | Shared placement, terrain, fixture, corridor, camera, and canopy calculations. |
| `world-validation.ts` | Complete blueprint validation, freezing, and hashing at trust boundaries. |
| `world.ts` | Seeded generation, trails, commission binding, and bounded generation retries. |
| `level.ts` | Generated fixture geometry and compatible public exports for the catalog. |
| `level-data.ts` | Equipment dimensions, rules, and retained MVP landmark constants. |
| `forest-models.ts` | Authored model collision catalog and placement transforms. |
| `legacy-level.ts` | Preserved MVP forest layout, trails, and route geometry. |
| `subject-geometry.ts` | Articulation and photo subject geometry shared by rendering and scoring. |

Existing callers can continue importing the public reserve API from `world.ts` and run/photo API from `game.ts`. Their exports forward to the extracted modules. Internal reserve modules depend on data and geometry directly, avoiding a runtime dependency back into the generator. Server state imports in equipment and encounter code are types, not runtime initialization dependencies.

The extracted modules form no local runtime import cycles. Prefer importing a specific implementation module inside a subsystem; keep the compatible API modules for existing callers. Keep application startup in `main.ts`, `server.ts`, or `browser.ts`, rather than adding startup side effects to reusable modules.

Keep world generation deterministic. Generation and validation deliberately share the same geometry calculations. Keep validation at the network/save boundary, authoritative commands on the server, and photographs frozen before asynchronous image capture. Do not regenerate a saved outing from its seed in place of its validated blueprint.

## Local checks

Use the existing pinned dependencies and Node 26.5+ within major 26, from the game repository root:

```sh
npm ci
npm run build
npm run format:check
npm run lint:docs
npm test
```

Tests stay beside the runtime modules. `game.test.ts`, the `expedition-*.test.ts` files, and `world.test.ts` exercise the extracted code through its existing public API. `release.test.ts` checks the portable package's exact runtime contents, including the new server modules. When adding a runtime module, update the allowlist in `release.ts` and its expectation in `release.test.ts`. Browser-only modules are included by the existing build.

The complete suite includes a large deterministic seed sweep and takes roughly three minutes on the development machine. `npm run test:browser` is the existing visible gameplay driver and uses port 4316; its historical acceptance results are separate from this cleanup. No fresh multiplayer or visual acceptance is claimed here.

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
