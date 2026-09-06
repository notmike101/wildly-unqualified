# Task 6 retention and payload preparation

Status: **bounded red-phase preparation complete; Task 6 implementation is not started**. No production files, commits, branches, live data, browser processes or servers were changed. Full Task 6 source work remains dependent on accepted Task 5.

## Source and scope

- Worktree: `D:/friendslop-games/games/wildly-unqualified/.worktrees/albums`, branch `feat/expedition-albums`.
- Verified HEAD before and after: `aa4d9414746a0da5c0e9d1ca270a0392b5bdac10`.
- Only new source-tree file: [album-retention.test.ts](D:/friendslop-games/games/wildly-unqualified/.worktrees/albums/album-retention.test.ts). Absolute location: `D:/friendslop-games/games/wildly-unqualified/.worktrees/albums/album-retention.test.ts`.
- Test SHA-256: `2be70dc77c59f666d9e5988a3775a2ceeb2ff380eb04d6f61bd8980fe4147a04`.
- [Before hashes](task-6-preparation-source-before.json) and [after hashes](task-6-preparation-source-after.json) independently match all ten checked runtime/config/lock files: game, save, server, shared, world, encounters, level, physics, package.json and package-lock.json. Final Git status is only `?? album-retention.test.ts`.
- Read the complete Task 6 brief, existing next-reserve transaction handoff and accepted Task 4 runtime/persistence contract. This preparation implements only retention/payload tests; it does not repeat the transition race audit.

## Reproducible evidence

From the albums worktree, Node `v26.5.0`, using already-installed pinned dependencies resolved through the worktree parents:

```powershell
node --test album-retention.test.ts
npx --no-install tsc --noEmit
npx --no-install prettier --check album-retention.test.ts
```

The first focused run is retained in [task-6-preparation-tests.log](task-6-preparation-tests.log): exit 1, 4,000.774 ms. After formatting and adding compact length assertions before existing deep comparisons, the final focused run is [task-6-preparation-tests-2.log](task-6-preparation-tests-2.log): exit 1, 5,825.3738 ms, Node reports 9 tests / 1 pass / 8 fail / 0 skipped. This represents **seven individual expected failing policy cases plus their failing parent group, and one passing maximum-payload test**. Both runs fail for the intended missing policy, not import, fixture, type or environmental errors. TypeScript exits 0 with no diagnostics ([log](task-6-preparation-typecheck.log)); the new test's Prettier check passes. No broad suite or build ran.

| Check | Actual result at this base |
| --- | --- |
| Eight separate credit photos plus the 56th extra | RED: 29 retained instead of 64. |
| At full allocation, remove only the oldest uncredited/unfavorited pending extra and its frame | RED: 29 retained instead of 64; later exact-ID/frame assertions remain for green verification. |
| All 56 extras favorited: uncredited capture is preview-only, with 0 / 28 / 56 ready extras | RED in all three mixtures: existing protected album shrinks from 64 to 29. Assertions also require unchanged frames, image bytes and restored album when implemented. |
| New eighth credited capture with 56 favorited extras | RED: real evaluator awards the intended credit, but retention leaves 29 instead of 64. |
| Seven credit records plus 57 extras, only 64 total | RED: `saveRun` accepts the invalid extra allocation; expected rejection is missing. |
| Real generated 48-resident world, 64 photographs at three maximum JPEG/pending mixtures | PASS, including exact restore and rejected 65th record without rewriting the preceding save. |

The causes are directly observable in unchanged production boundaries: `game.ts:1173–1177` first stores the pending frame then trims uncredited extras to 21 without favorite protection; `save.ts:728,735` limits pending records and album to 64 but does not reserve eight credit slots / limit extras to 56. These are planned Task 6 policy changes, not newly introduced Task 5 defects.

## Maximum payload: unchanged production passes

`createRun(4891, 'max-population-preflight')` uses the actual production generator: **48 residents, all 12 species, 451,733-byte blueprint**. Each fixture contains eight separately credited records plus 56 extras, all with four valid favorite identities and three assist identities. Pending frames come from actual `makePhotoFrame`; each ready image is the exact existing `save.test.ts` JPEG fixture with its identical valid JPEG comment padding to **65,536 bytes**. `validJPEG` must accept the bytes. Neither validator nor byte limit is weakened.

| Ready / pending records | Actual serialized run.json bytes |
| --- | ---: |
| 0 / 64 | 1,128,655 |
| 32 / 32 | 3,601,988 |
| 64 / 0 | 6,075,243 |

Every mixture passes the existing 8,388,608-byte save guard, retains exactly one serialized blueprint, restores the world, album, pending frames and image bytes exactly, and refuses a 65th record while preserving all bytes of the last valid save. The final all-ready case has 2,313,365 bytes below the file limit. This proves these concrete generated-population/photo fixtures fit; it is not a universal worst-case proof over all possible legal strings, worlds, pending scene histories or future Task 5 additions.

## Boundaries and next handoff

Fixtures construct valid policy metadata and selected geometry; they do **not** establish naturally earned photographs, a completed outing, pacing, meaningful participation or actual browser upload acceptance. The new-credit case uses an arranged deer graze scene through real `applyCommand`/photo evaluation. Existing API capture return is used for the preview assertion; no speculative production API or deliberately broken import was introduced.

The pending-extra eviction case exercises real command/frame removal. Ready image deletion requires the server-owned image-map/upload/save path and remains a Task 6 integration test; comparing an unchanged caller-owned image map in the preview fixture is not proof of server cleanup. UI preview-only messaging, upload admission/removal, stale uploads/actions, archive retry/crash boundaries and copied-directory authentic-session relocation remain required Task 6 work. Reconcile these tests with any accepted Task 5 behavior-frame delta before implementation, preserving the real generated population and validation limits.

Each save uses its own temporary directory and test cleanup removes only that owned directory. No live room, private save or credential contents were read. No implementation or commit was made; the preparation is paused for the controller's dependency gate.

## Test-only backup after power-outage checkpoint request

The original prepared file was verified unchanged at SHA-256 `2be70dc77c59f666d9e5988a3775a2ceeb2ff380eb04d6f61bd8980fe4147a04` and committed alone on `feat/expedition-albums` as `b2ee00c21f56f4161403ea1def8cefb7f8dd9e31`: `test: record pending expedition album retention requirements`. Worktree is clean. Root owns the separate preparatory branch push; this worker did not push.

Fresh `npx --no-install prettier --check album-retention.test.ts`, `npx --no-install tsc --noEmit` and staged `git diff --cached --check` all passed before commit. Fresh `node --test album-retention.test.ts` is intentionally red: seven individual expected policy failures plus their parent aggregation, Node 9 tests / 1 pass / 8 fail, 4,091.3185 ms. [Fresh retained log](task-6-backup-red-check.log). The unchanged genuine 48-resident maximum-payload test passes all three JPEG/pending mixtures. This commit preserves pending requirements only; no retention implementation or full Task 6 completion is claimed.
