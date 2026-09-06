# 06 — One bounded album policy

**Scope:** game.ts, shared.ts, save.ts, server.ts and tests; album-retention.test.ts.
**Prerequisite:** packet 05's feasible technical gates accepted; visual inspection limitations recorded explicitly. New branch/worktree.
**Read:** photo insertion/eviction in game.ts around baseline 1160; server upload/flush rollback; save.ts album/pending/image invariants; references/task-6-preparation.md for the prepared red cases.

- [ ] Bring in ONLY the prepared test file, not the old albums runtime:
```powershell
git restore --source=b2ee00c21f56f4161403ea1def8cefb7f8dd9e31 -- album-retention.test.ts
node --test album-retention.test.ts
```
Historical result: seven policy cases fail plus parent (Node reports one pass/eight failures including group), maximum-population payload case passes. Reobserve actual behavior on current source.

- [ ] Implement one policy shared by runtime/save/upload: <=64 total retained photos, <=56 extras and capacity for eight separately credited photos. Protect credited and favorited records from automatic eviction. Evict oldest eligible uncredited/unfavorited extra deterministically.
- [ ] With all extras protected, extra capture stays preview-only, with no saved record/frame/JPEG; a newly earned credit still retains. Decide retention once and carry that result through the existing photo envelope rather than re-deriving it inconsistently in UI/upload.
- [ ] Whenever a photo is evicted, remove record, pending frame AND server image bytes together. Keep upload idempotence/ownership and durable rollback; a stale in-flight upload cannot resurrect a deleted image or leave orphan bytes.
- [ ] Cover mixed pending/ready photos, eight separate credited frames plus 56 favorited extras, duplicate credit captures, saturation and coordinated removal. Strict save validation must match runtime policy and still reject impossible/orphaned records.
- [ ] Use a genuine generated 48-resident seed (4891 observed; assert current count) and maximum permitted JPEGs. Measure actual encoded save UTF-8/base64 size for 0/32/64 records and mixed pending. Do not shrink population or raise 8 MiB to make it fit.

Checks:
```powershell
node --test album-retention.test.ts save.test.ts server.test.ts
npx tsc --noEmit
npm run format:check
```
All policy cases must be green with current counts/sizes reported. Keep new public type/API changes explicit in results/06.md for packet 07, including how preview-only and removed IDs are represented. Commit/push. UI behavior itself is packet 07, not established by this gate.
