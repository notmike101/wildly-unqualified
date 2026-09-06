# 05 — Real wildlife images, contacts and mature forest

**Scope:** reusable render check under assets/ or tests as fits existing repository; view.ts, wildlife.ts, forest-view.ts, level.ts/support-meshes.ts only for demonstrated errors. Asset corrections are conditional.
**Prerequisite:** packet 04 complete. New branch/worktree.
**Read:** drafts/render/client.ts and run.mjs, references/task-5-programmatic-render.md, assets/manifest-v4.json and actual capturePhoto/createView/subjectPoints. Load contact/animation references only for the species being inspected.

- [ ] Adapt the draft renderer to the CURRENT checkout via import.meta.url/explicit source/output arguments. Remove old absolute routines/expedition assumptions, fixed listener ownership and 30-minute polling. Process a finite explicit fixture list and exit nonzero on missing/error/oversize/uninspected cases. Do not copy the historical STOP sentinel.
- [ ] Launch repository Playwright with headless:false, actual Edge/WebGPU and a new free port. Keep the rendering browser visible. Call production createView and capturePhoto on the naturally earned packet-04 frames; no fabricated JPEG bytes.
- [ ] Produce at least one qualifying action image for each of all twelve species and inspect it. Check intended individual prominence, silhouette/readability, clipping, terrain/branch/water contact and frozen pose while live actors advance. Neighbor credit metadata is not intended-subject proof. Include Fox pounce, Squirrel climb/cache, Otter surface/groom, Woodpecker cling/tap/flight and Owl roost/perch transition.
- [ ] Numerically compare imported photo markers with production subject points when available; label missing/ambiguous markers (historical Heron) and use actual geometry/image inspection. Verify repeated frozen captures are stable; JPEG <=65536 bytes; no asset/page errors.
- [ ] Inspect short scripted continuous sequences for transitions, Beavers/branch work, visible tracks, clear equipment routes, names/colors, dense mature crowns with open contrast, water and sky. Select current-world camera views using read-only geometry, not a manually played outing. Record actual image/sequence paths and specific judgments.
- [ ] If visual evidence proves a model defect, use TOOLS.md to establish REAL Blender Lab connectivity in a visible foreground session before authoring. Reuse v4 source/pivots/semantic names, save a new versioned scene/export, update manifest/provenance/hashes and relevant contact checks. No asset rebuild merely to show activity.

Checks:
```powershell
node assets/check-v4.mjs
node --test view.test.ts forest-view.test.ts expedition-wildlife.test.ts
npx tsc --noEmit
npm run build
```
Run the newly documented finite renderer command and inspect outputs. If the receiving model has no image inspection capability, preserve the images and mark that precise visual gate pending; numeric hashes alone cannot close it.

Close only owned browser/server. Commit/push reusable validation and verified fixes; results/05.md lists twelve species and observed evidence, not a blanket “visuals pass.” Keep subjective pacing/fun separate.
