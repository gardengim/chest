pub mod artwork;
pub mod backgrounds;
mod account_skins;
mod resource_launch;
mod resource_edit;
mod archive;
pub mod instance_files;
mod screenshot_images;
mod instance_icons;
pub mod storage;
mod log_buffer;
pub mod worlds;
pub mod server_bookmarks;
pub mod launch_settings;
pub mod creation;
pub mod auth;
pub mod catalog;
pub mod catalog_description;
pub mod fabric;
pub mod forge;
pub mod loaders;
pub mod install;
mod download_temp;
pub mod metadata;
pub mod news;
pub mod modpack;
pub mod store;
pub mod profile;
use anyhow::{bail, Context, Result};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap},
    fs,
    path::PathBuf,
    process::Stdio,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use store::{Config, Instance, Store};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    sync::Semaphore,
};

pub(crate) fn artwork_format(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(("png", "image/png"))
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some(("jpg", "image/jpeg"))
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(("webp", "image/webp"))
    } else {
        None
    }
}

#[derive(Clone, Serialize)]
pub struct Activity {
    pub id: String,
    pub status: String,
    pub progress: Option<f64>,
    pub phase: String,
}
impl Activity {
    pub fn new(id: &str, status: &str, progress: Option<f64>, phase: &str) -> Self {
        Self {
            id: id.into(),
            status: status.into(),
            progress,
            phase: phase.into(),
        }
    }
}
#[derive(Clone, Serialize)]
pub struct Log {
    pub id: String,
    pub line: String,
}
pub struct Job {
    pub paused: AtomicBool,
    pub cancel: AtomicBool,
    pub kind: &'static str,
    pub started: AtomicBool,
}
#[derive(Serialize)]
pub struct DebugLaunch {
    pub available: bool,
    pub enabled: bool,
    pub account: Option<store::Account>,
}
pub struct Core {
    debug_offline: AtomicBool,
    pub store: Store,
    pub client: reqwest::Client,
    pub download_lock: Semaphore,
    jobs: Mutex<HashMap<String, Arc<Job>>>,
    activities: Mutex<HashMap<String, Activity>>,
    operation_lock: Mutex<()>,
    maintenance: AtomicBool,
    logs: Mutex<log_buffer::LogBuffer>,
    image_cache_lock: Mutex<()>,
    emit_activity: Arc<dyn Fn(Activity) + Send + Sync>,
    emit_log: Arc<dyn Fn(Log) + Send + Sync>,
    pub auth_cancel: Mutex<Option<Arc<AtomicBool>>>,
    pub auth_lock: Semaphore,
}
struct FileOperation<'a> { core: &'a Core, id: String, previous: Option<Activity> }
const DELETE_ERROR: &str = "Deletion failed. Some files may have been removed. Retry deletion.";
impl Drop for FileOperation<'_> {
    fn drop(&mut self) {
        if let Ok(instance) = self.core.store.instance(&self.id) {
            if let Some(previous) = self.previous.take() {
                self.core.activity(previous);
            } else {
                self.core.activities.lock().unwrap().remove(&self.id);
                (self.core.emit_activity)(Activity::new(&self.id,"idle",None,
                    if instance.installed {"Ready to play"} else {"Not installed"}));
            }
        } else {
            self.core.activities.lock().unwrap().remove(&self.id);
            (self.core.emit_activity)(Activity::new(&self.id,"idle",None,""));
        }
        // Keep the reservation until the final status is sent, so a new job
        // cannot have its starting status overwritten by this operation.
        self.core.jobs.lock().unwrap().remove(&self.id);
    }
}
pub struct MaintenanceGuard<'a>(&'a Core);
impl Drop for MaintenanceGuard<'_> {
    fn drop(&mut self){self.0.maintenance.store(false,Ordering::Release);}
}
impl Core {
    pub fn new(
        root: PathBuf,
        activity: impl Fn(Activity) + Send + Sync + 'static,
        log: impl Fn(Log) + Send + Sync + 'static,
    ) -> Result<Self> {
        Self::new_scoped(root, None, activity, log)
    }
    pub fn new_scoped(
        root: PathBuf,
        credential_scope: Option<String>,
        activity: impl Fn(Activity) + Send + Sync + 'static,
        log: impl Fn(Log) + Send + Sync + 'static,
    ) -> Result<Self> {
        Ok(Self {
            debug_offline: AtomicBool::new(cfg!(debug_assertions)
                && std::env::var("CHEST_DEBUG_OFFLINE").as_deref() == Ok("1")),
            store: Store::new_scoped(root, credential_scope)?,
            client: reqwest::Client::builder()
                .user_agent(concat!("Chest/",env!("CARGO_PKG_VERSION")))
                .connect_timeout(std::time::Duration::from_secs(15))
                .timeout(std::time::Duration::from_secs(300))
                .build()?,
            download_lock: Semaphore::new(1),
            jobs: Mutex::new(HashMap::new()),
            activities: Mutex::new(HashMap::new()),
            operation_lock: Mutex::new(()),
            maintenance: AtomicBool::new(false),
            logs: Mutex::new(log_buffer::LogBuffer::default()),
            image_cache_lock: Mutex::new(()),
            emit_activity: Arc::new(activity),
            emit_log: Arc::new(log),
            auth_cancel: Mutex::new(None),
            auth_lock: Semaphore::new(1),
        })
    }
    pub fn debug_launch(&self) -> DebugLaunch {
        let enabled = cfg!(debug_assertions) && self.debug_offline.load(Ordering::Relaxed);
        DebugLaunch {
            available: cfg!(debug_assertions),
            enabled,
            account: enabled.then(|| auth::debug_session().account),
        }
    }
    pub fn set_debug_offline(&self, enabled: bool) -> Result<DebugLaunch> {
        if !cfg!(debug_assertions) {
            bail!("Offline debugging is only available in development builds");
        }
        self.debug_offline.store(enabled, Ordering::Relaxed);
        Ok(self.debug_launch())
    }
    #[cfg(test)]
    async fn launch_session(&self) -> Result<auth::Session> {
        self.launch_session_for(None).await
    }
    async fn launch_session_for(&self, account: Option<&str>) -> Result<auth::Session> {
        if self.debug_launch().enabled {
            return Ok(auth::debug_session());
        }
        let _auth = self.auth_lock.acquire().await?;
        auth::refresh_for(&self.store, &self.client, account).await
    }
    pub fn activity(&self, a: Activity) {
        self.activities
            .lock()
            .unwrap()
            .insert(a.id.clone(), a.clone());
        (self.emit_activity)(a);
    }
    pub fn activities(&self) -> Vec<Activity> {
        self.activities.lock().unwrap().values().cloned().collect()
    }

    pub fn log(&self, id: &str, line: &str) {
        let line = line.chars().take(8192).collect::<String>();
        let mut logs = self.logs.lock().unwrap();
        logs.push(id, line.clone());
        drop(logs);
        (self.emit_log)(Log {
            id: id.into(),
            line,
        });
    }
    pub fn logs(&self, id: &str) -> Vec<String> {
        self.logs.lock().unwrap().get(id)
    }
    pub fn busy(&self, id: &str) -> bool {
        self.jobs.lock().unwrap().contains_key(id)
    }
    pub fn begin_maintenance(&self) -> Result<MaintenanceGuard<'_>> {
        let _operation=self.operation_lock.lock().unwrap();
        if self.maintenance.load(Ordering::Acquire) || !self.jobs.lock().unwrap().is_empty(){
            bail!("Stop running instances and finish installations before updating Chest.");
        }
        self.maintenance.store(true,Ordering::Release);
        Ok(MaintenanceGuard(self))
    }
    fn reserve(&self, id: &str, kind: &'static str) -> Result<Arc<Job>> {
        let _operation = self.operation_lock.lock().unwrap();
        if self.maintenance.load(Ordering::Acquire){bail!("Chest is updating; try again after restart.");}
        self.store.instance(id)?;
        let mut jobs = self.jobs.lock().unwrap();
        if jobs.contains_key(id) {
            bail!("This instance already has an active operation");
        }
        let job = Arc::new(Job {
            paused: AtomicBool::new(false),
            cancel: AtomicBool::new(false),
            kind,
            started: AtomicBool::new(false),
        });
        jobs.insert(id.into(), job.clone());
        Ok(job)
    }
    pub fn start_install(self: &Arc<Self>, id: String) -> Result<()> {
        let runtime = tokio::runtime::Handle::try_current()
            .context("Start installation from an async runtime")?;
        let job = self.reserve(&id, "install")?;
        self.activity(Activity::new(
            &id,
            "installing",
            None,
            "Waiting for installer",
        ));
        let core = self.clone();
        runtime.spawn(async move {
            let result = async {
                modpack::prepare(&core, &id, &job).await?;
                creation::prepare_content(&core, &id, &job).await?;
                install::install(core.clone(), id.clone(), job).await
            }
            .await;
            let _operation = core.operation_lock.lock().unwrap();
            core.jobs.lock().unwrap().remove(&id);
            match result {
                Ok(()) => core.activity(Activity::new(&id, "idle", None, "Ready to play")),
                Err(e) => {
                    let message = format!("{e:#}");
                    core.log(&id, &message);
                    core.activity(Activity::new(&id, "failed", None, &message));
                }
            }
        });
        Ok(())
    }
    pub async fn install_content(
        self: &Arc<Self>,
        id: String,
        source: catalog::Source,
        project: String,
        version: String,
        kind: catalog::Kind,
    ) -> Result<Vec<String>> {
        let _job = self.reserve(&id, "content")?;
        let result = async {
            let _download = self.download_lock.acquire().await?;
            catalog::install(self, &id, source, &project, &version, kind).await
        }
        .await;
        self.jobs.lock().unwrap().remove(&id);
        result
    }
    pub fn pause(&self, id: &str, paused: bool) -> Result<()> {
        let job = self
            .jobs
            .lock()
            .unwrap()
            .get(id)
            .cloned()
            .context("No installation is running")?;
        if job.kind != "install" {
            bail!("Only installations can be paused");
        }
        job.paused.store(paused, Ordering::Relaxed);
        if paused {
            let progress = self
                .activities
                .lock()
                .unwrap()
                .get(id)
                .and_then(|a| a.progress);
            self.activity(Activity::new(
                id,
                "pausing",
                progress,
                "Pausing after current downloads",
            ));
        }
        Ok(())
    }
    pub fn launch(self: &Arc<Self>, id: String) -> Result<()> {self.launch_target(id,None)}
    pub(crate) fn launch_target(self:&Arc<Self>,id:String,target:Option<resource_launch::ResourceTarget>)->Result<()>{
        if !self.store.instance(&id)?.installed {
            bail!("Install this instance first");
        }
        let runtime = tokio::runtime::Handle::try_current()
            .context("Launch Minecraft from an async runtime")?;
        let job = self.reserve(&id, "game")?;
        self.activity(Activity::new(&id, "starting", None, "Preparing Minecraft"));
        let core = self.clone();
        runtime.spawn(async move {
            let result = run_game(core.clone(), id.clone(), job.clone(),target).await;
            let _operation = core.operation_lock.lock().unwrap();
            core.jobs.lock().unwrap().remove(&id);
            match result {
                Ok(()) => core.activity(Activity::new(&id, "idle", None, "Minecraft closed")),
                Err(e) => {
                    let message = format!("{e:#}");
                    core.log(&id, &message);
                    core.activity(Activity::new(
                        &id,
                        if job.cancel.load(Ordering::Relaxed) {
                            "idle"
                        } else if job.started.load(Ordering::Relaxed) {
                            "crashed"
                        } else {
                            "launch_failed"
                        },
                        None,
                        &message,
                    ));
                }
            }
        });
        Ok(())
    }
    pub fn stop(&self, id: &str) -> Result<()> {
        let job = self
            .jobs
            .lock()
            .unwrap()
            .get(id)
            .cloned()
            .context("Minecraft is not running")?;
        if job.kind != "game" {
            bail!("This instance is installing");
        }
        job.cancel.store(true, Ordering::Relaxed);
        self.activity(Activity::new(id, "stopping", None, "Stopping Minecraft"));
        Ok(())
    }
    pub fn acknowledge(&self, id: &str) -> Result<()> {
        self.store.instance(id)?;
        if self.busy(id) {
            bail!("Instance is busy");
        }
        self.activity(Activity::new(id, "idle", None, ""));
        Ok(())
    }
    pub fn save_instance(&self, instance: Instance) -> Result<Config> {
        self.save_instance_settings(instance, None)
    }
    pub fn save_instance_settings(&self, instance: Instance, settings: Option<launch_settings::LaunchSettings>) -> Result<Config> {
        let _operation = self.operation_lock.lock().unwrap();
        if self.busy(&instance.id) {
            bail!("Wait for this instance to finish before editing");
        }
        if self
            .store
            .dir(&instance.id)?
            .join("modpack-request.json")
            .exists()
        {
            let old = self.store.instance(&instance.id)?;
            if old.version != instance.version
                || old.loader != instance.loader
                || old.loader_version != instance.loader_version
            {
                bail!("Versions are determined by the queued modpack");
            }
        }
        self.store.save_with_launch(instance, settings)
    }
    pub async fn versions(&self) -> Result<Vec<metadata::Version>> {
        let cache = self.store.root.join("manifest.json");
        let fetch = async {
            let response = self
                .client
                .get(metadata::MANIFEST)
                .send()
                .await?
                .error_for_status()?;
            let data = response.bytes().await?;
            let manifest: metadata::Manifest = serde_json::from_slice(&data)?;
            fs::write(&cache, &data)?;
            Ok::<_, anyhow::Error>(manifest)
        }
        .await;
        let manifest = match fetch {
            Ok(m) => m,
            Err(e) => {
                if cache.exists() {
                    serde_json::from_slice(&fs::read(cache)?)?
                } else {
                    return Err(e);
                }
            }
        };
        Ok(manifest
            .versions
            .into_iter()
            .filter(|v| v.kind == "release" && metadata::supported_release(&v.id))
            .collect())
    }
    pub fn content(&self, id: &str) -> Result<Vec<Content>> {
        let game = self.store.dir(id)?.join("game");
        let mut content = vec![];
        for kind in ["mods", "resourcepacks", "shaderpacks"] {
            let dir = game.join(kind);
            if !dir.exists() {
                continue;
            }
            for item in fs::read_dir(dir)? {
                let item = item?;
                if !item.file_type()?.is_file() {
                    continue;
                }
                let name = item.file_name().to_string_lossy().to_string();
                let enabled = !name.ends_with(".disabled");
                content.push(Content {
                    name,
                    kind: kind.into(),
                    enabled,
                });
            }
        }
        content.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(content)
    }
    pub fn toggle_content(&self, id: &str, kind: &str, name: &str) -> Result<()> {
        let _operation = self.operation_lock.lock().unwrap();
        if self.busy(id) {
            bail!("Close Minecraft before changing content");
        }
        if kind != "mods" {
            bail!("Enable resource packs inside Minecraft");
        }
        if name.contains('/') || name.contains('\\') {
            bail!("Invalid file name");
        }
        let root = self.store.dir(id)?.join("game/mods");
        let source = store::safe_join(&root, name)?;
        let next = if let Some(s) = name.strip_suffix(".disabled") {
            s.into()
        } else {
            format!("{name}.disabled")
        };
        let target = store::safe_join(&root, &next)?;
        if target.exists() {
            bail!("A file with the target name already exists");
        }
        fs::rename(source, target)?;
        Ok(())
    }
    fn file_operation(&self, id: &str, phase: &str) -> Result<FileOperation<'_>> {
        self.reserve(id, "files")?;
        let previous = self.activities.lock().unwrap().get(id).cloned()
            .filter(|activity| matches!(activity.status.as_str(),"idle"|"failed"|"launch_failed"|"crashed"));
        let operation = FileOperation { core: self, id: id.into(), previous };
        self.activity(Activity::new(id,"working",None,phase));
        Ok(operation)
    }
    pub fn file_operations_active(&self) -> bool {
        self.jobs.lock().unwrap().values().any(|job| job.kind == "files")
    }
    pub fn duplicate(&self, id: &str) -> Result<Instance> {
        let _operation = self.file_operation(id,"Copying…")?;
        if self.store.dir(id)?.join("modpack-request.json").exists() || self.store.dir(id)?.join("creation-content.json").exists() {
            bail!("Finish preparing this modpack before duplicating it");
        }
        let old = self.store.instance(id)?;
        let mut new = old.clone();
        new.id = uuid::Uuid::new_v4().to_string();
        new.name = format!("{} copy", old.name);
        new.storage_parent.clear();
        new.playtime_seconds = 0;
        new.installed = false;
        store::validate(&new)?;
        let destination = self.store.dir(&new.id)?;
        let result = (|| -> Result<()> {
            copy_tree(&self.store.dir(id)?.join("game"), &destination.join("game"))?;
            self.store.change(|config| {
                if let Some(settings) = config.launch_settings.get(id).cloned() {
                    config.launch_settings.insert(new.id.clone(), settings);
                }
                config.instances.push(new.clone());
                Ok(())
            })?;
            Ok(())
        })();
        if let Err(error) = result { let _ = fs::remove_dir_all(destination); return Err(error); }
        Ok(new)
    }
    pub fn remove(&self, id: &str) -> Result<Config> {
        let _operation = self.file_operation(id,"Deleting…")?;
        let config = self.store.remove(id).map_err(|error| {
            self.log(id,&format!("Deletion failed: {error:#}"));
            error.context(DELETE_ERROR)
        })?;
        self.activities.lock().unwrap().remove(id);
        self.logs.lock().unwrap().remove(id);
        Ok(config)
    }
    pub fn instance_folder(&self, id: &str) -> Result<PathBuf> {
        self.store.instance(id)?;
        Ok(self.store.dir(id)?.join("game"))
    }
    pub fn open_data_folder(&self) -> Result<()> {
        open::that(&self.store.root)?;
        Ok(())
    }
    pub fn open_folder(&self, id: &str) -> Result<()> {
        let folder = self.instance_folder(id)?;
        fs::create_dir_all(&folder)?;
        open::that(folder)?;
        Ok(())
    }
}
#[derive(Serialize)]
pub struct Content {
    pub name: String,
    pub kind: String,
    pub enabled: bool,
}
fn copy_tree(from: &std::path::Path, to: &std::path::Path) -> Result<()> {
    fs::create_dir_all(to)?;
    for item in fs::read_dir(from)? {
        let item = item?;
        let kind = item.file_type()?;
        let target = to.join(item.file_name());
        if kind.is_dir() {
            copy_tree(&item.path(), &target)?;
        } else if kind.is_file() {
            fs::copy(item.path(), target)?;
        }
    }
    Ok(())
}
async fn run_game(core: Arc<Core>, id: String, job: Arc<Job>, target:Option<resource_launch::ResourceTarget>) -> Result<()> {
    let instance = core.store.instance(&id)?;
    let meta: Value =
        serde_json::from_slice(&fs::read(if instance.loader != store::Loader::Vanilla {
            core.store.dir(&id)?.join("launch.json")
        } else {
            metadata::version_dir(&core.store.root, &instance.version)?
                .join(format!("{}.json", instance.version))
        })?)?;
    if instance.loader != store::Loader::Vanilla
        && metadata::text(&meta, "id")?
            != loaders::profile_id(&instance.version, &instance.loader_version, instance.loader)
    {
        bail!("Modloader installation does not match this instance; reinstall from Versions");
    }
    if let Some(files) = meta["chestLoaderFiles"].as_array() {
        for file in files {
            let path = store::safe_join(&core.store.root.join("libraries"), file.as_str().context("Invalid loader file")?)?;
            if !path.is_file() { bail!("Modloader installation is missing files; reinstall from Versions"); }
        }
    }
    let settings=core.launch_settings(&id)?;
    settings.validate(&core.store.config())?;
    let graphics_arguments = settings.graphics_arguments(&instance.version)?;
    let session = core.launch_session_for(settings.account_id.as_deref()).await?;
    let _download = core.download_lock.acquire().await?;
    let java = install::java(&core, &meta, &instance.java_path).await?;
    drop(_download);
    if job.cancel.load(Ordering::Relaxed) {
        return Ok(());
    }
    let (_, mut classpath, _) = metadata::libraries(&meta, &core.store.root)?;
    classpath.push(
        metadata::version_dir(&core.store.root, &instance.version)?
            .join(format!("{}.jar", instance.version)),
    );
    for file in &classpath {
        if !file.is_file() {
            bail!("Installation is missing files; reinstall from Versions");
        }
    }
    let classpath = std::env::join_paths(&classpath)?
        .to_string_lossy()
        .into_owned();
    let dir = core.store.dir(&id)?;
    let game = dir.join("game");
    fs::create_dir_all(&game)?;
    fs::create_dir_all(dir.join("natives"))?;
    let mut vars = HashMap::from([
        ("auth_player_name".into(), session.account.name),
        ("auth_uuid".into(), session.account.id),
        ("auth_access_token".into(), session.access_token.clone()),
        ("auth_xuid".into(), session.xuid),
        ("clientid".into(), session.client_id.clone()),
        ("user_type".into(), if session.client_id.is_empty() { "legacy" } else { "msa" }.into()),
        ("version_type".into(), "release".into()),
        ("version_name".into(), metadata::text(&meta, "id")?.into()),
        ("game_directory".into(), game.to_string_lossy().into_owned()),
        (
            "assets_root".into(),
            core.store
                .root
                .join("assets")
                .to_string_lossy()
                .into_owned(),
        ),
        (
            "assets_index_name".into(),
            metadata::text(&meta["assetIndex"], "id")?.into(),
        ),
        (
            "natives_directory".into(),
            dir.join("natives").to_string_lossy().into_owned(),
        ),
        ("launcher_name".into(), "Chest".into()),
        ("launcher_version".into(), env!("CARGO_PKG_VERSION").into()),
        ("classpath".into(), classpath),
        (
            "classpath_separator".into(),
            if cfg!(windows) { ";" } else { ":" }.into(),
        ),
        (
            "library_directory".into(),
            core.store
                .root
                .join("libraries")
                .to_string_lossy()
                .into_owned(),
        ),
    ]);
    let mut args = vec![
        format!("-Xms{}M", instance.memory_mb.min(512)),
        format!("-Xmx{}M", instance.memory_mb),
    ];
    args.extend(metadata::expand_arguments(
        &meta["arguments"]["jvm"],
        &vars,
    )?);
    if let Some(logging) = meta.pointer("/logging/client") {
        let path = store::safe_join(
            &core.store.root.join("logging"),
            metadata::text(&logging["file"], "id")?,
        )?;
        vars.insert("path".into(), path.to_string_lossy().into_owned());
        args.extend(metadata::expand_arguments(
            &serde_json::json!([metadata::text(logging, "argument")?]),
            &vars,
        )?);
    }
    args.extend(settings.java_args.clone());
    args.push(metadata::text(&meta, "mainClass")?.into());
    args.extend(metadata::expand_arguments(
        &meta["arguments"]["game"],
        &vars,
    )?);
    args.extend(["--width".into(), settings.width.to_string(), "--height".into(), settings.height.to_string()]);
    if settings.fullscreen { args.push("--fullscreen".into()); }
    args.extend(settings.game_args.clone());
    args.extend(graphics_arguments);
    if let Some(target)=&target{args.extend(resource_launch::arguments(&meta,target)?);}
    launch_settings::hook(&settings.before_launch, &game, &settings.environment).await?;
    if job.cancel.load(Ordering::Relaxed) { return Ok(()); }
    let mut command = tokio::process::Command::new(java);
    command
        .args(args)
        .envs(&settings.environment)
        .current_dir(&game)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().context("Minecraft could not start")?;
    let started = std::time::Instant::now();
    job.started.store(true, Ordering::Relaxed);
    core.logs.lock().unwrap().remove(&id);
    core.activity(Activity::new(&id, "running", None, "Minecraft is running"));
    core.log(&id, "Minecraft started.");
    let (out, err) = (child.stdout.take().unwrap(), child.stderr.take().unwrap());
    let c = core.clone();
    let i = id.clone();
    let token = session.access_token.clone();
    let a = tokio::spawn(async move { read_logs(c, i, out, token).await });
    let c = core.clone();
    let i = id.clone();
    let token = session.access_token;
    let b = tokio::spawn(async move { read_logs(c, i, err, token).await });
    let status: Result<std::process::ExitStatus> = async {
        Ok(loop {
            tokio::select! {result=child.wait()=>break result?,_=tokio::time::sleep(std::time::Duration::from_millis(150))=>{
                if job.cancel.load(Ordering::Relaxed){child.kill().await?;break child.wait().await?;}
            }}
        })
    }.await;
    if let Err(error) = core.store.record_playtime(&id, started.elapsed().as_secs()) {
        core.log(&id, &format!("Could not save playtime: {error:#}"));
    }
    let status = status?;
    let _ = a.await;
    let _ = b.await;
    let lines = core.logs(&id).join("\n");
    fs::write(dir.join("launcher.log"), lines)?;
    launch_settings::hook(&settings.after_exit, &game, &settings.environment).await?;
    if !status.success() && !job.cancel.load(Ordering::Relaxed) {
        bail!("Minecraft exited unexpectedly ({status}). Open Log for details.");
    }
    core.log(
        &id,
        if job.cancel.load(Ordering::Relaxed) {
            "Minecraft was stopped by the user."
        } else {
            "Minecraft closed normally."
        },
    );
    Ok(())
}
async fn read_logs<R: tokio::io::AsyncRead + Unpin>(
    core: Arc<Core>,
    id: String,
    reader: R,
    token: String,
) {
    const LIMIT:usize=16*1024;
    let mut reader=BufReader::new(reader);
    let mut line=Vec::with_capacity(LIMIT);
    let mut oversized=false;
    loop {
        let buffer=match reader.fill_buf().await {Ok(buffer) if !buffer.is_empty()=>buffer,_=>break};
        let size=buffer.len();
        for &byte in buffer {
            if byte==b'\n' {
                emit_game_line(&core,&id,&line,oversized,&token);
                line.clear();oversized=false;
            }else if line.len()<LIMIT {line.push(byte);}else{oversized=true;}
        }
        reader.consume(size);
    }
    if !line.is_empty() || oversized{emit_game_line(&core,&id,&line,oversized,&token);}
}
fn emit_game_line(core:&Core,id:&str,line:&[u8],oversized:bool,token:&str){
    if oversized{core.log(id,"[Log line omitted: exceeds 16 KiB]");return;}
    let line=String::from_utf8_lossy(line);
    let line=line.trim_end_matches('\r');
    if token.is_empty(){core.log(id,line);}else{core.log(id,&line.replace(token,"[redacted]"));}
}


pub fn open_launcher_link(link: &str) -> Result<()> {
    let path=match link {"github"=>"", "issues"=>"/issues", "releases"=>"/releases", _=>bail!("Unknown project link")};
    open::that(format!("https://github.com/gardengim/chest{path}"))?;
    Ok(())
}

#[cfg(test)]
mod lifecycle_tests {
    use super::*;
    #[test]
    fn updater_maintenance_excludes_new_jobs_and_releases_on_failure(){
        let d=tempfile::tempdir().unwrap();let core=Core::new(d.path().into(), |_|{}, |_|{}).unwrap();
        let instance=core.store.create("World".into(),"1.21.4".into(),"grass".into()).unwrap();
        let guard=core.begin_maintenance().unwrap();
        assert!(core.reserve(&instance.id,"install").is_err());
        assert!(core.begin_maintenance().is_err());
        drop(guard);
        assert!(core.reserve(&instance.id,"install").is_ok());
        assert!(core.begin_maintenance().is_err());
    }
    #[tokio::test]
    async fn oversized_and_fragmented_logs_stay_bounded_and_redact_tokens(){
        use tokio::io::AsyncWriteExt;
        let d=tempfile::tempdir().unwrap();let core=Arc::new(Core::new(d.path().into(), |_|{}, |_|{}).unwrap());
        let (mut writer,reader)=tokio::io::duplex(64);
        let c=core.clone();let task=tokio::spawn(async move{read_logs(c,"world".into(),reader,"private-token".into()).await;});
        writer.write_all(b"hello private-").await.unwrap();writer.write_all(b"token\r\n").await.unwrap();
        writer.write_all(&vec![b'x';100_000]).await.unwrap();writer.write_all(b"private-token\nlast line").await.unwrap();
        drop(writer);task.await.unwrap();
        assert_eq!(core.logs("world"),["hello [redacted]","[Log line omitted: exceeds 16 KiB]","last line"]);
    }
    #[cfg(debug_assertions)]
    #[tokio::test]
    async fn offline_debugging_skips_credentials_without_saving_a_fake_account() {
        let d = tempfile::tempdir().unwrap();
        let core = Core::new(d.path().into(), |_| {}, |_| {}).unwrap();
        core.set_debug_offline(false).unwrap();
        assert!(core.launch_session().await.err().unwrap().to_string().contains("Sign in"));
        core.set_debug_offline(true).unwrap();
        let session = core.launch_session().await.unwrap();
        assert_eq!(session.account.name, "ChestDebug");
        assert_eq!(session.account.id, "2b4f29ac7a2f366dacf8457b8011111e");
        assert!(session.client_id.is_empty());
        assert!(session.xuid.is_empty());
        assert!(core.store.config().accounts.is_empty());
        assert!(core.store.config().active_account.is_none());
        core.set_debug_offline(false).unwrap();
        assert!(core.launch_session().await.is_err());
    }
    #[test]
    fn instance_folder_returns_the_known_instances_game_path() {
        let d = tempfile::tempdir().unwrap();
        let core = Core::new(d.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core.store.create("World".into(), "1.21.4".into(), "grass".into()).unwrap();
        let path = core.instance_folder(&instance.id).unwrap();
        assert_eq!(path, core.store.root.join("instances").join(&instance.id).join("game"));
        assert!(core.instance_folder("../elsewhere").is_err());
        assert!(core.instance_folder(&uuid::Uuid::new_v4().to_string()).is_err());
    }
    #[test]
    fn file_reservations_reject_conflicts_and_failed_copies_are_not_published() {
        let temp = tempfile::tempdir().unwrap();
        let core = Core::new(temp.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core.store.create("World".into(), "1.21.4".into(), "grass".into()).unwrap();
        core.activity(Activity::new(&instance.id,"launch_failed",None,"Previous error"));
        let reservation = core.file_operation(&instance.id,"Copying…").unwrap();
        assert_eq!(core.activities()[0].status,"working");
        assert!(core.file_operations_active());
        assert!(core.duplicate(&instance.id).is_err());
        assert!(core.remove(&instance.id).is_err());
        assert!(core.save_instance(instance.clone()).is_err());
        assert!(core.begin_maintenance().is_err());
        drop(reservation);
        assert!(!core.busy(&instance.id));
        assert_eq!(core.activities()[0].phase,"Previous error");
        fs::remove_dir_all(core.instance_folder(&instance.id).unwrap()).unwrap();
        assert!(core.duplicate(&instance.id).is_err());
        assert!(!core.busy(&instance.id));
        assert_eq!(core.store.config().instances.len(), 1);
    }
    #[test]
    fn deleted_instances_do_not_retain_file_operation_activity() {
        let temp = tempfile::tempdir().unwrap();
        let core = Core::new(temp.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core.store.create("World".into(),"1.21.4".into(),"grass".into()).unwrap();
        core.remove(&instance.id).unwrap();
        assert!(!core.busy(&instance.id));
        assert!(core.activities().iter().all(|activity| activity.id != instance.id));
    }
    #[test]
    fn deletion_config_failure_keeps_its_record_and_can_be_retried() {
        let temp = tempfile::tempdir().unwrap();
        let core = Core::new(temp.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core.store.create("World".into(),"1.21.4".into(),"grass".into()).unwrap();
        let original = fs::read(temp.path().join("config.json")).unwrap();
        fs::create_dir(temp.path().join("config.json.tmp")).unwrap();
        assert_eq!(core.remove(&instance.id).unwrap_err().to_string(),DELETE_ERROR);
        assert!(core.store.instance(&instance.id).is_ok());
        assert_eq!(fs::read(temp.path().join("config.json")).unwrap(),original);
        assert!(!core.busy(&instance.id));
        assert!(core.logs(&instance.id).iter().any(|line|line.starts_with("Deletion failed:")));
        fs::remove_dir(temp.path().join("config.json.tmp")).unwrap();
        core.remove(&instance.id).unwrap();
        assert!(core.store.config().instances.is_empty());
        assert!(core.activities().is_empty());
    }
    #[test]
    fn artwork_comes_from_instance_data_and_rejects_invalid_images() {
        let d = tempfile::tempdir().unwrap();
        let core = Core::new(d.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core
            .store
            .create("World".into(), "1.21.4".into(), "gold".into())
            .unwrap();
        assert!(core.instance_icons().is_empty());
        let icon = core.store.dir(&instance.id).unwrap().join("game/icon.png");
        fs::write(&icon, b"not a PNG").unwrap();
        assert!(core.instance_icons().is_empty());
        image::RgbaImage::new(32, 32).save(&icon).unwrap();
        let images = core.instance_icons();
        assert!(images[&instance.id].starts_with("data:image/png;base64,"));
        let copy = core.duplicate(&instance.id).unwrap();
        assert_eq!(core.instance_icons()[&copy.id], images[&instance.id]);
        fs::write(&icon, vec![0u8; 2 * 1024 * 1024 + 1]).unwrap();
        assert!(!core.instance_icons().contains_key(&instance.id));
    }
    #[tokio::test]
    async fn duplicate_operations_and_mutation_are_rejected_while_busy() {
        let d = tempfile::tempdir().unwrap();
        let core = Arc::new(Core::new(d.path().into(), |_| {}, |_| {}).unwrap());
        let instance = core
            .store
            .create("World".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        let job = core.reserve(&instance.id, "install").unwrap();
        assert!(core.reserve(&instance.id, "game").is_err());
        assert!(core.save_instance(instance.clone()).is_err());
        assert!(core.remove(&instance.id).is_err());
        core.pause(&instance.id, true).unwrap();
        let c = core.clone();
        let id = instance.id.clone();
        let checkpoint =
            tokio::spawn(
                async move { install::checkpoint(&c, &id, &job, Some(0.5), "Assets").await },
            );
        for _ in 0..100 {
            if core.activities().iter().any(|a| a.status == "paused") {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }
        assert!(core.activities().iter().any(|a| a.status == "paused"));
        core.pause(&instance.id, false).unwrap();
        checkpoint.await.unwrap().unwrap();
        assert!(core.activities().iter().any(|a| a.status == "installing"));
    }
    #[tokio::test]
    async fn failed_start_is_not_reported_as_game_crash() {
        let d = tempfile::tempdir().unwrap();
        let core = Arc::new(Core::new(d.path().into(), |_| {}, |_| {}).unwrap());
        let instance = core
            .store
            .create("World".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        core.store.installed(&instance.id).unwrap();
        core.launch(instance.id.clone()).unwrap();
        for _ in 0..100 {
            if !core.busy(&instance.id) {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }
        assert!(!core.busy(&instance.id));
        assert_eq!(core.activities()[0].status, "launch_failed");
    }
}
