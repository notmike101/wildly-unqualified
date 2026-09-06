# Species contact calibration — Task 5 preparation

Calibrated from the actual existing `wildlife-kit-v4.glb` and `forest-kit-v3.glb`, with no source/export/runtime changes. Exact numerical data, scripts and images are in `contact-calibration/` beside this report. This resolves static contact/immersion poses; it does not complete live routines, collision transitions, frozen-photo acceptance or human pacing.

## Coordinates and reusable transforms

Game coordinates remain metres, +Y up, -Z forward. All part angles below are **XYZ Euler radians relative to the imported neutral part**, not additive frame-by-frame rotations. Preserve imported part translations and unit scale. Apply placement transforms in this order: `worldPosition = placement.position + rotateY(placement.yaw, localPosition)` and `worldQuaternion = yawQuaternion(placement.yaw) * localQuaternion`. The numeric checks exercised all four quarter turns, not just an unrotated tree.

Bind `FootL`, `FootR`, `Head` and other parts through `findPart` / `userData.partName`. Photo points follow the resulting full hierarchy. The existing `species-animation-handoff.md` contains the neutral local-versus-root-relative photo-point table; **none of these calibrations relocates PhotoHead or PhotoBody to an invented point**.

## Woodpecker: usable cling and tap without an export change

Use this **SnagTall-relative** root position/yaw table. For current pocket coordinates, add the local snag origin `[7,0,-11]` before the pocket quarter turn. Leave Body, wings and Tail neutral. Set both FootL/FootR rotation to `[.95,0,0]`; set Head to `[.58,0,0]` at the tap endpoint and `[.76,0,0]` at the withdrawn/rest endpoint. Interpolate this bounded head rotation range; nine evenly spaced phases were measured. No part translation is needed.

| Snag height index | Root position | Root local yaw | Change from previous root Z=.85 |
|---:|---|---:|---:|
| 0 | [0,2.50,.738890857] | -.18 | -.111109143 m |
| 1 | [0,2.95,.723826736] | -.30 | -.126173264 m |
| 2 | [0,3.40,.705257203] | -.42 | -.144742797 m |
| 3 | [0,3.85,.685117075] | -.42 | -.164882925 m |

Actual vertex plus triangle-centroid rays, across all heights/quarter turns and nine head phases:

- FootR nearest mesh point stays **1.000 mm outside bark**. FootL nearest point is **1.122–1.923 mm outside**; both feet contact the trunk visually at ordinary display resolution.
- Body mesh remains **80.210–88.593 mm outside bark**, rather than being pulled into the trunk to satisfy the old marker.
- Head/beak nearest point at tap is **1.755–3.047 mm outside**; withdrawn endpoint is **35.518–37.795 mm outside**. All intervening sampled phases remain outside the mesh.
- Tail is neutral and **235–254 mm outside**: this is a two-foot grip/tap pose, **not a tail-braced pose**. Do not claim tail contact from this calibration. A separate bracing motion is optional additional art work, not required to repair the floating feet/beak.

This corrects the real foot geometry, orientation and beak excursion together. The previous TrunkCling marker alone was insufficient: its coordinate `[0,.09,-.08]` is not the toes' contact location after foot articulation. **No intrinsic mesh defect prevents a usable cling/tap pose; no tracked asset correction is requested.**

Exact records: `contact-calibration/wood-probe.json` (root/part transforms, photo points), `calibration-checks.json` (all transformed samples), `verify-geometry.mjs` (reproducible read-only assertion check).

## Owl and Squirrel: crown-adjusted RootArch stance

The original contact Z=.35 sits toward the curved branch's edge. Aligning the entire animal to that edge gave an excessive ~61-degree pitch at the fourth contact and was rejected during preparation. Move the stance **.15 m toward the crown, to RootArch-local Z=.20**, and use the following measured root heights and rotations. These are complete asset-root poses, not a claim that the previous Z=.35-contact anchor is already the asset origin.

| Contact index / root X | Root Y (both species, rounded) | Root Z | Root Euler XYZ |
|---|---:|---:|---|
| 0 / -.9 | 3.715900 | .20 | [-.160305,0,.257884] |
| 1 / -.3 | 3.876210 | .20 | [-.160305,0,.257884] |
| 2 / .3 | 3.926500 | .20 | [-.228282,0,-.357666] |
| 3 / .9 | 3.663574 | .20 | [.522843,0,-.392285] |

Use the full-precision quaternion/position records in `perch-probe.json` for implementation checks. Root quaternions include the slope alignment; multiplying placement yaw on the right would give a different pose. Owl FootL/FootR and Squirrel LegBL/LegBR retain neutral part rotations/translations. Numerical solver residue in the JSON is below 1.4e-8 m and can be treated as zero; no visible leg shortening/extension is required.

Across both species, four contacts and four quarter turns, both Owl feet and both Squirrel hind paws have nearest mesh clearance **approximately 1.000 mm**. Actual Body mesh stays at least **48.143 mm** clear for Owl and **69.096 mm** clear for Squirrel; head/tail samples also remain outside the arch. Squirrel forepaws remain in its natural raised neutral pose; this is a supported hind-paw stance, not a four-paw walking pose.

The calibrated root transform must be applied consistently to the posed actor and authoritative/frozen subject-point calculation. If Task 5 changes resolved contact data instead of representing the stance transform relative to an anchor, update the matching contact validation in that task. Do not apply an unexplained visual-only translation while leaving photography geometry behind. No `world.ts` change was made here.

## A measured squirrel approach surface

`contact-calibration/squirrel-approach-surface.json` identifies a concrete approach along the actual arch's left leg, rather than a straight line from ground to a floating high point:

- Ground-side staging candidate: RootArch-local `[-2.5,0,.70]`, facing the front of the arch (-Z); the first measured bark point is `[-2.5,.08,.344612521]`.
- Follow the front skin alongside centreline XY waypoints `[-2.5,.08] -> [-2.2,1.8] -> [-1.3,3.2] -> [-.3,3.55]`; Z comes from actual front-surface ray hits, not a constant trunk radius.
- Wrap from the front to the crown using rays around centre `[-.3,3.57,.2]`, outward direction `[0,sin(angle),cos(angle)]`, angle 0 through pi/2. The terminal surface is `[-.3,3.875209539,.2]`, directly below calibrated stance 1.
- **85 actual mesh-hit points, zero misses, maximum consecutive surface-point separation .102923 m.** The image marks these surface samples. This is a measured supported surface route suitable for bounded climbing/grip planning; it is not yet a solved moving four-paw pose or swept-body validation. Ground staging is a proposed approach datum, not a new generated navigation node. Limb stepping, body clearance along the full moving transition and final turn into the stance remain explicit Task 5 checks.

## Swimming waterlines and shore datum

Final inspection-selected **neutral floating** waterlines are Beaver **.30 m**, Otter **.20 m**, Mallard **.21 m** above their grounded model roots. All root/part rotations remain neutral in the calibrated float pose. These are stylized art choices checked against real meshes, not zoological buoyancy measurements or a finished paddle cycle. The earlier .25/.16/.18 candidates are preserved only as `initial-swimming.png`; use the final values below.

`assetRootY = visibleWaterSurfaceY - localWaterline`. Do not use the submerged physical bed or add half the animal height.

| Species | Local waterline | Root Y if visible surface=.1200 | Root Y for current rendered top=.1075 | PhotoHead height above surface | PhotoBody height above surface | Highest neutral foot below surface |
|---|---:|---:|---:|---:|---:|---:|
| Beaver | .30 | -.1800 | -.1925 | .100 | .020 | .103696 m |
| Otter | .20 | -.0800 | -.0925 | .080 | .020 | .025406 m |
| Mallard | .21 | -.0900 | -.1025 | .308 | .038 | .082000 m |

The controller reports current water BoxGeometry top is blueprint maxY minus .0125 m. This calibration explicitly supports both conventions. Images use a planar **visible surface at .1200 m**. Either correct the render offset or use .1075 consistently for these current boxes; do not use .12 for poses against visibly lower water. Raising/lowering surface and root together preserves all relative measurements above.

At the final waterlines all sampled feet are submerged, both existing photo markers are above the surface, and the visible body/head remain readable in the final inspection. Beaver/Otter PhotoBody have only 2 cm clearance: a later bob/groom/dive pose must recompute actual visibility and must not inherit guaranteed neutral visibility. Body sample fractions in `calibration-checks.json` are duplicated vertex/centroid sampling counts, not volume or displacement fractions; they were not used as buoyancy claims.

**Transition datum:** grounded roots return to the actual ground support height (0 on this flat reserve). Blend from that support datum to the selected floating datum through the shoreline region, preserving the same world/visible-surface convention. Keep remaining bank-overlapping feet/tail/body above actual bank support; do not lower the whole animal merely because its centre crossed the shoreline. Neutral forward extent / trailing extent from actual bounds are approximately Beaver .5075/1.0624 m, Otter .5406/.9914 m, Mallard .4495/.4632 m along -Z/+Z. These bound where a fully floated or grounded pose can be used clear of the bank; intermediate root-height/limb transitions must use real support checks. No terrain, behavior state machine or API design was changed here.

## Actual geometry images and reproducibility

All final images below are **ordinary foreground Blender Cycles renders of imported production GLBs**, 1800x1200, with added inspection lights, camera, labels and datum planes only. They are not game screenshots/JPEG acceptance or AI-generated pictures. Actual owned Blender PID30516/window5048462 was reselected and observed before import. Timer stages only start while that window is foreground; each render remains visible. Existing v1-v4 scene/export files were preserved. Only an isolated ignored `species-contact-inspection.blend` was saved.

- `contact-calibration/wood0.png` — lowest calibrated snag contact, beak at tap endpoint.
- `contact-calibration/wood3.png` — highest calibrated snag contact, beak at tap endpoint.
- `contact-calibration/perches.png` — all four Owl and Squirrel stances on the actual arch, front inspection.
- `contact-calibration/swimming.png` — final .30/.20/.21 neutral waterlines on the explicit visible datum.
- `contact-calibration/approach.png` — measured left-leg/front-to-crown surface route; orange dots are diagnostic guidance, not an implemented trail.

Scripts: `geometry.mjs`, `calibrate.mjs`, `perch.mjs`, `verify-geometry.mjs`, `approach.mjs`, `summarize.mjs`, `visible-init.py`, `visible-render.py`, `visible-water-finish.py`, `visible-final-labels.py`, `cross-check.mjs`. The `.mjs` scripts read actual GLBs and write only ignored evidence. Blender import/posing/render staging is executed from its visible console; never run the Python scripts through background Blender. Raw initial inspections remain as `initial-*.png` and early probe logs/data where retained.

Numerical assertions passed for **16 woodpecker placements x 9 tap phases**, **32 perch placements**, and the three waterline poses. Mesh checks sample actual triangle vertices and centroids against the actual surface, with 1 mm intentional contact clearance. They are not an exhaustive triangle/triangle intersection proof or a runtime swept collision test. Separate Blender-import photo-point records provide the second coordinate implementation for inspection.

No build or game test suite was run. No browser, server, dependency, Git mutation, production edit or further delegation occurred. The only created/modified files are this report and ignored calibration evidence. Remaining acceptance is actual movement, disturbed/retry transitions, semantic photo consistency and genuine rendered gameplay photographs under Task 5.

Independent coordinate/preservation check: 16 Blender-import versus GLTFLoader photo-point comparisons agree within **2.41942e-7 m**; cross-check-and-preservation.json verifies the original library-v4.blend and both v4 GLBs still match their manifest SHA-256 values. The final water image uses one continuous inspection datum plane to avoid coplanar overlaps; this changes no animal transform.
