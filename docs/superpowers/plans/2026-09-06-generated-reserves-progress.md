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

- [ ] Task 1: validated procedural world data.
- [x] Task 2: nine animal models and habitat props in visible Blender; independent review approved. Actual in-game actions/photos remain Tasks 4–5.
- [x] Task 3: native audio module and licensed samples; independent review approved. Production integration and listening remain Task 7.
- [ ] Task 4: authoritative generated world end to end.
- [ ] Task 5: complete species/commission/co-op loop.
- [ ] Task 6: bounded albums and safe next reserve.
- [ ] Task 7: integrated audible soundscape.
- [ ] Task 8: visible acceptance, portable release and private milestone backup.

## Integrated foundation checkpoint

- `6f900c3`: deterministic, validated reserve data with twelve species, 36–48 residents, six required/two optional commissions, connected equipment routes and density measurements. Independent review found four important gaps; Task 1 stays open while they are fixed.
- `db587b6` through `0760354`: nine distinct low-poly animals and four habitat props, authored in the visible foreground Blender session. Actual exported roots, pivots, attachments and bounds passed the v4 checker and glTF validation. Independent model review approved; gallery and action renders inspected.
- `25a9fd9` through `0807b27`: native audio module, six CC0 samples and thirty original synthesized files with source/license/hash evidence. Sixteen focused audio tests passed; no listening claim is made.
- At `0807b27`, sequential build and the full **137-test suite** passed. That exact expansion-branch commit is backed up to the private origin, with privacy and remote/local SHA equality independently verified. Main remains the preserved baseline.
- Generator review fixes in progress: real mesh support for owl perches, actual vertical support for camp/tin/equipment, strict nested fixture geometry, and exact resident-to-objective reachability. Focused regressions are required before Task 4 relies on the blueprint.

## Rulings

- Ruling: preserve the mistaken empty parent-repository setup as local metadata instead of deleting it. Automatic review rejected recursive `.git` deletion; moving the owned setup to the local artifact folder safely removed the parent repository without losing files.
- Ruling: give each outing a fresh world ID even when a seed repeats, and namespace commands/photos with it. A seed reproduces geography but must not let delayed traffic from an earlier outing act on a later one.
- Ruling: provide game-local package, lockfile and ambient WASM types. A game-only repository that depends on untracked parent configuration is not an independent backup; original parent tooling remains untouched.
