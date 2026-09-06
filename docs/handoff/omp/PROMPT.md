# Wildly Unqualified: finish the MVP in Oh My Pi

You are the implementation worker for an existing game. Work on this same Windows machine using Oh My Pi. Complete the remaining approved MVP work one small task at a time, then return evidence to the orchestrator. Do not restart the project, redesign it, or assume Codex tools, conversation history, a large context window, or extra agents.

Start in:
D:/friendslop-games/games/wildly-unqualified/.worktrees/omp-01-wildlife
Branch: work/omp-01-wildlife

Read only these initially:
1. AGENTS.md
2. docs/handoff/omp/CURRENT.md
3. docs/handoff/omp/RULES.md
4. docs/handoff/omp/tasks/00-bootstrap.md

Execute packet 00, then the single packet named by CURRENT.md. Read STATE.md once for product scope; load historical references and skill bodies only when the current packet needs them. The ordered task list is in PLAN.md. The latest runnable starting source is **b16f00ed549e8dac0f26400d3dadd34e00e29f6a**, with six recorded test failures. Main and the expedition documentation branch are older game code. The prepared worker checkout adds handoff documentation to that source; verify ancestry before editing.

Mandatory workflow:
- Use a NEW branch and NEW worktree for each subsequent numbered task, based on the preceding verified task commit. Never work in main or any original worker checkout. Never reset, clean, rebase, force-push, delete, or absorb unrelated original work.
- Read the relevant callers, reproduce the problem, write a meaningful failing regression where appropriate, make the smallest coherent fix, run the packet's checks, inspect the diff, commit and push the private feature branch. Preserve exact commands, exit codes, counts, and source SHA.
- Update CURRENT.md and write a concise results/NN.md at each checkpoint. Continue autonomously through the ordered packets. At context reset, reread CURRENT.md and the current packet, not the full history. Do not start a dependent packet with a failing prerequisite.
- Ordinary code/tool/test blockers are yours to investigate. Ask only when the answer materially changes the game or an external capability is indispensable. Keep chat to short milestone/blocker messages. Do not ask whether to continue between tasks.
- Prefer programmatic simulation, native physics, real production commands and scripted browser assertions. No agents literally walking through long outings. Browser checks that remain necessary must be visible; new Blender authoring must use a visible foreground instance. Simulation cannot prove human fun, a 40–60-minute duration, listening quality or internet reliability.
- Keep existing stack and free/local tools. Preserve strict validation, server authority, private saves, immutable photos and portable self-hosting. No paid services or account/model changes. Never print tokens, room credentials or cookies.
- Tool setup is in TOOLS.md and setup-omp.ps1. Install the included project-local Superpowers skills and Blender Lab MCP configuration there; verify actual availability. Use installed Node/npm/Git/gh and repository Playwright directly. Do not install a Computer Use dependency merely to test the game.
- Historical candidate fixes and harness drafts in drafts/ are UNVERIFIED references. Their original dirty checkout must remain untouched. Do not copy a candidate production fix and call it accepted.

Finish all feasible automated implementation/acceptance and prepare a portable candidate release. Return using RETURN.md. Leave human listening/pacing and inaccessible-home-server checks explicitly pending. Push branches and verify private visibility and matching remote SHA. **Do not merge main, force-push, publish publicly, or create the final release tag. Stop for orchestrator review at the end.** Do not claim the full MVP accepted while a material gate remains open.
