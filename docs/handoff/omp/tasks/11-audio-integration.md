# 11 — Connect the existing native audio module

**Scope:** main.ts, view.ts, index.html/style.css, shared.ts, server.ts/game.ts metadata and strict save validator if event fields change.
**Prerequisite:** packet 10. New branch/worktree.
**Read:** references/task-7-integration-handoff.md (exact source mapping, ~1,500 words), current audio.ts API and metadata producers. The reviewed e07b4b3 limiter/water fix is already in b16: preserve it.

Existing createAudio() methods: unlock(), settings({master,effects,ambience,music}), listener(position,forward), environment({habitat,waterDistance}), cue({id,kind,position,species?,material?}), pause(bool), dispose().

- [ ] Create exactly one audio instance per client outside world/view/socket installation. Gesture unlock on Join, Continue and restored-session viewport entry before network awaits; admission must not await audio readiness.
- [ ] Replace old playSound call sites and oscillator implementation. Remove the nonzero distant-volume floor; native HRTF/linear attenuation already owns gain. Keep server delivery range explicit.
- [ ] Extend existing settings with effects .8, ambience .35 and music 0; preserve saved volume as master including exact zero. Validate finite values and provide accessible labels. Captions remain at mute/unsupported audio.
- [ ] Extend only the existing world-scoped cue envelope with actual species/material where needed. Use authoritative resident identity/event position and real involved contact bodies. Do not infer material/species from nearest decor, duplicate shutter on restored frames, or emit action sounds each snapshot. Teammate shutter is a named caption; local shutter uses the module once.
- [ ] Supply listener from the rendered predicted camera immediately after assignment, including yaw/pitch/crouch. Water distance is to the actual rectangle surface; habitat from actual geometry with labeled woodland fallback. Steps classify the highest real supporting surface, using the same walkables/open-fixture surfaces as prediction.
- [ ] Pause immediately on world install/loss/disconnect/room pause; unpause only for coherent connected ready current state. Reuse caches/context through retry. Reset stride accumulation and keep module's existing visibility ownership; no replay of discarded muted/paused cues.
- [ ] Serve actual .wav/.ogg MIME types and preserve audio/provenance in web/release. If persistent event metadata changes, update strict save fields deliberately.

Checks:
```powershell
node --test audio.test.ts shared.test.ts game.test.ts server.test.ts save.test.ts
npm run build
npm run format:check
node assets/audio/check.mjs
```
Add focused integration tests for actual metadata selection/lifecycle; do not repeat already-passing module tests as a substitute for wiring. Commit/push; results/11.md lists removed legacy paths, cue producers, lifecycle and settings contracts. Native output/listening are packet 12.
