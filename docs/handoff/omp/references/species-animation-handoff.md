# Task 5 species-animation handoff

Preparation only, 2026-09-06. Sources: Task 5 brief; approved design species/photography/world sections; stable `world.ts`; `assets/manifest-v4.json`, `assets/author-v4.py`, `assets/wildlife-shapes-v4.py`, `assets/check-v4.mjs`; established `forest-view.ts:7` findPart helper. No unfinished Task 4 runtime was reviewed, no production/test/Git state changed, and no Blender/browser/server was opened. One read-only GLTFLoader SnagTall contact measurement is recorded below.

## Coordinate and binding contract

- All nine exact model roots in `wildlife-kit-v4.glb` use metres, **+Y up and -Z forward**, positive unit scale and neutral geometry grounded at Y=0. Place the root on supported ground; do not add its half-height as though its origin were a centred physics body. A positive yaw turns -Z toward -X; derive orientation consistently from the route tangent. The library container is not an animal instance.
- These are rigid hierarchical parts, with no armature or baked animation clips. Bind with `findPart(animalRoot, semanticName)`, which resolves `userData.partName` before a raw name fallback. GLTFLoader splits multi-material parts into child meshes with generated suffixes; rotate the semantic parent, not every material primitive. Search within each animal instance, not the complete 48-animal scene.
- Every animal has `Body` under its model root, `Head` under Body, `PhotoHead` under Head, and `PhotoBody` under Body. Consequently the photo points follow both body and head action. Head/Body neutral rotations are identity; preserve their imported translations and scale. Compute each frame from the baseline pose rather than accumulating rotations.
- Manifest `attachments` are **absolute coordinates in the neutral animal-root coordinate system**, measured with the library/model at identity. They are not each node's local `.position`. The GLB already stores correct parent-local transforms. Do not assign an absolute manifest PhotoHead vector to a Head child. In a neutral zero-rotation hierarchy, child-local = child attachment minus parent attachment; during action use the actual hierarchy/world matrix or equivalent shared transform math.
- `pose_rotations_xyz_radians` are Three.js/game-coordinate **XYZ Euler radians** assigned to semantic parts. The multi-axis Mallard head pose makes rotation order consequential. `action_photo_points` and `action_bounds` are measured root-relative results of that one example pose, not a complete animation or conservative envelope for arbitrary poses. They do not prescribe behavior durations.

## Exact species parts and photo datums

In the parts column, Q means the four exact names `LegFL`, `LegFR`, `LegBL`, `LegBR`; B means `FootL`, `FootR`, `WingL`, `WingR`. Every row also has the common Body, Head, PhotoBody, PhotoHead and Tail. EarL/EarR parent to Head; Q/B and Tail parent to Body. Exceptions/additions are explicit.

| Model root | Height m | Additional semantic parts |
|---|---:|---|
| Fox | .965 | Q, EarL, EarR |
| Rabbit | .770 | Q, EarL, EarR |
| Squirrel | .700 | ForepawL, ForepawR, LegBL, LegBR, EarL, EarR; forepaws parent to Body, no LegFL/LegFR |
| Beaver | .555 | Q, EarL, EarR |
| Otter | .385 | Q |
| Badger | .551 | Q, ClawsL under LegFL, ClawsR under LegFR |
| Owl | .79043 | B |
| Woodpecker | .485 | B, TrunkCling directly under Woodpecker root |
| Mallard | .623 | B |

All vectors below are metres, in `[X,Y,Z]` order. Local columns are offsets from the named animated parent, not from the model root.

| Root | PhotoHead root-relative neutral | PhotoHead local to Head | PhotoBody root-relative neutral | PhotoBody local to Body |
|---|---|---|---|---|
| Fox | [0,.7,-.37] | [0,.07,-.08] | [0,.48,.02] | [0,.05,-.03] |
| Rabbit | [0,.37,-.18] | [0,.08,-.045] | [0,.26,.04] | [0,.06,0] |
| Squirrel | [0,.455,-.105] | [0,.085,-.035] | [0,.25,.02] | [0,.03,-.01] |
| Beaver | [0,.4,-.32] | [0,.05,-.08] | [0,.32,.04] | [0,.06,-.02] |
| Otter | [0,.28,-.38] | [0,.04,-.11] | [0,.22,.03] | [0,.04,0] |
| Badger | [0,.4,-.38] | [0,.07,-.12] | [0,.33,.04] | [0,.06,-.02] |
| Owl | [0,.58,-.035] | [0,.13,-.023] | [0,.3,0] | [0,0,-.015] |
| Woodpecker | [0,.365,-.04] | [0,.065,-.023] | [0,.21,.015] | [0,.02,-.005] |
| Mallard | [0,.518,-.225] | [0,.23,-.025] | [0,.248,.04] | [0,.04,0] |

Mallard authoring grounds the completed geometry by -0.012 m. The exported/manifest positions above already include that correction; copying raw pre-grounding points from the shape function introduces a second convention. Height alone is not a body visibility proxy: Rabbit ears, Owl tufts and Squirrel tail contribute substantial silhouette height. Otter's actual total height is only .385 m. Preserve close/low camera approaches and evaluate articulated head/body points, not a generic deer proxy.

## Movement/action integration requirements

| Species | Practical integration with these parts |
|---|---|
| Fox | Ground route for stalk/passage; short bounded root pounce arc with landing at supported ground. Head listening/aim, Q gait and front-leg pounce are different from a repeated idle bob. Long tail extends the neutral model to Z=1.04436, so body-only clearance is insufficient when turning. |
| Rabbit | Ground nibble/freeze/bound. Ear pivots can change attention; Q has different hind/front dimensions. A bound requires actual root displacement/landing as well as leg rotation; moving Body alone leaves its root/navigation at the old ground point. |
| Squirrel | Ground cache uses ForepawL/R, Head and Tail. A ground-to-perch link needs a bounded supported climb/transition; linear interpolation to the arch crown would visibly float through space. Body/root pitch and support contact must be coordinated. This rig has no front-leg names and no general-purpose climbing skeleton. |
| Beaver | Ground branch work uses Head, Q/front paws and paddle Tail; swimming requires a separate waterline. No `Mouth` or `BranchGrip` attachment is exported: any carried branch needs an explicit calibrated Head-relative pose used identically in live/frozen rendering. A BranchPile is scenery, not a pre-rigged held branch. |
| Otter | Water travel/surface versus grounded bank groom/roll. Head yaw, front paws and long Tail can articulate independently. A roll changes body/photopoint transforms and support footprint; the single gallery action does not prove rolling clearance. |
| Badger | Ground sniff/dig/passage, Head pitch plus alternating front legs/claws. Claws already follow their parent legs; applying the leg rotation again to Claws doubles it. Digging is an action, not terrain deformation. |
| Owl | Grounded feet at an actual perch contact, Head turn for roost, opposing WingL/R rotation for short flight. Authored wings are rigid folded shapes; opening them demonstrates motion but does not create a fully jointed flight wing. Perch-to-perch flight needs a bounded unobstructed root path, landing contact and action phase. |
| Woodpecker | Upright body with -Z beak toward the trunk; Head pitch for tap, feet/tail bracing and WingL/R for flutter. TrunkCling is a semantic root-relative marker, not a pre-verified trunk-contact solution or foot pose. See measured gap below before using the current root coordinates unchanged. |
| Mallard | Ground walking on FootL/R versus water paddling, Head/neck for dabble/preen and WingL/R for stretch. Current blueprint routine label is `dabble`; the approved roster also requires a readable paddle/preen repertoire. Match capture behavior labels to the actual visible action. |

`world.ts` provides allowed ground/perch/water anchor sets and routine target names. It does not supply a complete contact-aware climb/flight/swim pose trajectory. Existing source example rotations in `wildlife-shapes-v4.py:309` are reusable articulation checks; they are not nine finished state machines.

## Contact and habitat calibration

**RootArch:** `world.ts:410` contains measured local branch contacts `[-.9,3.72163,.35]`, `[-.3,3.84199,.35]`, `[.3,3.86264,.35]`, `[.9,3.57587,.35]`, transformed by each arch placement/yaw. Preserve those varied heights; do not restore the earlier flat Y=3.95 shelf. The existing actual GLB regression checks root-downward contact across quarter turns and four owls. An owl's two feet and a squirrel's stance span the curved surface, so orientation/articulated foot placement still needs actual rendered inspection; root contact alone is not a proof that both feet touch. Perch yaw should use an explicit coherent branch/flight convention rather than an unrelated travel-facing value.

**SnagTall measured preparation concern:** current woodpecker anchors are local `[7,2.5+n*.45,-10.15]` against a snag at `[7,0,-11]`, i.e. a root .85 m along the snag's +Z side. At neutral -Z-facing orientation, the exported `TrunkCling` marker `[0,.09,-.08]` sits at snag-local Z=.77. Read-only GLTFLoader horizontal rays toward -Z hit the actual trunk as follows:

| Root Y | Marker Y | Surface Z | Marker-to-trunk gap m |
|---:|---:|---:|---:|
| 2.50 | 2.59 | .58114221 | .18885779 |
| 2.95 | 3.04 | .56100208 | .20899792 |
| 3.40 | 3.49 | .54086196 | .22913804 |
| 3.85 | 3.94 | .52072183 | .24927817 |

This is a measured **marker gap**, not an assertion that moving the whole bird inward by that amount is sufficient. The trunk tapers; the beak reaches about root Z=-.225, the feet were authored in a standing arrangement, and the tail braces behind. Calibrate root transform, foot pitch and head/tap excursion together against the actual mesh so the body stays outside the trunk and beak contact is visible. Bind the result to each generated snag transform/height and use it in photo subject transforms. The prior Task 1 fix review explicitly left the existing SnagTall convention outside its bounded RootArch repair; this handoff identifies the downstream pose work rather than silently changing validated data.

**Water:** generated water anchors mark the visible surface at Y=.12. The animals' root datum is their grounded minimum, not their natural swimming waterline. Placing Beaver/Otter/Mallard root Y=.12 makes their entire neutral body stand above the surface. Establish a per-species visible swimming waterline and compute root Y = surface Y minus that local waterline; use an explicit bounded transition back to bank/ground support. The assets do not contain a `Waterline` marker or a measured swimming pose. Do not treat the pond's submerged physical bed as a swimming height. Photo points must follow the same immersion/surface/groom state, and a hidden underwater body point must not receive visibility merely from its neutral coordinate.

**Habitat props:** `BeaverLodge` and `BadgerDen` have real hollow tunnels and `Entrance` plus `BranchWork`/`Retreat` markers; use their manifest root-relative attachment transforms. Their three collision proxies leave the entrance open. `BranchPile`/`SquirrelCache` intentionally have no blocking colliders. Reuse `check-v4.mjs` entrance-ray checks (including X=-.24/0/.24 at Y=.61) before assuming a scaled/rotated entrance still admits an animal. The geometry/export checker already protects the open tunnel; a generic filled AABB would undo that property.

## Reuse actual-model checks for frozen photos

1. Keep `node assets/check-v4.mjs` as the asset gate when model/attachment integration changes. It uses actual GLTFLoader roots and verifies hashes, dimensions, unit scale, semantic uniqueness/parents, neutral photo points, head-following movement, the measured XYZ action pose's real bounds/points, hollow entrances and Khronos validation. It should be reused, not replaced with a test-only duplicate model.
2. Add focused integration checks against the same real GLB clones: neutral, characteristic action and ground/perch/water transition poses at nonzero position/yaw; compare rendered attachment world positions with the authoritative species subject-point math. Existing manifest action points provide one independent pose oracle. Keep the 0.00015 m asset-check tolerance for its rounded measurements rather than expecting exact decimal equality.
3. Apply one deterministic pose calculation to live and frozen actor data. Freeze the behavior, phase/tick and root transform needed for every limb, carried branch and water/cling offset. Restoring a photo must not use wall time, current live animal state or the latest world. Update matrices before reading attachment points; reset a reused clone before another species/state/photo so previous rotations cannot leak.
4. Exercise actual JPEGs for each characteristic action and the tiny/occluded cases. A matching label or a neutral point inside an AABB is insufficient. Preserve the exact world identity, all capture-time actor/equipment/route state and instance IDs; JPEG bytes remain presentation data and cannot award credit. These are Task 5 integration checks, not claims established by this preparation or the gallery renders.

No tests were rerun for this preparation. The only execution beyond reads was the bounded actual SnagTall mesh ray measurement and manifest-coordinate extraction; all outputs above are in-memory observations. The only written file is this handoff.
