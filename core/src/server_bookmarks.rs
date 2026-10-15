use crate::{
    instance_files::inside,
    store::{Config, Loader},
    Core,
};
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs};
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ServerBookmark {
    pub id: String,
    pub name: String,
    pub address: String,
    #[serde(default)]
    pub instance_id: Option<String>,
    #[serde(default)]
    pub expected_version: String,
    #[serde(default)]
    pub expected_loader: Option<Loader>,
}
fn validate(bookmark: &ServerBookmark) -> Result<()> {
    if bookmark.name.trim().is_empty()
        || bookmark.name.len() > 120
        || bookmark.name.chars().any(char::is_control)
    {
        bail!("Enter a server name between 1 and 120 bytes");
    }
    let address = &bookmark.address;
    if address.is_empty()
        || address.len() > 320
        || address
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || "/\\?#@".contains(c))
    {
        bail!("Enter a hostname or IP address, optionally with a port");
    }
    let url =
        url::Url::parse(&format!("minecraft://{address}")).context("Invalid server address")?;
    if url.host_str().is_none() {
        bail!("Invalid server address");
    }
    if !bookmark.expected_version.is_empty() {
        crate::store::valid_segment(&bookmark.expected_version)?;
    }
    Ok(())
}
impl Core {
    pub fn save_server_bookmark(&self, mut bookmark: ServerBookmark) -> Result<Config> {
        let _operation = self.operation_lock.lock().unwrap();
        bookmark.name = bookmark.name.trim().into();
        bookmark.address = bookmark.address.trim().into();
        bookmark.expected_version = bookmark.expected_version.trim().into();
        validate(&bookmark)?;
        let new = bookmark.id.is_empty();
        if new {
            bookmark.id = Uuid::new_v4().to_string();
        } else {
            Uuid::parse_str(&bookmark.id)?;
        }
        self.store.change(|config| {
            if let Some(id) = &bookmark.instance_id {
                if !config.instances.iter().any(|i| &i.id == id) {
                    bail!("Instance not found");
                }
            }
            if new {
                if config.server_bookmarks.len() >= 500 {
                    bail!("Server bookmarks are limited to 500");
                }
                config.server_bookmarks.push(bookmark);
            } else {
                let existing = config
                    .server_bookmarks
                    .iter_mut()
                    .find(|b| b.id == bookmark.id)
                    .context("Server bookmark not found")?;
                *existing = bookmark;
            }
            Ok(())
        })
    }
    pub fn remove_server_bookmark(&self, id: &str) -> Result<Config> {
        self.store.change(|config| {
            config.server_bookmarks.retain(|b| b.id != id);
            Ok(())
        })
    }
    pub fn add_bookmarked_server(&self, bookmark_id: &str, instance_id: &str) -> Result<bool> {
        let _operation = self.operation_lock.lock().unwrap();
        if self.maintenance.load(std::sync::atomic::Ordering::Acquire) {
            bail!("Chest is updating; try again after restart.");
        }
        if self.busy(instance_id) {
            bail!("Close this instance before changing its server list");
        }
        let instance = self.store.instance(instance_id)?;
        if instance.version == "pending" {
            bail!("Finish preparing this instance first");
        }
        let bookmark = self
            .store
            .config()
            .server_bookmarks
            .into_iter()
            .find(|b| b.id == bookmark_id)
            .context("Server bookmark not found")?;
        validate(&bookmark)?;
        let game = self.instance_folder(instance_id)?;
        fs::create_dir_all(&game)?;
        let file = game.join("servers.dat");
        let mut root = if file.exists() {
            let file = inside(&game, &file)?;
            if fs::metadata(&file)?.len() > 1024 * 1024 {
                bail!("Server list exceeds 1 MiB");
            }
            match fastnbt::from_bytes::<fastnbt::Value>(&fs::read(file)?)? {
                fastnbt::Value::Compound(root) => root,
                _ => bail!("Invalid server list"),
            }
        } else {
            HashMap::new()
        };
        let servers = root
            .entry("servers".into())
            .or_insert_with(|| fastnbt::Value::List(vec![]));
        let fastnbt::Value::List(servers) = servers else {
            bail!("Invalid server list");
        };
        if servers.iter().any(|server|matches!(server,fastnbt::Value::Compound(fields) if matches!(fields.get("ip"),Some(fastnbt::Value::String(ip)) if ip.eq_ignore_ascii_case(&bookmark.address)))){return Ok(false);}
        if servers.len() >= 1000 {
            bail!("Server list is limited to 1000 entries");
        }
        servers.push(fastnbt::Value::Compound(HashMap::from([
            ("name".into(), fastnbt::Value::String(bookmark.name)),
            ("ip".into(), fastnbt::Value::String(bookmark.address)),
        ])));
        let bytes = fastnbt::to_bytes(&fastnbt::Value::Compound(root))?;
        if bytes.len() > 1024 * 1024 {
            bail!("Server list exceeds 1 MiB");
        }
        let temp = game.join(format!(".servers-{}.tmp", Uuid::new_v4()));
        let result = (|| -> Result<()> {
            use std::io::Write;
            let mut output = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temp)?;
            output.write_all(&bytes)?;
            output.sync_all()?;
            drop(output);
            fs::rename(&temp, &file)?;
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(temp);
        }
        result?;
        Ok(true)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn bookmark() -> ServerBookmark {
        ServerBookmark {
            id: String::new(),
            name: "Home".into(),
            address: "localhost:25565".into(),
            instance_id: None,
            expected_version: String::new(),
            expected_loader: None,
        }
    }
    #[test]
    fn validates_addresses_and_preserves_unknown_server_fields() {
        for address in ["localhost", "example.com:25565", "[::1]:25565"] {
            let mut b = bookmark();
            b.address = address.into();
            assert!(validate(&b).is_ok(), "{address}");
        }
        for address in [
            "",
            "https://example.com",
            "a b",
            "user@host",
            "host:99999",
            "host/path",
        ] {
            let mut b = bookmark();
            b.address = address.into();
            assert!(validate(&b).is_err(), "{address}");
        }
        let d = tempfile::tempdir().unwrap();
        let core = Core::new(d.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core
            .store
            .create("A".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        let mut b = bookmark();
        b.instance_id = Some(instance.id.clone());
        let config = core.save_server_bookmark(b).unwrap();
        let b = &config.server_bookmarks[0];
        let game = core.instance_folder(&instance.id).unwrap();
        fs::create_dir_all(&game).unwrap();
        let value = serde_json::json!({"custom":"preserved","servers":[{"name":"Other","ip":"other.host","icon":"existing-icon","acceptTextures":1}]});
        fs::write(game.join("servers.dat"), fastnbt::to_bytes(&value).unwrap()).unwrap();
        assert!(core.add_bookmarked_server(&b.id, &instance.id).unwrap());
        assert!(!core.add_bookmarked_server(&b.id, &instance.id).unwrap());
        let value: serde_json::Value =
            fastnbt::from_bytes(&fs::read(game.join("servers.dat")).unwrap()).unwrap();
        assert_eq!(value["custom"], "preserved");
        assert_eq!(value["servers"][0]["icon"], "existing-icon");
        assert_eq!(value["servers"].as_array().unwrap().len(), 2);
        let _job = core.reserve(&instance.id, "game").unwrap();
        assert!(core.add_bookmarked_server(&b.id, &instance.id).is_err());
        core.jobs.lock().unwrap().remove(&instance.id);
        let reopened = crate::store::Store::new(d.path().into()).unwrap();
        assert_eq!(
            reopened.config().server_bookmarks[0].address,
            "localhost:25565"
        );
        core.store.remove(&instance.id).unwrap();
        assert!(core.store.config().server_bookmarks[0]
            .instance_id
            .is_none());
        core.remove_server_bookmark(&b.id).unwrap();
        assert!(core.store.config().server_bookmarks.is_empty());
    }
}
