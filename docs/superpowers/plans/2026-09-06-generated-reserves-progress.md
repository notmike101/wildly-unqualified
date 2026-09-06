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
- [ ] Task 2: nine animal models and habitat props in visible Blender.
- [ ] Task 3: native audio module and licensed samples.
- [ ] Task 4: authoritative generated world end to end.
- [ ] Task 5: complete species/commission/co-op loop.
- [ ] Task 6: bounded albums and safe next reserve.
- [ ] Task 7: integrated audible soundscape.
- [ ] Task 8: visible acceptance, portable release and private milestone backup.

## Rulings

- Ruling: preserve the mistaken empty parent-repository setup as local metadata instead of deleting it. Automatic review rejected recursive `.git` deletion; moving the owned setup to the local artifact folder safely removed the parent repository without losing files.
- Ruling: give each outing a fresh world ID even when a seed repeats, and namespace commands/photos with it. A seed reproduces geography but must not let delayed traffic from an earlier outing act on a later one.
- Ruling: provide game-local package, lockfile and ambient WASM types. A game-only repository that depends on untracked parent configuration is not an independent backup; original parent tooling remains untouched.
