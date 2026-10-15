use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use uuid::Uuid;

#[derive(Clone, Copy, Default, Serialize, Deserialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Loader {
    #[default]
    Vanilla,
    Fabric,
    Quilt,
    Forge,
    Neoforge,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub loader: Loader,
    #[serde(default)]
    pub loader_version: String,
    pub memory_mb: u32,
    pub java_path: String,
    pub artwork: String,
    pub installed: bool,
    #[serde(default)]
    pub playtime_seconds: u64,
    #[serde(default)]
    pub storage_parent: String,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Account {
    pub id: String,
    pub name: String,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SidebarGroup {
    pub name: String,
    pub ids: Vec<String>,
    #[serde(default)]
    pub collapsed: bool,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Config {
    #[serde(default)]
    pub server_bookmarks: Vec<crate::server_bookmarks::ServerBookmark>,
    #[serde(default)]
    pub launch_settings: std::collections::HashMap<String, crate::launch_settings::LaunchSettings>,
    pub instances: Vec<Instance>,
    #[serde(default)]
    pub sidebar_groups: Vec<SidebarGroup>,
    pub accounts: Vec<Account>,
    pub active_account: Option<String>,
    pub client_id: String,
    pub java_path: String,
    pub memory_mb: u32,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            server_bookmarks: vec![],
            instances: vec![],
            sidebar_groups: vec![],
            launch_settings: Default::default(),
            accounts: vec![],
            active_account: None,
            client_id: client_id(""),
            java_path: String::new(),
            memory_mb: 4096,
        }
    }
}
pub struct Store {
    pub root: PathBuf,
    credential_scope: Option<String>,
    config: Mutex<Config>,
}
pub fn valid_segment(text: &str) -> Result<()> {
    if text.is_empty()
        || text.len() > 120
        || !text
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || ".-_".contains(c))
        || text == "."
        || text == ".."
    {
        bail!("Invalid identifier");
    }
    Ok(())
}
pub fn validate(instance: &Instance) -> Result<()> {
    Uuid::parse_str(&instance.id)?;
    valid_segment(&instance.version)?;
    match instance.loader {
        Loader::Vanilla if !instance.loader_version.is_empty() => {
            bail!("Vanilla has no loader version")
        }
        Loader::Fabric | Loader::Quilt => valid_segment(&instance.loader_version)?,
        Loader::Forge | Loader::Neoforge => crate::forge::validate_version(&instance.version, &instance.loader_version, instance.loader)?,
        _ => {}
    }
    if instance.name.trim().is_empty() || instance.name.len() > 120 {
        bail!("Enter a name between 1 and 120 bytes");
    }
    if !(512..=65536).contains(&instance.memory_mb) {
        bail!("Memory must be between 512 and 65536 MB");
    }
    if !["grass", "stone", "amethyst", "gold"].contains(&instance.artwork.as_str()) {
        bail!("Unknown artwork");
    }
    Ok(())
}
// Public application identifier, not a credential. Explicit saved IDs take precedence.
pub const DEFAULT_CLIENT_ID: &str = "2a46389b-7bf0-4854-95b8-0e808d0ac054";
fn client_id(saved: &str) -> String {
    if !saved.trim().is_empty() { return saved.trim().into(); }
    std::env::var("CHEST_CLIENT_ID").ok().filter(|id| !id.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_CLIENT_ID.into()).trim().into()
}
impl Store {
    pub fn new(root: PathBuf) -> Result<Self> {
        Self::new_scoped(root, None)
    }
    pub fn credential_service(&self) -> &str { self.credential_scope.as_deref().unwrap_or("Chest Minecraft") }
    pub fn is_test_profile(&self) -> bool { self.credential_scope.is_some() }
    pub fn new_scoped(root: PathBuf, credential_scope: Option<String>) -> Result<Self> {
        fs::create_dir_all(&root)?;
        let file = root.join("config.json");
        let mut config: Config = if file.exists() {
            serde_json::from_slice(&fs::read(file)?)
                .context("Cannot read Chest settings; original file was left unchanged")?
        } else {
            Config::default()
        };
        config.client_id = client_id(&config.client_id);
        Ok(Self {
            root,
            credential_scope,
            config: Mutex::new(config),
        })
    }
    pub fn config(&self) -> Config {
        self.config.lock().unwrap().clone()
    }
    pub fn change(&self, edit: impl FnOnce(&mut Config) -> Result<()>) -> Result<Config> {
        let mut guard = self.config.lock().unwrap();
        let mut next = guard.clone();
        edit(&mut next)?;
        next.client_id = client_id(&next.client_id);
        let tmp = self.root.join("config.json.tmp");
        fs::write(&tmp, serde_json::to_vec_pretty(&next)?)?;
        fs::rename(tmp, self.root.join("config.json"))?;
        *guard = next.clone();
        Ok(next)
    }
    pub fn set_sidebar_groups(&self, groups: Vec<SidebarGroup>) -> Result<Config> {
        self.change(|config| {
            let mut names = std::collections::HashSet::new();
            let mut ids = std::collections::HashSet::new();
            for group in &groups {
                if group.name.trim().is_empty() || group.name.len() > 80 || !names.insert(&group.name) {
                    bail!("Use unique group names between 1 and 80 bytes");
                }
                for id in &group.ids {
                    if !ids.insert(id) { bail!("An instance can belong to only one group"); }
                }
            }
            config.sidebar_groups = groups;
            for group in &mut config.sidebar_groups {
                group.ids.retain(|id| config.instances.iter().any(|i| &i.id == id));
            }
            config.sidebar_groups.retain(|group| !group.ids.is_empty());
            Ok(())
        })
    }
    pub fn reorder(&self, ids: &[String]) -> Result<Config> {
        self.change(|config| {
            // Unknown or deleted IDs are ignored; newly added instances stay at the end.
            config.instances.sort_by_key(|instance| {
                ids.iter().position(|id| id == &instance.id).unwrap_or(usize::MAX)
            });
            Ok(())
        })
    }
    pub fn instance(&self, id: &str) -> Result<Instance> {
        Uuid::parse_str(id)?;
        self.config()
            .instances
            .into_iter()
            .find(|i| i.id == id)
            .context("Instance not found")
    }
    pub fn dir(&self, id: &str) -> Result<PathBuf> {
        Uuid::parse_str(id)?;
        let config = self.config.lock().unwrap();
        if let Some(instance) = config.instances.iter().find(|i| i.id == id) {
            self.dir_for(instance)
        } else {
            Ok(self.root.join("instances").join(id))
        }
    }
    // Callers holding an instance snapshot need no repeated library clone or lookup.
    pub(crate) fn dir_for(&self, instance: &Instance) -> Result<PathBuf> {
        Uuid::parse_str(&instance.id)?;
        let parent = if instance.storage_parent.is_empty() {
            self.root.join("instances")
        } else {
            PathBuf::from(&instance.storage_parent)
        };
        Ok(parent.join(&instance.id))
    }
    pub fn create(&self, name: String, version: String, artwork: String) -> Result<Instance> {
        self.create_with_loader(name, version, artwork, Loader::Vanilla, String::new())
    }
    pub fn create_with_loader(
        &self,
        name: String,
        version: String,
        artwork: String,
        loader: Loader,
        loader_version: String,
    ) -> Result<Instance> {
        let config = self.config();
        let instance = Instance {
            id: Uuid::new_v4().to_string(),
            name: name.trim().into(),
            version,
            loader,
            loader_version,
            artwork,
            memory_mb: config.memory_mb,
            java_path: config.java_path,
            installed: false,
            playtime_seconds: 0,
            storage_parent: String::new(),
        };
        validate(&instance)?;
        let dir = self.dir(&instance.id)?;
        fs::create_dir_all(dir.join("game"))?;
        self.change(|c| {
            c.instances.push(instance.clone());
            Ok(())
        })?;
        Ok(instance)
    }
    pub fn save(&self, instance: Instance) -> Result<Config> {
        self.save_with_launch(instance, None)
    }
    pub fn save_with_launch(&self, instance: Instance, settings: Option<crate::launch_settings::LaunchSettings>) -> Result<Config> {
        validate(&instance)?;
        self.change(|c| {
            if let Some(settings) = &settings {
                settings.graphics_arguments(&instance.version)?;
                settings.validate(c)?;
            }
            let old = c
                .instances
                .iter_mut()
                .find(|i| i.id == instance.id)
                .context("Instance not found")?;
            // Installation truth is owned by the installer, never a frontend field.
            let installed = old.installed
                && old.version == instance.version
                && old.loader == instance.loader
                && old.loader_version == instance.loader_version;
            let playtime = old.playtime_seconds;
            let storage_parent = old.storage_parent.clone();
            *old = instance;
            old.installed = installed;
            old.playtime_seconds = playtime;
            old.storage_parent = storage_parent;
            if let Some(settings) = settings { c.launch_settings.insert(old.id.clone(), settings); }
            Ok(())
        })
    }
    pub fn installed(&self, id: &str) -> Result<()> {
        self.change(|c| {
            c.instances
                .iter_mut()
                .find(|i| i.id == id)
                .context("Instance not found")?
                .installed = true;
            Ok(())
        })?;
        Ok(())
    }
    pub fn record_playtime(&self, id: &str, seconds: u64) -> Result<()> {
        self.change(|c| {
            let instance = c.instances.iter_mut().find(|i| i.id == id).context("Instance not found")?;
            instance.playtime_seconds = instance.playtime_seconds.saturating_add(seconds);
            Ok(())
        })?;
        Ok(())
    }
    pub fn remove(&self, id: &str) -> Result<Config> {
        self.instance(id)?;
        let dir = self.dir(id)?;
        if dir.exists() {
            fs::remove_dir_all(dir)?;
        }
        self.change(|c| {
            c.instances.retain(|i| i.id != id);
            c.launch_settings.remove(id);
            for bookmark in &mut c.server_bookmarks { if bookmark.instance_id.as_deref()==Some(id){bookmark.instance_id=None;} }
            for group in &mut c.sidebar_groups { group.ids.retain(|member| member != id); }
            c.sidebar_groups.retain(|group| !group.ids.is_empty());
            Ok(())
        })
    }
}
pub fn safe_join(root: &Path, relative: &str) -> Result<PathBuf> {
    let path = Path::new(relative);
    if path.is_absolute()
        || path
            .components()
            .any(|c| !matches!(c, std::path::Component::Normal(_)))
        || relative.contains('\\')
        || relative.contains(':')
    {
        bail!("Unsafe download path");
    }
    Ok(root.join(path))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn playtime_survives_reopening_and_stale_editor_saves() {
        let dir = tempfile::tempdir().unwrap();
        let s = Store::new(dir.path().into()).unwrap();
        let mut instance = s.create("World".into(), "26.3".into(), "grass".into()).unwrap();
        let mut legacy = serde_json::to_value(&instance).unwrap();
        legacy.as_object_mut().unwrap().remove("playtime_seconds");
        assert_eq!(serde_json::from_value::<Instance>(legacy).unwrap().playtime_seconds, 0);
        s.record_playtime(&instance.id, 90).unwrap();
        s.record_playtime(&instance.id, 60).unwrap();
        instance.name = "Renamed world".into();
        s.save(instance.clone()).unwrap();
        let reopened = Store::new(dir.path().into()).unwrap().instance(&instance.id).unwrap();
        assert_eq!(reopened.playtime_seconds, 150);
        assert_eq!(reopened.name, "Renamed world");
    }
    #[test]
    fn saves_and_reopens() {
        let dir = tempfile::tempdir().unwrap();
        let s = Store::new(dir.path().into()).unwrap();
        let i = s
            .create("Survival".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        s.installed(&i.id).unwrap();
        let again = Store::new(dir.path().into()).unwrap();
        assert!(again.instance(&i.id).unwrap().installed);
        let mut i = again.instance(&i.id).unwrap();
        i.version = "1.21.5".into();
        again.save(i.clone()).unwrap();
        assert!(!again.instance(&i.id).unwrap().installed);
    }
    #[test]
    fn reordered_instances_persist_without_losing_new_instances() {
        let dir = tempfile::tempdir().unwrap();
        let s = Store::new(dir.path().into()).unwrap();
        let a = s.create("A".into(), "1.21.4".into(), "grass".into()).unwrap();
        let b = s.create("B".into(), "1.21.4".into(), "grass".into()).unwrap();
        let c = s.create("C".into(), "1.21.4".into(), "grass".into()).unwrap();
        s.reorder(&[b.id.clone(), "deleted".into(), a.id.clone()]).unwrap();
        let reopened = Store::new(dir.path().into()).unwrap().config();
        assert_eq!(reopened.instances.iter().map(|i| &i.id).collect::<Vec<_>>(), vec![&b.id, &a.id, &c.id]);
    }
    #[test]
    fn sidebar_groups_validate_membership_and_persist() {
        let dir = tempfile::tempdir().unwrap();
        let s = Store::new(dir.path().into()).unwrap();
        let a = s.create("A".into(), "1.21.4".into(), "grass".into()).unwrap();
        let group = SidebarGroup { name: "Friends".into(), ids: vec![a.id.clone(), "deleted".into()], collapsed: true };
        s.set_sidebar_groups(vec![group.clone()]).unwrap();
        let reopened = Store::new(dir.path().into()).unwrap().config();
        assert_eq!(reopened.sidebar_groups[0].ids, vec![a.id]);
        assert!(reopened.sidebar_groups[0].collapsed);
        assert!(s.set_sidebar_groups(vec![group.clone(), SidebarGroup { name: "Other".into(), ..group }]).is_err());
        assert_eq!(s.config().sidebar_groups.len(), 1);
    }
    #[test]
    fn rejects_traversal() {
        for path in ["../x", "/tmp/x", "a/../../b", "C:\\x", "a\\..\\b"] {
            assert!(safe_join(Path::new("cache"), path).is_err());
        }
    }
    #[test]
    fn loader_settings_are_backward_compatible_and_invalidate_installation() {
        let dir = tempfile::tempdir().unwrap();
        let s = Store::new(dir.path().into()).unwrap();
        let mut instance = s
            .create("Fabric world".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        let mut legacy = serde_json::to_value(&instance).unwrap();
        legacy.as_object_mut().unwrap().remove("loader");
        legacy.as_object_mut().unwrap().remove("loader_version");
        assert_eq!(
            serde_json::from_value::<Instance>(legacy).unwrap().loader,
            Loader::Vanilla
        );
        s.installed(&instance.id).unwrap();
        instance.loader = Loader::Fabric;
        assert!(s.save(instance.clone()).is_err());
        instance.loader_version = "0.16.10".into();
        s.save(instance.clone()).unwrap();
        assert!(!s.instance(&instance.id).unwrap().installed);
        s.installed(&instance.id).unwrap();
        instance.loader_version = "0.16.9".into();
        s.save(instance.clone()).unwrap();
        assert!(!s.instance(&instance.id).unwrap().installed);
        let reopened = Store::new(dir.path().into())
            .unwrap()
            .instance(&instance.id)
            .unwrap();
        assert_eq!(reopened.loader, Loader::Fabric);
        assert_eq!(reopened.loader_version, "0.16.9");
        instance.loader_version = "../unsafe".into();
        assert!(s.save(instance).is_err());
    }
    #[test]
    fn default_application_id_migrates_empty_config_and_preserves_explicit_ids() {
        let directory = tempfile::tempdir().unwrap();
        let mut config = Config::default();
        config.client_id.clear();
        fs::write(directory.path().join("config.json"), serde_json::to_vec(&config).unwrap()).unwrap();
        assert!(!Store::new(directory.path().into()).unwrap().config().client_id.is_empty());
        config.client_id = "custom-public-id".into();
        fs::write(directory.path().join("config.json"), serde_json::to_vec(&config).unwrap()).unwrap();
        let store = Store::new(directory.path().into()).unwrap();
        assert_eq!(store.config().client_id, "custom-public-id");
        assert!(!store.change(|config| { config.client_id.clear(); Ok(()) }).unwrap().client_id.is_empty());
    }
    #[test]
    fn does_not_replace_corrupt_config() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("config.json"), "bad").unwrap();
        assert!(Store::new(d.path().into()).is_err());
        assert_eq!(
            fs::read_to_string(d.path().join("config.json")).unwrap(),
            "bad"
        );
    }
}
