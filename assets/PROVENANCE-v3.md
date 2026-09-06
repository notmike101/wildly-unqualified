# Version-3 asset provenance

Created 2026-09-05 for the approved mature-forest MVP direction. This is original procedural low-poly geometry authored by the asset worker in **visible foreground Blender 5.2.1 LTS**, using the application's Python console and staged timers. No Blender MCP was connected or called. No background Blender, purchased assets, outsourced work or runtime image service was used.

The [brief](BRIEF-v3.md) defines 39 models: 29 environment entries, one deer, one researcher, four hats and four equipment assemblies. All 39 were constructed and exported into the five new GLBs named in [manifest-v3.json](manifest-v3.json). Original v1/v2 assets and scenes were preserved.

Editable source is [library-v3.blend](library-v3.blend); authoring sources are [author-v3.py](author-v3.py), [forest-shapes-v3.py](forest-shapes-v3.py) and the representative revision [revise-v3.py](revise-v3.py). The [export log](export-v3.log) records staged exports and `COMPLETE_VISIBLE` with 39 models. The manifest records source/export SHA-256, model bounds, triangle/material counts, pivots, attachments and collision metadata.

The coordinator inspected the initial and refined representative renders, then walked a real visible WebGPU client at eye level before authorizing the remaining 35 models. After the full export, all five packages passed the glTF validator with zero errors/warnings/infos, and the actual GLTFLoader checks passed bounds, hashes, grounded origins, positive scale, hierarchy and 89 pivots. The real case-lid opening and semantic attachments were checked. The completed scene was reactivated in Blender after the owned browser checks closed; its returned window was `library-v3 … - Blender 5.2.1 LTS`.

Preview artifacts: [gallery](preview-v3.png), [human-scale forest composition](forest-composition-v3.png), [equipment detail](equipment-preview-v3.png). In-game evidence and remaining gameplay integration are recorded in the [MVP checkpoint](../MVP-CHECKPOINT-2026-09-05.md).

## Integration notes

- Metres, Y up, forward -Z; individually exported model roots are at ground origin.
- Blender/glTFLoader may suffix/sanitize repeated node names. Resolve a semantic part by `object.userData.partName` within its own model, then fall back to `object.name`. `semantic_attachments`/`pivot_m` are model-space coordinates, not parent-local coordinates.
- `ForestGate > Hinge > GateLeaf > Latch`; rotate `GateLeaf.rotation.y` to open the leaf. Its hinge pivot is `[-2.2,0.9,0]`. Proxy coordinates are model-root coordinates; subtract the pivot before attaching them beneath the moving leaf.
- The plank's actual bounds are `[-1.6,0,-0.325]` to `[1.6,0.188,0.325]`; deck height is 0.045–0.145 m. Handles are at X ±1.43/Y 0.165. Audited support pivots are X ±1.48/Y 0, with 0.14 × 0.09 × 0.65 m support blocks. Match route geometry to these dimensions.
- The screen has separate lower/upper/side solids and an actual central camera opening. The root arch has separate upright proxies. The hollow log opening is a low visual crawl opening, not a walkable tunnel.
- Equipment and animation hooks being exported/loaded do not mean co-carry, reactive deer, spills or hat theft are implemented. Those remain the next gameplay tasks.

## Bounded usability audit

The existing foreground `library-v3.blend` was audited at human scale after the MVP checkpoint. The audit corrected two demonstrated geometry/attachment defects: the screen's upper beam intersected the actual standing camera at Y=1.6 m, and the plank's old support blocks lay inside the approved 2.8 m bank gap. The screen now has a central aperture from Y=1.21 to 1.79 m; its bounds, handles and panel pivots are unchanged. Plank support blocks and `SupportL/R` moved outward from X ±1.32 to ±1.48, preserving its overall bounds and handle pivots. Only `expedition-kit-v3.glb` was re-exported. Screen-foot and plank-support collision boxes were added to the manifest so both assemblies have physical contact at Y=0.

The corrections used [audit-v3.py](audit-v3.py) and [audit-plank-v3.py](audit-plank-v3.py) in the existing visible Blender Python console. Inspection poses were temporary and restored before saving the source. The actual imported-geometry regression [usability-v3.mjs](usability-v3.mjs) failed on the old screen and passes on the corrected export. It also verifies bank contact, unchanged handles/bounds, empty aperture proxies, the case opening, gate swing, hat mount and moving deer photo points. All five final GLBs pass the validator with zero errors/warnings/infos and the existing GLTFLoader contract checks, including 39 model origins and 89 pivots.

Evidence: [screen before](audit-screen-before-v3.png), [screen after](audit-screen-after-v3.png), [open case/gate and fitted hat](audit-equipment-v3.png), [corrected plank](audit-plank-v3.png), [foreground Blender screenshot](audit-foreground-v3.png), [machine-readable results](usability-rays-v3.json), and [validator output](validation-v3.log). These are source/audit evidence, not ordinary-controls gameplay proof. The detailed report is `games/.artifacts/wildly-unqualified/mvp-2026-09-05/asset-usability-review.md`.

### Hat-fit follow-up
The earlier visual hat audit covered HatBrim only. A later in-game beanie cuff gap revealed grounding lift in the Beanie and Cap undersides. Visible foreground Blender corrections and all-four front/profile fits are recorded in `audit-hats-v3.py`, `audit-hats-front-v3.png`, `audit-hats-profile-v3.png`, and the artifact `asset-usability-review.md`. Beanie height .37→.31 m; Cap .26→.21 m. All widths, depth bounds, grounded roots and HatMount Y=1.76 remain unchanged. Headwear alone was re-exported for this follow-up; source/manifest hashes, imported seating regression and zero-error/zero-warning glTF validation pass. No renderer changes.
