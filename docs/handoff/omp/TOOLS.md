# Oh My Pi tools on this machine

Verified read-only on 2026-09-06: Oh My Pi 18.1.12 at C:/Users/me/.bun/bin/omp.exe; Node v26.5.0; Git/gh/npm installed. Use the user's existing authenticated model/provider. Do not upgrade the harness, change account/model/approval policy, run omp token, or copy global auth/config databases.

## Project setup

Run setup-omp.ps1 once in each NEW owned worktree. It copies five included Superpowers skill directories into ignored .omp/skills and writes only a missing project .omp/mcp.json for Blender Lab. It does not touch global configuration. If a project MCP config already exists, it verifies the required entry rather than overwriting it.

PowerShell 7 is available at:
C:/Users/me/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe

OMP project skill discovery is .omp/skills/<name>/SKILL.md; project MCP config is .omp/mcp.json. Start a fresh OMP session from the actual worker cwd after setup. For an existing session use /mcp reload, /mcp list and /mcp test blender_lab. These are OMP interactive commands, not shell commands. A server handshake/tool listing is not proof of a live Blender scene connection: call the read-only object summary too. If skill discovery is disabled in user settings, use explicit --skills with this worktree's .omp/skills/*/SKILL.md glob, or read the included files directly; do not change global settings silently.

Available builtins include read/write/edit, bash, grep/glob, lsp, Python, browser (Puppeteer), web_search and task. Inspect the live tool list; names/permissions may differ. No Codex functions.exec, CUA, imagegen or collaboration API is assumed. Use repository Playwright from the shell for scripted visible browser checks; use Node tests first. Additional browser/GitHub/Context7 MCP servers are unnecessary because repository Playwright, gh and ctx7 cover these tasks.

Skills: executing-plans, using-git-worktrees, systematic-debugging, test-driven-development, verification-before-completion. Exact Superpowers 6.3.0 sources and MIT license are included under vendor/superpowers. RULES.md supplies the sequential/no-repeat-question adaptation. No new custom skill or plugin framework is needed.

## Blender Lab (needed only for real asset work)

Existing server:
C:/Users/me/AppData/Local/friendslop-tools/blender-mcp-venv/Scripts/blender-mcp.exe
Arguments: --transport stdio
Environment: BLENDER_MCP_HOST=127.0.0.1, BLENDER_MCP_PORT=9877.

This is Blender Lab's blender-mcp 1.0.0, not a different community server on port 9876. Local source/add-on:
C:/Users/me/AppData/Local/friendslop-tools/blender_mcp-1.0.0/addon/blender_mcp_addon
Read its readme.md and addon/blender_mcp_addon/__init__.py before setup. Blender 5.2 is installed under C:/Program Files/Blender Foundation/Blender 5.2.

**Current probe failed:** unable to connect to 127.0.0.1:9877. The executable exists; the Blender-side bridge was not proven active. Prior assets were authored with real foreground Blender scripting; do not retroactively label that as MCP work.

For an asset correction, inspect running Blender window/process first. Reuse an appropriate visible session without replacing unsaved work. Enable/install the local Blender MCP add-on, set Host 127.0.0.1 / Port 9877 in its preferences and choose Start Server (operator blmcp.server_start). The local source is authoritative for exact registration/online-access behavior. If automation requires a new owned authoring session, launch Blender visibly with a versioned working copy and --python setup script, never -b/--background. The inspected add-on supports addon_utils.enable('blender_mcp_addon', default_set=False) after adding its parent to sys.path; obtain preferences from bpy.context.preferences.addons and set host/port before bpy.ops.blmcp.server_start(). Check the installed version's preconditions first.

Bring the authoring window to the foreground and verify title/scene/object summary before mutations. Use actual exposed inspection/edit tools; documentation tools help with API details. Save new versioned .blend/export paths. Do not delete the scene or modify the original library. If the harness cannot show/inspect a window, do not pretend it can; keep code tasks moving and report the narrow asset-visibility blocker if a proven asset defect needs repair.

## Documentation and external access

For library/CLI/API-specific setup or behavior, fetch current docs:
```powershell
npx ctx7@latest library 'Three.js' 'WebGPU renderer capture render target lifecycle'
# Pick the matching returned /org/project ID, then fetch that exact concept.
```
Always resolve library first unless the user supplied its ID. At most three ctx7 commands per question; separate unrelated concepts. No private code or credentials in queries. Quota error: report it and the login/API-key option; do not fabricate current docs. Use primary official docs as an explicitly labeled fallback. Do not index CodeGraph without an existing .codegraph directory.

Harness setup was checked against installed OMP source:
- src/discovery/builtin.ts (native .omp skills/MCP discovery)
- src/config/mcp-schema.json
- src/modes/controllers/mcp-command-controller.ts
- omp --help (supports --cwd and @file prompts)
Installation source root: C:/Users/me/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent.

Primary references: [OMP MCP configuration](https://github.com/can1357/oh-my-pi/blob/main/docs/mcp-config.md), [OMP repository](https://github.com/can1357/oh-my-pi), [Blender Lab](https://www.blender.org/lab/mcp-server/). OMP configuration docs were also retrieved through Context7 /can1357/oh-my-pi. Setup-file validation is not an end-to-end OMP/model session test.
