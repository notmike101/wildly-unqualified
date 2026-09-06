# 03 — Validate persisted routine goals

**Scope:** save.ts, encounters.ts and their tests; a tiny shared parser only if both paths need the same concrete validation.
**Prerequisite:** packet 02 accepted. New branch/worktree.
**Read:** save.ts memory validation near baseline 690–741; wildlifeStep near 961 and routine parsing near 1008; Deer trail parsing near 1320. Search every reader/writer of memory.goal and recentGoals.

The concern is **unproven**: strings like routine:bad:0 or deer-trail:99 may pass text validation and fail on a later tick. Do not claim a crash until reproduced.

- [ ] Start from a valid generated run in an owned temporary directory. Through the existing save-test envelope/load helpers, replace only a relevant resident's goal with malformed values. Exercise loadRun and real advancement. Keep malformed-save tests clearly labeled as negative fixtures.
- [ ] Probe nonnumeric, negative, fractional, out-of-range and extra-segment indexes; stage/path lengths and goal family must match the resident's actual routine. Include a valid partly advanced routine and a valid Deer trail cursor. Record whether failure is at load, save or decision.
- [ ] If accepted malformed state can crash, first retain a minimal red regression, then reject it at the strict save boundary and defensively handle invalid numeric interpretation in the shared runtime path where necessary. Do not silently reset corrupted save files, relax schema validation or modulo invalid values into apparent validity.
- [ ] Preserve legitimate old/current goal families and recent-goal history. Restore a valid climbing/perched/swimming resident and advance it, checking coherent continuation rather than only JSON equality.

Checks:
```powershell
node --test save.test.ts encounters.test.ts expedition-wildlife.test.ts
npx tsc --noEmit
npm run format:check
npm test
npm run build
```
Run sequentially; stop and investigate nonzero exits. All known suite failures from packets 01–02 must now be absent. Record actual counts, not a predicted 196.

If the concern cannot be reproduced because an existing guard already rejects it, cite that source and a passing negative test; do not add speculative duplicate validation. Review the full wildlife diff from b16 and the specific parser change for regressions. Commit/push and write results/03.md with the first clean combined gate or an honest blocker. Packet 04 depends on this gate.
