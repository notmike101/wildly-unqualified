# 04 — Complete the outing through production commands

**Scope:** expedition-test-helpers.ts, expedition-equipment.test.ts, a reusable expedition-equipment-helpers.ts and expedition-validation.ts. Product changes only for independently demonstrated defects.
**Prerequisite:** packet 03 clean gate. New branch/worktree.
**Read:** those existing helpers; drafts/README.md; drafts/expedition-validation.ts and drafts/expedition-equipment-helpers.ts; references/task-5-programmatic-validation.md only for the failing producer details.

- [ ] Selectively transplant the draft helper extraction/harness into your checkout. Do not transplant the candidate encounters fix. Ensure imports resolve locally and typecheck before running.
- [ ] Keep positive progress through applyCommand, ordinary inputs, advanceRun and native physics. Read-only world/pose guidance is allowed; no forced positions, behaviors, completion IDs, credits or fake uploads. Scale simulation time with ticks, not production clock/physics changes.
- [ ] Reproduce the seed-6 stall near [-2.30,0,-96] approaching [-4,0,-96]. The draft uses animalRoute for player/carry guidance. Use generated nav/camera/handling approaches and a bounded local clearance-aware detour; test a narrow blocking case. A stuck guide is not automatically a production collision defect.
- [ ] Repair the Raccoon producer's setup using the passing close wash approach: actually carry the tin within the required range before opening it. Assert the intended resident is visible/eligible. Frame size and intended subject must be checked, not just absence of a “hidden” word.
- [ ] Complete six required IDs, use real equipment, exercise recoverable mischief and replenishment, return the connected crew, ready/finish and assert exhibition. Optional objectives must not gate completion. Persist every earned PhotoFrame with its world/snapshot/verdict and a final summary.
- [ ] Generalize only the parameters needed for distinct seeds and two/four players. At least one two-player and one distinct four-player command run must complete here; packet 13 adds combined transport/client acceptance. The draft currently hardcodes two players/seed 6, so do not advertise unimplemented flags.

Initial runnable draft commands, after local adaptation:
```powershell
$env:WU_CAPTURE_DIR = Join-Path (Get-Location) '.artifacts/omp/04/loop-a'
node expedition-validation.ts --loop
# Set a separate new output directory before species production.
$env:WU_CAPTURE_DIR = Join-Path (Get-Location) '.artifacts/omp/04/species'
node expedition-validation.ts --species
```
Add/document actual seed/crew flags in the script and results rather than inventing them in reports. Bound loops and print useful final stalled-state diagnostics, with no credentials.

Checks: node --test expedition-equipment.test.ts expedition-wildlife.test.ts expedition-commissions.test.ts expedition-lifecycle.test.ts; npx tsc --noEmit; npm run format:check; completed scenario exit codes. Never call a timeout partial success.

Commit/push reusable harness and smallest necessary repairs. results/04.md records exact flags, seeds, crew, required IDs, ticks, frame paths and limitations. This is accelerated logic/physics evidence, not human playtime or UI/WAN evidence.
