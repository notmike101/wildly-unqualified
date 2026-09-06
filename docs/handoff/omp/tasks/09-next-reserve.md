# 09 — Host-only Next reserve transaction

**Scope:** server.ts, game.ts, shared.ts, main.ts, index.html and tests.
**Prerequisite:** packet 08 exports verified. New branch/worktree.
**Read:** references/next-reserve-handoff.md (entire, ~2,000 words); packet 08 report; server startServer, mutate/flush/tick/WS/upload/disconnect/close callers. Historical line numbers in the reference require rebasing.

- [ ] Add the strict world-scoped next-reserve command and host UI action, available only in exhibition. Refuse a guest, wrong world, wrong phase or any pending frame/thumbnail. Keep asynchronous I/O in server, not game simulation.
- [ ] Use a synchronous transition gate and one promise before the first await. Gate WS commands/favorites, admissions/reassignment/upgrades, physics and autosave; drain already-running HTTP mutations without awaiting the queue from inside itself. Recheck guards and await a final old flush as a write barrier.
- [ ] Build/validate fresh createRun seed/world ID and native physics before primary publication; archive the frozen old run/images via packet 08. Preserve room secrets/session mappings, host and reserved player IDs/names/slots/lastSeq. Reset outing positions/gear/goals/album and start paused at camp.
- [ ] Save the candidate through the same drained save queue. Successful primary publication is the commit point. Swap run/images/physics together with NO await, then reset world-scoped caches/timing and deliver world/hash before snapshots. Keep a coherent live bundle; never retain a physics closure over the old run.
- [ ] Precommit failure disposes only candidate resources and restores a usable old outing. Postcommit delivery/disposal failure must not roll back or flush the old world. Ambiguous publication must inspect the actual primary world; undecidable storage state stays paused with an explicit error.
- [ ] Disconnects remove dead sockets immediately but defer simulation mutations during freeze; reconcile on either outcome. Server close waits for the transaction then flushes the installed outcome. Old uploads recheck world after body receipt and inside commit; old high-seq commands cannot consume new-world sequence.
- [ ] Client clears stale pending captures/prediction/readiness on world replacement, preserves local identity/settings, installs/validates blueprint before commands and starts paused. No forced page reload to hide a mismatched world.

Checks:
```powershell
node --test shared.test.ts game.test.ts save.test.ts server.test.ts
npm run build
npm run format:check
```
Add real socket guard/success tests first and run them with the command above. Verify matching new world/hash, unchanged identities/secrets (compare, do not log), zero old-state overwrite and old run usable after forced precommit storage failure. Do a small visible host-button/client-install check.

Commit/push; results/09.md documents guard, freeze/drain, commit, failure and client sequence with exact test names. Packet 10 stress-tests races/crashes; this packet alone is not a durable-transition acceptance claim.
