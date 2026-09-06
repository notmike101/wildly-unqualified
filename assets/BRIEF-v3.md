# Version 3: mature forest and field equipment

Date: 2026-09-05. **Production brief, not a completed asset inventory.** Implements the user's correction to the [MVP design](../docs/superpowers/specs/2026-09-05-wildly-unqualified-mvp-design.md). The current reserve trees measure 4.65–5.44 metres tall in `manifest-v2.json`; the new forest needs substantial trunks, an overhead canopy and a coherent horizon at first-person scale.

## Visual target

One temperate mixed forest, with deep woodland, a sunlit clearing and a wooded wetland. Main trees are 18–32 m tall beside a roughly 2 m researcher. Large crowns overlap in the middle distance; foreground trunks, buttress roots and deadwood establish scale. Keep the stylized low-poly finish, restrained surface colors and clean silhouettes. Branching and clustered crown masses should carry the form. A recolor or uniform rescale of one tree does not count as a distinct geometric variant.

Ground detail supports that canopy: leaf and needle mats, ferns, roots, moss, timber and water-edge vegetation. Do not fill the scene with small ornamental trees or shrubs. The four-metre equipment trail and six-metre overhead clearance remain usable under the enclosing canopy.

## Authoring and export contract

- Work in a visible, foreground Blender window. Inspect the current scene before using it; a new visible asset session must preserve the user's existing scene. Use staged updates so work is observable. Never use `--background` or claim a Blender MCP connection without a real callable connection.
- Keep `author.py`, both existing `.blend` libraries, all existing manifests and their GLBs unchanged. Version-3 authoring writes new paths only.
- Source: `author-v3.py`, `forest-shapes-v3.py`, `library-v3.blend`. Deliver `manifest-v3.json`, `preview-v3.png`, a human-scale forest composition render and `PROVENANCE-v3.md` beside this brief. Extend the existing `check.mjs` only where the new contract needs it.
- Export environment props in `../public/models/forest-kit-v3.glb`; each named prop has a grounded local origin and is separately instantiable. Display-gallery offsets must not leak into exported local geometry.
- Export researcher, deer, headwear and articulated equipment in the four GLBs specified below. Metres, Y up, forward -Z. Apply scale consistently, preserve named pivots, and avoid negative transforms.
- Prefer shared materials and vertex-color variation suitable for instancing. Opaque faceted crown geometry establishes the low-poly style. Additional texture atlases, skeletal systems or decimation pipelines need an observed benefit before introduction.
- Working geometry targets: 1,500–5,000 triangles per large tree; 100–2,500 per static supporting model; under 8,000 per character/animal; under 4,000 per equipment assembly. These are planning budgets; inspect silhouette before reducing detail and measure dense-scene runtime before raising budgets.
- Manifest records per-model bounds, triangle/material counts, named nodes, collider proxies and attachment positions, plus source/export hashes. Gameplay proxies describe trunks and rocks independently of canopy volumes. Ground mats and small foliage are decorative; canopy bounds still matter for photography and visual clearance.

## Required model inventory

The baseline contains **39 authored models or geometric variants**. Grouping them into five GLB files does not change that count. Retained prototype props and material recolors are additional reuse, not new-model deliverables.

| Family | Exact exported model names | Count | Scale and purpose |
|---|---|---:|---|
| Mature canopy | `MaturePineA`, `MaturePineB`, `MatureCedarA`, `MatureCedarB`, `MatureOakA`, `MatureOakB`, `MatureAlderA`, `MatureAlderB` | 8 | 18–32 m high; vary branch architecture, lean and crown outline. Pine/cedar form deep stands, oak frames the clearing, alder borders water. |
| Large deadwood | `SnagTall`, `SnagForked`, `FallenLogWhole`, `HollowLog`, `RootPlate` | 5 | Snags 8–14 m; fallen logs 5–9 m long; visible broken ends, hollow opening and root mass. Place beside routes and at observation sites. |
| Stone and banks | `MossBoulderA`, `MossBoulderB`, `BoulderCluster`, `RootArch`, `WetBankShelf`, `DryBankSlope` | 6 | Boulders 1.5–4 m across, arch 4–6 m across, bank modules 4–8 m. Match visual walkable faces to simple collision proxies; no hidden solid box across openings. |
| Forest floor | `FernLargeA`, `FernLargeB`, `LeafMat`, `NeedleMat`, `RootSpread` | 5 | Ferns 0.8–1.4 m high; irregular 2–4 m patches at ground level. Sparse placement around clear photo approaches. |
| Wetland detail | `ReedBed`, `LilyPatch`, `SedgeClump` | 3 | Water-specific clusters, with open channels and a readable waterline. Decorative except explicitly authored site blockers. |
| Route landmarks | `ForestGate`, `TrailBoard` | 2 | Human-scale gate and readable sign supports. Gate posts are solid, moving gate leaf has its own pivot and collision state. Text remains rendered by existing sign logic. |
| Wildlife | `Deer` | 1 | Approximately 1.3 m shoulder height, 1.9 m head height, 1.8 m body length. Distinct ears, hooves and muzzle; plausible leg placement and graze posture. |
| Crew body | `ResearcherForest` | 1 | Approximately 2 m including hat; retains existing recognizable researcher style, large recolorable outfit/pack areas and a separate hat mount. |
| Removable headwear | `HatBrim`, `HatBeanie`, `HatCap`, `HatBucket` | 4 | Different readable shapes, consistent fitting origin. Crew color applies to a named `CrewAccent` material; hats fit both the researcher mount and the raccoon's carried-hat transform. |
| Physical equipment | `FieldCase`, `CrossingPlank`, `FoldingScreen`, `WildlifeDecoy` | 4 | Case 1.3 × 0.65 × 0.65 m; plank about 3.2 × 0.65 × 0.12 m; screen about 2.4 × 1.9 m; decoy about 1 m tall. Obvious handling points and stable bases. |

All 29 environment entries go in `forest-kit-v3.glb`. Use `deer-v3.glb`, `researcher-forest-v3.glb`, `headwear-v3.glb` and `expedition-kit-v3.glb` for the other groups.

Repeated node names may be suffixed or sanitized by Blender/glTFLoader. Resolve `object.userData.partName` within the correct model, falling back to `object.name`; manifest semantic attachment positions are model-space, not parent-local.

Required pivots/attachments:

- `Deer`: `Body`, `Neck`, `Head`, `EarL`, `EarR`, `LegFL`, `LegFR`, `LegBL`, `LegBR`, `Tail`. Grounded feet and authored photograph subject points for head/body.
- `ResearcherForest`: preserve `Head`, `ArmL`, `ArmR`, `LegL`, `LegR`, `Camera`, `CameraGrip`, `TinGrip`; add `HatMount`. No baked-in duplicate hat beneath removable headwear. Use named `CrewAccent` material on a large torso/pack area.
- `FieldCase`: `Lid`, `HandleL`, `HandleR`, `BaitStore`; the hinge actually opens away from its container. Stored bait is an assembly detail, not another counted asset.
- `CrossingPlank`: `HandleL`, `HandleR`, `SupportL`, `SupportR`; placement preview and collision share its dimensions.
- `FoldingScreen`: `PanelL`, `PanelR`, `HandleL`, `HandleR`; author an actual camera opening and separate solid frame/panel proxies.
- `WildlifeDecoy`: `BaitCup`, `Handle`; distinct from a living deer in silhouette and material, while visually intelligible as a field tool.
- `ForestGate`: `GateLeaf`, `Hinge`, `Latch`; supplied tree/floor models remain static.

## Production sequence and acceptance

1. Make one mature pine, one oak, a large log and a fern. Place them around the researcher at real scale in a visible scene; inspect trunk width, branch height, walkable clearance and canopy enclosure.
2. Integrate these representatives into the browser with the sky described below. Review first-person views and an actual in-game photograph. Adjust the family proportions before producing the remaining variants.
3. Complete the other environment families, deer, researcher/headwear and equipment. Export all named models and attachment metadata, then compose the final forest areas around tested paths.
4. Run the existing glTF validator and actual GLTFLoader check for all five new packages. Inspect the final source render and in-game silhouettes, pivots, colors, shadows and held poses. Verify manifest dimensions and that exports have grounded local origins.

Inventory completion alone is insufficient: adjacent same-family trees must have distinguishable outlines; an eye-height view must read as a mature forest; doors, screen openings, hats and handles must work at gameplay scale. Keep rendered previews and real in-game evidence separate.

## Sky and atmosphere delivery

The sky is rendered by the existing Three.js 0.185.1 `SkyMesh` WebGPU addon, confirmed in the installed package and current official documentation. It includes atmospheric scattering, a sun and cloud uniforms. This is a full surrounding sky background supplied by code; it is not counted as a Blender model or presented as a completed bitmap asset.

Use muted blue-gray daylight, soft broken clouds, one consistent light direction, matching horizon fog and woodland color grading. Keep cloud speed zero for deterministic restored photography. Frame the sky through tall crowns and over the clearing/water; include distant forest silhouettes below it. Test shadow direction, readable shade, horizon continuity and a full upward/360-degree look in real WebGPU. Tune within the existing renderer and retain the low-poly ground aesthetic. A paid HDRI, external image service, weather system or day/night cycle is unnecessary for this outing.

Documentation checked 2026-09-05 via Context7: [official SkyMesh documentation source](https://github.com/mrdoob/three.js/blob/dev/docs/pages/SkyMesh.html). Execution must cross-check against the installed `node_modules/three/examples/jsm/objects/SkyMesh.js`; indexed development docs may include later changes.
