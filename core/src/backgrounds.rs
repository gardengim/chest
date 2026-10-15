//! One instance background pool; local images remain references until displayed.
use crate::{instance_files::names, Core};
use anyhow::Result;
use serde::Serialize;
use std::{fs, time::UNIX_EPOCH};

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Background {
    Provider { url: String },
    Screenshot { name: String, modified: u64 },
}

impl Core {
    pub async fn instance_backgrounds(&self, id: &str) -> Result<Vec<Background>> {
        self.store.instance(id)?;
        let game = self.instance_folder(id)?;
        let local = tokio::task::spawn_blocking(move || -> Result<Vec<Background>> {
            Ok(names(&game, "screenshots")?.into_iter().map(|name| {
                let modified = fs::metadata(game.join("screenshots").join(&name))
                    .and_then(|meta| meta.modified()).ok()
                    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                    .map_or(0, |time| time.as_secs());
                Background::Screenshot { name, modified }
            }).collect())
        });
        let (provider, local) = tokio::join!(self.provider_backgrounds(id), local);
        // A missing/broken provider receipt must not hide local screenshots,
        // and an unreadable screenshots directory must not hide provider images.
        let mut pool: Vec<_> = provider.unwrap_or_default().into_iter()
            .map(|url| Background::Provider { url }).collect();
        pool.extend(local.ok().and_then(Result::ok).unwrap_or_default());
        Ok(pool)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn pool_combines_sources_and_survives_a_broken_provider_receipt() {
        let directory = tempfile::tempdir().unwrap();
        let core = Core::new(directory.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core.store.create("World".into(), "1.21.4".into(), "grass".into()).unwrap();
        let game = core.instance_folder(&instance.id).unwrap();
        fs::create_dir_all(game.join("screenshots")).unwrap();
        fs::write(game.join("screenshots/local.png"), b"image").unwrap();
        fs::write(game.join("screenshots/notes.txt"), b"not an image").unwrap();
        fs::write(game.join(".chest-modpack.json"), br#"{"gallery":["https://cdn.modrinth.com/pack.png","https://cdn.modrinth.com/pack.png","file:///private.png"]}"#).unwrap();
        let pool = core.instance_backgrounds(&instance.id).await.unwrap();
        assert_eq!(pool.len(), 2);
        assert_eq!(pool[0], Background::Provider { url: "https://cdn.modrinth.com/pack.png".into() });
        assert!(matches!(&pool[1], Background::Screenshot { name, .. } if name == "local.png"));
        fs::write(game.join(".chest-modpack.json"), b"broken").unwrap();
        assert_eq!(core.instance_backgrounds(&instance.id).await.unwrap().len(), 1);
        #[cfg(unix)] {
            std::os::unix::fs::symlink(game.join("screenshots/local.png"), game.join("screenshots/link.png")).unwrap();
            assert_eq!(core.instance_backgrounds(&instance.id).await.unwrap().len(), 1);
        }
    }
}
