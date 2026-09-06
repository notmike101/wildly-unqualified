# Task 5 programmatic validation — paused on explicit user stop

The user stopped this pass with: "Dont fix anything in this pass. Just document your findings and pause." No source/test/harness edits, new validation runs, commits or pushes were performed after that instruction. Current source changes made before the stop remain preserved, uncommitted and unreverted. Last committed baseline is b16f00ed549e8dac0f26400d3dadd34e00e29f6a in the routines worktree. Full Task 5 acceptance is incomplete.

## Established simulation results

The new accelerated script uses existing production command/tick helpers and native physics. It does not assign passing behaviors, positions, goals or credits. Snapshot/pose inspection provides only movement/camera guidance. Existing arranged negative and legacy regression fixtures are separate from these simulations. Output contract is {name, world, frame, snapshot, verdict, subjectIds}, with completed JSON files written through temporary-file rename.

- task-5-programmatic-species.log: eleven species action captures were earned and frozen: Fox, Rabbit, Squirrel, Beaver, Otter, Badger, Owl, Woodpecker, Mallard, Deer and Heron. Three further frozen transition frames exist for Squirrel climb, Otter surface and Woodpecker flight. These fifteen JSONs including the loop capture are preserved under task-5-programmatic-captures/.
- Fox at tick 5292 earned commission-1. Beaver at tick 2850 earned commission-0/3/6. Mallard at tick 2034 earned optional commission-6. Other captures mostly return field-photo/guidance verdicts; not all are bound goal credits. Squirrel and Deer verdict text names a neighboring identity, so metadata alone does not prove the intended resident is visually prominent.
- transition-otter.json at tick 7488 explicitly returns "Move closer: subject is too small". It is diagnostic evidence, not accepted swimming-photo framing.
- The Raccoon wash attempt timed out without a frame. Inspection of the existing passing wash-turnover test shows this new producer had opened the tin at the camera instead of first approaching within 1.5m of the wash anchor; that guidance discrepancy was identified but not corrected before the stop. It does not establish inaccessible production washing.
- The renderer worker independently owns actual JPEG production/inspection. This report does not claim all eleven actions, contact poses or contexts have passed visual inspection. No COMPLETE marker was written.

## Complete-loop attempt

The same seed 6 simulation earned the natural Rabbit behavior goal and optional cameo through an actual photo at tick 3354 (commission-0/6; loop-natural-rabbit.json). It then continued through the extracted equipment setup helper. The run exited 1 at cameraApproach after equipment transport and tin pickup: ordinary movement stalled at [-2.302531721886025,0,-95.99999999999986] toward [-4,0,-96]. Exact stack and evidence: task-5-programmatic-loop.log, feedingSetup at expedition-equipment-helpers.ts:185 (line numbers at stop).

This is an observed route/approach failure in the script using animalRoute guidance; the obstructing geometry was not diagnosed before stop. It is not yet evidence of an unreachable authored equipment route or a production collision defect. No complete six-goal return/exhibition result was produced. The prior seed 23 equipment regression remains separately passing evidence from the preceding checkpoint, not a passing seed 6 outing.

## Baseline full-suite findings

Root ran the clean b16 full suite: 190/196 passed in 178.059s, exact log task-5-full-suite-b16.log. Six failures remain unresolved in this pass:

1. encounters.test.ts:418 expects a particular raccoon to wash within 6s. A read-only diagnostic using its same arranged fixture reaches washing at tick 1230 / 20.5s, after shared-site approach/turnover. The immediate loss-of-wash assertion after removing food remains the behavior to preserve. task-5-baseline-timing-probe.log records actual transitions.
2. encounters.test.ts:432 expects Deer investigate at 3s. The same fixture reaches investigate at tick 258 / 4.3s, then repeatedly alternates approach/investigate around an unchanged decoy. A strengthened half-second stability assertion fails on baseline: task-5-deer-stable-inspection-red.log. This is a confirmed unstable inspection pose; the uncommitted candidate source change described below has NOT been run or verified green.
3. game.test.ts:1126 expects the tin unheld after a fixed 38s following theft/whistle diversion; actual holder is another resident, animal:p3-raccoon-2. A valid later theft is possible with repeated residents, but first-drop/stash causality has not been traced. No fix or fixture update was made.
4. game.test.ts:1272 expects no credits for a framed Deer with a wrong required behavior; actual result includes commission-6. Optional cameo is now legitimately possible independently of required behavior. The test must retain wrong required-goal rejection without incorrectly forbidding a qualifying optional photograph. No update was made.
5. game.test.ts:1513 linked tin theft/pause/recovery/pair test times out waiting for bound inspection plus Heron display. Its diagnostic shows the tin still held at a camp-relative position after staged player relocations. Stale arranged carry/release setup versus genuine gameplay failure remains unproven; no fix was made.
6. reserve-runtime.test.ts:386 is explicitly named "unimplemented new wildlife commissions..." and assigns a Mallard its now-supported dabble pose/action, then expects rejection. That assumption is obsolete. A revised strict wrong-action/exact-identity negative is needed while retaining duplicate-ID rejection and separate earned positive cases. No update was made.

## Exact pre-stop worktree changes

- encounters.ts: six-line candidate guard retains an already-investigating Deer near the unchanged decoy until its interest expires. Added after the failing strengthened assertion, before the stop. **Unverified candidate, not an accepted fix.**
- encounters.test.ts: replaced fixed Deer delays with bounded waits and added half-second stable-inspection assertion. Changed two wash entry waits from 6s to 30s, including the second existing food-restoration case through the same replacement. Immediate food-removal rejection is unchanged. Only the targeted Deer red test ran; no post-candidate green or formatting gate ran.
- expedition-equipment-helpers.ts (new): extracted the existing actual transport/setup helper, returns the earned photo result, no production behavior edits.
- expedition-equipment.test.ts: now invokes that extracted helper using its original seed 23.
- expedition-validation.ts (new): accelerated six-goal and twelve-species capture producer. Both attempted branches failed as documented above.

The new helper/script/test extraction passed TypeScript before the later Deer source/test changes. This is not a final gate on the current worktree. Nothing from this programmatic pass is committed or pushed.

## Owned process state and pause

Species producer session 59310 exited 1 after the Raccoon timeout. Loop producer session 2314 had already exited 1 with the route stall when stop was handled; a stop request returned that completed exit. A read-only Win32_Process query found no remaining node expedition-validation.ts --loop/--species processes. There is no owned running simulation PID to terminate. Other Node/browser processes were not touched. Renderer worker was notified of the user stop and retains responsibility for its separate cleanup/report. All logs and completed JSONs remain intact; no evidence was deleted.

Paused. No further diagnosis, repairs or runs are authorized in this pass.
