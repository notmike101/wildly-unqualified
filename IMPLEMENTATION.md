# Implementation ledger

The forest MVP is ready for human playtesting. Independent reviews, 111 game tests, game build/format and shared package gates pass. One two-player and two four-player outing chains completed through recorded saved-world continuations, including actual HTTPS/WSS with 150 ms added delay. Forest, crew lighting, original photographs, notebook and production-release relocation checks pass. A fresh private room is running on this PC; the [README](README.md) links host access and the portable package. The [forest checkpoint](MVP-CHECKPOINT-2026-09-05.md) and [working ledger](../.artifacts/wildly-unqualified/mvp-2026-09-05/progress.md) retain the evidence. Human duration, enjoyment, balanced contribution and separate-network human play remain unmeasured.

| Forest task | Current implementation and evidence |
|---|---|
| 1. World/state | Shared placements, manifest-derived geometry, supported navigation, strict schema-2 saves and explicit v1 refusal; foundation review corrections pass. |
| 2/7. Forest/identity | 39 new models, 89 attachment pivots, 718 placements, 179 mature trees, sky/fog and four colors/names/numbers/hats. Static/import, actual habitats/collision/screen, four-crew shade/sun and active single-viewport performance pass. A final visual correction exposes the shallow brook above the trail. |
| 3. Physical co-op | Exclusive handles, two-person carry, actual compound collision, gate/plank routes and recovery; two-player and four-player 150ms ordinary-controls crossing pass. |
| 4. Wildlife | 64 bounded selections, three reactive species, authored routes and four selected commissions. All configurations pass arranged production checks and independent review; three visible outing chains complete actual goals, including both inspect/wash and graze/decoy alternatives. |
| 5. Mischief | Actual open-case spill/E recovery, hat reach/theft/E recovery, safe midpoint restart and normal decoy bait/move/restore pass. The same tipped decoy that exposed a carry trap was recovered through the existing Settings action after a reviewed regression fix. |
| 6. Photographs/exhibition | Frozen props/route/hats, actual JPEG capture, strict favorites and connected-crew readiness. All three exhibitions/favorite restarts pass with 5/7/6 original JPEGs; the final combined portrait has separately visible subjects. Final visible notebook check decodes all six HTTPS-outing images and confirms readable selected-by text. |
| 8. Portability/acceptance | Seven-module, 27-file final production bundle matches its installed/tested payload. Actual earned data, JPEGs, favorites and host recovery survive changed local folder/port/origin. The fresh own-PC HTTPS room has zero reserved slots. Owned test windows/servers are closed; prototype rooms and Blender remain intact. |

Corrections include measured carry/re-grip traps, screen/tin/handle prediction and occlusion mismatches, dry-bank support, the trail hiding wash water and a test-only tin-pickup cutoff. Behavioral fixes retain failing evidence and runnable regressions. Removing a notebook color override restores readable favorite attribution. [Fresh gates](../.artifacts/wildly-unqualified/mvp-2026-09-05/final-gates.md), [asset recheck](../.artifacts/wildly-unqualified/mvp-2026-09-05/task-7-final-assets.md), [cue fixture diagnosis](../.artifacts/wildly-unqualified/mvp-2026-09-05/cue-fixture-report.md), [brook review](../.artifacts/wildly-unqualified/mvp-2026-09-05/brook-visibility-review.md).

## Preserved prototype and earlier foundation history

Ruling: work in the existing game directory because this workspace is not a Git repository; do not initialize Git or copy unrelated tools. Preserve all prior concepts.

Ruling: delegate isolated asset authoring and bounded server/game modules once shared contracts exist, while the controller builds and verifies the browser. This follows Superpowers subagent-driven development without concurrent ownership of files.

| Plan task | Implemented result | Evidence / remaining gate |
|---|---|---|
| 1. Join and movement | Private four-slot room, strict messages, origin/cookie authentication, prediction and interpolation | Real socket and browser movement checks; initial missing-module test preceded implementation |
| 2. Shared physical tin | One exclusive owner, actual standard Box3D gravity/contact, place/drop/recovery | Ownership, reach/occlusion, WASM fall/contact and lifecycle checks |
| 3. Raccoon cooperation | Rattle, inspect, steal, follow and reclaim; articulated reactions | Causal rule test and two-client actual-controls photography; human interpretation pending |
| 4. Shared photographs | Server frame/credit, real WebGPU JPEG, pinned credited album, upload ownership and retry | Geometry/occlusion tests, actual shared decoded image and browser framing checks |
| 5. Linked outing | Heron quiet/display, same tin, three assignments, discovered clues, camp exhibition | Complete browser route with real keyboard/buttons and 150 ms added WebSocket RTT |
| 6. Recognizable models | Original v1 plus 24 extra kit models and four variants; shared cues, local footsteps and settings | Nine validated/imported GLBs and in-game screenshots; human silhouette/audio usability pending |
| 7. Persistence | Serialized atomic versioned saves/backups, pending photo frames, role-safe rejoin/reassignment | Disk/restore/race tests and actual browser restart/reconnect |
| 8. Hosting and portability | Local server, exact configuration, immutable allowlisted release and migration runbook | Fresh production-only install, local port/origin/data relocation and actual authenticated HTTPS/WSS check; fresh internet room left running |
| 9. Verification and handoff | Existing shared tools preserved, actual WebGPU checks, scoped independent review, observed results | Separate-internet two/four-person sessions, duration and inaccessible home-server verification remain pending |

The independent reviewer identified four issues: temporary admission failures stopped reconnects, keyboard yaw could leave the accepted range, the viewfinder diverged from capture framing on tall windows, and friends lacked shared sound cues. All were fixed and passed a scoped re-review and affected checks. Visual inspection also moved a tripod away from the shelter's photo opening and grounded the small equipment on its supports.

The user's visibility instruction supersedes the original background-authoring step. Version 1 used actual background Blender CLI. Version 2 was created in visible Blender PID 51680 with timers yielding between model batches, then exported and rendered there. Its source remains open for inspection; subsequent asset work must stay visible/foreground. Neither pass used Blender MCP. All original assets/concepts are preserved.

## Forest MVP task 1: shared world and versioned state

Implemented on 2026-09-05 without changing the preserved prototype release or reserved four-player save. The v2 snapshot/save contract includes seeded world selection, stable crew slots, four field props, route state, spills, hats, spare bait and immutable capture copies. After the final model integration, the canonical level exports 29 environment model names across 715 placements, including 179 mature trees, split walkable terrain, supported physical ramps, a dry detour, a west return and a wetland water blocker. All environment proxies now derive from the final manifest; crossing/equipment behavior remains Task 3.

Failing-first evidence: after adding the slot/world and version-1 incompatibility regressions, `node --test wildly-unqualified/game.test.ts wildly-unqualified/save.test.ts` reported 17 passes and the two expected failures (`snapshot.version` was 1; the old envelope did not report explicit incompatibility). Focused surface/level tests also failed on the missing `surfaceHeight` and `CONTENT_VERSION` exports before implementation.

Validation: `npm.cmd run wu:test` passed 37/37. `npm.cmd run wu:build -- --outDir web-mvp` passed TypeScript and the Vite production build without writing the preserved `web` output; Vite reported the existing bundle-size warning for a 959.49 kB minified chunk. Preserved hashes are recorded in `.artifacts/wildly-unqualified/mvp-2026-09-05/evidence/task-1/preserved-prototype-hashes.json`; both hashes were rechecked unchanged after validation.

That was the Task-1 worker checkpoint. The coordinator's subsequent five review corrections, final forest/identity rendering and readiness fix pass the 42-test suite, build and formatting gate. The final [MVP checkpoint](MVP-CHECKPOINT-2026-09-05.md) records the 966.73 kB client, real visible forest check and actual JPEG. Delegated execution/re-review was interrupted by the account usage limit; do not mark the full eight-task MVP plan complete.
