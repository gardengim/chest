//! All new download writers and orphan cleanup share a directory lock.
//! Legacy temporary names are intentionally outside this ownership contract.
use anyhow::Result;
use std::{fs::{self, File, OpenOptions}, path::{Path, PathBuf}};

pub(crate) struct DownloadDirectory(File);

impl DownloadDirectory {
    pub(crate) fn acquire(directory: &Path) -> Result<Self> {
        fs::create_dir_all(directory)?;
        let file = OpenOptions::new().create(true).truncate(false).read(true).write(true)
            .open(directory.join(".chest-downloads.lock"))?;
        file.lock()?;
        let guard = Self(file);
        // With the lock held, no cooperating process can still be writing one of
        // these files, including a process that stopped between create and lock.
        for entry in fs::read_dir(directory)? {
            let entry = entry?;
            if entry.file_type()?.is_file() && owned_name(&entry.file_name().to_string_lossy()) {
                fs::remove_file(entry.path())?;
            }
        }
        Ok(guard)
    }
}

impl Drop for DownloadDirectory {
    fn drop(&mut self) { let _ = self.0.unlock(); }
}

fn owned_name(name: &str) -> bool {
    name.strip_prefix(".chest-part-").and_then(|name| name.strip_suffix(".download"))
        .is_some_and(|id| uuid::Uuid::parse_str(id).is_ok_and(|uuid| uuid.to_string() == id))
}

pub(crate) fn temporary_path(directory: &Path) -> PathBuf {
    directory.join(format!(".chest-part-{}.download", uuid::Uuid::new_v4()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn process_exit_releases_lock_and_next_writer_reconciles() {
        const KEY: &str = "CHEST_ORPHAN_TEST_DIRECTORY";
        if let Some(directory) = std::env::var_os(KEY) {
            let directory = PathBuf::from(directory);
            let _guard = DownloadDirectory::acquire(&directory).unwrap();
            fs::write(temporary_path(&directory), b"interrupted writer").unwrap();
            // Exit without Rust destructors, as with forced process termination.
            std::process::exit(0);
        }
        let directory = tempfile::tempdir().unwrap();
        let child = std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "download_temp::tests::process_exit_releases_lock_and_next_writer_reconciles"])
            .env(KEY, directory.path()).output().unwrap();
        assert!(child.status.success());
        assert!(fs::read_dir(directory.path()).unwrap().any(|entry| owned_name(&entry.unwrap().file_name().to_string_lossy())));
        let _guard = DownloadDirectory::acquire(directory.path()).unwrap();
        assert!(!fs::read_dir(directory.path()).unwrap().any(|entry| owned_name(&entry.unwrap().file_name().to_string_lossy())));
    }
    #[test]
    fn reconciles_only_owned_orphans_and_excludes_other_writers() {
        let directory = tempfile::tempdir().unwrap();
        let orphan = temporary_path(directory.path());
        fs::write(&orphan, b"interrupted").unwrap();
        for name in ["legacy.download", ".chest-part-not-a-uuid.download", "verified.jar"] {
            fs::write(directory.path().join(name), b"preserve").unwrap();
        }
        let guard = DownloadDirectory::acquire(directory.path()).unwrap();
        assert!(!orphan.exists());
        let other = OpenOptions::new().read(true).write(true)
            .open(directory.path().join(".chest-downloads.lock")).unwrap();
        assert!(other.try_lock().is_err());
        for name in ["legacy.download", ".chest-part-not-a-uuid.download", "verified.jar"] {
            assert!(directory.path().join(name).exists());
        }
        drop(guard);
        other.try_lock().unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn never_follows_orphan_symlinks() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("original");
        fs::write(&source, b"preserve").unwrap();
        let link = temporary_path(directory.path());
        std::os::unix::fs::symlink(&source, &link).unwrap();
        let _guard = DownloadDirectory::acquire(directory.path()).unwrap();
        assert!(link.exists());
        assert_eq!(fs::read(source).unwrap(), b"preserve");
    }
}
