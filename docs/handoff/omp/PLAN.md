# Wildly Unqualified remaining MVP implementation plan

> For the Oh My Pi worker: use Superpowers executing-plans sequentially, with RULES.md adapting platform commands and checkpoint behavior. Do not dispatch agents or load every packet together.

**Goal:** finish the approved generated-reserves MVP and return a tested portable candidate to the orchestrator.
**Architecture:** extend the existing authoritative Node simulation, generated immutable world blueprint and production Three.js client. Reuse current save queue, physics, photo renderer and native audio module; keep transaction boundaries explicit.
**Tech stack:** pinned Node 26.5+, TypeScript, Three.js 0.185.1, Box3D WASM, ws, Vite, Node test runner, Playwright.
**Spec:** ../../superpowers/specs/2026-09-05-wildly-unqualified-generated-reserves-design.md; global constraints are compacted in STATE.md.
**Execution:** start with packet 00, then consume exactly one row at a time. Every row after 01 starts in a new branch/worktree from its predecessor's accepted commit. Split a row into smaller commits if needed; don't broaden scope.

| Packet | Deliverable | Required predecessor |
| --- | --- | --- |
| [00](tasks/00-bootstrap.md) | Verify safe source checkout and Oh My Pi tools | None |
| [01](tasks/01-encounters.md) | Stable decoy investigation and valid washing setup regression | 00 |
| [02](tasks/02-game-regressions.md) | Resolve four remaining full-suite failures without weakening rules | 01 |
| [03](tasks/03-saved-goals.md) | Reproduce and close any saved-goal parsing defect | 02 |
| [04](tasks/04-simulation.md) | Reusable complete command/native-physics outing simulation | 03 |
| [05](tasks/05-visual-acceptance.md) | Actual all-species photos and movement/contact inspection | 04 |
| [06](tasks/06-retention.md) | Unified bounded album/frame/JPEG retention | 05 |
| [07](tasks/07-album-ui.md) | Preview-only, downloads, eligible deletion and shared favorites UI | 06 |
| [08](tasks/08-archives.md) | Validated immutable archives and durable save boundary | 07 |
| [09](tasks/09-next-reserve.md) | Host transaction and coherent client world replacement | 08 |
| [10](tasks/10-transition-faults.md) | Races, real process interruption and archive relocation | 09 |
| [11](tasks/11-audio-integration.md) | Production positional cues, settings and lifecycle | 10 |
| [12](tasks/12-audio-validation.md) | Native output/assets/caption checks; honest listening gate | 11 |
| [13](tasks/13-multiplayer-performance.md) | Automated multiplayer, network and measured dense-world performance | 12 |
| [14](tasks/14-release.md) | Portable candidate, relocation, docs and orchestrator return | 13 |

Completed original Tasks 1–4 and the audio module are not a rebuild backlog. Source regressions and incomplete acceptance from original Task 5 remain first.

At each gate, review the diff against the packet and STATE.md, not just test output. Record actual evidence and limits. Final whole-branch independent review, main integration and release tag belong to the orchestrator. A hard external blocker should produce a precise incomplete return, not a false green milestone.
