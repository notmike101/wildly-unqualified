# Maintaining Wildly Unqualified

This is the current source map. The dated MVP checkpoints and OMP handoffs are historical evidence and unfinished-work references. They do not describe a fully accepted expansion. This cleanup changes module boundaries, not game rules, save formats, or wildlife routines.

## Follow a game action

1. `main.ts` owns browser admission, connection/reconnection, input, prediction, and rendering updates. `notebook.ts` renders observations, album controls, and the map from supplied snapshots. Its favorite callback returns a photo ID to `main.ts`, which reads the latest authoritative state before sending a command.
2. `server.ts` owns HTTP/WebSocket admission, the authoritative tick loop, photo delivery, and persistence scheduling. `shared.ts` defines wire messages and snapshot types, validates messages, and provides shared movement/geometry calculations.
3. `game.ts` applies commands and advances the run. `game-state.ts` defines server-only state and bounded observation/event bookkeeping. `equipment.ts` handles grips, swept prop movement, plank seating, release, and recovery. Its grip cache remains keyed by run identity.
4. `encounters.ts` advances wildlife decisions. `wildlife.ts` supplies calibrated motion, poses, and sight checks; `wildlife-data.ts` and `support-meshes.ts` hold measured asset data. These routines remain incomplete in the ways recorded below.
5. `game.ts` creates immutable photo frames. `photo.ts` scores those frames against their reserve, independently of subsequent live movement. `view.ts` and `forest-view.ts` render the live world and frozen photographs; `audio.ts` owns native browser audio resources.
6. `save.ts` validates and persists the run, frozen frames, and JPEGs. `release.ts` builds a portable server package with an explicit runtime allowlist.

## Follow a reserve

| Module | Responsibility |
| --- | --- |
| `world-data.ts` | Blueprint types, species/routine data, resident names, commission descriptions. |
| `world-geometry.ts` | Shared placement, terrain, fixture, corridor, camera, and canopy calculations. |
| `world-validation.ts` | Complete blueprint validation, freezing, and hashing at trust boundaries. |
| `world.ts` | Seeded generation, trails, commission binding, and bounded generation retries. |
| `level.ts` | Model/prop geometry catalog and retained MVP definitions; generated runtime uses the resolved blueprint. |

Existing callers can continue importing the public reserve API from `world.ts` and run/photo API from `game.ts`. Their exports forward to the extracted modules. Internal reserve modules depend on data and geometry directly, avoiding a runtime dependency back into the generator. Server state imports in equipment and encounter code are types, not runtime initialization dependencies.

Keep world generation deterministic. Generation and validation deliberately share the same geometry calculations. Keep validation at the network/save boundary, authoritative commands on the server, and photographs frozen before asynchronous image capture. Do not regenerate a saved outing from its seed in place of its validated blueprint.

## Local checks

Use the existing pinned dependencies and Node 26.5+ within major 26, from the game repository root:

```sh
npm ci
npm run build
npm run format:check
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
