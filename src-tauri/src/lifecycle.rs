//! All user exits are decided by the same frontend draft guards.
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

#[derive(Default)]
pub struct ExitPermission(pub AtomicBool);

#[tauri::command]
pub fn complete_exit(
    app: tauri::AppHandle,
    core: crate::App<'_>,
    action: String,
) -> Result<(), String> {
    if core.file_operations_active() {
        return Err("Wait for file operations to finish before closing Chest.".into());
    }
    if !matches!(action.as_str(), "close" | "quit") {
        return Err("Invalid exit action".into());
    }
    app.state::<ExitPermission>()
        .0
        .store(true, Ordering::Release);
    if action == "quit" {
        app.exit(0);
    } else if let Some(window) = app.get_webview_window("main") {
        window.close().map_err(crate::err)?;
    }
    Ok(())
}

pub fn request(app: &tauri::AppHandle, action: &str) -> bool {
    if app.get_webview_window("main").is_none() {
        return false;
    }
    if app.state::<ExitPermission>().0.load(Ordering::Acquire) {
        return false;
    }
    let _ = app.emit_to("main", "desktop-menu", action);
    true
}
