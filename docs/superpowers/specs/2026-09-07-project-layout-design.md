# Responsibility-based project layout

Approved by the user on 2026-09-07. Scope: the standalone Wildly Unqualified
repository, with existing gameplay and save behavior preserved.

## Structure and ownership

- Root: `index.html`, package/lockfile, Vite/TypeScript/ESLint configuration,
  `README.md`, `AGENTS.md`, and Git configuration.
- `src/client/main.ts`: browser entry point. `session/`: admission, HTTP requests,
  preferences. `ui/`: HUD, notebook, CSS. `rendering/`: scene lifecycle, model
  loading, interpolation, graphics setup, photo capture. `audio/`: current and
  retained sound implementations.
- `src/server/`: HTTP/WebSocket entry point, environment configuration, HTTP
  helpers. `persistence/`: save IO and validation. `simulation/`: lifecycle,
  commands, equipment, physics, snapshots, photo scoring. Its `wildlife/` folder
  owns encounter scheduling, navigation, memory, and animal routines.
- `src/shared/shared.ts`: network contracts, validation, and shared geometry.
  `world/`: reserve generation/validation, terrain, fixture and model catalogs,
  retained level geometry. `wildlife/`: poses and measured geometry needed by
  both renderer and authoritative simulation. `src/types/`: vendor declarations.
- `public/models/` and `public/audio/`: existing exported assets at stable URLs.
- `tests/client/`, `tests/server/`, `tests/shared/`: module tests by owner.
  `tests/integration/`: expeditions, persistence, server, and release checks.
  `tests/e2e/`: visible browser driver and scenarios. `tests/helpers/`: test helpers.
- `scripts/release.ts`: portable packaging. Reuse its explicit runtime copying
  for the browser evidence driver instead of a second incomplete file list.
- `assets/`: original authoring files, scripts, measurements and provenance;
  preserve existing versioned paths and contents.
- `docs/MAINTAINING.md` and `docs/SERVER.md`: current developer/operator guides.
  `docs/history/`: dated verification/checkpoint/implementation records.
  Existing `docs/superpowers/` and `docs/handoff/` history remains identifiable.
- `dist/`: new Vite output, ignored by Git. Preserve old `web/`, `web-mvp/`,
  `.artifacts/` releases and all private data.

## Compatibility and boundaries

Keep existing public module exports and module basenames; change paths without
rewriting game rules. Client and shared runtime modules must not import server
runtime modules. Do not introduce path aliases, dependencies, barrel APIs, or a
framework migration. Retain pinned dependencies and Node >=26.5.0 <27.

Update all import/asset references, discovery globs, active documentation links,
release consumers, and path-sensitive tests. Keep historical source-path records
explicitly historical rather than rewriting the events they describe.

Resolve server-relative configuration against the game root, even after moving
server implementation into `src/server/`. Keep the existing `data-expedition`
default and explicit relative overrides anchored there. Portable releases retain
`wildly-unqualified/server.ts` as a small launcher, the bundled `web/` directory,
and game-root-relative data. The source checkout uses explicit `WU_WEB_DIR=dist`
when serving the new production build; preserved `web/` remains untouched.

Release runtime files retain their nested relative paths. Package only the
explicit server/shared runtime allowlist, the small launcher, built web assets,
operator guide and pinned package/lockfile. Preserve refusal to overwrite a
release, private/public path separation, and symlink rejection.

The browser evidence driver copies the complete allowed runtime, retains nested
paths, and selects the correct entry point. Existing frozen evidence can resume
using its original flat runtime; new evidence uses the nested layout. Preserve
saved data and ordinary-controls scenario semantics.

## Verification

Capture baseline build, full tests, formatting and lint results from the starting
commit. Add executable coverage for nested runtime packaging, release launch from
another working directory, relative private/public paths, and isolated browser
runtime imports. Run existing tests after moving them; do not weaken assertions
to conceal pre-existing expansion failures.

Verify build, typecheck, formatting, documentation lint, complete tests, package
contents, portable server health/static assets/authenticated WebSocket and visible
browser startup. Attempt the existing outing scenario, distinguishing its known
gameplay failures from layout problems. Inspect the final diff and get independent
review from the single authorized subagent. Commit coherent changes and push to
the existing private origin after checking privacy and remote commit equality.

## Exact move manifest

| Original root file | Destination |
| --- | --- |
| `main.ts` | `src/client/main.ts` |
| `client-admission.ts` | `src/client/session/client-admission.ts` |
| `client-api.ts` | `src/client/session/client-api.ts` |
| `client-settings.ts` | `src/client/session/client-settings.ts` |
| `hud.ts` | `src/client/ui/hud.ts` |
| `notebook.ts` | `src/client/ui/notebook.ts` |
| `style.css` | `src/client/ui/style.css` |
| `client-graphics.ts` | `src/client/rendering/client-graphics.ts` |
| `client-interpolation.ts` | `src/client/rendering/client-interpolation.ts` |
| `forest-view.ts` | `src/client/rendering/forest-view.ts` |
| `photo-capture.ts` | `src/client/rendering/photo-capture.ts` |
| `view.ts` | `src/client/rendering/view.ts` |
| `view-assets.ts` | `src/client/rendering/view-assets.ts` |
| `view-constants.ts` | `src/client/rendering/view-constants.ts` |
| `view-scenery.ts` | `src/client/rendering/view-scenery.ts` |
| `audio.ts` | `src/client/audio/audio.ts` |
| `legacy-sound.ts` | `src/client/audio/legacy-sound.ts` |
| `server.ts` | `src/server/server.ts` |
| `server-config.ts` | `src/server/server-config.ts` |
| `server-http.ts` | `src/server/server-http.ts` |
| `save.ts` | `src/server/persistence/save.ts` |
| `save-validation.ts` | `src/server/persistence/save-validation.ts` |
| `save-values.ts` | `src/server/persistence/save-values.ts` |
| `game.ts` | `src/server/simulation/game.ts` |
| `game-commands.ts` | `src/server/simulation/game-commands.ts` |
| `game-lifecycle.ts` | `src/server/simulation/game-lifecycle.ts` |
| `game-simulation.ts` | `src/server/simulation/game-simulation.ts` |
| `game-snapshot.ts` | `src/server/simulation/game-snapshot.ts` |
| `game-state.ts` | `src/server/simulation/game-state.ts` |
| `game-support.ts` | `src/server/simulation/game-support.ts` |
| `equipment.ts` | `src/server/simulation/equipment.ts` |
| `physics.ts` | `src/server/simulation/physics.ts` |
| `photo.ts` | `src/server/simulation/photo.ts` |
| `animal-behavior.ts` | `src/server/simulation/wildlife/animal-behavior.ts` |
| `animal-context.ts` | `src/server/simulation/wildlife/animal-context.ts` |
| `animal-navigation.ts` | `src/server/simulation/wildlife/animal-navigation.ts` |
| `animal-routines.ts` | `src/server/simulation/wildlife/animal-routines.ts` |
| `encounters.ts` | `src/server/simulation/wildlife/encounters.ts` |
| `raccoon.ts` | `src/server/simulation/wildlife/raccoon.ts` |
| `shared.ts` | `src/shared/shared.ts` |
| `world.ts` | `src/shared/world/world.ts` |
| `world-data.ts` | `src/shared/world/world-data.ts` |
| `world-geometry.ts` | `src/shared/world/world-geometry.ts` |
| `world-validation.ts` | `src/shared/world/world-validation.ts` |
| `level.ts` | `src/shared/world/level.ts` |
| `level-data.ts` | `src/shared/world/level-data.ts` |
| `legacy-level.ts` | `src/shared/world/legacy-level.ts` |
| `forest-models.ts` | `src/shared/world/forest-models.ts` |
| `subject-geometry.ts` | `src/shared/world/subject-geometry.ts` |
| `wildlife.ts` | `src/shared/wildlife/wildlife.ts` |
| `wildlife-data.ts` | `src/shared/wildlife/wildlife-data.ts` |
| `support-meshes.ts` | `src/shared/wildlife/support-meshes.ts` |
| `vendor.d.ts` | `src/types/vendor.d.ts` |
| `audio.test.ts` | `tests/client/audio.test.ts` |
| `forest-view.test.ts` | `tests/client/forest-view.test.ts` |
| `view.test.ts` | `tests/client/view.test.ts` |
| `encounters.test.ts` | `tests/server/encounters.test.ts` |
| `game.test.ts` | `tests/server/game.test.ts` |
| `physics.test.ts` | `tests/server/physics.test.ts` |
| `level.test.ts` | `tests/shared/level.test.ts` |
| `shared.test.ts` | `tests/shared/shared.test.ts` |
| `wildlife.test.ts` | `tests/shared/wildlife.test.ts` |
| `world.test.ts` | `tests/shared/world.test.ts` |
| `album-retention.test.ts` | `tests/integration/album-retention.test.ts` |
| `expedition-commissions.test.ts` | `tests/integration/expedition-commissions.test.ts` |
| `expedition-equipment.test.ts` | `tests/integration/expedition-equipment.test.ts` |
| `expedition-lifecycle.test.ts` | `tests/integration/expedition-lifecycle.test.ts` |
| `expedition-wildlife.test.ts` | `tests/integration/expedition-wildlife.test.ts` |
| `release.test.ts` | `tests/integration/release.test.ts` |
| `reserve-runtime.test.ts` | `tests/integration/reserve-runtime.test.ts` |
| `runtime-layout.test.ts` | `tests/integration/runtime-layout.test.ts` |
| `save.test.ts` | `tests/integration/save.test.ts` |
| `server.test.ts` | `tests/integration/server.test.ts` |
| `browser.ts` | `tests/e2e/browser.ts` |
| `browser-navigation.ts` | `tests/e2e/browser-navigation.ts` |
| `browser-outing.ts` | `tests/e2e/browser-outing.ts` |
| `expedition-test-helpers.ts` | `tests/helpers/expedition-test-helpers.ts` |
| `release.ts` | `scripts/release.ts` |
| `SERVER.md` | `docs/SERVER.md` |
| `IMPLEMENTATION.md` | `docs/history/IMPLEMENTATION.md` |
| `MVP-CHECKPOINT-2026-09-05.md` | `docs/history/MVP-CHECKPOINT-2026-09-05.md` |
| `PLAYTEST-2026-09-05.md` | `docs/history/PLAYTEST-2026-09-05.md` |
| `VERIFICATION.md` | `docs/history/VERIFICATION.md` |
