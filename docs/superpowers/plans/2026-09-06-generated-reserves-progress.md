# Generated-reserves progress

Plan: [2026-09-06-generated-reserves.md](2026-09-06-generated-reserves.md). Spec: [approved design](../specs/2026-09-05-wildly-unqualified-generated-reserves-design.md).

## Versioning foundation — complete

- User correction: repository contains **only Wildly Unqualified**, rooted in its game directory. No parent research or other game was pushed. The mistakenly initialized parent Git metadata was preserved in a local ignored artifact and removed from the parent root; no parent commit or remote was created.
- Private repository: `notmike101/wildly-unqualified`; privacy independently verified before push and remote/local baseline SHA matched.
- `70415e2`: preserved source/Blender baseline and approved expansion design; tag `forest-mvp-1-baseline`.
- `cbbf7c9`: standalone package/lock/types/build/release and corrected browser resource paths. The release test first failed on the absent local package file; after implementation, release test, full 111-test suite, build and formatting passed.
- Fresh authenticated GitHub clone in an unrelated temporary directory installed its own pinned packages, built the identical baseline JS/CSS and passed all 111 tests without parent files.
- One initial full-test run raced a simultaneous formatter against release-byte comparison. Formatting was completed first and the settled files passed the entire suite; no production workaround was added.

## Execution

- [x] Task 1: validated procedural world data; independent review approved after four focused fixes.
- [x] Task 2: nine animal models and habitat props in visible Blender; independent review approved. Actual in-game actions/photos remain Tasks 4–5.
- [x] Task 3: native audio module and licensed samples; independent review approved. Production integration and listening remain Task 7.
- [x] Task 4: authoritative generated world end to end; independent source and visible-client review approved.
- [ ] Task 5: complete species/commission/co-op loop — implementation underway.
- [ ] Task 6: bounded albums and safe next reserve.
- [ ] Task 7: integrated audible soundscape.
- [ ] Task 8: visible acceptance, portable release and private milestone backup.

## Integrated foundation checkpoint

- `6f900c3`: deterministic reserve data with twelve species, 36–48 residents, six required/two optional commissions, connected equipment routes and density measurements.
- `db587b6` through `0760354`: nine distinct low-poly animals and four habitat props, authored in the visible foreground Blender session. Actual exported roots, pivots, attachments and bounds passed the v4 checker and glTF validation. Independent model review approved; gallery and action renders inspected.
- `25a9fd9` through `0807b27`: native audio module, six CC0 samples and thirty original synthesized files with source/license/hash evidence. Sixteen focused audio tests passed; no listening claim is made.
- At `0807b27`, sequential build and the full **137-test suite** passed. That exact expansion-branch commit is backed up to the private origin, with privacy and remote/local SHA equality independently verified. Main remains the preserved baseline.
- `7d66ce9`: all four generator review findings fixed and independently approved. Actual exported-mesh contact checks cover every quarter turn and four owl residents; unsupported origins, malformed fixture geometry and unreachable bound targets reject. Four focused regressions and the final **141-test suite**, build and formatting passed. Exact local/remote fix commit verified after push.
- Sampled generator coverage after fixes: 258 distinct sweep seeds plus two high-bit cases; 418,142–464,420-byte blueprints, 614–714 mature trees and 83.74–89.80% dense crown-proxy coverage. These measurements do not establish rendered canopy appearance or human outing duration.

## Runtime and independent verification

- `43c4ede`: generated fixture identities and native local-plank seats. Twelve focused physics checks and TypeScript passed; the exact checkpoint is pushed. The wider state, save, socket and client migration remains in progress.
- `95568ff`: partial migration of authoritative state, navigation, world negotiation, rendering and schema-3 saves. The save/socket/generated-runtime group passed **31/31** and the exact private checkpoint is pushed. Existing photo/navigation test fixtures are still being migrated; the full typecheck, suite, build and visible-client gate are not yet complete.
- Prior-MVP comparison baseline: one visible hardware WebGPU viewport at 1280×720 and DPR 1, 30.008 seconds of ordinary walking, 3,601 raw frame intervals and 53.45 metres of sampled movement. Median interval 8.30 ms; p95/p99 8.50 ms. This measures display-paced callbacks for the earlier forest/population, not expanded-world performance. All 24 preserved runtime/web hashes matched afterward; temporary browsers/listener were closed.
- Native browser decoding passed for all 36 sound assets at 48 kHz, with 19.37 MiB decoded PCM. It exposed overlapping-effect overload and an abrupt water stop, including an ordinary walking-speed case.
- `e07b4b3` on the private audio branch repairs those module defects and passed independent review. Twenty focused tests, TypeScript, formatting and actual production-graph capture passed: sampled output stayed at or below 0.95; water faded before stopping; reentry reused its source; mute and resume-tail captures were silent. Integrated and pushed as `aa4d941`, with all twenty audio tests and TypeScript passing in the combined checkout. Gameplay audio controls, spatial checks and real listening remain open.
- A quiet 12-second module audition is available in local evidence; user feedback was requested. No listening approval or full sound-integration completion is assumed.

## Generated runtime milestone

- `9059220` completed the runtime regression migration with **155/155 tests** and the production build passing. Independent review found three important defects: ground hats were reclaimed too early, failed model requests stayed cached, and later gate movement could invalidate an existing ground incident during saving.
- `473c3ce` fixes all three with focused regressions. The settled suite passed **159/159**, followed by formatting, production build and the portable release check. Independent source and fault-recovery review approved the corrections; `b938e2d` marks the completed task without an additional source change.
- A visible production-client fault check recovered in the same tab after three bad world hashes and a transient model HTTP 503. Backoff increased across failed installs, reset after success, and sent no gameplay commands before the world was ready.
- Two visible production clients completed an ordinary-input inspection through camp, clearing, wetland and dense interior. All five captures had zero asset errors; no page errors were recorded. Inspected dense views show continuous overhead crowns and a clear shaded route. Temporary browsers and port 4320 were closed; the original port 4316 room remains preserved.
- Short scene diagnostics ranged from 357–1,087 draw calls and 9.2–12.2 ms rolling p95 frame intervals. These are inspection samples, not the controlled expansion benchmark. The existing bundle-size advisory remains for final performance review.
- Generated identities, fixtures, movement, native physics, rendering, frozen photos and schema-3 persistence now share the same validated blueprint. Task 4 credits only the tested legacy subset; the full new wildlife and six-plus-two objective loop remain Task 5.

## Wildlife preparation and next work

- Actual exported meshes were calibrated in foreground Blender for woodpecker feet/beak contact, owl and squirrel crown stances, a squirrel approach surface and three swimming waterlines. Source scenes and exports were preserved. These measurements guide implementation; moving poses and gameplay JPEGs remain to be verified.
- Three focused tests now demonstrate the missing ground-pounce, climbing/cache and swim/groom families through ordinary player inputs and real simulation ticks. Their expected failures are retained; production implementation begins from the accepted `aa4d941` baseline in the isolated `feat/species-routines` branch.
- Task 5 also addresses repeated animals crowding a shared wash spot and makes exact bound photo subjects identifiable during ordinary play.
- A genuine generated world at seed 4891 contains the maximum 48 residents across all twelve species. It will be used for later combined payload and performance gates; the earlier maximum-JPEG test had 43 residents.
- Human outing duration, enjoyment, the full objectives, next-reserve transactions, integrated listening and final portable-release acceptance remain open.

## Rulings

- Ruling: preserve the mistaken empty parent-repository setup as local metadata instead of deleting it. Automatic review rejected recursive `.git` deletion; moving the owned setup to the local artifact folder safely removed the parent repository without losing files.
- Ruling: give each outing a fresh world ID even when a seed repeats, and namespace commands/photos with it. A seed reproduces geography but must not let delayed traffic from an earlier outing act on a later one.
- Ruling: provide game-local package, lockfile and ambient WASM types. A game-only repository that depends on untracked parent configuration is not an independent backup; original parent tooling remains untouched.
- Ruling for Task 6: archive filenames can include the outing ID and a digest of canonical saved content. This keeps earlier archives immutable and lets a failed transition be retried after a favorite changes. A mismatched existing target is refused; meaningful revisions may consume another full archive's disk space.
- Ruling: repair the independent audio module in its separate worktree while runtime migration continues. Its API remains fixed; shared gameplay/UI integration still follows the gameplay dependency. If that interface changes, the module needs a bounded rebase and retest.
- Ruling: Task 4 preserves existing three-species credit tests through generated commission bindings and their physical/equipment checks. Unsupported new actions/categories remain uncredited until Task 5. This avoids dropping tested authorization behavior while replacing the old fixed-world identifiers; the full new loop remains Task 5 work.
- Ruling: long migrations may have explicitly partial checkpoints on the isolated feature branch after their relevant checks pass. Record remaining failures and incomplete gates precisely; only the final reviewed milestone claims the full task is ready. This keeps backups current without weakening the completion gates.
