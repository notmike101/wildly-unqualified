# Reserve kit and character variants, version 2

Created on 2026-09-05 by Codex for the expanded Wildly Unqualified prototype. The user requested a more useful variety of original models and explicitly required all subsequent Blender work to be visible. **Version 2 was constructed, exported and rendered in a new visible Blender GUI process, with no background Blender operation and no MCP calls.** Version-1 models, scripts, preview and the already-open `library-v1.blend` scene were preserved.

The actual process was Blender **5.2.1 LTS**, PID **51680**, launched with PowerShell `Start-Process -WindowStyle Normal` and arguments `--factory-startup --python-exit-code 1 --python author-v2.py`. The executable was `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. [export-v2.log](export-v2.log) records `VISIBLE_AUTHORING_STARTED`, every `MODEL_CONSTRUCTED_VISIBLE` and `VARIANT_CONSTRUCTED_VISIBLE` event, all five real glTF exports, the source save, the visible Cycles render and `COMPLETE_VISIBLE`. The process remains open for inspection; the authoring timer has finished. [export-v2.err](export-v2.err) was empty after completion.

[author-v2.py](author-v2.py) drives the actual GUI construction using Blender timers, frames each new mesh in the material viewport and yields to the GUI between batches. [reserve-shapes-v2.py](reserve-shapes-v2.py) contains the original geometry definitions and was loaded as each batch became available. It reuses the game-owned primitive geometry helpers in the preserved [author.py](author.py). No downloaded meshes, stock textures, paid resources or image-generation service were used.

The editable source is [library-v2.blend](library-v2.blend). It contains a separated, labelled inspection layout at actual metre scale, four character variants, an inspection camera and lights. Only selected model hierarchies are exported; the inspection labels, camera, lights and ground plane are excluded from the GLBs. [preview-v2.png](preview-v2.png) is the actual 3600×2600 Cycles render made by this visible process. The render was inspected for distinct tree silhouettes, recognizable field equipment, actual sight openings in the blind, different animal tracks and the cosmetic character variations. It is source-scene evidence; game integration and performance require their own browser checks.

[manifest-v2.json](manifest-v2.json) records exact source hashes, output hashes, bytes, triangle counts, bounds, hierarchy and all pivot coordinates. The GLBs are self-contained, with no textures, skinning, external buffer URLs or animation clips. All game exports use **metres, Y up, forward -Z, unit root scale and grounded Y=0 origins**. Blender source coordinates are Z up. As in v1, a multi-material named node may load as a Three.js Group; extract/clone the named Object3D rather than requiring it to be a Mesh.

## Reserve kit

`public/models/reserve-kit.glb` contains root `ReserveKit` and exactly these **24 named grounded reusable models**. The library has **15,644 triangles**, **75 material primitives/draw calls** across the entire unique kit and **889,656 bytes**. The objects overlap at the origin in the exported library intentionally: the game must extract the desired named child. Their saved Blender inspection positions are applied only after export.

| Exact node name | Width × height × depth, metres | Triangles | Authored use |
|---|---:|---:|---|
| OakTree | 4.721 × 5.254 × 4.023 | 636 | Broad crown, branching trunk and flared roots |
| BirchTree | 3.810 × 5.442 × 1.470 | 688 | Twin white-barked stems, dark bark scars and airy canopy |
| PineTree | 2.425 × 4.650 × 2.462 | 720 | Tiered evergreen canopy and branch structure |
| DeadTree | 1.982 × 3.260 × 1.241 | 276 | Bare crooked branches and exposed roots |
| FallenTrunk | 3.460 × 1.060 × 0.720 | 416 | Long fallen log, broken branches, dark ends and moss |
| Stump | 1.154 × 0.606 × 1.205 | 604 | Rooted stump with visible cut growth rings |
| Boulder | 1.910 × 1.130 × 1.450 | 68 | Asymmetric faceted stone and moss patch |
| FlatRock | 1.995 × 0.178 × 1.227 | 40 | Low layered stone shelf |
| Fern | 1.500 × 0.670 × 1.500 | 1,408 | Eight pinnate fronds with separate leaflets |
| Bush | 1.310 × 0.824 × 1.060 | 776 | Branched foliage with berry clusters |
| Cattails | 1.250 × 1.900 × 0.637 | 480 | Tall brown seed heads and long curved blades |
| LilyPads | 1.323 × 0.097 × 1.170 | 838 | Four notched pads, veins and a small flower |
| Mushrooms | 0.660 × 0.361 × 0.594 | 1,370 | Five varied stems and spotted caps |
| BirdNest | 0.536 × 0.140 × 0.544 | 1,472 | Woven twig bowl with three eggs |
| RaccoonTracks | 0.338 × 0.018 × 1.305 | 1,548 | Six alternating five-digit paw prints |
| HeronTracks | 0.389 × 0.024 × 1.335 | 320 | Four alternating long-toed bird prints |
| ObservationBlind | 2.980 × 2.155 × 2.042 | 1,360 | Three-sided reed screen, viewing opening and open rear |
| TrailMarker | 0.860 × 1.740 × 0.208 | 160 | Two opposed directional arrow boards |
| CampTable | 2.180 × 0.834 × 1.201 | 248 | Slatted tabletop with braced legs |
| Bench | 1.680 × 1.050 × 0.587 | 132 | Slatted seat and backrest |
| SupplyCrate | 0.697 × 0.521 × 0.569 | 372 | Planked crate, metal straps, handle and clasp |
| Lantern | 0.216 × 0.399 × 0.216 | 440 | Caged warm emitter, cap and carry handle |
| FieldNotebook | 0.420 × 0.062 × 0.290 | 804 | Open bound pages with ruled notes and a bird sketch |
| CameraTripod | 0.824 × 1.470 × 0.722 | 468 | Three braced legs, pan handle and forward-facing camera |

Tracks should sit slightly above the ground surface to avoid coincident faces; lily pads should be placed at the water surface. These clues are decorative authored assets; behavior, discovery credit and interaction are game-owned responsibilities. Duplicate props add actual visible triangle and draw-call cost, so these counts do not establish reserve performance or session length.

### Observation blind geometry

Exact local bounds are `[-1.49, 0, -0.98117]` to `[1.49, 2.155, 1.06117]`. Its front faces **-Z**. The front viewing opening is clear approximately from **Y=1.2475 to Y=1.89** and X=-1.25 to X=1.25; the sill and upper header define those limits. A standing 1.6 m camera can look through the opening. The rear remains open between the corner posts at Z=0.86, providing walk-in access. The source includes low floor planks whose upper surface is Y=0.086; the ground controller must account for them visually if avatar feet are shown inside.

Collision and occlusion must use separate side strips, the lower front wall and upper header. A single solid box spanning the full bounds would incorrectly block both the viewing opening and the rear entrance. No collision mesh is embedded in the GLB.

## Character variants

These are cosmetic variants of the existing characters, with preserved original named rigid hierarchies and attachments. They do not introduce new animal species or behavior rules.

| GLB filename | Width × height × depth, metres | Triangles | Actual variation |
|---|---:|---:|---|
| researcher-raincoat.glb | 0.742 × 1.940 × 0.829 | 1,402 | Yellow raincoat hem/collar, buttons, covered green backpack and straps |
| researcher-vest.glb | 0.742 × 1.940 × 0.838 | 1,344 | Cream shirt, brown pocketed vest, slate pack and two side bottles |
| raccoon-dark.glb | 0.546 × 0.703 × 1.578 | 2,164 | Darker coat, 24% broader geometry/stance, fuller shoulder ruff |
| heron-reed.glb | 2.060 × 1.560 × 1.263 | 1,916 | Buff/brown plumage and extra paired crest feathers |

Researcher variants retain `Body`, `Head`, `ArmL`, `ArmR`, `LegL`, `LegR`, `Camera`, `CameraGrip` and `TinGrip`; extra nodes are `RainGear` or `FieldVest`. Recolour **`Raincoat`** for the raincoat variant and **`Vest`** for the vest variant. The original researcher still uses **`Outfit`**. On the vest variant, `Outfit` is only the small backpack patch, so recolouring that material alone will not change the vest.

The darker raccoon keeps its original `Head`, four leg pivots, `Tail` and `TinGrip`; its grip remains `[0, 0.20, -0.61]` in model space. All X coordinates and applicable pivots are widened together; the new mesh node is `ShoulderRuff`. The heron preserves `Neck`, `Head`, both legs and wings, adding `Crest`. Heron wings remain authored spread: fold with `WingL.rotation.z ≈ +1` and `WingR.rotation.z ≈ -1`, and use zero for display.

## Observed validation

On 2026-09-05, the existing glTF validator reported **0 errors, 0 warnings, 0 infos and 0 hints for all five new GLBs**. The actual installed `GLTFLoader` check passed output hashes, imported bounds, every grounded prop origin, hierarchy and all **66 pivots**. The authoring script also asserted the 24 exact prop names, grounded bounds and under-8,000-triangle character budgets before export.

```powershell
npm run validate:glb -- wildly-unqualified/public/models/reserve-kit.glb wildly-unqualified/public/models/researcher-raincoat.glb wildly-unqualified/public/models/researcher-vest.glb wildly-unqualified/public/models/raccoon-dark.glb wildly-unqualified/public/models/heron-reed.glb
node wildly-unqualified/assets/check.mjs wildly-unqualified/public/models wildly-unqualified/assets/manifest-v2.json
```

These Node checks do not run Blender. The v2 authoring entry point explicitly rejects background mode, an existing/dirty scene and pre-existing v2 output. A future revision must use new source/output version paths; do not overwrite the preserved v1 or v2 files or the user's open scenes. No Blender process is closed by the authoring script.

Blender printed source-save notices about unused factory grease-pencil brush references. Those factory brushes are not used by the authored meshes and are absent from the self-contained GLBs. The inspection source uses only this game's generated models and its own camera, lights, labels and floor.
