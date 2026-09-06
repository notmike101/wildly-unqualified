# Wildly Unqualified server

**Forest MVP — build `forest-mvp-1`, save schema 2.** The source checkout builds into `web-mvp`; a portable release serves its bundled `wildly-unqualified/web`. The preserved prototype release uses schema 1. Use that original release for its original private data; incompatible saves are rejected without conversion or overwrite.

The server runs on Node 26.5 or later within major 26. It uses the standard single-threaded Box3D WASM build and ordinary filesystem/network access. Players need a compatible WebGPU browser; the server needs no GPU, Blender, Codex, Vite, or tunnel software. A home-server OS and architecture still require their own verification.

## Install and start a portable release

From the release directory, install the exact pinned runtime packages once:

```sh
npm ci --omit=dev
node wildly-unqualified/server.ts
```

Keep that terminal/process running. Browse the configured public origin. The default is `http://127.0.0.1:4310`. The entry point also works by absolute path from another working directory; relative data/web settings resolve beside `server.ts`.

The MVP builder creates immutable timestamped directories named `forest-mvp-1-*` under `.artifacts/wildly-unqualified/releases/` and refuses an existing destination. It copies seven runtime modules (including `encounters.ts`), the compiled `web-mvp` bundle into the release's `wildly-unqualified/web`, this runbook, and the pinned package/lockfile. Installed dependencies, authoring tools and private data are excluded. In the development checkout, run `npm run wu:build`, then `npm run wu:release`. The build defaults to `web-mvp`; the accepted prototype's old `web` output remains preserved.

## Configuration

| Environment variable | Default                                           | Meaning                                                                                                |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `WU_BIND_HOST`       | `127.0.0.1`                                       | Interface to listen on. Select an explicit interface for a separate reverse proxy.                     |
| `WU_PORT`            | `4310`                                            | TCP port, 1–65535.                                                                                     |
| `WU_PUBLIC_ORIGIN`   | `http://127.0.0.1:4310` with configured host/port | Exact browser origin, including nonstandard port, with no trailing slash, path, query, or credentials. |
| `WU_DATA_DIR`        | `data` beside `server.ts`                         | Private credentials, world, images and backups. Must be outside the served web tree.                   |
| `WU_WEB_DIR`         | `web` beside `server.ts`                          | Compiled game files.                                                                                   |

For local development, set `WU_DATA_DIR` to `../.artifacts/wildly-unqualified/data` so generated private data stays in the existing artifact tree. For a portable install, use a private writable location and back it up. Permissions are requested as owner-only on systems supporting POSIX modes; on Windows keep the directory in an account-private location with appropriate ACLs. Do not share it through a web/file server.

`GET /healthz` returns only readiness, build and save-schema versions. It does not reveal room state or credentials. Startup fails if the web build is missing, data storage is unavailable, versions are unsupported, or saved data is invalid without a usable backup.

## Host and guests

The first start creates private `room.json`. Open that file locally without placing its contents in logs or screenshots. The `hostSecret` field is the host recovery credential; use it in the browser's room-credential field for the first host admission. Keep the separate `joinSecret` private to invited friends. The host must enter before new guests can join.

The host's invite control produces a copyable URL with the join credential in its fragment. The browser removes the fragment and submits the credential directly to the same-origin admission endpoint. A guest invite never grants host administration. An authenticated host can retrieve the invite through `GET /api/invite`, which also lists pending admissions. The application does not send invitations for you.

Admissions create a random HttpOnly, SameSite=Strict session cookie, marked Secure for an HTTPS public origin. Reconnecting with that cookie restores the same reserved identity. A second connection cannot take over an already connected identity. The room has four player slots. Disconnected slots stay reserved; while paused, up to four guests can wait for explicit host reassignment. Pending guests have no avatar or world access. Host reassignment replaces a disconnected guest slot's session mapping and invalidates the prior cookie. It cannot replace a connected player or the host.

## Pause, save, stop and restore

The host can pause or choose **Save and stop server** in the room controls. The server announces a completed save only after the final write resolves, then closes sockets and stops listening. Ctrl+C or a normal SIGTERM uses the same close path where the platform delivers those signals. The exported `close()` path is also exercised by integration tests. If a final save fails, the server remains paused and reports the failure; repair storage and retry. A forced process kill or power loss can lose progress since the last successful save.

World and album saves run every ten seconds and on significant room actions. The private `run.json` envelope has schema version 2 and is capped at 8 MiB. It includes the selected four commissions, animal memory, equipment/route state, supplies, recoverable incidents, bounded album, JPEG image bytes, shared favorites and immutable pending capture frames. Writes are serialized through a sibling temporary file and atomic replacement, retaining a valid `run.json.bak`. Unknown versions fail clearly. A corrupt or unavailable primary can recover from a valid backup with an explicit startup warning; an invalid save never silently becomes a new outing.

Restart loads paused, disconnects all old sockets, neutralizes movement and releases stale player-held equipment. A hat being borrowed by the raccoon returns safely to its owner when the old connections are cleared; its protection against immediate repeat theft persists. A reconnecting photographer receives any pending immutable capture and can finish the original image upload. Uploaded pixels never award objective credit. Keep both `room.json` and `run.json`, their backups, and any remaining private directory files together when backing up. Do not edit JSON by hand to resolve game progress.

To relocate or restore:

1. Pause, flush and stop the old server successfully. Keep it stopped throughout the move.
2. Copy the complete private data directory and retain an untouched backup. Install the same compatible release at the destination.
3. Configure the destination data path, port and exact public origin, then start it. Only one process may write a data directory.
4. Recover the host using the copied `hostSecret`. Re-admit friends and use the paused host controls to reassign disconnected guest slots.
5. Check the album, objectives, supplies and animal state, then resume. Rollback uses the stopped old instance, the same compatible release and a consistent backup of the complete private directory.

Browser cookies do not transfer to a different origin. Re-admission and slot reassignment restore access without resetting the world. Local directory/port relocation is covered by socket tests; operation on an inaccessible home server is not thereby established.

## HTTPS and WebSocket proxy

Use HTTPS for friends outside the local machine. A reverse proxy or temporary tunnel must forward HTTP and WebSocket Upgrade traffic to the configured listen interface and port, and preserve the browser's Origin header. Set `WU_PUBLIC_ORIGIN` to the exact HTTPS browser origin and use that same origin in the host browser. The server compares the actual Origin; it does not trust forwarded-origin headers. Never disable the origin check to work around a proxy error.

A development tunnel is one replaceable transport option. Tunnel setup/public testing is separate from the release bundle; no external service is required by the server code. The machine and transport must remain available while friends play. The application bounds admission attempts, message size/rate and image uploads, and closes unresponsive WebSockets using ping/pong. Only generated web assets are served: source, credentials, saves, traversal paths and symlink escapes are rejected.

## Validation limits

Run `npm run wu:test` and `npm run wu:build` in the development checkout before packaging. Socket tests exercise admission, actual authoritative movement, upload ownership, restart, recovery and local relocation. A fresh release smoke test should run `npm ci --omit=dev` and the absolute server entry point from a different working directory, then request health, the page and an authenticated WebSocket. Browser/GPU correctness, public HTTPS/WSS and two-to-four-person playtesting are separate gates; consult the game's verification record for observed results.
