# Worker rules and context budget

This handoff narrows the already-approved generated-reserves plan for sequential execution in Oh My Pi. The user explicitly chose autonomy, minimal chat, programmatic testing and new branches/worktrees. These instructions override generic skill advice to ask about known red baselines, ask for continuation, run parallel agents, switch to main after a worktree failure, or present integration options. There is no authorization to merge main in this worker pass; the orchestrator reviews the candidate first.

## One task cycle

1. Read CURRENT.md and one packet. Read only its named source sections and references. If .codegraph exists, query CodeGraph before locating code; otherwise use rg. Do not create an index.
2. Confirm clean owned branch/worktree and record the base SHA. For tasks after 01, create a new branch/worktree from the preceding accepted SHA using packet 00's recipe. The current packet may contain multiple tiny commits; push coherent checkpoints.
3. Write a short local checklist for this packet only. For a failure, trace callers and observe the failing boundary before editing. Retain strict negative cases when migrating obsolete fixtures.
4. Run the focused red/green check. Finish formatting before builds/release-byte tests. Run checks sequentially against settled source. Do not duplicate an unchanged full suite just to fill time.
5. Inspect git diff, staged scope and git diff --cached --check. Commit only this packet and its report. Push the existing private origin, verify visibility and remote SHA.
6. Write results/NN.md (at most 500 words, links to ignored raw evidence). Update CURRENT.md (at most 300 words) with the next task, current branch/worktree/SHA, exact last checks and unresolved items. Commit/push this ledger too. Then proceed.

If a packet is too large for remaining context, checkpoint its incomplete steps, exact first failing command and next action; resume the SAME packet. Never replace a failure with a skip, enlarge production limits, remove an assertion, teleport, force behavior/credits, inject fake JPEG success, or mark an intended test run as executed. Structured fixture mutation is allowed in explicitly labeled negative/unit tests; it does not count as positive gameplay evidence.

Three unsuccessful guesses mean stop guessing: return to reproduction/caller tracing and record the hypotheses. Continue independent safe work only if it has no unmet prerequisite. A missing credential, inaccessible machine, required subjective judgment, or unresolved data-loss risk may need a concise material question. Never invent access or approval.

## Evidence and publication

Use each owned worktree's ignored .artifacts/omp/NN/ for logs, screenshots and private test data. Record commands, cwd, source SHA, exit code, actual counts, seeds, world IDs/hashes, process ownership and limits. Keep credentials, storageState, real run/room files, .env, node_modules, generated builds and raw profiles out of Git. Commit sanitized reports and reusable test scripts.

Repository: https://github.com/notmike101/wildly-unqualified.git (private, game only). No new repo and no parent research. Push each task's branch; never rewrite published history. A URL is not backup proof: verify GitHub privacy and the actual branch SHA.

Use Superpowers executing-plans for the sequence, systematic-debugging for failures, test-driven-development for real behavior changes and verification-before-completion for claims. The bundled skills are references; read only the applicable body. Their platform-specific examples are not commands to run blindly. Never print environment secrets from an example. Prefer stdlib/native functions and existing helpers; no framework, broad refactor or speculative abstraction.

## Commit and verify a checkpoint

Stage only the packet's named changed files and sanitized reports using explicit paths. Inspect git diff --cached --stat, git diff --cached, then git diff --cached --check. Commit with a concrete fix/feat/test/docs message. These commands run from the owned worker checkout after its checks:

```powershell
$wuBranch = (git branch --show-current).Trim()
if ($wuBranch -notmatch '^work/omp-') { throw 'Unexpected worker branch' }
$wuHead = (git rev-parse HEAD).Trim()
$wuPrivacy = gh api repos/notmike101/wildly-unqualified | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $wuPrivacy.private -or $wuPrivacy.owner.login -ne 'notmike101') { throw 'Private origin not verified' }
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin $wuBranch
if ($LASTEXITCODE -ne 0) { throw 'Push failed; preserve local checkpoint and investigate' }
$wuRemote = (gh api "repos/notmike101/wildly-unqualified/git/ref/heads/$wuBranch" --jq '.object.sha').Trim()
if ($LASTEXITCODE -ne 0 -or $wuRemote -ne $wuHead) { throw 'Remote SHA mismatch' }
git status --short
```

No credentials appear in the output. A verified source commit can be recorded in the subsequent ledger commit; record its actual SHA, never a guessed/self-referential future hash.

No ordinary messaging to other people is authorized. Keep user browsers, Blender scenes, old deployment/data and original worktrees intact. Close only processes/windows started for your test, tracked by PID/ownership; old PIDs are stale.
