# Windows desktop release

## Decision (2026-09-08)

Use Tauri 2 with the shared Evergreen WebView2 runtime and bundled Node 26.5.
CrossCode's installed Windows build uses NW.js 0.35.5. NW.js itself is active
(0.115.0 ships Chromium 152), but distributing a Chromium copy defeats the
small-download objective. Wails uses the same system webview with a Go host.
Electrobun's smaller Cottontail runtime is interesting, but replacing Node would
introduce a separate compatibility migration for the authoritative server.

The native launcher owns a hidden Node process, opens its loopback URL and
pre-fills the locally generated host key. Closing the window requests a graceful
save over the private stdin pipe. Failed saves keep the process/window alive for
retry. An existing hosted room can be opened with `--url URL`; this does not start
a local server or grant native APIs to the remote page. Navigation stays on the
selected origin. Desktop saves and browser profiles live outside installation
files, under the user's local application data.

This is packaging, not a native rewrite of Three.js or a new multiplayer design.
The existing two-player minimum and self-hosting requirements remain applicable.
The first release is `v0.1.0-alpha.1`, Windows x64, in the private GitHub repository.

## Implementation and acceptance

- [x] Test the desktop server adapter with real admission, save failure/retry,
      restart and parent EOF during startup.
- [x] Reuse the runtime allowlist and package pinned dependencies plus Node.
- [x] Build the Tauri window and verify actual WebGPU rendering visibly.
- [x] Check native window close/save and server adapter restart.
- [ ] Check two native clients and remote join mode: automatic approval review
      rejected the second native launch twice with only "blocked by policy".
      A protocol guest was used for the first native window's gameplay check.
- [x] Check standalone-package independence with an empty PATH and unrelated cwd.
- [x] Run Node tests (212 passed, zero skipped), typecheck, lint and native build checks.
- [x] Publish the ZIP, checksums and candid alpha release notes; verify privacy,
      tag commit and uploaded artifact digests.

## Evidence and build

The visible Tauri/WebView2 smoke test selected NVIDIA Ampere hardware with
`isFallbackAdapter: false`, admitted the local host, entered an outing with a
WebSocket protocol guest, acquired pointer lock, and moved more than 0.5 units.
There were no reported asset errors. This does not establish full multiplayer
gameplay acceptance or two-native-client acceptance. Native window close stopped
the owned listener after saving. Isolated integration tests cover save restart,
failed-save retry and EOF before startup has completed.

Build with `pnpm install --frozen-lockfile` then `npm run release:desktop` on
Windows x64 / Node 26.5.0 / Rust with Visual Studio C++ build tools. The script
uses Cargo.lock, static CRT linkage and remaps local source paths. It refuses an
existing output folder. Supply a new folder to `node scripts/release-desktop.ts`
after `npm run build` to produce another package. Archive the complete output
folder, not only the launcher executable. No runtime compilation happens on
players' machines.

The desktop alpha version is independent of the existing content build and save
schema identifiers. Only the native Windows package is being released here;
there is no renderer rewrite, server runtime migration, updater or installer.

The final static-CRT launcher is 3.01 MiB, and the full directory is 115.7 MiB.
PE import inspection confirms only Windows system DLLs for both launcher and
bundled Node; local user/workspace paths are absent from both binaries.
The visible gameplay check used the earlier native build; static linkage and
shutdown fixes were subsequently rebuilt and checked through compilation,
dependency inspection and server adapter regressions.

Published release: https://github.com/notmike101/wildly-unqualified/releases/tag/v0.1.0-alpha.1

The 44.27 MiB ZIP was extracted outside the repository and its bundled server
passed the empty-PATH/unrelated-cwd smoke check. GitHub reports prerelease=true,
draft=false and private=true. The release tag and BUILD.json both identify
`3e1bba01f2c099eb0a14dcc249e4ba733f522847`. Both uploaded asset digests match
their local SHA-256 values. ZIP SHA-256:
`08f69011aa0287515eee1aa230daca71d17d3361a91f4c628312559258d1bd83`.

## Sources

- https://nwjs.io/blog/v0.115.0/
- https://v2.tauri.app/distribute/windows-installer/
- https://v2.tauri.app/develop/sidecar/
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution
- https://wails.io/docs/next/guides/windows/
- https://framework.blackboard.sh/electrobun/guides/cottontail/
