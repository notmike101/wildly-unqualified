# 01 — Washing setup and stable Deer investigation

**Scope:** encounters.ts, encounters.test.ts. Start from the prepared work/omp-01-wildlife checkout.
**Read:** references/wildlife-validation-findings.md; stepAnimals decoy path near baseline line 1290; both failing tests near lines 418/432; callers of walk, goal selection and interestUntilTick. Load systematic-debugging/TDD skills.

- [ ] Run the existing focused file and save actual output:
```powershell
node --test encounters.test.ts
```
Baseline expected failures: wash precondition assumes six seconds, moved-decoy investigation assumes three seconds. Diagnostic timings were 20.5 and 4.3 seconds respectively; these are observations, not new magic constants.

- [ ] Read drafts/encounters.test.ts and drafts/encounters.ts as unverified references. Change only the two relevant test sections in your checkout. Advance real simulation with a bounded wait until the required precondition, then assert the behavior under test. Do not merely inflate all waits.
- [ ] Washing: observe the SAME resident enter washing, remove food by the test's existing legitimate setup, then assert it stops as specified. Failure before washing is not evidence against food-removal behavior.
- [ ] Deer: after it reaches an unchanged decoy, assert stable investigation over at least 0.5 seconds of real ticks; record this stronger test failing before the production fix. Investigate why repeated approach overwrites investigate. Correct the shared transition with the smallest change.
- [ ] Add/check cases for actual decoy relocation, interest expiry and disturbance recovery so a stability guard cannot pin the Deer forever. The six-line candidate in drafts has not passed these gates; do not accept it solely because it removes flicker.

Verify:
```powershell
node --test encounters.test.ts expedition-wildlife.test.ts
npx tsc --noEmit
npx prettier --check encounters.ts encounters.test.ts
git diff --check
```
Expected: the named file groups pass and the new stability assertion fails on unchanged baseline. If formatting changes are necessary, format only touched files, then rerun affected verification on settled source.

Record original symptom, cause, red/green result and any test-only correction in results/01.md. Update CURRENT, commit/push and verify private remote equality using RULES. The other four known suite failures are packet 02; do not claim full-suite green yet.
