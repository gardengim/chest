use crate::{instance_files::inside, Core};
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{fs, io::Read, path::Path};
use uuid::Uuid;

#[derive(Serialize)]
pub struct World {
    pub instance_id: String,
    pub folder: String,
    pub name: String,
    pub version: Option<String>,
    pub data_version: Option<i32>,
    pub last_played: Option<i64>,
}
#[derive(Serialize, Default)]
pub struct Worlds {
    pub worlds: Vec<World>,
    pub unavailable: Vec<String>,
}
#[derive(Deserialize)]
struct Level {
    #[serde(rename = "Data")]
    data: LevelData,
}
#[derive(Deserialize)]
struct LevelData {
    #[serde(rename = "LevelName", default)]
    name: String,
    #[serde(rename = "Version", default)]
    version: Option<WorldVersion>,
    #[serde(rename = "DataVersion", default)]
    data_version: Option<i32>,
    #[serde(rename = "LastPlayed", default)]
    last_played: Option<i64>,
}
#[derive(Deserialize)]
struct WorldVersion {
    #[serde(rename = "Name", default)]
    name: String,
}

// Stream world data instead of keeping region files or entire archives in memory.
fn walk(
    root: &Path,
    dir: &Path,
    depth: usize,
    visit: &mut impl FnMut(&Path, &Path, bool) -> Result<()>,
) -> Result<()> {
    if depth > 64 {
        bail!("World folder nesting exceeds 64 levels");
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let kind = entry.file_type()?;
        if kind.is_symlink() || !(kind.is_file() || kind.is_dir()) {
            bail!("World contains a link or unsupported file");
        }
        let path = inside(root, &path)?;
        let relative = path.strip_prefix(root)?;
        if relative == Path::new("session.lock") {
            continue;
        }
        visit(&path, relative, kind.is_dir())?;
        if kind.is_dir() {
            walk(root, &path, depth + 1, visit)?;
        }
    }
    Ok(())
}
fn read_world(id: &str, folder: &str, root: &Path) -> World {
    let mut world = World {
        instance_id: id.into(),
        folder: folder.into(),
        name: folder.into(),
        version: None,
        data_version: None,
        last_played: None,
    };
    // Bad or unfamiliar metadata leaves the world visible with unknown compatibility.
    let metadata = (|| -> Result<LevelData> {
        let file = inside(root, &root.join("level.dat"))?;
        if fs::metadata(&file)?.len() > 8 * 1024 * 1024 {
            bail!("World metadata exceeds 8 MiB");
        }
        let mut bytes = Vec::new();
        flate2::read::GzDecoder::new(fs::File::open(file)?)
            .take(8 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)?;
        if bytes.len() > 8 * 1024 * 1024 {
            bail!("World metadata exceeds 8 MiB");
        }
        Ok(fastnbt::from_bytes::<Level>(&bytes)?.data)
    })();
    if let Ok(data) = metadata {
        if !data.name.trim().is_empty() {
            world.name = data.name;
        }
        world.version = data.version.map(|v| v.name).filter(|name| !name.is_empty());
        world.data_version = data.data_version;
        world.last_played = data.last_played;
    }
    world
}
fn scan_worlds(id: &str, game: &Path) -> Result<Vec<World>> {
    if !game.exists() {
        return Ok(vec![]);
    }
    crate::instance_files::names(game, "saves")?
        .into_iter()
        .map(|folder| {
            let root = inside(game, &game.join("saves").join(&folder))?;
            Ok(read_world(id, &folder, &root))
        })
        .collect()
}
impl Core {
    pub fn world_info(&self, id: &str, folder: &str) -> Result<World> {
        let root = self.instance_file(id, "saves", folder)?;
        Ok(read_world(id, folder, &root))
    }
    pub fn instance_worlds(&self, id: &str) -> Result<Vec<World>> {
        scan_worlds(id, &self.instance_folder(id)?)
    }
    pub fn worlds(&self) -> Worlds {
        let mut result = Worlds::default();
        for instance in self.store.config().instances {
            let worlds = self
                .store
                .dir_for(&instance)
                .and_then(|dir| scan_worlds(&instance.id, &dir.join("game")));
            match worlds {
                Ok(worlds) => result.worlds.extend(worlds),
                Err(_) => result.unavailable.push(instance.name),
            }
        }
        result.unavailable.sort();
        result.unavailable.dedup();
        result
    }
    pub fn copy_world(&self, id: &str, folder: &str, target_id: &str) -> Result<String> {
        let _operation = self.operation_lock.lock().unwrap();
        if id == target_id {
            bail!("Choose another instance");
        }
        if self.maintenance.load(std::sync::atomic::Ordering::Acquire) {
            bail!("Chest is updating; try again after restart.");
        }
        if self.busy(id) || self.busy(target_id) {
            bail!("Close both instances before copying a world");
        }
        let target_instance = self.store.instance(target_id)?;
        if target_instance.version == "pending" {
            bail!("Finish preparing this instance first");
        }
        let source = self.instance_file(id, "saves", folder)?;
        inside(&source, &source.join("level.dat"))?;
        let game = self.instance_folder(target_id)?;
        fs::create_dir_all(&game)?;
        fs::create_dir_all(game.join("saves"))?;
        let saves = inside(&game, &game.join("saves"))?;
        let token = Uuid::new_v4();
        let stage = saves.join(format!(".chest-copy-{token}"));
        let name = format!("world-{token}");
        let destination = saves.join(&name);
        fs::create_dir(&stage)?;
        let result = (|| -> Result<()> {
            walk(&source, &source, 0, &mut |path, relative, directory| {
                let target = stage.join(relative);
                if directory {
                    fs::create_dir(&target)?;
                } else {
                    fs::copy(path, target)?;
                }
                Ok(())
            })?;
            if destination.exists() {
                bail!("World destination already exists");
            }
            fs::rename(&stage, destination)?;
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_dir_all(stage);
        }
        result?;
        Ok(name)
    }
    pub fn backup_world(&self, id: &str, folder: &str, target: &Path) -> Result<()> {
        let _operation = self.operation_lock.lock().unwrap();
        if self.maintenance.load(std::sync::atomic::Ordering::Acquire) {
            bail!("Chest is updating; try again after restart.");
        }
        if self.busy(id) {
            bail!("Close this instance before backing up a world");
        }
        let source = self.instance_file(id, "saves", folder)?;
        inside(&source, &source.join("level.dat"))?;
        let parent = target
            .parent()
            .context("Choose a backup folder")?
            .canonicalize()?;
        if parent.starts_with(&source) {
            bail!("Save the backup outside the world folder");
        }
        let target = parent.join(target.file_name().context("Choose a backup file")?);
        // create_new protects an existing backup even if the file picker allows replacement.
        let file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .context("Choose a new backup filename; existing files are preserved")?;
        let result = (|| -> Result<()> {
            let mut zip = zip::ZipWriter::new(file);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated);
            walk(&source, &source, 0, &mut |path, relative, directory| {
                let name = format!("world/{}", relative.to_string_lossy().replace('\\', "/"));
                if directory {
                    zip.add_directory(format!("{name}/"), options)?;
                } else {
                    zip.start_file(name, options)?;
                    std::io::copy(&mut fs::File::open(path)?, &mut zip)?;
                }
                Ok(())
            })?;
            zip.finish()?.sync_all()?;
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(target);
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    fn fixture(core: &Core, id: &str) {
        let world = core.instance_folder(id).unwrap().join("saves/Survival");
        fs::create_dir_all(world.join("region")).unwrap();
        let bytes=fastnbt::to_bytes(&serde_json::json!({"Data":{"LevelName":"My world","Version":{"Name":"1.21.4"},"DataVersion":4189,"LastPlayed":1234_i64}})).unwrap();
        let mut gzip = flate2::write::GzEncoder::new(
            fs::File::create(world.join("level.dat")).unwrap(),
            flate2::Compression::default(),
        );
        gzip.write_all(&bytes).unwrap();
        gzip.finish().unwrap();
        fs::write(world.join("region/r.0.0.mca"), b"region data").unwrap();
        fs::write(world.join("session.lock"), b"old lock").unwrap();
    }
    #[test]
    fn metadata_copy_and_backup_preserve_original_and_never_overwrite() {
        let d = tempfile::tempdir().unwrap();
        let core = Core::new(d.path().join("data"), |_| {}, |_| {}).unwrap();
        let a = core
            .store
            .create("A".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        let b = core
            .store
            .create("B".into(), "1.20.1".into(), "grass".into())
            .unwrap();
        fixture(&core, &a.id);
        let info = core.world_info(&a.id, "Survival").unwrap();
        assert_eq!(info.name, "My world");
        assert_eq!(info.version.as_deref(), Some("1.21.4"));
        assert_eq!(info.data_version, Some(4189));
        let folder = core.copy_world(&a.id, "Survival", &b.id).unwrap();
        let copied = core
            .instance_folder(&b.id)
            .unwrap()
            .join("saves")
            .join(folder);
        assert_eq!(
            fs::read(copied.join("region/r.0.0.mca")).unwrap(),
            b"region data"
        );
        assert!(!copied.join("session.lock").exists());
        assert!(core
            .instance_folder(&a.id)
            .unwrap()
            .join("saves/Survival/session.lock")
            .exists());
        assert_eq!(core.worlds().worlds.len(), 2);
        let backup = d.path().join("backup.zip");
        core.backup_world(&a.id, "Survival", &backup).unwrap();
        let mut archive = zip::ZipArchive::new(fs::File::open(&backup).unwrap()).unwrap();
        assert!(archive.by_name("world/level.dat").is_ok());
        assert!(archive.by_name("world/session.lock").is_err());
        assert!(core.backup_world(&a.id, "Survival", &backup).is_err());
        assert!(core.copy_world(&a.id, "../Survival", &b.id).is_err());
        assert!(core.copy_world(&a.id, "Survival", &a.id).is_err());
        assert!(core
            .backup_world(
                &a.id,
                "Survival",
                &core
                    .instance_folder(&a.id)
                    .unwrap()
                    .join("saves/Survival/backup.zip")
            )
            .is_err());
    }
    #[cfg(unix)]
    #[test]
    fn links_fail_without_publishing_partial_copies_or_backups() {
        let d = tempfile::tempdir().unwrap();
        let core = Core::new(d.path().join("data"), |_| {}, |_| {}).unwrap();
        let a = core
            .store
            .create("A".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        let b = core
            .store
            .create("B".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        fixture(&core, &a.id);
        std::os::unix::fs::symlink(
            d.path(),
            core.instance_folder(&a.id)
                .unwrap()
                .join("saves/Survival/outside"),
        )
        .unwrap();
        assert!(core.copy_world(&a.id, "Survival", &b.id).is_err());
        assert_eq!(
            fs::read_dir(core.instance_folder(&b.id).unwrap().join("saves"))
                .unwrap()
                .count(),
            0
        );
        let backup = d.path().join("backup.zip");
        assert!(core.backup_world(&a.id, "Survival", &backup).is_err());
        assert!(!backup.exists());
    }
    #[test]
    fn active_instances_reject_backup_and_copy() {
        let d = tempfile::tempdir().unwrap();
        let core = Core::new(d.path().into(), |_| {}, |_| {}).unwrap();
        let a = core
            .store
            .create("A".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        let b = core
            .store
            .create("B".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        fixture(&core, &a.id);
        let _job = core.reserve(&a.id, "game").unwrap();
        assert!(core
            .backup_world(&a.id, "Survival", &d.path().join("busy.zip"))
            .is_err());
        assert!(core.copy_world(&a.id, "Survival", &b.id).is_err());
        core.jobs.lock().unwrap().remove(&a.id);
        let _job = core.reserve(&b.id, "game").unwrap();
        assert!(core.copy_world(&a.id, "Survival", &b.id).is_err());
    }
    #[test]
    fn corrupt_metadata_remains_visible_with_unknown_version() {
        let d = tempfile::tempdir().unwrap();
        let core = Core::new(d.path().into(), |_| {}, |_| {}).unwrap();
        let a = core
            .store
            .create("A".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        fixture(&core, &a.id);
        fs::write(
            core.instance_folder(&a.id)
                .unwrap()
                .join("saves/Survival/level.dat"),
            b"invalid",
        )
        .unwrap();
        let info = core.world_info(&a.id, "Survival").unwrap();
        assert!(info.version.is_none());
        assert_eq!(core.worlds().worlds.len(), 1);
    }
}
