# 00 — Safe checkout and tool setup

**Outcome:** the receiver runs in its own correctly based checkout with usable local tools. No game edit in this packet.
**Read:** PROMPT.md, RULES.md, STATE.md, TOOLS.md. The prepared first worktree should already exist; verify before creating anything.

- [ ] In PowerShell, inspect the exact checkout:
```powershell
$wuRoot = 'D:/friendslop-games/games/wildly-unqualified'
$wuWork = "$wuRoot/.worktrees/omp-01-wildlife"
git -C $wuWork status --short
git -C $wuWork branch --show-current
git -C $wuWork merge-base --is-ancestor b16f00ed549e8dac0f26400d3dadd34e00e29f6a HEAD
if ($LASTEXITCODE -ne 0) { throw 'Wrong source base' }
git -C $wuWork worktree list
git -C $wuWork remote get-url origin
gh api repos/notmike101/wildly-unqualified --jq '{owner:.owner.login,private:.private,visibility:.visibility}'
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify private origin' }
```
Expected branch work/omp-01-wildlife, source ancestor b16, game-only origin, private=true. If unexpected dirty files exist, inspect them; never reset another worker's work.

- [ ] Run project setup from the worker cwd:
```powershell
Set-Location -LiteralPath $wuWork
& ./docs/handoff/omp/setup-omp.ps1
node --version
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency install failed' }
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'Unexpected baseline type failure; investigate' }
```
Use PowerShell 7's absolute path in TOOLS.md if the harness shell is Bash/Windows PowerShell. Do not paste PowerShell syntax into Bash. Start/reload OMP as documented; verify skill availability and MCP config. A failed live Blender probe is currently known and does not block code regressions.

- [ ] Verify drafts/MANIFEST.json hashes before reusing any drafts. Do not copy all drafts into production. Record setup results in results/00.md and go to packet 01 without a continuation question.

## New worktree recipe for EVERY subsequent packet

Finish/commit/push the current packet first. Read its actual accepted commit into $wuBase. Replace NN-topic with the next packet's number and short name. These variables are deliberately explicit; never use main as the base.
```powershell
$wuBase = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'No accepted base' }
$wuNextBranch = 'work/omp-NN-topic'
$wuNextWork = "$wuRoot/.worktrees/omp-NN-topic"
git -C $wuRoot check-ignore -q .worktrees
if ($LASTEXITCODE -ne 0) { throw 'Worktree directory is not ignored' }
git -C $wuRoot worktree add -b $wuNextBranch $wuNextWork $wuBase
if ($LASTEXITCODE -ne 0) { throw 'Resolve worktree failure; never fall back to main' }
Set-Location -LiteralPath $wuNextWork
& ./docs/handoff/omp/setup-omp.ps1
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Install failed' }
```
Do not delete old worktrees to free a branch name. Choose a new suffix if a genuinely different prior attempt owns it; resume an existing task only after verifying its ledger/ownership. Set every tool's cwd to the new checkout, or restart OMP with --cwd there before edits. Skills/MCP and relative paths are cwd-sensitive.
