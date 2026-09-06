# Wildlife validation findings — paused

The user requested findings only and a pause on 2026-09-06. No further fixes or validation runs were performed after that instruction. Full Task 5 acceptance and its source review remain incomplete.

The tested production baseline is `b16f00ed549e8dac0f26400d3dadd34e00e29f6a` on `feat/species-routines`. The full suite reported **190 passing / 196 total, six failures**, in 178.059 seconds. These failures have different causes; they are not six confirmed gameplay bugs.

## Confirmed results and unresolved causes

| Test at the baseline | Observed result | Finding/status |
| --- | --- | --- |
| `encounters.test.ts:418` — washing stops after food removal | The setup expected washing within 6 seconds; the resident was still approaching. A diagnostic reached washing after 20.5 seconds. | Shared-site timing invalidates the short setup assumption. This failure occurs before the food-removal assertion and does not prove that removing food fails to stop washing. |
| `encounters.test.ts:432` — moved-decoy investigation | Investigation begins after 4.3 seconds, then flickers between approach and investigation around an unchanged decoy. | A strengthened stability assertion also fails on the baseline: unstable investigation is confirmed. A tentative local change was started before the stop but has not passed verification. |
| `game.test.ts:1126` — theft, whistle diversion and stash | After a fixed wait, the tin is held by `animal:p3-raccoon-2` instead of being unheld. | Whether this is a later valid theft or a failure in the original drop/stash sequence remains unresolved. |
| `game.test.ts:1272` — rejected deer portrait guidance | The test expects no credits but receives optional `commission-6`. | A valid optional cameo can coexist with rejection of the required behavior. The blanket no-credit assumption is outdated; the required-goal rejection and guidance still need isolated verification. |
| `game.test.ts:1513` — linked theft, pause, recovery and pair | The encounter wait times out; the diagnostic leaves the held tin near its camp position after staged player relocation. | An inconsistent arranged carry setup is suspected. A production encounter failure has not been established. |
| `reserve-runtime.test.ts:386` — unimplemented commissions reject | A Mallard's now-supported action earns credit that this older test forbids. | The unsupported-feature premise is obsolete. Strict wrong-action and exact-resident rejection still need to be retained when this test is updated. |

## Additional source concern

The new `routine:` and `deer-trail:` parsers in `encounters.ts` interpret saved `memory.goal` strings as numeric indexes, while the existing validator in `save.ts:690–741` checks only a text-length limit. Malformed values such as `routine:bad:0` or `deer-trail:99` may therefore restore and fail during a later decision.

This is a **suspected persistence defect from source inspection**, not a reproduced crash. No corrupt-save probe was run before the pause, and the full source review was not approved.

## Programmatic acceptance results

The accelerated scenarios use production commands, ticks and native physics, without assigning successful behaviors, positions or credits. They preserved eleven species action frames, three transition frames and one additional Rabbit loop frame.

- The complete-loop attempt earned one required Rabbit goal and an optional cameo, then stalled during a camera approach at approximately `[-2.30, 0, -96]` toward `[-4, 0, -96]`. It did not complete the six required goals, return or exhibition. The script used animal-route guidance; a production collision or route defect has not been established.
- The Raccoon producer timed out. Its tin setup omitted the close approach used by the existing passing wash test. This is an identified producer setup discrepancy, not proof of inaccessible washing.
- The extra Otter transition frame was rejected as too small. Some other verdicts named neighboring residents, so stored metadata alone does not establish intended-subject prominence.
- The production renderer completed **15 JPEG cases**, each within 64 KiB, with identical repeated-capture hashes. Fourteen imported body/head marker checks matched production subject points with maximum error approximately `6.20e-8` metres; the Heron marker check was unavailable.
- Qualitative image, contact, motion and branch/track inspection did not finish. These numerical/render results do not establish complete visual acceptance, human pacing, ordinary UI behavior or real-network multiplayer readiness.

## Preserved work and pause state

Before the stop, five files were changed or created in the routines worktree: `encounters.ts`, `encounters.test.ts`, `expedition-equipment.test.ts`, `expedition-equipment-helpers.ts`, and `expedition-validation.ts`. This includes the unverified six-line Deer stability candidate, test changes and automation preparation. They remain **uncommitted and unreverted**. No source fixes from this pass were committed or pushed.

Both simulation processes exited unsuccessfully. The owned renderer browser and server were closed; port 4322 is no longer listening. User applications, existing rooms and prior private data were left untouched. All work is paused.

Raw logs, frozen frames and JPEGs remain in the ignored `.superpowers/sdd/2026-09-06-generated-reserves/` workspace of the expedition checkout. Evidence reports: `task-5-full-review-b16.md`, `task-5-programmatic-validation.md`, and `task-5-programmatic-render.md`; the full suite log is `task-5-full-suite-b16.log`. This document is the versioned, self-contained findings record.
