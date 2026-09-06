# Wildly Unqualified original assets, version 1

Created on 2026-09-05 for this prototype by Codex through the original game-owned [author.py](author.py). The geometry, flat colours and geometric sign/tin markings were authored specifically for this game. No downloaded model, image texture, stock audio, purchased resource or image-generation service was used.

These are actual Blender-authored and exported meshes. Blender **5.2.1 LTS**, build hash `9e2066aef7ef` (2026-08-25), executed the Python authoring script in a **new hidden background factory-startup process**. The installed glTF exporter identifies itself as `Khronos glTF Blender I/O v5.2.40`. **No Blender MCP was used.** The user's existing Blender GUI and working scene were neither queried nor modified.

The retained editable source is [library-v1.blend](library-v1.blend). It lays out the characters and props separately for editing; its display positions are applied only after the zero-origin GLBs have been exported. [manifest-v1.json](manifest-v1.json) records the author-script hash, exact model hashes, bounds, triangle counts, byte sizes, node parents and model-space pivot coordinates.

[preview-v1.png](preview-v1.png) is an actual Cycles render of that isolated source file. It was visually inspected for the researcher's hat/backpack/camera, the raccoon's masked short-legged silhouette and the heron's beak/long legs/separate wings. This source preview is not browser or WebGPU evidence. [export-v1.log](export-v1.log) records the real exports and version; [preview-v1.log](preview-v1.log) records the source render. The original isolated render helper is [.preview-v1.py](.preview-v1.py).

## Export and integration contract

All game exports use **metres, Y up, forward -Z and ground at Y=0**. The `.blend` itself uses Blender's conventional Z-up coordinates. Authoring helpers convert game coordinates to Blender before the glTF exporter converts to Y up. Root scale is one. `L` means negative local X; `R` means positive local X. Preserve the authored part positions when animating their rotations.

| File in `public/models/` | Width × height × depth, metres | Triangles | Material primitives / draw calls | Bytes |
|---|---:|---:|---:|---:|
| `researcher.glb` | 0.742 × 1.940 × 0.799 | 1,144 | 26 | 76,956 |
| `raccoon.glb` | 0.440 × 0.703 × 1.578 | 2,084 | 21 | 130,936 |
| `heron.glb` | 2.060 × 1.560 × 1.263 | 1,876 | 17 | 113,348 |
| `field-kit.glb` | Per prop below | 1,834 total | 30 total | 112,592 |

All three animated characters remain below the 8,000-triangle initial budget. These counts do not establish reserve performance; repeated props still cost draw calls and require runtime measurement.

Each articulated part is one Blender mesh object with flat-colour material groups. glTF represents it as one node with several primitives, so Three.js `GLTFLoader` can expose a named part as an `Object3D`/`Group` containing primitive meshes. Find and clone/rotate the **named object**, without requiring that object itself to be an instance of `Mesh`.

- **Researcher:** root `Researcher`; `Body`, `Head`, `ArmL`, `ArmR`, `LegL`, `LegR`; `CameraGrip` and `TinGrip` attachment nodes. `Camera` is already attached to `CameraGrip`. Clone the material named **`Outfit`** for four player colour variants, retaining the neutral hat, boots, backpack and camera materials. Runtime labels remain necessary for identity beyond colour.
- **Raccoon:** root `Raccoon`; `Body`, `Head`, `LegL`, `LegR`, `HindLegL`, `HindLegR`, `Tail`; `TinGrip` under `Head`. The tail has eight alternating material segments and one rigid base pivot. Front paw motion can use `LegL`/`LegR` around their shoulder pivots.
- **Heron:** root `Heron`; `Body`, `Neck`, `Head`, `LegL`, `LegR`, `WingL`, `WingR`. The authored neutral pose has wings **spread**, with a 2.06 m span. To fold them downward, start with `WingL.rotation.z = +1.0` and `WingR.rotation.z = -1.0`; display approaches zero. Animate the neck and head separately for feed/alert poses. All resting toes and feet touch the ground.
- **Field kit:** root `FieldKit`; direct named reusable mesh nodes `Tin`, `Camera`, `Whistle`, `Tent`, `Sign`, `Log`, `Rock`, `Tree`, `Reeds`. All overlap at the origin in the GLB intentionally: extract/clone the requested named object instead of displaying the entire library. No collision proxies, light, camera object, textures, skinning, animation clips or external buffer URLs are exported.

| Attachment | Model-space origin `[x,y,z]`, metres | Parent | Use |
|---|---|---|---|
| Researcher `CameraGrip` | `[0, 1.065, -0.24]` | `Body` | Camera already hangs here, lens along -Z |
| Researcher `TinGrip` | `[0.31, 0.82, -0.28]` | `Body` | Attach the bottom-origin tin to the right hand area |
| Raccoon `TinGrip` | `[0, 0.20, -0.61]` | `Head` | Tin bottom; its top reaches Y=0.418 below the muzzle |
| Heron `WingL` pivot | `[-0.18, 0.955, -0.015]` | `Body` | Rotate around Z for the display |
| Heron `WingR` pivot | `[0.18, 0.955, -0.015]` | `Body` | Rotate around Z for the display |

The camera model's front lens surface is at local Z=-0.164 m. Tin bounds are centred on X/Z with a flat base at Y=0; its top is open with visible stylized bait. The tin has a 0.147 m outer radius and 0.218 m total height. Rigid mesh art does not replace game-authoritative equipment ownership or subject-point evaluation.

| Reusable prop | Width × height × depth, metres | Triangles |
|---|---:|---:|
| Tin | 0.294 × 0.218 × 0.294 | 476 |
| Camera | 0.270 × 0.213 × 0.224 | 180 |
| Whistle | 0.074 × 0.068 × 0.159 | 96 |
| Tent, including guy ropes | 2.495 × 1.614 × 3.682 | 260 |
| Sign | 0.900 × 1.365 × 0.154 | 48 |
| Log | 1.624 × 0.652 × 0.460 | 144 |
| Rock | 1.020 × 0.410 × 0.785 | 32 |
| Tree | 2.390 × 3.380 × 1.851 | 238 |
| Reeds | 0.840 × 1.140 × 0.430 | 360 |

## Reproduction and observed checks

From the shared `games` directory, the original export used this real executable with arguments `--background --factory-startup --python wildly-unqualified/assets/author.py -- --version 1`. The process was launched with PowerShell `Start-Process -WindowStyle Hidden`; it exited 0. Standard output and standard error were redirected into the log files above. No user GUI automation was involved.

The script intentionally refuses to overwrite an existing GLB, versioned `.blend` or manifest. For a later revision, use a new version and new output directory. This example requires neither the user's GUI nor an unsaved working scene:

```powershell
$assetDir = Join-Path (Get-Location) 'wildly-unqualified\assets'
$nextModels = Join-Path (Get-Location) 'wildly-unqualified\public\models\v2'
$process = Start-Process -FilePath 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' `
  -ArgumentList @('--background', '--factory-startup', '--python-exit-code', '1',
    '--python', ('"' + (Join-Path $assetDir 'author.py') + '"'), '--', '--version', '2',
    '--output-dir', ('"' + $nextModels + '"')) `
  -WindowStyle Hidden -PassThru -Wait
$process.ExitCode
```

The version-1 authoring run asserted required names, mesh validity, metre-space bounds, grounded characters/props and character triangle budgets. A second background invocation with `--python-exit-code 1` produced the expected `FileExistsError` and **exit 1** before changing existing assets; see [refusal-v1.err](refusal-v1.err).

Run the two independent output checks from `games`:

```powershell
npm run validate:glb -- wildly-unqualified/public/models/researcher.glb wildly-unqualified/public/models/raccoon.glb wildly-unqualified/public/models/heron.glb wildly-unqualified/public/models/field-kit.glb
node wildly-unqualified/assets/check.mjs
```

On 2026-09-05, the existing glTF validator reported **0 errors, 0 warnings, 0 infos and 0 hints for every GLB**. The import check uses the installed actual `GLTFLoader` and checks hashes, all bounds, grounded prop origins, every named hierarchy/pivot and the recolourable outfit material. Neither check substitutes for the planned labelled browser turntable, unlabelled play-distance silhouettes or a human identifying the animals.

Blender emitted a `Material.use_nodes` deprecation notice for Blender 6.0, beyond this project's pinned 5.2.1 target, and source-save notices about unused factory grease-pencil brush references. Those factory brushes are not used by these meshes and are absent from the self-contained GLBs. The generator uses no user scene, asset library, material or texture as an input.
