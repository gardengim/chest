//! Native menus share one action path across desktop platforms. Inspector and
//! reload actions are compiled only into development builds.
use tauri::{menu::{Menu, MenuBuilder, MenuItem, SubmenuBuilder}, App, AppHandle, Emitter, Manager, Wry};
use std::{collections::HashMap,sync::Mutex};

struct Zoom(Mutex<f64>);
struct Labels(Mutex<HashMap<String,String>>);

pub fn label(app:&AppHandle,key:&str)->String {
    app.try_state::<Labels>().and_then(|labels|labels.0.lock().ok()?.get(key).cloned()).unwrap_or_else(||key.to_string())
}

fn item(app: &AppHandle, id: &str, label: &str, shortcut: Option<&str>) -> tauri::Result<MenuItem<Wry>> {
    MenuItem::with_id(app, id, label, true, shortcut)
}

fn build(app: &AppHandle, labels: &HashMap<String,String>) -> tauri::Result<Menu<Wry>> {
    let tr = |key: &str| labels.get(key).cloned().unwrap_or_else(||key.to_string());
    let settings = item(app, "settings", &tr("Settings…"), Some("CmdOrCtrl+Comma"))?;
    let updates = item(app, "updates", &tr("Check for updates…"), None)?;
    let about = item(app, "about", &tr("About Chest"), None)?;
    let quit = item(app, "quit", &tr("Quit Chest"), Some("CmdOrCtrl+Q"))?;
    let menu = MenuBuilder::new(app);
    #[cfg(target_os = "macos")]
    let menu = menu.item(&SubmenuBuilder::new(app, "Chest")
        .item(&about).item(&updates).separator().item(&settings).separator()
        .services_with_text(tr("Services")).separator().hide_with_text(tr("Hide Chest")).hide_others_with_text(tr("Hide others")).show_all_with_text(tr("Show all")).separator().item(&quit).build()?);

    let file = SubmenuBuilder::new(app, tr("File"))
        .item(&item(app, "create", &tr("New instance…"), Some("CmdOrCtrl+N"))?);
    #[cfg(not(target_os = "macos"))]
    let file = file.separator().item(&settings).separator().item(&quit);
    let edit = SubmenuBuilder::new(app, tr("Edit"));
    #[cfg(target_os = "macos")]
    let edit = edit.undo_with_text(tr("Undo")).redo_with_text(tr("Redo"));
    // Native Undo/Redo menu items are unsupported on Windows and Linux.
    #[cfg(not(target_os = "macos"))]
    let edit = edit.item(&item(app, "undo", &tr("Undo"), Some("CmdOrCtrl+Z"))?)
        .item(&item(app, "redo", &tr("Redo"), Some("CmdOrCtrl+Shift+Z"))?);
    let edit = edit.separator().cut_with_text(tr("Cut")).copy_with_text(tr("Copy")).paste_with_text(tr("Paste")).select_all_with_text(tr("Select all")).build()?;
    let mut view = SubmenuBuilder::new(app, tr("View"))
        .item(&item(app, "home", &tr("Home"), Some("CmdOrCtrl+Shift+H"))?);
    for (id, label) in [("instances", "Instances"), ("servers", "Servers"), ("worlds", "Worlds"),
        ("news", "News"), ("screenshots", "Screenshots"), ("explore", "Explore")] {
        view = view.item(&item(app, id, &tr(label), None)?);
    }
    let fullscreen = if cfg!(target_os = "macos") { "Ctrl+Super+F" } else { "F11" };
    let view = view.separator()
        .item(&item(app, "zoom-in", &tr("Zoom in"), Some("CmdOrCtrl+Equal"))?)
        .item(&item(app, "zoom-out", &tr("Zoom out"), Some("CmdOrCtrl+Minus"))?)
        .item(&item(app, "zoom-reset", &tr("Actual size"), Some("CmdOrCtrl+Digit0"))?)
        .separator().item(&item(app, "fullscreen", &tr("Toggle full screen"), Some(fullscreen))?).build()?;
    let window = SubmenuBuilder::new(app, tr("Window"))
        .item(&item(app, "minimize", &tr("Minimize"), Some("CmdOrCtrl+M"))?)
        .item(&item(app, "maximize", &tr("Maximize / Restore"), None)?)
        .separator().item(&item(app, "close", &tr("Close window"), Some("CmdOrCtrl+W"))?);
    #[cfg(target_os = "macos")]
    let window = window.separator().bring_all_to_front_with_text(tr("Bring all to front"));
    let help = SubmenuBuilder::new(app, tr("Help")).item(&item(app, "issues", &tr("Report an issue…"), None)?);
    #[cfg(not(target_os = "macos"))]
    let help = help.separator().item(&updates).item(&about);
    let menu = menu.item(&file.build()?).item(&edit).item(&view).item(&window.build()?);
    #[cfg(debug_assertions)]
    let menu = {
        let inspector = if cfg!(target_os = "macos") { "Super+Alt+I" } else { "Ctrl+Shift+I" };
        menu.item(&SubmenuBuilder::new(app, tr("Developer"))
            .item(&item(app, "inspector", &tr("Toggle Web Inspector"), Some(inspector))?)
            .item(&item(app, "reload-ui", &tr("Reload UI"), Some("CmdOrCtrl+R"))?)
            .separator().item(&item(app, "data-folder", &tr("Open data folder"), None)?).build()?)
    };
    menu.item(&help.build()?).build()
}

fn handle(app: &AppHandle, id: &str) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window("main") else { return Ok(()); };
    match id {
        "create" | "settings" | "about" | "updates" | "issues" | "home" | "instances" |
        "servers" | "worlds" | "news" | "screenshots" | "explore" => window.emit("desktop-menu", id)?,
        "quit" | "close" => { crate::lifecycle::request(app, id); },
        "minimize" => window.minimize()?,
        "maximize" => { if window.is_maximized()? { window.unmaximize()?; } else { window.maximize()?; } }
        "fullscreen" => window.set_fullscreen(!window.is_fullscreen()?)?,
        "zoom-in" | "zoom-out" | "zoom-reset" => {
            let zoom = app.state::<Zoom>();
            let mut current = zoom.0.lock().unwrap_or_else(|e| e.into_inner());
            let next = match id { "zoom-in" => *current + 0.1, "zoom-out" => *current - 0.1, _ => 1.0_f64 }.clamp(0.5, 2.0);
            window.set_zoom(next)?;
            *current = next;
        }
        #[cfg(not(target_os = "macos"))]
        "undo" => window.eval("document.execCommand('undo')")?,
        #[cfg(not(target_os = "macos"))]
        "redo" => window.eval("document.execCommand('redo')")?,
        #[cfg(debug_assertions)]
        "inspector" => { if window.is_devtools_open() { window.close_devtools(); } else { window.open_devtools(); } }
        #[cfg(debug_assertions)]
        "reload-ui" => window.reload()?,
        #[cfg(debug_assertions)]
        "data-folder" => window.emit("desktop-menu", id)?,
        _ => {}
    }
    Ok(())
}

pub fn install(app: &mut App) -> tauri::Result<()> {
    app.manage(Zoom(Mutex::new(1.0)));
    app.manage(Labels(Mutex::new(HashMap::new())));
    app.set_menu(build(app.handle(), &HashMap::new())?)?;
    app.on_menu_event(|app, event| {
        if let Err(error) = handle(app, event.id().as_ref()) {
            let _ = app.emit_to("main", "desktop-menu-error", error.to_string());
        }
    });
    Ok(())
}

#[tauri::command]
pub fn set_menu_labels(app:AppHandle,labels:HashMap<String,String>)->Result<(),String>{
    if labels.len()>100 || labels.values().any(|text|text.len()>1024){return Err("Invalid menu labels".into());}
    app.set_menu(build(&app,&labels).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    *app.state::<Labels>().0.lock().map_err(|e|e.to_string())?=labels;
    Ok(())
}
