# Task5 programmatic render — stopped, findings only

User instructed: “Dont fix anything in this pass. Just document your findings and pause.” No further rendering, captures, tests or harness/source fixes were started after handling that instruction. The existing runner was stopped through its STOP control and completed its owned-resource finally cleanup (native exit0). Port4322 is closed. Only its returned Vite server and visible Playwright browser were closed; user browsers, Blender and old rooms were not touched.

## Source and method

Harness/evidence: `task-5-programmatic-render/`; producer inputs: `task-5-programmatic-captures/`, both in this ignored plan workspace. Renderer source is the **routines** worktree at b16f00ed549e8dac0f26400d3dadd34e00e29f6a, not the older expedition renderer. `output/source-hashes.json` records the exact view.ts/main.ts/level.ts/wildlife.ts/forest-view.ts bytes loaded for this pass. Producer's new equipment helper extraction did not change the renderer, according to the producer. No production files were edited by this worker.

Each producer JSON supplied actual `{name,world,frame,snapshot,verdict,subjectIds}`. The harness passed those frames to production `createView`, `view.update` and `capturePhoto`, mirroring main.ts's capture-time state overlay and snapshot restore callback. It did not invent animal poses, perform gameplay driving, upload an album, assign credit or invoke an audio layer. Real WebGPU adapter: NVIDIA/Ampere, isFallbackAdapter=false. One visible browser displayed the rendered output. No broad tests were run by this worker.

## Completed outputs

Exactly **15 cases** were rendered and saved when the stop was handled:11 distinct species action cases,3 transition cases and1 additional natural Rabbit loop case. Each basename below has an actual640x360 `.jpg`, a visible-harness `.png` and a metadata `.json` under `task-5-programmatic-render/output/`.

| Basename | Frozen action | JPEG bytes |
|---|---|---:|
| action-badger | dig |34884|
| action-beaver | gnaw |24603|
| action-deer | graze |41001|
| action-fox | pounce |32144|
| action-heron | preen |41184|
| action-mallard | dabble |29157|
| action-otter | groom |33881|
| action-owl | roost |44801|
| action-rabbit | nibble |37325|
| action-squirrel | cache |26255|
| action-woodpecker | tap |39615|
| loop-natural-rabbit | nibble |35357|
| transition-otter | surface |34912|
| transition-squirrel | climb |32342|
| transition-woodpecker | fly |40546|

Completed JPEG write times span2026-09-06T18:39:21.941Z through18:40:26.173Z. STOP control was written18:40:32.451Z; all15 were already present at the first stop/cleanup inventory. `output/results.json` and `run.log` preserve individual completion records. No additional cases were requested after stop.

## Findings established by the completed render checks

- All15 original JPEGs fit the production65536-byte maximum (range24603–44801bytes).
- Each frame rendered twice through the same production apply/capture/restore sequence with an identical JPEG SHA256. This supports deterministic frozen render preservation for these inputs; it is not a network/upload or full live-game test.
- Actual imported PhotoBody/PhotoHead marker positions matched production `subjectPoints` transformed by the frozen quaternion/root pose in14cases. Maximum measured discrepancy was6.199373753916441e-8m. This is the actual rendered scene graph's marker alignment, not merely two copies of pose math.
- Heron's marker check was **unavailable or ambiguous**, so no imported-body/head alignment pass is claimed for it. Its JPEG render and repeat equality did complete.
- Two startup errors are retained in results/log: the harness initially imported CAMERA_FAR from level.ts and then forest-view.ts, neither of which exports it. The correct view.ts import was applied before successful renders and before the stop. These were harness setup errors, not confirmed production defects. No case-level render exception occurred after successful startup.

No production **visual** defect was confirmed by this worker during this pass. The stop arrived before visual image review: none of these new15JPEGs was opened for qualitative inspection by this worker, and no new inspection/test was started after stop. Files existing or matching markers do not establish recognizable limb motion, bark/claw/feet support, waterline, branch/track readability, landmark composition or full visible continuity.

## Unfinished checks and producer-reported findings

Raccoon action capture is missing; all12species are therefore **not** covered. Producer reported its raccoon wash attempt timed out, the extra Otter transition was too small for the intended photo framing, and its loop stopped on a native approach stall after one credited natural Rabbit capture. Those are producer findings, not independently reproduced render defects here; consult the producer's report and capture verdicts for exact authority/evidence.

Input verdict credits are retained verbatim in each output JSON; rendering did not award or revalidate them. This worker makes no six-goal/full-outing pass claim. The promised qualitative ground/climb/perch/swim/contact, branch/track and frozen/live comparison review remains unfinished. Repeated frozen images and marker agreement are the completed narrow checks only.

No COMPLETE marker was received from the producer. It reported both owned simulation producers had stopped with exit1. This renderer stopped on the explicit user instruction, preserved all existing evidence, and is now paused. No fixes or additional testing are proposed or performed in this pass.
