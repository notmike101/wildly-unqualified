# 02 — Four remaining regression failures

**Scope:** game.test.ts, reserve-runtime.test.ts; game.ts/encounters.ts only if a production defect is reproduced.
**Prerequisite:** packet 01 accepted. New worktree/branch from its verified SHA.
**Read:** references/wildlife-validation-findings.md; four failing test bodies at baseline game.test.ts:1126,1272,1513 and reserve-runtime.test.ts:386; relevant photo/theft/carry callers.

- [ ] Run:
```powershell
node --test game.test.ts reserve-runtime.test.ts
```
Record each first failing assertion, not just the parent count.

- [ ] Theft/whistle/stash: the tin is held by animal:p3-raccoon-2 after 38 seconds. Track holder, resident ID, event tick and stash/drop sequence. Decide whether the original drop failed or a later valid theft occurred. If the latter, observe/assert the original event at its actual transition and separately retain repeated-theft behavior. Do not outlaw another legitimate resident.
- [ ] Rejected Deer portrait: required behavior credit must be absent with useful guidance, while a valid optional commission-6 may be present. Assert exclusion of that exact required ID rather than credits == []. Preserve a positive correct-action case.
- [ ] Linked theft/pause/recovery/pair: verify staged player/tin/grip poses agree before waiting. Previous diagnostics left the held tin at camp after relocating the player. Repair an inconsistent fixture only if demonstrated; otherwise reproduce the production carry/encounter defect and fix its common path. Preserve pause, recovery and pair assertions.
- [ ] Obsolete Mallard negative: the action is now implemented. Replace the old “unimplemented” premise with the exact wrong behavior and wrong resident/anchor rejection cases. Keep a real positive supported-action credit and duplicate-credit rejection. Never weaken exact-world/subject validation to green this test.

Checks:
```powershell
node --test game.test.ts reserve-runtime.test.ts expedition-commissions.test.ts expedition-lifecycle.test.ts
npx tsc --noEmit
npm run format:check
```
If broader formatting fails only on untouched files, record it and make a separate minimal format-only correction before the final gate; do not scatter it through a logic fix.

Commit coherent fixture fixes separately from any demonstrated production fix. results/02.md must classify each of the four as fixture issue, product defect, or unresolved, with evidence. All four must be resolved before this packet passes. Update CURRENT, commit/push; continue to the saved-goal concern.
