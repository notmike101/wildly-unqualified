# 08 — Immutable archives and durable publication

**Scope:** save.ts, save.test.ts; release.ts if a necessary runtime module is added. Prefer extending existing concrete helpers.
**Prerequisite:** packet 07. New branch/worktree.
**Read:** references/next-reserve-handoff.md sections “Publish an immutable archive,” “Archive retry identity,” and “Crash/backup semantics”; current serialize/replace/saveRun/loadRun in full.

**New interface to implement:** archiveRun(dataDir: string, run: RunState, images: Map<string, Uint8Array>): Promise<string>. It resolves to the validated immutable archive path. Preserve existing saveRun/loadRun signatures. Record any justified minimal signature adjustment for packet 09.

- [ ] Test first with owned temp data: valid full schema-3 archive; byte-stable retry; tampered existing target refusal; changed favorite after failed transition produces a different immutable name. No overwrite or automatic deletion.
- [ ] Reuse the exact bounded validated save serialization, including blueprint, full run and retained JPEGs. Snapshot before awaits. Do not produce a second looser archive schema or duplicate blueprint into every PhotoFrame.
- [ ] Archive name: validated world ID + digest of canonical persistent content. Exclude ONLY transient connection/input/sequence/pause bookkeeping from retry identity; include favorites/credits/world/JPEG bytes and all persistent wildlife/equipment state. Validate and compare canonical contents before reusing an existing exact target.
- [ ] Write/sync staging content, then publish exclusively on the same filesystem (native hard link is a suitable minimal option). Existing mismatched destination is an error. Preserve failed staging/old archives. Unsupported filesystem behavior must fail clearly, not silently fall back to overwrite.
- [ ] Improve the existing primary/backup replacement path with file sync before publication and directory metadata sync where supported. Keep strict startup fallback/incompatible-version semantics. State Windows filesystem limits: tested process interruption does not establish power-loss durability on all hardware.
- [ ] Use real filesystem obstruction fixtures to show failed staging/publishing leaves previous primary, backups and archives unchanged. Retrying after repair succeeds; changed favorites retain both full archive versions, with resulting disk growth documented.

Checks:
```powershell
node --test save.test.ts album-retention.test.ts release.test.ts
npx tsc --noEmit
npm run format:check
```
Archive output and existing persistence tests must pass. No server transaction yet. results/08.md names exact exports, archive path format/canonical fields, publication commit point, supported filesystem operation and limitations. Commit/push.
