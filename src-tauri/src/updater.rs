use std::sync::{atomic::{AtomicBool, Ordering}, Mutex};
use std::time::Duration;
use serde::Serialize;
use tauri::{AppHandle, State, ipc::Channel};
use tauri_plugin_updater::{Update, UpdaterExt};
use crate::{App, err};

#[derive(Default)]
pub struct UpdaterState {
    pending: Mutex<Option<Update>>,
    operation: tokio::sync::Mutex<()>,
    installed: AtomicBool,
}
#[derive(Serialize)]
pub struct AppUpdateInfo {
    current_version: String,
    development: bool,
    test_profile: bool,
    version: Option<String>,
    notes: Option<String>,
}
#[derive(Clone, Serialize)]
pub struct DownloadProgress { downloaded: u64, total: Option<u64>, installing: bool }
fn idle(core: &chest_core::Core) -> Result<(), String> {
    if core.activities().iter().any(|a| matches!(a.status.as_str(), "running"|"starting"|"stopping"|"installing"|"paused"|"pausing")) {
        return Err("Stop running instances and finish installations before updating Chest.".into());
    }
    Ok(())
}
#[tauri::command]
pub fn get_app_update_info(app: AppHandle, core: App<'_>) -> AppUpdateInfo {
    AppUpdateInfo { current_version:app.package_info().version.to_string(),development:cfg!(debug_assertions),test_profile:core.store.is_test_profile(),version:None,notes:None }
}
#[tauri::command]
pub async fn check_app_update(app: AppHandle, core: App<'_>, state: State<'_, UpdaterState>) -> Result<AppUpdateInfo,String> {
    let _operation=state.operation.try_lock().map_err(|_|"Updater busy")?;
    if state.installed.load(Ordering::SeqCst) { return Err("Restart Chest to finish updating.".into()); }
    let update=app.updater_builder().timeout(Duration::from_secs(15)).build().map_err(err)?.check().await.map_err(err)?;
    let mut info=get_app_update_info(app, core);
    if let Some(update)=&update {info.version=Some(update.version.clone());info.notes=update.body.clone();}
    *state.pending.lock().map_err(err)?=update;
    Ok(info)
}
#[tauri::command]
pub async fn install_app_update(core: App<'_>, state: State<'_, UpdaterState>, on_progress: Channel<DownloadProgress>) -> Result<(),String> {
    let _operation=state.operation.try_lock().map_err(|_|"Updater busy")?;
    if cfg!(debug_assertions) {return Err("Updates install in release builds.".into());}
    if core.store.is_test_profile() {return Err("App updates are disabled in test profiles.".into());}
    idle(&core)?;
    let mut update=state.pending.lock().map_err(err)?.clone().ok_or("Check for updates first.")?;
    update.timeout=Some(Duration::from_secs(300));
    let mut downloaded=0u64;
    let bytes=update.download(|chunk,total|{
        downloaded+=chunk as u64;
        let _=on_progress.send(DownloadProgress {downloaded,total,installing:false});
    },||{}).await.map_err(err)?;
    idle(&core)?;
    let _=on_progress.send(DownloadProgress {downloaded,total:Some(downloaded),installing:true});
    let _maintenance=core.begin_maintenance().map_err(err)?;
    update.install(bytes).map_err(err)?;
    state.installed.store(true,Ordering::SeqCst);
    *state.pending.lock().map_err(err)?=None;
    Ok(())
}
#[tauri::command]
pub fn restart_updated_app(app:AppHandle, core:App<'_>, state:State<'_,UpdaterState>) -> Result<(),String> {
    idle(&core)?;
    if !state.installed.load(Ordering::SeqCst){return Err("No installed update to restart.".into());}
    let _maintenance=core.begin_maintenance().map_err(err)?;
    app.restart();
}
