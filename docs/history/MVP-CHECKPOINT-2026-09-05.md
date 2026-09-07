# Wildly Unqualified forest MVP

> Historical record preserved during the 2026-09-07 reorganization. Commands,
> source paths, process status, and acceptance claims describe that earlier version.
> See [the current maintenance guide](../MAINTAINING.md) and [server guide](../SERVER.md).

Final technical acceptance completed on 2026-09-05 local / 2026-09-06 UTC. The approved forest implementation is independently reviewed. One two-player and two four-player outing chains, forest/crew/notebook checks and actual production-release migration pass. A fresh private room is running on this PC. Human playtesting is next; the intended 20–30-minute human playtime has not been established.

The [implementation plan](../superpowers/plans/2026-09-05-wildly-unqualified-mvp.md) and [working ledger](../../../.artifacts/wildly-unqualified/mvp-2026-09-05/progress.md) record implementation and acceptance separately. The accepted prototype, its private outing, original concepts, old GLBs and both earlier Blender scenes remain preserved.

## Playable systems

- A continuous forest connects camp, deep woodland, washout, clearing and wooded wetland. Sixty-four bounded site/commission selections choose a raccoon, deer and heron objective plus the simultaneous raccoon-inspection/heron-display portrait.
- A shared case, screen and plank have two exclusive handles; a decoy has one. Heavy equipment is slow alone and faster with two carriers. Body geometry blocks motion and photographs. A latched gate and a physically placed plank change the shared route, with a dry detour remaining available.
- Noise, distance, cover, food and moved lures influence animal decisions. Inspection ends after bounded interest; animals can lose interest or move away. Authored navigation avoids permanent scenery rather than cycling through fixed waypoints.
- Open-case mishaps spill recoverable bait. A raccoon can borrow a hat after a visible reach; players can retrieve it with E. A timed-out chase drops the hat onto reachable ground for E recovery; a restart returns it to its owner. Decoy placement and its bait cup affect the same wildlife rules.
- Four stable crew colors, numbers, names and distinct hats appear during play. Actual 640×360 shared JPEGs freeze visible state and exclude HUD labels. Four commissions, a connected crew back at camp, readiness, exhibition and per-player favorites form the end sequence.

## Forest and assets

There are 39 new models in five version-3 GLBs: 29 environment models, one deer, one researcher, four hats and four equipment assemblies. Eight mature tree silhouettes provide 18–32m canopy. The world has 718 canonical placements, including 179 mature trees and three retained camp furniture models. The atmospheric sky, static clouds, sunlight, distant silhouettes and fog are shared by the live and photo cameras.

All v3 authoring and export used visible foreground Blender. No Blender MCP was available or used. [Editable scene](../../assets/library-v3.blend), [gallery](../../assets/preview-v3.png), [equipment](../../assets/equipment-preview-v3.png), [provenance](../../assets/PROVENANCE-v3.md) and [asset brief](../../assets/BRIEF-v3.md) remain available.

The final static audit validates all five GLBs without errors or warnings, imports all 39 models and 89 pivots through the actual GLTFLoader, verifies manifest bounds/proxies and preserves all 18 protected baseline files. It found a dry-bank edge support mismatch; the shared ramp now uses the actual model width, and imported-mesh, player and native-tin checks pass. See [final asset audit](../../../.artifacts/wildly-unqualified/mvp-2026-09-05/task-7-final-assets.md).

## Observed acceptance so far

| Area | Evidence and limit |
|---|---|
| Equipment | Independent authority/client reviews pass. Ordinary-controls two/four-player routes and completed outing chains cover shared carry, gate, physical plank placement and every player's crossing, including the HTTPS/150 ms chain. |
| Wildlife | All 64 selected configurations complete four goals in arranged production scenarios. All three visible outing chains complete their four actual selected commissions. The first combined photos had obstructed subjects; the final original has both separately visible, though small in frame. |
| Mischief | Actual open-case spill/E recovery took 16.9s in one visible run; a borrowed-hat/E recovery took 12.2s. A restart during another theft restored the hat safely. A real captured JPEG visibly shows the raccoon wearing the yellow hat. |
| Exhibition/favorites | All three outings returned the connected crew, readied, finished and retained a shared favorite through restart. They produced 5/7/6 original JPEGs. The final delivered-build notebook check decodes all six HTTPS-outing images and confirms dark readable favorite attribution. Interruptions and saved-world continuations remain explicit. |
| Final rules gate | 111/111 game tests pass, including the added brook visibility regression; independent rechecks, game build/format and shared package gates pass. |
| Current build | TypeScript/Vite pass; `index-C-4DfThH.js`, 981.09 kB minified / 276.17 kB gzip, and `index-yUq1JVPQ.css`. Vite's existing large-chunk advisory remains visible. |
| Portability | The final clean 27-file / 5,343,156-byte package exactly matches a separate three-package production install. Actual browser-earned photographs and a shared favorite survived complete-directory transfer, changed data path/port/origin, host recovery and resumption from another working directory. This used an interrupted two-player outing; full-slot guest reassignment is covered separately by socket tests. |
| Forest/performance | Habitat, sky, trunk/log/rock collision, standing-screen JPEG, visible wash water and all four crew in shade/sun pass. A 20-second active 1400×820 viewport sample on RTX 3080 measured median 8.30 ms / p95 9.00 ms and stable 145.67 MiB renderer memory. A labeled stationary socket fixture kept that outing active; no hidden browser was used. The final trail-height/text changes received visual checks, not a repeated performance benchmark. |
| Own-PC handoff | Fresh paused HTTPS room on port 4316, zero reserved player slots; public/local readiness, exact assets and private-path rejection verified. All owned test browsers and isolated test listeners are closed; prototype rooms and Blender remain intact. |

[Visible outing ledger](../../../.artifacts/wildly-unqualified/mvp-2026-09-05/outing-report.md) preserves unsuccessful driver attempts and recoveries. Read-only snapshots and authored geometry guided ordinary keys/buttons; no progression or animal state was injected. Seeds 1150906316, 3939270088 and 892274019 completed through saved-world continuations. The last selected raccoon wash, deer decoy, heron preen and the combined portrait through HTTPS/WSS with 150 ms added delay. Its hat recovery followed a timeout drop, and a 178.7-second decoy recovery includes manual driver guidance. [Corrected acceptance summary](../../../.artifacts/wildly-unqualified/mvp-2026-09-05/outing-acceptance-summary.json) preserves these qualifications and raw results.

A server socket fixture also had a diagnosed test-only pickup error: at its old 0.7m stopping distance, the case handle could be closer than the tin. Its approach now reaches 0.4m; the real cue/reconnect/restart test passes with all assertions intact. [Diagnosis](../../../.artifacts/wildly-unqualified/mvp-2026-09-05/cue-fixture-report.md).

## Run and preserve

Use the [README](../../README.md) and [private MVP host entrance](../../../.artifacts/wildly-unqualified/MVP-HOST-ACCESS.md) to play the fresh room. The [launch record](../../../.artifacts/wildly-unqualified/mvp-launch.json) and [final payload manifest](../../../.artifacts/wildly-unqualified/mvp-2026-09-05/portable-release-final-manifest.json) identify exact paths/builds. The [server runbook](../SERVER.md) covers production installation, origin configuration, save/stop and complete-directory migration. Never start schema 2 on the prototype's schema-1 data; verified rejection leaves that data unchanged.

The later home server remains inaccessible and unverified. Friends use one purchase per player in the intended product; there is no paid-host tier or runtime AI service. Human duration, enjoyment, contribution balance and people on different networks still require human playtests. In the automated four-player runs, two observers often waited during setup, and the tin escort/quiet photography strategy remained prominent across seeds.
