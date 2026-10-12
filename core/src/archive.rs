use crate::{
    store::{validate, Instance},
    Core,
};
use anyhow::{bail, Context, Result};
use std::{
    fs,
    io::{Read, Write},
    path::Path,
};
use uuid::Uuid;

impl Core {
    pub fn export(&self, id: &str, target: &Path) -> Result<()> {
        let _operation = self.operation_lock.lock().unwrap();
        if self.busy(id) {
            bail!("Close this instance before exporting it");
        }
        let instance = self.store.instance(id)?;
        let directory = self.store.dir(id)?;
        if directory.join("modpack-request.json").exists() || directory.join("creation-content.json").exists() {
            bail!("Finish preparing this modpack before exporting it");
        }
        if target.starts_with(&directory) {
            bail!("Save the archive outside this instance's folder");
        }
        let temp = target.with_extension("chest.zip.tmp");
        let mut archive = zip::ZipWriter::new(fs::File::create(&temp)?);
        archive.start_file("instance.json", zip::write::SimpleFileOptions::default())?;
        archive.write_all(&serde_json::to_vec_pretty(&instance)?)?;
        add_directory(&mut archive, &directory.join("game"), &directory)?;
        archive.finish()?;
        fs::rename(temp, target)?;
        Ok(())
    }
    pub fn import(&self, source: &Path) -> Result<Instance> {
        let mut zip = zip::ZipArchive::new(fs::File::open(source)?)?;
        let metadata = zip.by_name("instance.json")?;
        if metadata.size() > 65536 {
            bail!("Invalid Chest archive metadata");
        }
        let mut bytes = String::new();
        metadata.take(65537).read_to_string(&mut bytes)?;
        let mut instance: Instance =
            serde_json::from_str(&bytes).context("Choose an archive exported by Chest")?;
        instance.id = Uuid::new_v4().to_string();
        instance.storage_parent.clear();
        // Executable overrides from another computer/archive are never trusted.
        instance.java_path = self.store.config().java_path;
        instance.installed = false;
        validate(&instance)?;
        let directory = self.store.dir(&instance.id)?;
        fs::create_dir_all(directory.join("game"))?;
        let result = (|| -> Result<()> {
            let mut total = 0u64;
            for n in 0..zip.len() {
                let mut item = zip.by_index(n)?;
                let name = item.enclosed_name().context("Unsafe archive path")?;
                if !name.starts_with("game") {
                    continue;
                }
                total = total
                    .checked_add(item.size())
                    .context("Archive size overflow")?;
                if total > 8 * 1024 * 1024 * 1024 {
                    bail!("Chest imports are limited to 8 GB uncompressed");
                }
                if item.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000) {
                    bail!("Archive contains a symbolic link");
                }
                let path = directory.join(name);
                if item.is_dir() {
                    fs::create_dir_all(path)?;
                } else {
                    fs::create_dir_all(path.parent().context("Unsafe path")?)?;
                    let mut file = fs::File::create(path)?;
                    std::io::copy(&mut item, &mut file)?;
                }
            }
            self.store.change(|c| {
                c.instances.push(instance.clone());
                Ok(())
            })?;
            Ok(())
        })();
        if let Err(e) = result {
            let _ = fs::remove_dir_all(directory);
            return Err(e);
        }
        Ok(instance)
    }
}
fn add_directory(
    archive: &mut zip::ZipWriter<fs::File>,
    directory: &Path,
    root: &Path,
) -> Result<()> {
    if !directory.exists() {
        return Ok(());
    }
    for item in fs::read_dir(directory)? {
        let item = item?;
        let kind = item.file_type()?;
        let path = item.path();
        if kind.is_dir() {
            add_directory(archive, &path, root)?;
        } else if kind.is_file() {
            let name = path
                .strip_prefix(root)?
                .to_string_lossy()
                .replace('\\', "/");
            archive.start_file(
                name,
                zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Deflated),
            )?;
            std::io::copy(&mut fs::File::open(path)?, archive)?;
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn roundtrip_gets_new_identity_and_preserves_world() {
        let d = tempfile::tempdir().unwrap();
        let core = Core::new(d.path().join("data"), |_| {}, |_| {}).unwrap();
        let mut instance = core
            .store
            .create("World".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        instance.java_path = "/foreign/untrusted/java".into();
        instance.loader = crate::store::Loader::Fabric;
        instance.loader_version = "0.16.10".into();
        core.store.save(instance.clone()).unwrap();
        let duplicate = core.duplicate(&instance.id).unwrap();
        assert_eq!(duplicate.loader, instance.loader);
        assert_eq!(duplicate.loader_version, instance.loader_version);
        let game = core
            .store
            .dir(&instance.id)
            .unwrap()
            .join("game/saves/world");
        fs::create_dir_all(&game).unwrap();
        fs::write(game.join("level.dat"), b"world data").unwrap();
        let archive = d.path().join("world.chest.zip");
        core.export(&instance.id, &archive).unwrap();
        core.store.change(|config|{config.java_path="/local/chosen/java".into();Ok(())}).unwrap();
        let copy = core.import(&archive).unwrap();
        assert_eq!(copy.java_path,"/local/chosen/java");
        assert_ne!(instance.id, copy.id);
        assert!(!copy.installed);
        assert_eq!(copy.loader, instance.loader);
        assert_eq!(copy.loader_version, instance.loader_version);
        assert_eq!(
            fs::read(
                core.store
                    .dir(&copy.id)
                    .unwrap()
                    .join("game/saves/world/level.dat")
            )
            .unwrap(),
            b"world data"
        );
    }
}
