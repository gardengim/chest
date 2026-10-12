use crate::{
    catalog::Source,
    store::{Instance, Loader},
    Core,
};
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{fs, io::Read, path::PathBuf, sync::Arc};

#[derive(Clone, Deserialize, Serialize)]
pub struct LocalContent {
    pub path: String,
    pub kind: String,
    pub enabled: bool,
}
#[derive(Deserialize)]
pub struct CreationRequest {
    pub name: String,
    pub default_name: String,
    pub version: String,
    pub loader: Loader,
    pub loader_version: String,
    pub parent: String,
    pub archive: Option<String>,
    pub pack: Option<PackSelection>,
    pub files: Vec<LocalContent>,
    #[serde(default)]
    pub catalog: Vec<CatalogSelection>,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct CatalogSelection {
    pub source: Source,
    pub project: String,
    pub release: String,
    pub kind: crate::catalog::Kind,
    pub enabled: bool,
}
const CONTENT_REQUEST: &str = "creation-content.json";

// A persistent queue is retried by the installer after pack metadata is resolved.
pub async fn prepare_content(core: &Arc<Core>, id: &str, job: &crate::Job) -> Result<()> {
    let path = core.store.dir(id)?.join(CONTENT_REQUEST);
    if !path.exists() {
        return Ok(());
    }
    let mut queue: Vec<CatalogSelection> = serde_json::from_slice(&fs::read(&path)?)?;
    while let Some(content) = queue.first().cloned() {
        crate::install::checkpoint(core, id, job, None, "Installing selected content").await?;
        core.activity(crate::Activity::new(
            id,
            "installing",
            None,
            "Installing selected content",
        ));
        crate::catalog::install(
            core,
            id,
            content.source,
            &content.project,
            &content.release,
            content.kind,
        )
        .await?;
        queue.remove(0);
        let temporary = path.with_extension("tmp");
        fs::write(&temporary, serde_json::to_vec(&queue)?)?;
        fs::rename(temporary, &path)?;
    }
    fs::remove_file(path)?;
    Ok(())
}

#[derive(Deserialize)]
pub struct PackSelection {
    pub source: Source,
    pub project: String,
    pub release: String,
}
#[derive(Serialize)]
pub struct ArchivePreview {
    pub path: String,
    pub instance: Instance,
}

pub fn inspect_archive(path: PathBuf) -> Result<ArchivePreview> {
    let mut zip = zip::ZipArchive::new(fs::File::open(&path)?)?;
    let metadata = zip.by_name("instance.json")?;
    if metadata.size() > 65536 {
        bail!("Invalid Chest archive metadata");
    }
    let mut text = String::new();
    metadata.take(65537).read_to_string(&mut text)?;
    let mut instance: Instance =
        serde_json::from_str(&text).context("Choose an archive exported by Chest")?;
    instance.storage_parent.clear();
    crate::store::validate(&instance)?;
    Ok(ArchivePreview {
        path: path.to_string_lossy().into_owned(),
        instance,
    })
}

impl Core {
    pub fn create_wizard(self: &Arc<Self>, request: CreationRequest) -> Result<Instance> {
        if request.archive.is_some() && request.pack.is_some() {
            bail!("Choose one instance source");
        }
        let name = if request.name.trim().is_empty() {
            request.default_name.trim()
        } else {
            request.name.trim()
        };
        if name.is_empty() || name.len() > 120 {
            bail!("Use an instance name between 1 and 120 bytes");
        }
        let parent = if request.parent.trim().is_empty() {
            None
        } else {
            let path = PathBuf::from(request.parent.trim());
            if !path.is_absolute() || !path.is_dir() {
                bail!("Choose an existing absolute folder for the instance location");
            }
            Some(fs::canonicalize(path)?)
        };
        // Validate all sources before creating any library entry.
        for file in &request.files {
            if !["mods", "resourcepacks", "shaderpacks"].contains(&file.kind.as_str()) {
                bail!("Unknown content folder");
            }
            let path = PathBuf::from(&file.path);
            if !path.is_file() || !path.extension().is_some_and(|e| e == "jar" || e == "zip") {
                bail!("Choose .jar or .zip content files");
            }
        }
        let pack = request.pack.is_some();
        let mut instance = if let Some(archive) = request.archive {
            self.import(&PathBuf::from(archive))?
        } else if let Some(pack) = request.pack {
            self.create_modpack(pack.source, pack.project, pack.release, name.to_owned())?
        } else {
            self.store.create_with_loader(
                name.to_owned(),
                request.version,
                "grass".into(),
                request.loader,
                request.loader_version,
            )?
        };
        let result = (|| -> Result<()> {
            instance.name = name.to_owned();
            self.store.save(instance.clone())?;
            if let Some(parent) = parent {
                let old = self.store.dir(&instance.id)?;
                let destination = parent.join(&instance.id);
                if fs::canonicalize(&old)? != destination {
                    // Own a fresh UUID subfolder, never the user's chosen parent directory.
                    fs::create_dir(&destination).context("Cannot create instance folder")?;
                    if let Err(error) = crate::copy_tree(&old, &destination) {
                        let _ = fs::remove_dir_all(&destination);
                        return Err(error);
                    }
                    instance.storage_parent = parent.to_string_lossy().into_owned();
                    if let Err(error) = self.store.change(|config| {
                        let entry = config
                            .instances
                            .iter_mut()
                            .find(|i| i.id == instance.id)
                            .context("Instance not found")?;
                        entry.storage_parent = instance.storage_parent.clone();
                        Ok(())
                    }) {
                        let _ = fs::remove_dir_all(&destination);
                        return Err(error);
                    }
                    fs::remove_dir_all(old)?;
                }
            }
            let game = self.store.dir(&instance.id)?.join("game");
            for file in request.files {
                let source = PathBuf::from(&file.path);
                let name = source
                    .file_name()
                    .context("Invalid content filename")?
                    .to_string_lossy();
                let folder = game.join(file.kind);
                fs::create_dir_all(&folder)?;
                let destination = folder.join(if file.enabled {
                    name.into_owned()
                } else {
                    format!("{name}.disabled")
                });
                let mut target = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(destination)
                    .context("A content file with this name already exists")?;
                std::io::copy(&mut fs::File::open(source)?, &mut target)?;
            }
            let catalog: Vec<_> = request
                .catalog
                .into_iter()
                .filter(|item| item.enabled)
                .collect();
            if !catalog.is_empty() {
                fs::write(
                    self.store.dir(&instance.id)?.join(CONTENT_REQUEST),
                    serde_json::to_vec(&catalog)?,
                )?;
            }
            if pack || !catalog.is_empty() {
                self.start_install(instance.id.clone())?;
            }
            Ok(())
        })();
        if let Err(error) = result {
            let _ = self.store.remove(&instance.id);
            return Err(error);
        }
        Ok(instance)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request() -> CreationRequest {
        CreationRequest {
            name: "  ".into(),
            default_name: "Vanilla 1.21.4".into(),
            version: "1.21.4".into(),
            loader: Loader::Vanilla,
            loader_version: String::new(),
            parent: String::new(),
            archive: None,
            pack: None,
            files: vec![],
            catalog: vec![],
        }
    }
    #[test]
    fn unchecked_catalog_entries_are_not_queued() {
        let temp = tempfile::tempdir().unwrap();
        let core = Arc::new(Core::new(temp.path().join("data"), |_| {}, |_| {}).unwrap());
        let mut req = request();
        req.catalog.push(CatalogSelection {
            source: Source::Modrinth,
            project: "example".into(),
            release: "release".into(),
            kind: crate::catalog::Kind::Mod,
            enabled: false,
        });
        let instance = core.create_wizard(req).unwrap();
        assert!(!core
            .store
            .dir(&instance.id)
            .unwrap()
            .join(CONTENT_REQUEST)
            .exists());
        assert!(!core.busy(&instance.id));
    }
    #[tokio::test]
    async fn failed_catalog_queue_is_preserved_for_retry_and_blocks_incomplete_exports() {
        let temp = tempfile::tempdir().unwrap();
        let core = Arc::new(Core::new(temp.path().join("data"), |_| {}, |_| {}).unwrap());
        let mut req = request();
        // Rejected locally before any network request.
        req.catalog.push(CatalogSelection {
            source: Source::Modrinth,
            project: "invalid/project".into(),
            release: "release".into(),
            kind: crate::catalog::Kind::Mod,
            enabled: true,
        });
        let instance = core.create_wizard(req).unwrap();
        let wait = || async {
            tokio::time::timeout(std::time::Duration::from_secs(2), async {
                while core.busy(&instance.id) {
                    tokio::task::yield_now().await;
                }
            })
            .await
            .unwrap();
        };
        wait().await;
        let queue = core.store.dir(&instance.id).unwrap().join(CONTENT_REQUEST);
        assert!(queue.exists());
        assert!(core
            .export(&instance.id, &temp.path().join("incomplete.zip"))
            .is_err());
        assert!(core.duplicate(&instance.id).is_err());
        core.start_install(instance.id.clone()).unwrap();
        wait().await;
        assert!(queue.exists());
        assert_eq!(core.store.config().instances.len(), 1);
    }
    #[test]
    fn default_name_custom_location_and_disabled_content_survive_reopen() {
        let temp = tempfile::tempdir().unwrap();
        let core = Arc::new(Core::new(temp.path().join("data"), |_| {}, |_| {}).unwrap());
        let parent = temp.path().join("worlds");
        fs::create_dir(&parent).unwrap();
        fs::write(parent.join("keep.txt"), "untouched").unwrap();
        let content = temp.path().join("example.jar");
        fs::write(&content, "example").unwrap();
        let mut req = request();
        req.parent = parent.to_string_lossy().into_owned();
        req.files.push(LocalContent {
            path: content.to_string_lossy().into_owned(),
            kind: "mods".into(),
            enabled: false,
        });
        let instance = core.create_wizard(req).unwrap();
        assert_eq!(instance.name, "Vanilla 1.21.4");
        let directory = fs::canonicalize(&parent).unwrap().join(&instance.id);
        assert!(directory.join("game/mods/example.jar.disabled").exists());
        let reopened = crate::store::Store::new(temp.path().join("data")).unwrap();
        assert_eq!(reopened.dir(&instance.id).unwrap(), directory);
        let mut stale = instance.clone();
        stale.storage_parent = String::new();
        reopened.save(stale).unwrap();
        assert_eq!(reopened.dir(&instance.id).unwrap(), directory);
        reopened.remove(&instance.id).unwrap();
        assert!(!directory.exists());
        assert!(parent.join("keep.txt").exists());
        assert!(content.exists());
    }
    #[test]
    fn invalid_location_and_duplicate_files_leave_no_library_entry() {
        let temp = tempfile::tempdir().unwrap();
        let core = Arc::new(Core::new(temp.path().join("data"), |_| {}, |_| {}).unwrap());
        let mut req = request();
        req.parent = "relative/path".into();
        assert!(core.create_wizard(req).is_err());
        assert!(core.store.config().instances.is_empty());
        let path = temp.path().join("same.jar");
        fs::write(&path, "example").unwrap();
        let file = LocalContent {
            path: path.to_string_lossy().into_owned(),
            kind: "mods".into(),
            enabled: true,
        };
        let mut req = request();
        req.files = vec![file.clone(), file];
        assert!(core.create_wizard(req).is_err());
        assert!(core.store.config().instances.is_empty());
    }
    #[test]
    fn archive_location_cannot_override_new_instances_location() {
        let temp = tempfile::tempdir().unwrap();
        let core = Arc::new(Core::new(temp.path().join("data"), |_| {}, |_| {}).unwrap());
        let original = core.create_wizard(request()).unwrap();
        let archive = temp.path().join("world.zip");
        core.export(&original.id, &archive).unwrap();
        let preview = inspect_archive(archive.clone()).unwrap();
        assert_eq!(preview.instance.name, original.name);
        let mut req = request();
        req.default_name = preview.instance.name;
        req.archive = Some(archive.to_string_lossy().into_owned());
        let imported = core.create_wizard(req).unwrap();
        assert_ne!(imported.id, original.id);
        assert!(imported.storage_parent.is_empty());
    }
}
