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
- [ ] Task 4: authoritative generated world end to end — integration underway.
- [ ] Task 5: complete species/commission/co-op loop.
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
- `e07b4b3` on the private audio branch repairs those module defects and passed independent review. Twenty focused tests, TypeScript, formatting and actual production-graph capture passed: sampled output stayed at or below 0.95; water faded before stopping; reentry reused its source; mute and resume-tail captures were silent. This checkpoint is pushed but awaits integration into the expedition branch while the runtime owner works. Gameplay audio controls, spatial checks and real listening remain open.
- A quiet 12-second module audition is available in local evidence; user feedback was requested. No listening approval or full sound-integration completion is assumed.

## Rulings

- Ruling: preserve the mistaken empty parent-repository setup as local metadata instead of deleting it. Automatic review rejected recursive `.git` deletion; moving the owned setup to the local artifact folder safely removed the parent repository without losing files.
- Ruling: give each outing a fresh world ID even when a seed repeats, and namespace commands/photos with it. A seed reproduces geography but must not let delayed traffic from an earlier outing act on a later one.
- Ruling: provide game-local package, lockfile and ambient WASM types. A game-only repository that depends on untracked parent configuration is not an independent backup; original parent tooling remains untouched.
- Ruling for Task 6: archive filenames can include the outing ID and a digest of canonical saved content. This keeps earlier archives immutable and lets a failed transition be retried after a favorite changes. A mismatched existing target is refused; meaningful revisions may consume another full archive's disk space.
- Ruling: repair the independent audio module in its separate worktree while runtime migration continues. Its API remains fixed; shared gameplay/UI integration still follows the gameplay dependency. If that interface changes, the module needs a bounded rebase and retest.
- Ruling: Task 4 preserves existing three-species credit tests through generated commission bindings and their physical/equipment checks. Unsupported new actions/categories remain uncredited until Task 5. This avoids dropping tested authorization behavior while replacing the old fixed-world identifiers; the full new loop remains Task 5 work.
- Ruling: long migrations may have explicitly partial checkpoints on the isolated feature branch after their relevant checks pass. Record remaining failures and incomplete gates precisely; only the final reviewed milestone claims the full task is ready. This keeps backups current without weakening the completion gates.
