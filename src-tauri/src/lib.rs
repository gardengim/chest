mod updater;
mod lifecycle;
mod startup;
mod shortcuts;
mod color_schemes;
#[cfg(desktop)]
mod menu;
use chest_core::{
    metadata::Version,
    store::{Account, Config, Instance, SidebarGroup},
    Activity, Content, Core,
};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
fn ui_text(app:&tauri::AppHandle,key:&str)->String {
    #[cfg(desktop)]
    {menu::label(app,key)}
    #[cfg(not(desktop))]
    {let _=app;key.to_string()}
}
static IMAGE_READS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);
type App<'a> = State<'a, Arc<Core>>;
fn err(e: impl std::fmt::Display) -> String {
    format!("{e}")
}

#[tauri::command]
fn get_launch_settings(core: App<'_>, id: String) -> Result<chest_core::launch_settings::LaunchSettings, String> {
    core.launch_settings(&id).map_err(err)
}
#[tauri::command]
fn save_launch_settings(core: App<'_>, id: String, settings: chest_core::launch_settings::LaunchSettings) -> Result<(), String> {
    core.save_launch_settings(&id, settings).map_err(err)
}
#[tauri::command]
fn open_launcher_link(link: String) -> Result<(), String> {
    chest_core::open_launcher_link(&link).map_err(err)
}
#[tauri::command]
async fn get_account_skin(core:App<'_>,id:String)->Result<Option<String>,String>{core.account_skin(&id).await.map_err(err)}
#[tauri::command]
async fn get_instance_files(core:App<'_>,id:String)->Result<chest_core::instance_files::InstanceFiles,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move ||core.instance_files(&id)).await.map_err(err)?.map_err(err)
}
#[tauri::command]
async fn get_screenshots(core:App<'_>)->Result<chest_core::instance_files::ScreenshotLibrary,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move ||core.screenshot_library()).await.map_err(err)
}
#[tauri::command]
async fn get_servers(core:App<'_>)->Result<chest_core::instance_files::ServerLibrary,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move ||core.server_library()).await.map_err(err)
}
#[tauri::command]
fn open_instance_file(core:App<'_>,id:String,kind:String,name:String)->Result<(),String>{core.open_instance_file(&id,&kind,&name).map_err(err)}
#[tauri::command]
async fn get_screenshot_image(core:App<'_>,id:String,name:String,edge:Option<u32>)->Result<String,String>{
    let core=core.inner().clone();
    let permit = IMAGE_READS.acquire().await.map_err(err)?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        match edge { Some(edge) => core.screenshot_thumbnail(&id,&name,edge), None => core.screenshot_image(&id,&name) }
    }).await.map_err(err)?.map_err(err)
}
#[tauri::command]
async fn get_world_icon(core:App<'_>,id:String,name:String)->Result<Option<String>,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move ||core.world_icon(&id,&name)).await.map_err(err)?.map_err(err)
}
#[tauri::command]
async fn get_server_icon(core:App<'_>,id:String)->Result<Option<String>,String>{core.server_icon(&id).await.map_err(err)}
#[tauri::command]
fn open_shared_datapacks(core:App<'_>)->Result<(),String>{core.shared_datapacks().map_err(err)}
#[tauri::command]
async fn apply_shared_datapacks(core:App<'_>,id:String,world:String)->Result<usize,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move ||core.apply_datapacks(&id,&world)).await.map_err(err)?.map_err(err)
}
#[tauri::command]
async fn get_worlds(core:App<'_>)->Result<chest_core::worlds::Worlds,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move ||core.worlds()).await.map_err(err)
}
#[tauri::command]
async fn get_instance_worlds(core:App<'_>,id:String)->Result<Vec<chest_core::worlds::World>,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move ||core.instance_worlds(&id)).await.map_err(err)?.map_err(err)
}
#[tauri::command]
async fn get_world_info(core:App<'_>,id:String,name:String)->Result<chest_core::worlds::World,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move ||core.world_info(&id,&name)).await.map_err(err)?.map_err(err)
}
#[tauri::command]
async fn copy_world(core:App<'_>,id:String,name:String,target:String)->Result<String,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move ||core.copy_world(&id,&name,&target)).await.map_err(err)?.map_err(err)
}
#[tauri::command]
async fn backup_world(app:tauri::AppHandle,core:App<'_>,id:String,name:String)->Result<bool,String>{
    let Some(path)=app.dialog().file().set_file_name(format!("{name}.zip")).add_filter(ui_text(&app,"World backup"),&["zip"]).blocking_save_file() else{return Ok(false);};
    let path=path.into_path().map_err(err)?;
    let core=core.inner().clone();tokio::task::spawn_blocking(move ||core.backup_world(&id,&name,&path)).await.map_err(err)?.map_err(err)?;Ok(true)
}
#[tauri::command]
fn save_server_bookmark(core:App<'_>,bookmark:chest_core::server_bookmarks::ServerBookmark)->Result<Config,String>{core.save_server_bookmark(bookmark).map_err(err)}
#[tauri::command]
fn remove_server_bookmark(core:App<'_>,id:String)->Result<Config,String>{core.remove_server_bookmark(&id).map_err(err)}
#[tauri::command]
async fn add_bookmarked_server(core:App<'_>,bookmark:String,id:String)->Result<bool,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move ||core.add_bookmarked_server(&bookmark,&id)).await.map_err(err)?.map_err(err)
}
#[tauri::command]
fn get_config(core: App<'_>) -> Config {
    core.store.config()
}
#[tauri::command]
fn get_launcher_info(core: App<'_>, app: tauri::AppHandle) -> serde_json::Value {
    serde_json::json!({"version":app.package_info().version.to_string(),"platform":std::env::consts::OS,"architecture":std::env::consts::ARCH,"data_path":core.store.root.to_string_lossy(),"test_profile":core.store.is_test_profile()})
}
#[tauri::command]
async fn get_storage_usage(core:App<'_>)->Result<chest_core::storage::StorageUsage,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move || core.storage_usage()).await.map_err(err)
}
#[tauri::command]
async fn clear_image_cache(core:App<'_>)->Result<u64,String>{
    let core=core.inner().clone();tokio::task::spawn_blocking(move || core.clear_image_cache()).await.map_err(err)?.map_err(err)
}
#[tauri::command]
fn open_data_folder(core: App<'_>) -> Result<(), String> {
    core.open_data_folder().map_err(err)
}
#[tauri::command]
async fn choose_java(app: tauri::AppHandle) -> Result<Option<String>, String> {
    app.dialog().file().blocking_pick_file().map(|p|p.into_path().map(|p|p.to_string_lossy().into_owned()).map_err(err)).transpose()
}
#[tauri::command]
async fn inspect_java(path: String) -> Result<String, String> {
    let path=path.trim();
    if path.is_empty() { return Err("Choose a Java executable first.".into()); }
    let mut command=tokio::process::Command::new(path);
    command.arg("-version").kill_on_drop(true);
    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);
    let output=tokio::time::timeout(std::time::Duration::from_secs(10),command.output()).await
        .map_err(|_|"Java check timed out".to_string())?.map_err(err)?;
    let text=format!("{}{}",String::from_utf8_lossy(&output.stderr),String::from_utf8_lossy(&output.stdout));
    if !output.status.success() || !text.to_lowercase().contains("version") { return Err("Could not determine Java version".into()); }
    Ok(text.chars().take(4096).collect())
}
#[tauri::command]
fn get_debug_launch(core: App<'_>) -> chest_core::DebugLaunch {
    core.debug_launch()
}
#[tauri::command]
fn set_debug_offline(core: App<'_>, enabled: bool) -> Result<chest_core::DebugLaunch, String> {
    core.set_debug_offline(enabled).map_err(err)
}
#[tauri::command]
async fn get_instance_icons(core: App<'_>) -> Result<std::collections::HashMap<String, String>, String> {
    let core=core.inner().clone();
    tokio::task::spawn_blocking(move || core.instance_icons()).await.map_err(err)
}
#[tauri::command]
async fn get_instance_backgrounds(core: App<'_>, id: String) -> Result<Vec<chest_core::backgrounds::Background>, String> {
    core.instance_backgrounds(&id).await.map_err(err)
}
#[tauri::command]
fn get_activities(core: App<'_>) -> Vec<Activity> {
    core.activities()
}
#[tauri::command]
async fn get_news(core: App<'_>) -> Result<Vec<chest_core::news::Article>, String> {
    chest_core::news::latest(&core.client).await.map_err(err)
}
#[tauri::command]
async fn get_instance_news(core: App<'_>, id: String) -> Result<chest_core::news::InstanceNews, String> {
    chest_core::news::instance_updates(&core, &id).await.map_err(err)
}
#[tauri::command]
fn open_news(url: String) -> Result<(), String> {
    chest_core::news::open(&url).map_err(err)
}
#[tauri::command]
async fn get_versions(core: App<'_>) -> Result<Vec<Version>, String> {
    core.versions().await.map_err(err)
}
#[tauri::command]
async fn get_fabric_versions(core: App<'_>, version: String) -> Result<Vec<String>, String> {
    chest_core::fabric::versions(&core.client, &version)
        .await
        .map_err(err)
}
#[tauri::command]
async fn get_quilt_versions(core: App<'_>, version: String) -> Result<Vec<String>, String> {
    chest_core::fabric::quilt_versions(&core.client, &version)
        .await
        .map_err(err)
}
#[tauri::command]
async fn get_loader_versions(core: App<'_>, version: String, loader: chest_core::store::Loader) -> Result<Vec<String>, String> {
    chest_core::loaders::versions(&core.client, &version, loader).await.map_err(err)
}
#[tauri::command]
fn get_catalog_sources() -> chest_core::catalog::Sources {
    chest_core::catalog::sources()
}
#[tauri::command]
async fn search_catalog(
    core: App<'_>,
    query: chest_core::catalog::Query,
) -> Result<chest_core::catalog::Page, String> {
    chest_core::catalog::search(&core.client, query)
        .await
        .map_err(err)
}
#[tauri::command]
async fn get_creation_releases(
    core: App<'_>, source: chest_core::catalog::Source, project: String,
    game: String, loader: chest_core::store::Loader, kind: chest_core::catalog::Kind,
) -> Result<Vec<chest_core::catalog::Release>, String> {
    let config = core.store.config();
    let instance = Instance { id:String::new(), name:String::new(), version:game, loader,
        loader_version:String::new(), memory_mb:config.memory_mb, java_path:config.java_path,
        artwork:"grass".into(), installed:false, playtime_seconds:0, storage_parent:String::new() };
    chest_core::catalog::releases(&core.client, source, &project, &instance, kind).await.map_err(err)
}
#[tauri::command]
async fn get_catalog_description(core: App<'_>, source: chest_core::catalog::Source, project: String) -> Result<chest_core::catalog_description::Description, String> {
    chest_core::catalog_description::description(&core.client, source, &project).await.map_err(err)
}
#[tauri::command]
fn open_description_link(url: String) -> Result<(), String> {
    chest_core::catalog_description::open_link(&url).map_err(err)
}
#[tauri::command]
async fn get_catalog_releases(
    core: App<'_>,
    source: chest_core::catalog::Source,
    project: String,
    id: String,
    kind: chest_core::catalog::Kind,
) -> Result<Vec<chest_core::catalog::Release>, String> {
    let instance = core.store.instance(&id).map_err(err)?;
    chest_core::catalog::releases(&core.client, source, &project, &instance, kind)
        .await
        .map_err(err)
}
#[tauri::command]
async fn add_catalog_content(
    core: App<'_>,
    source: chest_core::catalog::Source,
    project: String,
    id: String,
    version: String,
    kind: chest_core::catalog::Kind,
) -> Result<Vec<String>, String> {
    core.inner()
        .install_content(id, source, project, version, kind)
        .await
        .map_err(err)
}
#[tauri::command]
async fn get_modpack_releases(
    core: App<'_>,
    source: chest_core::catalog::Source,
    project: String,
    game: String,
    loader: String,
) -> Result<Vec<chest_core::catalog::Release>, String> {
    chest_core::modpack::releases(&core.client, source, &project, &game, &loader)
        .await
        .map_err(err)
}
#[tauri::command]
async fn install_modpack(
    core: App<'_>,
    source: chest_core::catalog::Source,
    project: String,
    version: String,
    name: String,
) -> Result<Instance, String> {
    core.inner()
        .queue_modpack(source, project, version, name)
        .map_err(err)
}
#[tauri::command]
fn open_project(source: chest_core::catalog::Source, url: String) -> Result<(), String> {
    chest_core::catalog::open_project(source, &url).map_err(err)
}
#[tauri::command]
async fn create_wizard(core: App<'_>, request: chest_core::creation::CreationRequest) -> Result<Instance, String> {
    let core = core.inner().clone();
    tokio::task::spawn_blocking(move || core.create_wizard(request)).await.map_err(err)?.map_err(err)
}
#[tauri::command]
async fn choose_instance_location(app: tauri::AppHandle) -> Result<Option<String>, String> {
    app.dialog().file().blocking_pick_folder().map(|p| p.into_path().map(|p| p.to_string_lossy().into_owned()).map_err(err)).transpose()
}
#[derive(serde::Serialize)]
struct ImportedColorScheme { name: String, source: String }
#[tauri::command]
async fn import_color_scheme(app: tauri::AppHandle) -> Result<Option<ImportedColorScheme>, String> {
    let Some(path) = app.dialog().file().add_filter(ui_text(&app,"Color scheme"), &["json", "css"]).blocking_pick_file() else { return Ok(None); };
    let path = path.into_path().map_err(err)?;
    tokio::task::spawn_blocking(move || {
        let source = color_schemes::read(&path)?;
        let name = path.file_stem().and_then(|name| name.to_str()).unwrap_or("Imported scheme").chars().take(120).collect();
        Ok(Some(ImportedColorScheme {name, source}))
    }).await.map_err(err)?
}
#[tauri::command]
async fn export_color_scheme(app: tauri::AppHandle, source: String) -> Result<bool, String> {
    let Some(path) = app.dialog().file().set_file_name("chest-color-scheme.json").add_filter(ui_text(&app,"Color scheme"), &["json"]).blocking_save_file() else { return Ok(false); };
    let path = path.into_path().map_err(err)?;
    tokio::task::spawn_blocking(move || color_schemes::write(&path, &source)).await.map_err(err)??;
    Ok(true)
}
#[tauri::command]
async fn choose_creation_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    app.dialog().file().add_filter(ui_text(&app,"Content"), &["jar", "zip"]).blocking_pick_files().unwrap_or_default().into_iter().map(|p| p.into_path().map(|p| p.to_string_lossy().into_owned()).map_err(err)).collect()
}
#[tauri::command]
async fn choose_creation_archive(app: tauri::AppHandle) -> Result<Option<chest_core::creation::ArchivePreview>, String> {
    let Some(path) = app.dialog().file().add_filter(ui_text(&app,"Chest archive"), &["zip"]).blocking_pick_file() else { return Ok(None) };
    let path = path.into_path().map_err(err)?;
    tokio::task::spawn_blocking(move || chest_core::creation::inspect_archive(path)).await.map_err(err)?.map(Some).map_err(err)
}
#[tauri::command]
fn create_instance(
    core: App<'_>,
    name: String,
    version: String,
    loader: Option<chest_core::store::Loader>,
    loader_version: Option<String>,
) -> Result<Instance, String> {
    core.store
        .create_with_loader(
            name,
            version,
            "grass".into(),
            loader.unwrap_or_default(),
            loader_version.unwrap_or_default(),
        )
        .map_err(err)
}
#[tauri::command]
fn set_sidebar_groups(core: App<'_>, groups: Vec<SidebarGroup>) -> Result<Config, String> {
    core.store.set_sidebar_groups(groups).map_err(err)
}
#[tauri::command]
fn reorder_instances(core: App<'_>, ids: Vec<String>) -> Result<Config, String> {
    core.store.reorder(&ids).map_err(err)
}
#[tauri::command]
fn save_instance(core: App<'_>, instance: Instance) -> Result<Config, String> {
    core.save_instance(instance).map_err(err)
}
#[tauri::command]
async fn install_instance(core: App<'_>, id: String) -> Result<(), String> {
    core.start_install(id).map_err(err)
}
#[tauri::command]
fn pause_install(core: App<'_>, id: String, paused: bool) -> Result<(), String> {
    core.pause(&id, paused).map_err(err)
}
#[tauri::command]
async fn rename_resource(core:App<'_>,id:String,kind:String,item:String,name:String)->Result<(),String>{let core=core.inner().clone();tokio::task::spawn_blocking(move||core.rename_resource(&id,&kind,&item,&name)).await.map_err(err)?.map_err(err)}
#[tauri::command]
fn launch_resource(core:App<'_>,id:String,kind:String,item:String)->Result<(),String>{core.launch_resource(id,&kind,item).map_err(err)}
#[tauri::command]
async fn launch_instance(core: App<'_>, id: String) -> Result<(), String> {
    core.launch(id).map_err(err)
}
#[tauri::command]
fn stop_instance(core: App<'_>, id: String) -> Result<(), String> {
    core.stop(&id).map_err(err)
}
#[tauri::command]
fn get_logs(core: App<'_>, id: String) -> Vec<String> {
    core.logs(&id)
}
#[tauri::command]
fn get_content(core: App<'_>, id: String) -> Result<Vec<Content>, String> {
    core.content(&id).map_err(err)
}
#[tauri::command]
fn toggle_content(core: App<'_>, id: String, kind: String, name: String) -> Result<(), String> {
    core.toggle_content(&id, &kind, &name).map_err(err)
}
#[tauri::command]
fn get_instance_folder(core: App<'_>, id: String) -> Result<String, String> {
    core.instance_folder(&id).map(|path| path.to_string_lossy().into_owned()).map_err(err)
}
#[tauri::command]
fn open_instance_folder(core: App<'_>, id: String) -> Result<(), String> {
    core.open_folder(&id).map_err(err)
}
#[tauri::command]
async fn duplicate_instance(core: App<'_>, id: String) -> Result<Instance, String> {
    let core = core.inner().clone();
    tokio::task::spawn_blocking(move || core.duplicate(&id)).await.map_err(err)?.map_err(err)
}
#[tauri::command]
async fn remove_instance(core: App<'_>, id: String) -> Result<Config, String> {
    let core = core.inner().clone();
    tokio::task::spawn_blocking(move || core.remove(&id)).await.map_err(err)?.map_err(err)
}
#[tauri::command]
fn acknowledge(core: App<'_>, id: String) -> Result<(), String> {
    core.acknowledge(&id).map_err(err)
}
#[tauri::command]
fn save_settings(
    core: App<'_>,
    client_id: String,
    java_path: String,
    memory_mb: u32,
) -> Result<Config, String> {
    if !(512..=65536).contains(&memory_mb) {
        return Err("Memory must be between 512 and 65536 MB".into());
    }
    if !client_id.trim().is_empty() {
        uuid::Uuid::parse_str(client_id.trim())
            .map_err(|_| "Invalid Microsoft application ID".to_string())?;
    }
    core.store
        .change(|c| {
            c.client_id = client_id.trim().into();
            c.java_path = java_path.trim().into();
            c.memory_mb = memory_mb;
            Ok(())
        })
        .map_err(err)
}
#[tauri::command]
fn select_account(core: App<'_>, id: String) -> Result<Config, String> {
    if !core.store.config().accounts.iter().any(|a| a.id == id) {
        return Err("Account not found".into());
    }
    core.store
        .change(|c| {
            c.active_account = Some(id);
            Ok(())
        })
        .map_err(err)
}
#[tauri::command]
async fn sign_in(core: App<'_>) -> Result<Account, String> {
    let _permit = core
        .auth_lock
        .try_acquire()
        .map_err(|_| "Another account operation is in progress".to_string())?;
    let cancel = Arc::new(AtomicBool::new(false));
    *core.auth_cancel.lock().unwrap() = Some(cancel.clone());
    let result = chest_core::auth::sign_in(&core.store, &core.client, cancel)
        .await
        .map_err(err);
    *core.auth_cancel.lock().unwrap() = None;
    result
}
#[tauri::command]
fn cancel_sign_in(core: App<'_>) {
    if let Some(cancel) = core.auth_cancel.lock().unwrap().as_ref() {
        cancel.store(true, Ordering::Relaxed);
    }
}
#[tauri::command]
async fn sign_out(core: App<'_>, id: String) -> Result<(), String> {
    let _permit = core
        .auth_lock
        .try_acquire()
        .map_err(|_| "Account operation is in progress".to_string())?;
    chest_core::auth::sign_out(&core.store, &id).map_err(err)
}
#[tauri::command]
async fn export_instance(app: tauri::AppHandle, core: App<'_>, id: String) -> Result<bool, String> {
    let path = app
        .dialog()
        .file()
        .set_file_name("instance.chest.zip")
        .add_filter(ui_text(&app,"Chest archive"), &["zip"])
        .blocking_save_file();
    let Some(path) = path else { return Ok(false) };
    let path = path.into_path().map_err(err)?;
    let core = core.inner().clone();
    tokio::task::spawn_blocking(move || core.export(&id, &path))
        .await
        .map_err(err)?
        .map_err(err)?;
    Ok(true)
}
#[tauri::command]
async fn import_instance(app: tauri::AppHandle, core: App<'_>) -> Result<Option<Instance>, String> {
    let path = app
        .dialog()
        .file()
        .add_filter(ui_text(&app,"Chest archive"), &["zip"])
        .blocking_pick_file();
    let Some(path) = path else { return Ok(None) };
    let path = path.into_path().map_err(err)?;
    let core = core.inner().clone();
    Ok(Some(
        tokio::task::spawn_blocking(move || core.import(&path))
            .await
            .map_err(err)?
            .map_err(err)?,
    ))
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder=tauri::Builder::default().manage(startup::Trace::new()).manage(lifecycle::ExitPermission::default()).manage(shortcuts::Pending(std::sync::Mutex::new(shortcuts::parse(&std::env::args().collect::<Vec<_>>()))));
    // Test profiles remain isolated from the normal application and its process handoff.
    if std::env::var_os("CHEST_TEST_PROFILE").is_none() {
        builder=builder.plugin(tauri_plugin_single_instance::init(|app,args,_cwd|{
            if let Some(intent)=shortcuts::parse(&args){
                if let Some(core)=app.try_state::<Arc<Core>>(){if core.store.instance(&intent.id).is_err(){return;}}
                *app.state::<shortcuts::Pending>().0.lock().unwrap()=Some(intent);
                let _=app.emit("instance-intent",());
            }
            if let Some(window)=app.get_webview_window("main"){let _=window.show();let _=window.set_focus();}
        }));
    }
    let result = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updater::UpdaterState::default())
        .setup(|app| {
            let setup = (|| -> Result<(), Box<dyn std::error::Error>> {
            app.state::<startup::Trace>().mark("setup");
            let activity = app.handle().clone();
            let logs = app.handle().clone();
            let normal = app.path().app_data_dir()?;
            let profile = std::env::var_os("CHEST_TEST_PROFILE")
                .map(|root| chest_core::profile::TestProfile::open(std::path::Path::new(&root), &normal))
                .transpose()?;
            #[cfg(target_os = "macos")]
            if profile.is_some() {
                let version = std::process::Command::new("/usr/bin/sw_vers").arg("-productVersion").output()?;
                let major = String::from_utf8_lossy(&version.stdout).split('.').next().and_then(|v|v.trim().parse::<u32>().ok()).unwrap_or(0);
                if major < 14 {return Err("Test profiles require macOS 14 or newer for isolated WebView storage".into());}
            }
            let root = profile.as_ref().map(|p|p.root.clone()).unwrap_or(normal);
            let core = Core::new_scoped(
                root,
                profile.as_ref().map(|p|p.credential_scope()),
                move |a| {
                    let _ = activity.emit("activity", a);
                },
                move |l| {
                    let _ = logs.emit("log", l);
                },
            )?;
            app.manage(Arc::new(core));
            app.state::<startup::Trace>().mark("core-ready");
            let config = app.config().app.windows[0].clone();
            let mut window = tauri::WebviewWindowBuilder::from_config(app, &config)?.devtools(cfg!(debug_assertions));
            if let Some(monitor) = app.primary_monitor()? {
                let size = monitor.size().to_logical::<f64>(monitor.scale_factor());
                window = window.inner_size(size.width * 0.8, size.height * 0.8).center();
            }
            if let Some(profile) = profile {
                window = window.title("Chest — Test profile");
                #[cfg(target_os = "macos")]
                { window = window.data_store_identifier(*profile.id.as_bytes()); }
                #[cfg(not(target_os = "macos"))]
                { window = window.data_directory(profile.root.join("webview")); }
            }
            if app.state::<startup::Trace>().enabled() {
                window = window.initialization_script("window.__CHEST_STARTUP_TRACE__ = true;");
            }
            window.build()?;
            #[cfg(desktop)]
            menu::install(app)?;
            app.state::<startup::Trace>().mark("window-built");
            Ok(())
            })();
            if let Err(error) = setup {
                eprintln!("Chest startup failed: {error}");
                if !app.state::<startup::Trace>().enabled() {
                    app.dialog().message(format!("{error}\n\nYour existing files were left unchanged."))
                        .title("Chest could not start").blocking_show();
                }
                app.state::<lifecycle::ExitPermission>().0.store(true, Ordering::Release);
                app.handle().exit(1);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if lifecycle::request(window.app_handle(), "close") { api.prevent_close(); }
            }
        })
        .invoke_handler(tauri::generate_handler![
            lifecycle::complete_exit,
            menu::set_menu_labels,
            startup::report_startup_ready,
            updater::get_app_update_info,
            updater::check_app_update,
            updater::install_app_update,
            updater::restart_updated_app,
            shortcuts::take_instance_intent,
            shortcuts::create_instance_shortcut,
            get_worlds,
            get_world_icon,
            get_server_icon,
            get_world_info,
            get_instance_worlds,
            copy_world,
            backup_world,
            save_server_bookmark,
            remove_server_bookmark,
            add_bookmarked_server,
            get_instance_files,
            get_account_skin,
            get_servers,
            get_screenshots,
            open_instance_file,
            get_screenshot_image,
            open_shared_datapacks,
            apply_shared_datapacks,
            get_storage_usage,
            clear_image_cache,
            get_config,
            get_launch_settings,
            save_launch_settings,
            open_launcher_link,
            get_launcher_info,
            open_data_folder,
            choose_java,
            inspect_java,
            get_activities,
            get_instance_icons,
            get_debug_launch,
            set_debug_offline,
            get_instance_backgrounds,
            get_versions,
            get_news,
            get_instance_news,
            open_news,
            get_fabric_versions,
            get_quilt_versions,
            get_loader_versions,
            get_catalog_sources,
            search_catalog,
            get_catalog_releases,
            get_catalog_description,
            open_description_link,
            get_creation_releases,
            add_catalog_content,
            get_modpack_releases,
            install_modpack,
            open_project,
            create_instance,
            create_wizard,
            choose_instance_location,
            choose_creation_files,
            import_color_scheme,
            export_color_scheme,
            choose_creation_archive,
            save_instance,
            reorder_instances,
            set_sidebar_groups,
            install_instance,
            pause_install,
            launch_instance,
            launch_resource,
            rename_resource,
            stop_instance,
            get_logs,
            get_content,
            toggle_content,
            open_instance_folder,
            get_instance_folder,
            duplicate_instance,
            remove_instance,
            acknowledge,
            save_settings,
            select_account,
            sign_in,
            cancel_sign_in,
            sign_out,
            export_instance,
            import_instance
        ])
        .build(tauri::generate_context!());
    match result {
        Ok(app) => app.run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() && lifecycle::request(app, "quit") { api.prevent_exit(); }
            }
        }),
        Err(error) => { eprintln!("Chest could not start: {error}"); std::process::exit(1); }
    }
}
