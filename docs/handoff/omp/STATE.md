# Verified starting state — 2026-09-06

## Source and existing work

Game root: D:/friendslop-games/games/wildly-unqualified. Parent D:/friendslop-games is research, not this Git repository.

| Checkout / branch | Commit | Meaning |
| --- | --- | --- |
| main | cee4ce6cd517861d8914b80d377daf9ebb21e150 | Preserved older MVP; do not use as implementation base |
| .worktrees/routines / feat/species-routines | b16f00ed549e8dac0f26400d3dadd34e00e29f6a | Latest committed game source; known red full suite |
| .worktrees/expedition / feat/generated-reserves | 018460fef7dafef85f622f5ce7862488dd0420ca | Latest progress/findings documents; game code predates wildlife branch |
| .worktrees/albums / feat/expedition-albums | b2ee00c21f56f4161403ea1def8cefb7f8dd9e31 | Test-only retention preparation; runtime older |
| .worktrees/audio / feat/forest-audio | e07b4b3df9b2e77878a87cbeff1f65f71cfda817 | Reviewed module fix already integrated into b16; do not redo |

Original routines has five uncommitted paths: encounters.ts, encounters.test.ts, expedition-equipment.test.ts, expedition-equipment-helpers.ts and expedition-validation.ts. They predate the stop. Copies/hashes are in drafts/; originals remain untouched. A six-line Deer fix is an unverified candidate, not an accepted patch.

Full suite at b16: **190/196 pass, six failures, 178.059 seconds**. Read references/wildlife-validation-findings.md for the six distinct causes and the unproven saved-goal parsing concern. Earlier focused checks passed, but full Task 5 acceptance/review did not. An accelerated loop stalled after one required Rabbit credit and an optional cameo. Fifteen JPEGs rendered with bounded bytes/repeat hashes; qualitative inspection and all-species acceptance did not finish.

Completed foundations: generated authoritative world, mature forest and v4 assets, 12-species routines/poses/commissions source checkpoints, native audio module and 36 licensed/generated assets. Remaining: wildlife acceptance/known failures; bounded albums/Next reserve; actual audio integration; combined acceptance/release. Existing docs describing three species/four goals/schema 2 are historical.

## Binding product contract

- 2–4 friends on different internet connections. Buy once per player eventually; no host subscription or paid runtime dependency. Current stack: Node 26 (>=26.5.0 <27), TypeScript, Three.js/WebGPU, Box3D WASM, ws, Vite and repository Playwright.
- A 40–60-minute human outing target; no claim this is established by simulation. Photography is the goal, with regular recoverable equipment/traversal challenges and light mischief. Avoid compulsory wait timers, cross-map tin escorts and four-player-only locks.
- Approximately 384 x 320 m, eight habitat pockets, two useful route loops, two refill/recovery stations. Land 70% dense / 20% light / 10% open (+/-5 percentage points); dense crown coverage 70–90%. Four-metre carrying corridors, six-metre overhead clearance. Keep mature low-poly trees, varied understory, clear routes, water and coherent sky.
- Twelve species: raccoon, deer, heron, fox, rabbit, squirrel, beaver, otter, badger, owl, woodpecker, mallard. 36–48 persistent individuals. No off-camera replacement population.
- Six required plus two optional bound photo objectives, >=5 species, >=2 new species and >=5 pockets per outing; all twelve eligible across seeds. Exact resident, behavior, anchor, line of sight and real geometric framing matter. Multiple legitimate credits in one frame are allowed.
- One shared tin/case/screen/decoy, permanent local crossing planks, renewable supplies/local recovery; at most one active borrowed hat with repeat protection. Preserve names/colors and authoritative collision/incident causality.
- Schema 3, content forest-expedition-1. Blueprint <=1 MiB; save <=8 MiB; 64 retained photos, each JPEG <=64 KiB. Eight credit slots protected; <=56 extras; credits/favorites protected from automatic eviction.
- Next reserve: connected host only after exhibition; refuse pending captures; archive completed evidence immutably, durably install validated new world; preserve room/crew identities; start paused at camp. Old state usable on precommit failure. No campaign/database needed.
- Original/CC0 audio, native Web Audio; music off by default; absolute master mute and visible critical cues. Existing $100 OpenAI subscription/free tools, no outsourced labor or paid API surprise.
- Portable own-PC server, later movable with complete private directory. Home server is inaccessible; no claim of testing it.

Authoritative detail: ../../superpowers/specs/2026-09-05-wildly-unqualified-generated-reserves-design.md. Its initial inventory/status is historical; requirements above and current source/checkpoint take precedence for state.

## Protected local originals

Preserve the whole directories, not merely Git:
- D:/friendslop-games/games/.artifacts/wildly-unqualified/mvp-2026-09-05/portable-install-2026-09-06-final-ui
- D:/friendslop-games/games/.artifacts/wildly-unqualified/forest-mvp-play-data-2026-09-06-final
- D:/friendslop-games/games/.artifacts/wildly-unqualified/releases/forest-mvp-1-2026-09-06T03-42-48-626Z
- MVP-HOST-ACCESS.md beside those folders contains secrets: never print or commit.
- Existing .blend files/source exports and original worktrees.

Historical listener 4316/tunnel/PIDs may no longer exist after the outage. Inspect current ownership; never kill by old PID or reuse someone else's live listener. Owned prior validation port 4322/browser were closed. Use new free ports and new test data.
