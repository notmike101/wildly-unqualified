# Wildlife library v4

Original low-poly wildlife and habitat geometry created for Wildly Unqualified on 2026-09-06. No downloaded meshes, textures, traced artwork, external samples, or generative image assets are used. The existing `author.py` supplies metre-coordinate conversion, material creation and primitive mesh assembly; its original researcher appears only as an inspection scale reference and is excluded from both new exports.

Authoring uses the actual visible foreground Blender 5.2.1 LTS application. The initial existing `library-v3.blend` window was inspected, then a clean in-memory scene was created and saved exclusively as `library-v4.blend`. Modeling runs in staged Blender Python timers initiated through the visible Python console. Rendering uses foreground `bpy.ops.render.render('INVOKE_DEFAULT', write_still=True)`. Blender MCP and background Blender were not used. The timers pause while Blender is not foreground.

## Reproduction and stages

Install this repository's pinned checker dependencies with `npm ci --ignore-scripts`. In a visible Blender console load `author-v4.py` with `importlib.util.spec_from_file_location`, retain the module as `v4`, and call `v4.start()`. It refuses an existing v4 scene to avoid accidentally replacing previous work. Start in a fresh copy if rebuilding the full source library. The script reuses only `author.py` helpers, never executes its historical background-authoring entry point.

The first milestone exports Fox, Squirrel and Owl and renders `preview-v4-representatives.png`. Inspect it, then call `v4.continue_models()` for the other six animals. After the nine-species gallery, call `v4.finish()` for the four habitat props, complete gallery, and articulated action sheet. Each model has its own silhouette and anatomy; color changes alone are not used as species variants.

Run `node assets/check-v4.mjs --representatives` for the first milestone, `node assets/check-v4.mjs --animals` for the nine animals, and `node assets/check-v4.mjs` for the complete library. The checker loads actual binary GLBs with Three.js GLTFLoader and Khronos gltf-validator. It compares geometry bounds, triangles, semantic pivots, hierarchy and source/export hashes against the measured manifest. The initial unbuilt contract failed with `Fox: v4 model has not been built/exported` before any v4 geometry was authored.

## Integration contract

Game coordinates are metres, +Y up, forward -Z, left negative X. Every exported model root is at [0,0,0] with unit positive scale and grounded geometry. Rigid body, head, limbs, wings and tails have independent semantic `partName` nodes. GLTFLoader splits multi-material nodes into suffixed primitive children without extras: bind the authored parent by `userData.partName`, not those generated names. `manifest-v4.json` records neutral subject points, their actual parents, per-part absolute pivots, dimensions and action-pose XYZ rotations. `PhotoHead` is parented to Head and `PhotoBody` to Body, so both follow articulated poses.

These are rigid-part rigs, without skinned deformation or baked animation clips. The action sheet demonstrates available articulation, not production behavior timing or collision acceptance. Tasks 4–5 must transform the recorded subject points through the actual live/frozen pose and evaluate small-animal photographic size at nearby camera approaches. Ground, waterline and perch placement remain runtime responsibilities. Do not use the full tail/ear height as a substitute for checking whether the head and body are visible.

The manifest also contains measured `action_bounds` and `action_photo_points` for the exact demonstration pose. The checker independently applies the recorded XYZ rotations to the GLTFLoader hierarchy and matches both quantities within 0.15 mm. These are one demonstration pose per species, not a conservative envelope for every future animation. Blender applies a quaternion basis conversion so multi-axis head poses agree with Three.js XYZ rotation order.

Habitat entrance shells are genuinely hollow with open front/back passages; their separately recorded conservative solid proxies leave the entrance clear. BranchPile and SquirrelCache are small nonblocking details. No terrain deletion, crafting inventory or gameplay code is included.

## Inspection record

- Representative milestone: fox narrow muzzle, triangular ears, dark stockings and bushy tail; squirrel seated haunches, separate forepaws and curled upright tail; owl facial discs, prominent eyes, feathered wings and feet. All were inspected beside the original researcher in actual Blender and in the saved 2400×1800 foreground render.
- Complete gallery and action sheet: all nine species, all four habitat props and their labels were inspected in the saved foreground renders. The cache was moved into an unobscured gallery position. Habitat refinement replaced rectangular shells with faceted earthen arches and an irregular branch pile. The badger-den clearance test first failed at animal height, then passed after the arch revision. Both entrances pass actual mesh rays across a 0.48 m width at 0.61 m height, and the solid proxies preserve that opening.
- Source/export hashes, exact measured dimensions, saved scene hash and all four final preview hashes are recorded in `manifest-v4.json`. The actual final scene is saved with neutral animal poses and all thirteen roots visible in its inspection layout. The exported GLBs have each individual root at the origin; gallery placement is excluded from export.
- Complete asset check: thirteen roots passed with zero glTF-validator errors and warnings. Wildlife uses 1,196–2,420 triangles per species; habitat props use 72–764 triangles each. No external texture payloads are used.
- Existing v1–v3 source scenes, manifests, previews and model exports are preserved unchanged.
