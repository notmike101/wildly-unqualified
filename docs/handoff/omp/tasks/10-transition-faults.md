# 10 — Transition races, interruption and recovery

**Scope:** server.test.ts/save.test.ts and minimal test support; smallest demonstrated server/save fixes.
**Prerequisite:** packet 09. New branch/worktree.
**Read:** references/next-reserve-handoff.md “Small test matrix,” packet 09 implementation/report and existing temp-directory/socket helpers.

Create separate, bounded cases; do not write a general fault-injection framework.

- [ ] Delay an existing old HTTP mutation/flush, request transition, release it and verify candidate remains primary after all queues settle. Use an explicit latch, not unreliable long sleeps.
- [ ] Stream an old photo body across gate/swap; old upload must not enter candidate image map. Send stale high-sequence input/favorite/photo after swap; valid new-world traffic still works.
- [ ] During delayed archive/candidate publication, disconnect a guest, attempt join/reassignment/upgrade and send commands; no frozen old-state mutation, no unauthorized admission, no new identity. Shutdown waits and saves the installed outcome.
- [ ] Obstruct archive and candidate publication separately using real temp paths. Compare old world, all JPEGs, credits/favorites and credential hashes before/after. Repair only the owned obstruction and retry. Same archive evidence reuses; changed favorite creates another immutable version; corrupted exact target is never overwritten.
- [ ] Start isolated CHILD server processes with explicit synchronization at staging/archive/backup/primary boundaries. Terminate the owned child, restart through real loadRun and assert old-before-commit/new-after-commit. At every point completed evidence remains in primary/backup/archive; no empty reset room. Throwing in a helper is a fault test, not a process-crash test. Keep any test instrumentation local/disabled in normal runtime.
- [ ] Copy a complete stopped test private directory to another owned path/port/origin. Restore with authentic host/guest admission and compare archive bytes, world hash, retained JPEGs/favorites/supplies and resumed wildlife behavior. Do not alter the preserved real user data.

Checks:
```powershell
node --test save.test.ts server.test.ts album-retention.test.ts
npm test
npm run build
npm run format:check
```
If new standalone test files are needed, include them in focused commands and the existing *.test.ts full gate. Record exact interruption points and outcomes, not “crash safe.”

Commit/push, update CURRENT/results/10.md. The report must distinguish atomic replacement, file synchronization, observed process-crash behavior and unproven hardware power-loss guarantees. Close all owned child processes and preserve failure evidence.
