# Project Layout Implementation Plan

> **For agentic workers:** Execute inline using superpowers:executing-plans. The
> single authorized subagent captures baseline checks and reviews the final diff.

**Goal:** Organize Wildly Unqualified by responsibility while preserving game,
asset, save, browser-test, and portable-release behavior.

**Architecture:** Keep Vite's HTML/configuration at the root and public exports
under `public/`; move application modules under client/server/shared ownership in
`src/`. Keep tests, release tooling, authored assets and documentation distinct.

**Tech Stack:** Existing TypeScript, Vite 8.2.2, Node >=26.5.0 <27, Three.js,
Box3D, ws, Node test runner, Playwright and ESLint. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-07-project-layout-design.md`

## Global constraints

- Only change this standalone game repository.
- Preserve gameplay, save schemas, assets, original Blender scenes, private data,
  preserved builds/releases, server authority and path validation.
- Preserve pinned dependencies and Node >=26.5.0 <27.
- Use one subagent only; it does not modify application files.
- Do not weaken tests or claim pre-existing expansion failures are resolved.
- Commit verified changes and verify private origin before pushing.

## Task 1: Record baseline and migration manifest

- [x] Capture the starting commit's build, tests, formatting and lint in an
  isolated archive under `.artifacts/reorganization/`.
- [x] Build an exhaustive old-to-new path manifest for root TypeScript, CSS and
  documentation files. Preserve module basenames and public exports.
- [x] Record dynamic paths, release/browser runtime copies, authoring script
  references, test fixtures, and documentation links before moving files.
- [x] Add release regression coverage that imports every copied runtime module
  and starts the package from a different working directory. Confirm the existing
  runtime-copy failure before repairing it.

## Task 2: Move modules and reconnect workflows

- [x] Move files with the approved ownership map; rewrite relative imports using
  resolved original paths, including type imports and dynamic imports.
- [x] Set `index.html` module source to `/src/client/main.ts`; set Vite output to
  `dist`; update TypeScript include and npm test/format/lint globs recursively.
- [x] Anchor `src/server/server-config.ts` to the game root, not its new folder.
- [x] Update `scripts/release.ts` to copy nested allowlisted runtime paths and a
  compatible portable launcher. Reuse runtime copying in `tests/e2e/browser.ts`;
  preserve old frozen flat-runtime resume behavior.
- [x] Update test asset/fixture paths and authoring-tool references while retaining
  original source assets and measurements.
- [x] Move current server guide to `docs/SERVER.md`; move dated root evidence to
  `docs/history/`; update active README, maintenance map, runbook and links.

## Task 3: Verify and review

- [x] Run `npm run build`, `npm run format:check`, `npm run lint:docs`,
  `npm run lint`, and `npm test`; compare failing names with baseline logs.
- [x] Run isolated packaging/startup checks from a directory containing spaces;
  verify health, HTML, static assets and authenticated WebSocket, and check source
  and credentials cannot be served.
- [x] Run visible browser validation against built assets and attempt the
  existing outing driver. Record exactly what passes and what fails.
- [x] Ask the existing subagent to review moves, runtime boundaries, path
  compatibility, discovery coverage, documentation and release safety.
- [x] Fix migration regressions, rerun affected checks, and record evidence in
  `docs/MAINTAINING.md` and this checklist.
- [ ] Inspect staged scope and `git diff --cached --check`, commit, verify remote
  privacy, push the authorized milestone and verify remote/local SHA equality.

## Execution record

Source restructuring and focused validation are complete; see `docs/MAINTAINING.md`
for measured results, the baseline build/test race, unchanged failure names,
independent review and browser/portable limitations. Work is on
`refactor/project-layout`; final staging and private checkpoint push follow.
