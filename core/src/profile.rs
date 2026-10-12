//! Explicit disposable profiles for packaged acceptance; normal launches never call this.
use anyhow::{bail, Context, Result};
use std::{fs, path::{Path, PathBuf}};
use uuid::Uuid;

pub struct TestProfile { pub root: PathBuf, pub id: Uuid }
// Resolve existing ancestors before creating anything, including symlink aliases.
fn resolved(path:&Path)->Result<PathBuf> {
    if path.exists(){return Ok(path.canonicalize()?);}
    let parent=path.parent().context("Invalid profile path")?;
    Ok(resolved(parent)?.join(path.file_name().context("Invalid profile directory")?))
}
impl TestProfile {
    pub fn open(root:&Path, normal:&Path)->Result<Self> {
        if !root.is_absolute() {bail!("CHEST_TEST_PROFILE must be an absolute directory path");}
        let root=resolved(root)?;
        let normal=resolved(normal)?;
        if root.starts_with(&normal) || normal.starts_with(&root) {
            bail!("Test profile must be separate from the normal Chest data directory");
        }
        fs::create_dir_all(&root)?;
        let marker=root.join(".chest-test-profile");
        let id=if marker.exists() {
            Uuid::parse_str(fs::read_to_string(&marker)?.trim()).context("Invalid test profile marker")?
        }else{
            if fs::read_dir(&root)?.next().is_some(){bail!("Test profile directory must be empty or already marked as a Chest test profile");}
            let id=Uuid::new_v4();
            use std::io::Write;
            let mut file=fs::OpenOptions::new().write(true).create_new(true).open(&marker)?;
            file.write_all(id.to_string().as_bytes())?;
            id
        };
        Ok(Self {root,id})
    }
    pub fn credential_scope(&self)->String {format!("Chest Minecraft Test {}",self.id)}
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn profiles_are_explicit_separate_and_stable(){
        let dir=tempfile::tempdir().unwrap();let normal=dir.path().join("normal");fs::create_dir(&normal).unwrap();
        fs::write(normal.join("config.json"),b"original").unwrap();
        assert!(TestProfile::open(Path::new("relative"),&normal).is_err());
        assert!(TestProfile::open(&normal,&normal).is_err());
        assert!(TestProfile::open(dir.path(),&normal).is_err());
        let path=dir.path().join("test");let first=TestProfile::open(&path,&normal).unwrap();
        let again=TestProfile::open(&path,&normal).unwrap();assert_eq!(first.id,again.id);
        let second=TestProfile::open(&dir.path().join("other"),&normal).unwrap();assert_ne!(first.credential_scope(),second.credential_scope());
        assert_eq!(fs::read(normal.join("config.json")).unwrap(),b"original");
    }
    #[cfg(unix)]
    #[test]
    fn symlink_alias_cannot_create_a_profile_inside_normal_data(){
        let dir=tempfile::tempdir().unwrap();let normal=dir.path().join("normal");fs::create_dir(&normal).unwrap();
        let alias=dir.path().join("alias");std::os::unix::fs::symlink(&normal,&alias).unwrap();
        assert!(TestProfile::open(&alias.join("test"),&normal).is_err());assert!(!normal.join("test").exists());
    }
    #[test]
    fn unmarked_data_and_invalid_markers_are_not_adopted(){
        let dir=tempfile::tempdir().unwrap();let root=dir.path().join("test");fs::create_dir(&root).unwrap();fs::write(root.join("config.json"),b"keep").unwrap();
        let normal=dir.path().join("normal");assert!(TestProfile::open(&root,&normal).is_err());
        fs::write(root.join(".chest-test-profile"),b"invalid").unwrap();assert!(TestProfile::open(&root,&normal).is_err());
        assert_eq!(fs::read(root.join("config.json")).unwrap(),b"keep");
    }
}
