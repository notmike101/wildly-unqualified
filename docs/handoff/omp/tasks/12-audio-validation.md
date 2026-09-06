# 12 — Native sound, mute, lifecycle and honest listening

**Scope:** reusable focused visible-browser audio validation and minimal demonstrated fixes.
**Prerequisite:** packet 11. New branch/worktree.
**Read:** current production audio graph/settings/caption flow; previous module evidence in STATE.md. Load old raw reports only to reproduce a specific technique.

- [ ] Use one visible production browser and user-facing Join/Continue/settings controls. Decode/deliver all 36 actual files using native AudioContext, not mocks. Record bytes and decoded channel/frame memory; targets <=5 MiB source assets and <=32 MiB decoded PCM.
- [ ] Collect native graph output for master zero, dense overlapping effects, water fade/reentry and pause/resume/reconnect/visibility. Assert true zero for mute, output ceiling <=0.95, bounded active voices and one ambience/music loop set. Preserve the reviewed limiter/fade/dedup behavior; decoding success is not output validation.
- [ ] Trigger actual whistle/rattle, resident calls/actions, metal/wood contacts, steps on trail/wood/wet supports and local shutter. Verify event IDs/world/species/material and no duplicate restore playback. Test predicted listener direction/range and captions while muted/unavailable.
- [ ] Keep exactly the intentionally auditioned client audible through Settings; other clients muted. Ensure optional music starts only when enabled and leaves the quiet default unchanged.
- [ ] If the harness has an actual audio perception/listening capability, inspect selected cues and a sustained mix and record exactly what was heard. If it cannot listen, export a short original audition plus a clear HUMAN LISTENING PENDING note for the orchestrator. Do not halt unrelated automated work or invent user feedback.

Checks:
```powershell
node --test audio.test.ts
node assets/audio/check.mjs
npm run build
npm run format:check
```
Run the new native browser command and report sample rate, measured peak/silence, memory, source count and selectors. The historical module result (19.37 MiB at 48 kHz, <=0.949999988 peak) is not a fresh integration result.

Verify license/credit files in actual built assets. Commit/push reusable checks and verified fixes. results/12.md distinguishes native automated evidence from listening; preserve the pending human gate if necessary. Close owned browsers/listeners.
