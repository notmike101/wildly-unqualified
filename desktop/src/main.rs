#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::{
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Write},
    os::windows::process::CommandExt,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    time::Duration,
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

fn show_error(message: &str) {
    let text: Vec<u16> = message.encode_utf16().chain(Some(0)).collect();
    let title: Vec<u16> = "Wildly Unqualified".encode_utf16().chain(Some(0)).collect();
    // Both strings are NUL-terminated and remain alive for this synchronous dialog.
    unsafe {
        windows_sys::Win32::UI::WindowsAndMessaging::MessageBoxW(
            std::ptr::null_mut(),
            text.as_ptr(),
            title.as_ptr(),
            windows_sys::Win32::UI::WindowsAndMessaging::MB_ICONERROR,
        );
    }
}

struct Server {
    child: Child,
    replies: mpsc::Receiver<Value>,
    _lock: fs::File,
}

impl Server {
    fn start(root: PathBuf, data: &PathBuf) -> Result<(Self, Value), Box<dyn std::error::Error>> {
        fs::create_dir_all(data)?;
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .write(true)
            .open(data.join("host.lock"))?;
        lock.try_lock()
            .map_err(|_| "This reserve is already open in another copy of the game.")?;
        let log = OpenOptions::new()
            .create(true)
            .append(true)
            .open(data.join("desktop-server.log"))?;
        let mut child = Command::new(root.join("runtime/node.exe"))
            .arg(root.join("runtime/wildly-unqualified/src/desktop/server.ts"))
            .current_dir(&root)
            .env("WU_DATA_DIR", data.join("saves"))
            .env("WU_WEB_DIR", root.join("runtime/wildly-unqualified/web"))
            .env("WU_BIND_HOST", "127.0.0.1")
            .env_remove("WU_PUBLIC_ORIGIN")
            .env_remove("NODE_OPTIONS")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(log)
            .creation_flags(0x08000000)
            .spawn()?;
        let stdout = child.stdout.take().unwrap();
        let (tx, replies) = mpsc::channel::<Value>();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                let Ok(line) = line else { break };
                if let Ok(value) = serde_json::from_str(&line) {
                    if tx.send(value).is_err() {
                        break;
                    }
                }
            }
        });
        let ready = replies.recv_timeout(Duration::from_secs(30));
        match ready {
            Ok(value) if value["type"] == "ready" => Ok((
                Self {
                    child,
                    replies,
                    _lock: lock,
                },
                value,
            )),
            _ => {
                // Dropping stdin asks a partially started server to save and stop.
                child.stdin.take();
                Err(format!("Could not start the reserve. Another copy may already be hosting on port 4310. Details: {}", data.join("desktop-server.log").display()).into())
            }
        }
    }

    fn stop(&mut self) -> Result<(), String> {
        if let Ok(Some(status)) = self.child.try_wait() {
            if !status.success() {
                show_error("The game server stopped unexpectedly. Check desktop-server.log before restarting.");
            }
            return Ok(());
        }
        self.child
            .stdin
            .as_mut()
            .ok_or("Server pipe is closed")?
            .write_all(b"stop\n")
            .map_err(|e| e.to_string())?;
        let reply = self
            .replies
            .recv_timeout(Duration::from_secs(30))
            .map_err(|_| "Saving did not finish. Keep the game open and retry closing it.")?;
        if reply["type"] != "stopped" {
            return Err(reply["message"]
                .as_str()
                .unwrap_or("Save failed. Please retry.")
                .into());
        }
        self.child.wait().map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn main() {
    let result = tauri::Builder::default()
        .setup(|app| {
            let data = std::env::var_os("WU_DESKTOP_DATA_DIR").map(PathBuf::from)
                .unwrap_or(app.path().app_local_data_dir()?);
            fs::create_dir_all(&data)?;
            let args: Vec<String> = std::env::args().skip(1).collect();
            let (url, server, secret) = if args.len() == 2 && args[0] == "--url" {
                let url: tauri::Url = args[1].parse()?;
                if !["http", "https"].contains(&url.scheme()) || !url.username().is_empty() || url.password().is_some() {
                    return Err("Room URL must use HTTP or HTTPS without embedded credentials".into());
                }
                (url, None, Value::Null)
            } else if args.is_empty() {
                let root = std::env::current_exe()?.parent().ok_or("Missing application directory")?.to_path_buf();
                let (server, ready) = Server::start(root, &data)?;
                (ready["url"].as_str().ok_or("Missing server URL")?.parse()?, Some(server), ready["hostSecret"].clone())
            } else {
                return Err("Usage: Wildly Unqualified.exe [--url https://your-room.example/]".into());
            };
            let origin = url.origin().ascii_serialization();
            let allowed_origin = origin.clone();
            let script = format!("if (location.origin === {} && {}) {{ document.addEventListener('DOMContentLoaded', () => {{ const input = document.getElementById('secret'); if (input && !input.value) input.value = {}; }}, {{ once: true }}); }}", json!(origin), !secret.is_null(), secret);
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Wildly Unqualified · Alpha")
                .inner_size(1280.0, 800.0).min_inner_size(800.0, 600.0)
                .data_directory(data.join("browser"))
                .initialization_script(script)
                .on_navigation(move |target| target.origin().ascii_serialization() == allowed_origin)
                .build()?;
            if let Some(server) = server {
                let server = Arc::new(Mutex::new(server));
                let closing = Arc::new(AtomicBool::new(false));
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if closing.swap(true, Ordering::SeqCst) { return; }
                        let server = Arc::clone(&server);
                        let closing = Arc::clone(&closing);
                        let app_handle = app_handle.clone();
                        std::thread::spawn(move || {
                            match server.lock().unwrap().stop() {
                                Ok(()) => app_handle.exit(0),
                                Err(error) => { show_error(&error); closing.store(false, Ordering::SeqCst); }
                            }
                        });
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!());
    if let Err(error) = result {
        show_error(&error.to_string());
        std::process::exit(1);
    }
}
