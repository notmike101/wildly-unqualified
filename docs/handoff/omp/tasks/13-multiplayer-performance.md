# 13 — Automated multiplayer and dense-world performance

**Scope:** browser.ts/reusable packet-04 harness and focused server/client tests; minimal measured bottleneck fixes.
**Prerequisite:** packet 12 feasible automated gates. New branch/worktree.
**Read:** references/browser-acceptance-handoff.md as historical mechanics, current browser.ts and packet-04/05/10 reports. Do not run legacy npm run test:browser blindly: it has old paths/port/scenario assumptions.

- [ ] Make the existing driver use source-relative paths, configurable owned ports/output and generated world/objectives. Keep headless:false for any browser checks and read-only diagnostics. Use accelerated ordinary commands/native physics for long travel; scripted UI/socket checks for actual admission/render/upload/return/Next. No subagents manually driving avatars.
- [ ] Complete one two-player and two DISTINCT four-player generated outings overall. Cover six required goals, actual JPEGs, recoverable equipment/mischief, resources, return/exhibition, favorites, restart/reconnect and Next reserve. Rotate active nearby tasks; log observed idle periods >90 simulated seconds. Bind actual identities/world IDs; artificial fixture albums are not earned outing evidence.
- [ ] Use authentic independent admitted sessions and actual WebSocket messages to verify identity/color/name, admission ownership, simultaneous far-region activity, world install, capture upload, favorite and transition. Tests in an in-process run are labeled separately from transport/client tests.
- [ ] One four-session check must traverse actual HTTPS/WSS to an owned local server through a replaceable tunnel/proxy, with the existing 150 ms WebSocket delay path and measured RTT. A local secure reverse proxy proves TLS only; an actual internet path needs a real route. Never disable Origin checks, use old credentials/tunnels, send invitations or pay for infrastructure. If external access is unavailable, report the precise missing WAN gate instead of replacing it with a fake socket.
- [ ] Reuse existing world.test.ts seed sweep (258 unique + high-bit coverage observed); assert current 12-species/36–48 population, density/bounds/connected approaches and two independent worlds. Exercise target anchors and four far-separated players at genuine 48 population; no reducing approved content for speed.
- [ ] Measure a visible moving dense viewport at 1280x720 DPR 1 for >=30 seconds with raw frame intervals/count, GPU/adapter, draw calls/triangles, server step timings, network bytes and memory. Historical same-PC RAF p95/p99=8.5 ms is display-paced, not GPU duration. Record four-window contention separately from single-view baseline; instrumentation overhead and simulation rates must be stated.

Checks:
```powershell
node --test world.test.ts reserve-runtime.test.ts server.test.ts
npm test
npm run build
npm run format:check
```
Run actual new documented acceptance commands; do not repeat long human-paced walking. Fix reproducible material failures at their common cause, commit/push coherent corrections and recheck affected gates. results/13.md labels every evidence layer and unresolved subjective/external gate. Close owned temporary browsers/proxy/listeners.
