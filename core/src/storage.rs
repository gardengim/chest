//! On-demand accounting; cleanup is restricted to Chest's generated image cache.
use crate::{instance_files::inside, Core};
use anyhow::Result;
use serde::Serialize;
use std::{collections::HashSet, fs, path::PathBuf};

#[derive(Default, Serialize)]
pub struct StorageUsage {
    pub instance_bytes: u64,
    pub shared_bytes: u64,
    pub cache_bytes: u64,
    pub clearable_bytes: u64,
    pub other_bytes: u64,
    pub complete: bool,
}

impl Core {
    pub fn storage_usage(&self) -> StorageUsage {
        let mut result = StorageUsage {
            complete: true,
            ..StorageUsage::default()
        };
        let mut pending = vec![(self.store.root.clone(), 0)];
        for instance in self.store.config().instances {
            if let Ok(path) = self.store.dir_for(&instance) {
                if !path.starts_with(&self.store.root) {
                    pending.push((path, 1));
                }
            }
        }
        let mut visited = HashSet::new();
        let mut entries = 0;
        while let Some((path, mut category)) = pending.pop() {
            if entries >= 200_000 {
                result.complete = false;
                break;
            }
            let metadata = match fs::symlink_metadata(&path) {
                Ok(metadata) => metadata,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                Err(_) => {
                    result.complete = false;
                    continue;
                }
            };
            if metadata.file_type().is_symlink() {
                continue;
            }
            if path.parent() == Some(self.store.root.as_path()) {
                category = match path.file_name().and_then(|name| name.to_str()) {
                    Some("instances") => 1,
                    Some("libraries" | "assets" | "versions" | "runtime" | "java") => 2,
                    Some("thumbnails") => 3,
                    _ => 0,
                };
            }
            if metadata.is_dir() {
                let canonical = match path.canonicalize() {
                    Ok(path) => path,
                    Err(_) => {
                        result.complete = false;
                        continue;
                    }
                };
                if !visited.insert(canonical) {
                    continue;
                }
                match fs::read_dir(path) {
                    Ok(children) => {
                        for child in children {
                            entries += 1;
                            if entries > 200_000 {
                                result.complete = false;
                                break;
                            }
                            match child {
                                Ok(child) => pending.push((child.path(), category)),
                                Err(_) => result.complete = false,
                            }
                        }
                    }
                    Err(_) => result.complete = false,
                }
            } else if metadata.is_file() {
                if category == 3
                    && path
                        .extension()
                        .is_some_and(|extension| extension == "png" || extension == "tmp")
                {
                    result.clearable_bytes = result.clearable_bytes.saturating_add(metadata.len());
                }
                let bytes = match category {
                    1 => &mut result.instance_bytes,
                    2 => &mut result.shared_bytes,
                    3 => &mut result.cache_bytes,
                    _ => &mut result.other_bytes,
                };
                *bytes = bytes.saturating_add(metadata.len());
            }
        }
        result
    }

    pub fn clear_image_cache(&self) -> Result<u64> {
        let _images = self.image_cache_lock.lock().unwrap();
        let directory = self.store.root.join("thumbnails");
        if !directory.exists() {
            return Ok(0);
        }
        let directory = inside(&self.store.root, &directory)?;
        let mut freed = 0;
        for entry in fs::read_dir(&directory)? {
            let entry = entry?;
            if !entry.file_type()?.is_file() {
                continue;
            }
            let path: PathBuf = entry.path();
            if !path
                .extension()
                .is_some_and(|extension| extension == "png" || extension == "tmp")
            {
                continue;
            }
            let path = inside(&directory, &path)?;
            let length = fs::metadata(&path)?.len();
            fs::remove_file(path)?;
            freed += length;
        }
        Ok(freed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accounts_once_and_only_cleans_generated_files() {
        let temp = tempfile::tempdir().unwrap();
        let core = Core::new(temp.path().into(), |_| {}, |_| {}).unwrap();
        fs::create_dir_all(temp.path().join("thumbnails")).unwrap();
        fs::write(temp.path().join("thumbnails/image.png"), [0; 10]).unwrap();
        fs::write(temp.path().join("thumbnails/keep.txt"), [0; 5]).unwrap();
        fs::create_dir_all(temp.path().join("assets")).unwrap();
        fs::write(temp.path().join("assets/keep"), [0; 20]).unwrap();
        let usage = core.storage_usage();
        assert!(usage.complete);
        assert_eq!(usage.cache_bytes, 15);
        assert_eq!(usage.clearable_bytes, 10);
        assert_eq!(usage.shared_bytes, 20);
        assert_eq!(core.clear_image_cache().unwrap(), 10);
        assert!(temp.path().join("assets/keep").exists());
        assert!(temp.path().join("thumbnails/keep.txt").exists());
    }
}
