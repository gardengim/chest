use crate::{App,err};
use serde::{Serialize,Deserialize};
use std::{fs,path::PathBuf,sync::Mutex};
use tauri::{Manager,State};
#[derive(Clone,Serialize,Deserialize)]
pub struct Intent {pub id:String,pub launch:bool}
#[derive(Default)]
pub struct Pending(pub Mutex<Option<Intent>>);
pub fn parse(args:&[String])->Option<Intent>{
    let position=args.iter().position(|a|a=="--instance")?;
    let id=args.get(position+1)?;
    uuid::Uuid::parse_str(id).ok()?;
    Some(Intent{id:id.clone(),launch:args.iter().any(|a|a=="--launch")})
}
#[tauri::command]
pub fn take_instance_intent(pending:State<'_,Pending>,core:App<'_>)->Option<Intent>{
    pending.0.lock().unwrap().take().filter(|intent|core.store.instance(&intent.id).is_ok())
}
#[tauri::command]
pub async fn create_instance_shortcut(app:tauri::AppHandle,core:App<'_>,id:String)->Result<String,String>{
    let instance=core.store.instance(&id).map_err(err)?;
    if core.store.is_test_profile(){return Err("Desktop shortcuts require the normal Chest profile".into());}
    if cfg!(debug_assertions){return Err("Desktop shortcuts require an installed release build".into());}
    let desktop=app.path().desktop_dir().map_err(err)?;
    fs::create_dir_all(&desktop).map_err(err)?;
    let executable=std::env::current_exe().map_err(err)?;
    let clean:String=instance.name.chars().map(|c|if c.is_control() || "<>:\"/\\|?*".contains(c){'_'}else{c}).take(60).collect();
    let name=format!("{} — {}",clean.trim().trim_end_matches('.'),&id[..8]);
    let path=create(desktop,executable,&id,&name).await?;
    Ok(path.to_string_lossy().into_owned())
}
#[cfg(target_os="macos")]
async fn create(desktop:PathBuf,executable:PathBuf,id:&str,name:&str)->Result<PathBuf,String>{
    use std::os::unix::fs::PermissionsExt;
    let path=desktop.join(format!("{name}.app"));
    fs::create_dir(&path).map_err(err)?;
    let result=(||->Result<(),String>{
        let contents=path.join("Contents");fs::create_dir(&contents).map_err(err)?;
        let bin=contents.join("MacOS");fs::create_dir(&bin).map_err(err)?;
        let quoted=executable.to_string_lossy().replace('\'',"'\\''");
        fs::write(bin.join("launch"),format!("#!/bin/sh\nexec '{quoted}' --instance '{id}' --launch\n")).map_err(err)?;
        fs::set_permissions(bin.join("launch"),fs::Permissions::from_mode(0o755)).map_err(err)?;
        fs::write(contents.join("Info.plist"),format!("<?xml version=\"1.0\"?><plist version=\"1.0\"><dict><key>CFBundleExecutable</key><string>launch</string><key>CFBundleIdentifier</key><string>app.chest.instance.{id}</string><key>CFBundleName</key><string>Chest Instance</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>")).map_err(err)?;
        // Reuse the installed launcher icon when available.
        if let Some(contents_root)=executable.parent().and_then(|p|p.parent()){
            let icon=contents_root.join("Resources/icon.icns");
            if icon.is_file(){fs::create_dir(contents.join("Resources")).map_err(err)?;fs::copy(icon,contents.join("Resources/icon.icns")).map_err(err)?;
                let plist=fs::read_to_string(contents.join("Info.plist")).map_err(err)?.replace("</dict>","<key>CFBundleIconFile</key><string>icon.icns</string></dict>");fs::write(contents.join("Info.plist"),plist).map_err(err)?;}
        }
        Ok(())
    })();
    if let Err(error)=result{let _=fs::remove_dir_all(&path);return Err(error);}
    Ok(path)
}
#[cfg(target_os="windows")]
async fn create(desktop:PathBuf,executable:PathBuf,id:&str,name:&str)->Result<PathBuf,String>{
    use std::process::Stdio;
    let path=desktop.join(format!("{name}.lnk"));
    // Reserve the destination without replacing an existing shortcut.
    let mut reserved=fs::OpenOptions::new().write(true).create_new(true).open(&path).map_err(err)?;
    let temporary=desktop.join(format!(".chest-{}.lnk",uuid::Uuid::new_v4()));
    let mut command=tokio::process::Command::new("powershell.exe");
    command.args(["-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop'; $shell=New-Object -ComObject WScript.Shell; $link=$shell.CreateShortcut($env:CHEST_SHORTCUT_PATH); $link.TargetPath=$env:CHEST_SHORTCUT_EXE; $link.Arguments=$env:CHEST_SHORTCUT_ARGS; $link.IconLocation=$env:CHEST_SHORTCUT_EXE+',0'; $link.Save()"]).env("CHEST_SHORTCUT_PATH",&temporary).env("CHEST_SHORTCUT_EXE",&executable).env("CHEST_SHORTCUT_ARGS",format!("--instance {id} --launch")).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).kill_on_drop(true).creation_flags(0x08000000);
    let result=tokio::time::timeout(std::time::Duration::from_secs(30),command.status()).await;
    let result=match result {Ok(Ok(status)) if status.success()=>{
        fs::File::open(&temporary).and_then(|mut source|std::io::copy(&mut source,&mut reserved)).map(|_|path.clone()).map_err(err)
    },_=>Err("Could not create desktop shortcut".into())};
    drop(reserved);
    let _=fs::remove_file(&temporary);
    if result.is_err(){let _=fs::remove_file(&path);}
    result
}
#[cfg(not(any(target_os="macos",target_os="windows")))]
async fn create(desktop:PathBuf,executable:PathBuf,id:&str,name:&str)->Result<PathBuf,String>{
    use std::{io::Write,os::unix::fs::PermissionsExt};
    let path=desktop.join(format!("{name}.desktop"));
    let escaped=executable.to_string_lossy().replace('\\',"\\\\").replace('"',"\\\"").replace('`',"\\`").replace('$',"\\$").replace('%',"%%");
    let text=format!("[Desktop Entry]\nType=Application\nName={}\nExec=\"{escaped}\" --instance {id} --launch\nIcon=chest\nTerminal=false\n",name.replace('\\',"\\\\"));
    let mut file=fs::OpenOptions::new().write(true).create_new(true).open(&path).map_err(err)?;
    file.write_all(text.as_bytes()).map_err(err)?;file.set_permissions(fs::Permissions::from_mode(0o755)).map_err(err)?;
    Ok(path)
}
#[cfg(test)]
mod tests{
    use super::*;
    #[cfg(target_os="macos")]
    #[tokio::test]async fn mac_shortcut_quotes_executable_and_refuses_overwrite(){
        let directory=std::env::temp_dir().join(format!("chest-shortcut-{}",uuid::Uuid::new_v4()));fs::create_dir(&directory).unwrap();
        let id=uuid::Uuid::new_v4().to_string();let exe=PathBuf::from("/Applications/Player's Chest.app/Contents/MacOS/chest");
        let path=create(directory.clone(),exe.clone(),&id,"World").await.unwrap();
        let script=fs::read_to_string(path.join("Contents/MacOS/launch")).unwrap();assert!(script.contains("Player'\\''s Chest"));assert!(script.contains(&format!("--instance '{id}' --launch")));
        assert!(create(directory.clone(),exe,&id,"World").await.is_err());fs::remove_dir_all(directory).unwrap();
    }
    #[test]fn rejects_invalid_intents(){assert!(parse(&["chest".into(),"--instance".into(),"../../file".into()]).is_none());let id=uuid::Uuid::new_v4().to_string();assert!(parse(&["chest".into(),"--instance".into(),id,"--launch".into()]).unwrap().launch);}
}
