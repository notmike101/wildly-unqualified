# 14 — Portable candidate and orchestrator return

**Scope:** README.md, SERVER.md, VERIFICATION.md, new expedition checkpoint, release.ts/test only as needed.
**Prerequisite:** packet 13 feasible automated acceptance. New branch/worktree.
**Read:** references/docs-release-handoff.md; current release.ts and SERVER.md; RETURN.md. Historical line counts/module allowlist are stale; derive from final source.

- [ ] Verify no material unexplained automated failure. Update documentation to actual 12 species/36–48 residents, generated 6+2 objectives, schema 3/content forest-expedition-1, implemented albums/archives/Next/audio and real launch/test flags. Keep 40–60 minutes a human target unless observed. Remove broken parent-research/private-access dependencies from portable instructions; preserve historical checkpoints.
- [ ] Run final settled-source gates sequentially:
```powershell
npm test
npm run build
npm run format:check
node assets/check-v4.mjs
node assets/audio/check.mjs
npm run release
```
Check every exit code. Current runtime allowlist has eleven modules; any new runtime import must be packaged/tested. Audio/license/provenance must exist in the produced web payload.

- [ ] Use the exact printed NEW release directory, install with npm ci --omit=dev, then launch its absolute wildly-unqualified/server.ts entrypoint from a different cwd. Set WU_BIND_HOST=127.0.0.1, a new free WU_PORT, exact WU_PUBLIC_ORIGIN, absolute WU_DATA_DIR and WU_WEB_DIR. Do not use default relative data in a source tree or overlap private/public paths.
- [ ] Verify health, page, authenticated host/guest socket and actual JPEG delivery. Gracefully pause/flush/stop, copy the COMPLETE stopped private test directory to another path/port/origin and verify world hash, JPEG bytes/favorites/supplies, archives and resumed wildlife. Re-admit on changed origin using genuine credentials; never log them. Do not run two writers on one directory.
- [ ] Compare the preserved originals against references/preserved-mvp-files.json without modifying them. If a pre-existing mismatch appears, report the exact file/hash and investigate; do not overwrite it to match. Home server remains untested.
- [ ] Prepare an own-PC candidate launch/access record outside Git, with a compatible private data path and exact process ownership. Preserve the original MVP. Keep an intentionally running candidate server only if needed for the user's playable result; close temporary test resources.
- [ ] Review final diff against STATE.md and every packet report; fix verified acceptance failures in small commits. Write results/FINAL.md using RETURN.md, update CURRENT and push with private/remote-SHA proof.

The deliverable is a **candidate for orchestrator review**, not automatic final acceptance. Do not merge main, tag forest-expedition-1 or publish a public release. Return exact source/release/evidence paths and remaining listening/pacing/WAN/home-server gates, then pause for the orchestrator.
