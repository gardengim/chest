use crate::{Core, store::Config};
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, path::Path, process::Stdio};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GraphicsApi {
    #[default]
    Default,
    OpenGl,
    Vulkan,
}

pub fn supports_graphics_api(version: &str) -> bool {
    let mut parts = version.split(['.', '-']);
    let major = parts.next().and_then(|v| v.parse::<u32>().ok());
    let minor = parts.next().and_then(|v| v.parse::<u32>().ok());
    matches!((major, minor), (Some(major), Some(minor)) if major > 26 || major == 26 && minor >= 2)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct LaunchSettings {
    pub width: u32,
    pub height: u32,
    pub fullscreen: bool,
    pub graphics_api: GraphicsApi,
    pub account_id: Option<String>,
    pub java_args: Vec<String>,
    pub game_args: Vec<String>,
    pub environment: BTreeMap<String, String>,
    pub before_launch: Vec<String>,
    pub after_exit: Vec<String>,
    pub open_log: bool,
}
impl Default for LaunchSettings {
    fn default() -> Self {
        Self { width: 854, height: 480, fullscreen: false, graphics_api: GraphicsApi::Default, account_id: None,
            java_args: vec![], game_args: vec![], environment: BTreeMap::new(),
            before_launch: vec![], after_exit: vec![], open_log: false }
    }
}
impl LaunchSettings {
    pub fn graphics_arguments(&self, version: &str) -> Result<Vec<String>> {
        if self.graphics_api == GraphicsApi::Default { return Ok(vec![]); }
        if !supports_graphics_api(version) {
            bail!("Graphics API selection requires Minecraft 26.2 or later. Choose Default in instance Settings.");
        }
        Ok(vec!["--graphicsBackend".into(), match self.graphics_api {
            GraphicsApi::OpenGl => "opengl",
            GraphicsApi::Vulkan => "vulkan",
            GraphicsApi::Default => unreachable!(),
        }.into()])
    }
    pub fn validate(&self, config: &Config) -> Result<()> {
        if !(320..=16384).contains(&self.width) || !(240..=16384).contains(&self.height) { bail!("Window size must be between 320 × 240 and 16384 × 16384"); }
        if let Some(id) = &self.account_id {
            if !config.accounts.iter().any(|a| &a.id == id) { bail!("Selected account is no longer signed in"); }
        }
        for values in [&self.java_args, &self.game_args, &self.before_launch, &self.after_exit] {
            if values.len() > 128 || values.iter().any(|v| v.len() > 8192 || v.contains('\0')) { bail!("Too many or invalid command arguments"); }
        }
        if self.environment.len() > 128 || self.environment.iter().any(|(key,value)| key.is_empty() || key.len()>128 || !key.chars().all(|c| c.is_ascii_alphanumeric() || c=='_') || key.starts_with(|c:char| c.is_ascii_digit()) || value.len()>8192 || value.contains('\0')) { bail!("Invalid environment variable"); }
        if self.game_args.iter().any(|v| v == "--graphicsBackend" || v.starts_with("--graphicsBackend=")) {
            bail!("Graphics API is managed in instance Settings");
        }
        // Keep Chest's credential arguments under launcher control.
        if self.game_args.iter().any(|v| ["--accessToken", "--uuid", "--username", "--clientId", "--xuid"].iter().any(|key| v==key || v.starts_with(&format!("{key}=")))) { bail!("Account arguments are managed by Chest"); }
        Ok(())
    }
}
impl Core {
    pub fn launch_settings(&self, id: &str) -> Result<LaunchSettings> {
        self.store.instance(id)?;
        Ok(self.store.config().launch_settings.get(id).cloned().unwrap_or_default())
    }
    pub fn save_launch_settings(&self, id: &str, settings: LaunchSettings) -> Result<()> {
        let _operation = self.operation_lock.lock().unwrap();
        let instance = self.store.instance(id)?;
        settings.graphics_arguments(&instance.version)?;
        if self.busy(id) { bail!("Close this instance before changing launch settings"); }
        settings.validate(&self.store.config())?;
        self.store.change(|c| { c.launch_settings.insert(id.into(), settings); Ok(()) })?;
        Ok(())
    }
}
pub(crate) async fn hook(arguments: &[String], game: &Path, environment: &BTreeMap<String,String>) -> Result<()> {
    let Some(program) = arguments.first() else { return Ok(()) };
    let mut command = tokio::process::Command::new(program);
    command.args(&arguments[1..]).current_dir(game).envs(environment).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    let status = tokio::time::timeout(std::time::Duration::from_secs(30), command.status()).await.context("Custom command timed out after 30 seconds")?.context("Could not run custom command")?;
    if !status.success() { bail!("Custom command failed ({status})"); }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn combined_instance_settings_save_is_atomic_and_preserves_installation() {
        let directory = tempfile::tempdir().unwrap();
        let core = Core::new(directory.path().into(), |_|{}, |_|{}).unwrap();
        let mut instance = core.store.create("Original".into(), "26.3".into(), "grass".into()).unwrap();
        core.store.installed(&instance.id).unwrap();
        instance.name = "Updated".into();
        let settings = LaunchSettings { width: 1280, ..Default::default() };
        core.save_instance_settings(instance.clone(), Some(settings)).unwrap();
        assert!(core.store.instance(&instance.id).unwrap().installed);
        instance.name = "Must not persist".into();
        let invalid = LaunchSettings { width: 0, ..Default::default() };
        assert!(core.save_instance_settings(instance.clone(), Some(invalid)).is_err());
        assert_eq!(core.store.instance(&instance.id).unwrap().name, "Updated");
        assert_eq!(core.launch_settings(&instance.id).unwrap().width, 1280);
        let reopened = Core::new(directory.path().into(), |_|{}, |_|{}).unwrap();
        assert_eq!(reopened.store.instance(&instance.id).unwrap().name, "Updated");
        assert_eq!(reopened.launch_settings(&instance.id).unwrap().width, 1280);
    }
    #[test]
    fn defaults_and_validation() {
        let config=Config::default();
        let mut options:LaunchSettings=serde_json::from_str("{}").unwrap();
        options.validate(&config).unwrap();
        assert_eq!(options.graphics_api, GraphicsApi::Default);
        options.width=0;assert!(options.validate(&config).is_err());options.width=854;
        options.account_id=Some("removed".into());assert!(options.validate(&config).is_err());options.account_id=None;
        options.environment.insert("BAD=KEY".into(), "value".into());assert!(options.validate(&config).is_err());options.environment.clear();
        options.game_args.push("--accessToken=secret".into());assert!(options.validate(&config).is_err());
    }
    #[test]
    fn graphics_api_arguments_and_version_gates() {
        for version in ["1.21.4", "26.1.2", "pending", "25w10a"] {
            assert!(LaunchSettings::default().graphics_arguments(version).unwrap().is_empty());
            let options = LaunchSettings { graphics_api: GraphicsApi::Vulkan, ..Default::default() };
            assert!(options.graphics_arguments(version).is_err());
        }
        for version in ["26.2", "26.2-snapshot-1", "26.3", "27.1"] {
            for (api, value) in [(GraphicsApi::OpenGl, "opengl"), (GraphicsApi::Vulkan, "vulkan")] {
                let options = LaunchSettings { graphics_api: api, ..Default::default() };
                assert_eq!(options.graphics_arguments(version).unwrap(), ["--graphicsBackend", value]);
            }
        }
        let mut options = LaunchSettings::default();
        options.game_args.push("--graphicsBackend=vulkan".into());
        assert!(options.validate(&Config::default()).is_err());
        assert!(serde_json::from_str::<LaunchSettings>(r#"{"graphics_api":"unknown"}"#).is_err());
        let directory = tempfile::tempdir().unwrap();
        let core = Core::new(directory.path().into(), |_|{}, |_|{}).unwrap();
        let instance = core.store.create("Old".into(), "1.21.4".into(), "grass".into()).unwrap();
        assert!(core.save_launch_settings(&instance.id, LaunchSettings { graphics_api: GraphicsApi::Vulkan, ..Default::default() }).is_err());
        assert_eq!(core.launch_settings(&instance.id).unwrap().graphics_api, GraphicsApi::Default);
    }
    #[cfg(unix)]
    #[tokio::test]
    async fn launches_with_separate_arguments_environment_window_and_hooks() {
        use std::{fs,os::unix::fs::PermissionsExt,sync::Arc};
        let directory=tempfile::tempdir().unwrap();let core=Arc::new(Core::new(directory.path().into(), |_|{}, |_|{}).unwrap());
        core.set_debug_offline(true).unwrap();
        let mut instance=core.store.create("World".into(),"26.2".into(),"grass".into()).unwrap();
        let java=directory.path().join("java with spaces");
        fs::write(&java,r#"#!/bin/sh
if [ "$1" = '-version' ]; then echo 'openjdk version "25.0.1"' >&2; exit 0; fi
[ -f before-marker ] || exit 1
printf '%s\n' "$@" > received-arguments
printf '%s' "$CHEST_EXAMPLE" > received-environment
"#).unwrap();
        fs::set_permissions(&java,fs::Permissions::from_mode(0o755)).unwrap();
        instance.java_path=java.to_string_lossy().into_owned();core.store.save(instance.clone()).unwrap();
        let version=crate::metadata::version_dir(&core.store.root,"26.2").unwrap();fs::create_dir_all(&version).unwrap();
        fs::write(version.join("26.2.jar"),[]).unwrap();
        fs::write(version.join("26.2.json"),serde_json::to_vec(&serde_json::json!({"id":"26.2","mainClass":"TestMain","javaVersion":{"majorVersion":25},"libraries":[],"assetIndex":{"id":"test"},"arguments":{"jvm":["-cp","${classpath}"],"game":["--username","${auth_player_name}"]}})).unwrap()).unwrap();
        core.save_launch_settings(&instance.id,LaunchSettings{width:1280,height:720,fullscreen:true,graphics_api:GraphicsApi::Vulkan,java_args:vec!["-Dexample=with spaces".into()],game_args:vec!["argument with spaces".into()],environment:BTreeMap::from([("CHEST_EXAMPLE".into(),"one=two with spaces".into())]),before_launch:vec!["/bin/sh".into(),"-c".into(),"printf before > before-marker".into()],after_exit:vec!["/bin/sh".into(),"-c".into(),"printf after > after-marker".into()],..Default::default()}).unwrap();
        let job=core.reserve(&instance.id,"game").unwrap();
        crate::run_game(core.clone(),instance.id.clone(),job,None).await.unwrap();
        let game=core.instance_folder(&instance.id).unwrap();let text=fs::read_to_string(game.join("received-arguments")).unwrap();let args:Vec<_>=text.lines().collect();
        assert!(args.iter().position(|a|*a=="-Dexample=with spaces").unwrap()<args.iter().position(|a|*a=="TestMain").unwrap());
        assert!(args.windows(4).any(|a|a==["--width","1280","--height","720"]));assert!(args.contains(&"--fullscreen"));assert!(args.contains(&"argument with spaces"));
        assert!(args.windows(2).any(|a|a==["--graphicsBackend","vulkan"]));
        assert_eq!(fs::read_to_string(game.join("received-environment")).unwrap(),"one=two with spaces");assert!(game.join("after-marker").is_file());
    }
    #[test]
    fn settings_persist_duplicate_and_stay_out_of_archives() {
        let d=tempfile::tempdir().unwrap();let core=Core::new(d.path().into(), |_|{}, |_|{}).unwrap();
        let instance=core.store.create("World".into(),"26.2".into(),"grass".into()).unwrap();
        let options=LaunchSettings{width:1280,graphics_api:GraphicsApi::Vulkan,before_launch:vec!["local-command".into()],..Default::default()};
        core.save_launch_settings(&instance.id,options).unwrap();
        let copy=core.duplicate(&instance.id).unwrap();assert_eq!(core.launch_settings(&copy.id).unwrap().width,1280);
        assert_eq!(core.launch_settings(&copy.id).unwrap().graphics_api,GraphicsApi::Vulkan);
        let archive=d.path().join("instance.zip");core.export(&instance.id,&archive).unwrap();
        let imported=core.import(&archive).unwrap();assert!(core.launch_settings(&imported.id).unwrap().before_launch.is_empty());
        assert_eq!(core.launch_settings(&imported.id).unwrap().graphics_api,GraphicsApi::Default);
        drop(core);
        let core=Core::new(d.path().into(), |_|{}, |_|{}).unwrap();assert_eq!(core.launch_settings(&instance.id).unwrap().before_launch,["local-command"]);
        core.remove(&instance.id).unwrap();assert!(!core.store.config().launch_settings.contains_key(&instance.id));
    }
    #[tokio::test]
    async fn hook_reports_failure() {
        let d=tempfile::tempdir().unwrap();
        assert!(hook(&[d.path().join("missing-command").to_string_lossy().into_owned()],d.path(),&BTreeMap::new()).await.is_err());
    }
}
