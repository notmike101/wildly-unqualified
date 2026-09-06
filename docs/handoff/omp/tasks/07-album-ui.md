# 07 — Album preview, download, deletion and favorites

**Scope:** main.ts, index.html, style.css, shared.ts and server/game command validation where packet 06 needs it; browser assertions.
**Prerequisite:** packet 06. New branch/worktree.
**Read:** packet-06 report/types; main.ts renderAlbum/queuePhoto, pending frame map and object URL handling; server photo GET/upload routes; favorite command and strict client-command parser.

- [ ] Write assertions around the existing controls/production endpoints for saturated extra preview, retained credit, favorite persistence and deletion rejection. Reuse repository Playwright and existing authentic session helpers.
- [ ] Display a clear preview-only state for unsaved extras. Allow local download of that JPEG without starting a doomed upload. Display retained and pending status separately; reconnect should render only actual retained pending frames.
- [ ] Add accessible download and explicit deletion controls for eligible extras. Default authorization: photographer or host may delete an uncredited photo with no favorites; enforce it server-side. Protect credited/favorited photos from deletion and preserve another player's favorites. Record this concrete choice; do not add bulk destructive deletion or moderation UI.
- [ ] Keep current world ID and names in all actions. Reject stale-world, unknown-ID, unauthorized and favorited/credited deletion requests. On success remove all associated record/frame/bytes; no deleted picture should reappear after pending upload or restart.
- [ ] Revoke replaced/removed object URLs and avoid accumulating preview buffers across captures/world changes. Favoriting an eligible extra changes eviction eligibility immediately and persists through restore.
- [ ] In one visible scripted client, use actual buttons and a real JPEG; verify preview/download, shared favorite update and eligible deletion. Socket tests may construct a full album fixture, explicitly labeled a capacity fixture rather than an earned outing.

Checks:
```powershell
node --test album-retention.test.ts game.test.ts shared.test.ts server.test.ts save.test.ts
npm run build
npm run format:check
```
Run/document the new focused visible UI command; assert downloads' bytes, restart persistence and absence of page errors. Never use a synthetic byte fixture as visual evidence.

Commit/push; results/07.md records selectors/commands, deletion permissions, retention/UI contract and actual evidence. Close owned test browser/listener. Do not start archive/Next reserve implementation in this packet.
