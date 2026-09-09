Wildly Unqualified — Windows x64 alpha 0.1.0-alpha.1

Extract the entire ZIP, then open Wildly Unqualified.exe. Keep its runtime
folder beside it. Node, npm, Rust and a separate browser installation are not
required. The shared Microsoft WebView2 Evergreen runtime and a WebGPU-capable
GPU/driver are required. WebView2 is normally already present on Windows 10/11.
If missing, install it from Microsoft's official page:
https://developer.microsoft.com/microsoft-edge/webview2/

The launcher starts a local room and fills its host key. Enter your field name
and select Enter the reserve. Two players are required to start an outing.
Closing the game saves the local room before exiting; a failed save keeps it
open so you can repair storage and retry.

Saves and the browser session are in:
%LOCALAPPDATA%\games.friendslop.wildly-unqualified\
Back up the entire saves folder, including room credentials and photographs.
Do not share that folder. Updates can replace the extracted application files
without replacing these saves. Do not run multiple local hosts against one save.

To join a separately hosted room, create a shortcut whose target is:
"C:\path\to\Wildly Unqualified.exe" --url "https://your-room.example/"
Enter the invitation key supplied by the host. This mode starts no local server.
The default local room binds only to this computer (127.0.0.1:4310). Internet/LAN
hosting still follows runtime\SERVER.md; the desktop wrapper adds no relay or
automatic port forwarding. An advanced host can run the bundled runtime with
the environment settings in that guide, using runtime\node.exe instead of node.

This is an unsigned alpha. It is not version 1.0 and is not full gameplay
acceptance. The historical browser outing scenario still needs migration;
the current server MIME allowlist does not serve JSON/WAV/OGG audio assets.
See BUILD.json for build identity and licenses for third-party notices.
