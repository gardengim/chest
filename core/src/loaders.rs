//! Loader dispatch is internal; integrations do no work until explicitly requested.
use crate::metadata;
use crate::{fabric, forge, store::Loader};
use anyhow::{bail, Context, Result};
use serde_json::Value;

pub async fn versions(client: &reqwest::Client, game: &str, loader: Loader) -> Result<Vec<String>> {
    match loader {
        Loader::Vanilla => Ok(vec![]),
        Loader::Fabric => fabric::versions(client, game).await,
        Loader::Quilt => fabric::quilt_versions(client, game).await,
        Loader::Forge | Loader::Neoforge => forge::versions(client, game, loader).await,
    }
}

pub fn profile_id(game: &str, version: &str, loader: Loader) -> String {
    match loader {
        Loader::Vanilla => game.into(),
        Loader::Fabric => fabric::profile_id(game, version),
        Loader::Quilt => format!("quilt-loader-{version}-{game}"),
        Loader::Forge => format!("{game}-forge-{version}"),
        Loader::Neoforge => format!("neoforge-{version}"),
    }
}

pub(crate) fn validate_profile(profile: &Value, game: &str, expected: &str) -> Result<()> {
    if metadata::text(profile, "inheritsFrom")? != game
        || metadata::text(profile, "id")? != expected
    {
        bail!("loader profile does not match the selected Minecraft and loader versions");
    }
    metadata::text(profile, "mainClass")?;
    Ok(())
}

fn library_key(lib: &Value) -> Result<String> {
    let name = metadata::text(lib, "name")?;
    // A loader library supersedes the same Maven artifact from the base profile.
    let parts = name.split(':').collect::<Vec<_>>();
    if parts.len() < 3 {
        bail!("Invalid loader library coordinate");
    }
    // Classifiers are separate artifacts (e.g. a patched client and its API).
    Ok(format!(
        "{}:{}:{}",
        parts[0],
        parts[1],
        parts.get(3).copied().unwrap_or("")
    ))
}

pub(crate) fn merge(mut base: Value, profile: &Value, game: &str, expected: &str) -> Result<Value> {
    validate_profile(profile, game, expected)?;
    if metadata::text(&base, "id")? != game {
        bail!("Minecraft metadata does not match the loader profile");
    }
    let children = profile["libraries"]
        .as_array()
        .context("Missing loader libraries")?;
    let keys = children
        .iter()
        .map(library_key)
        .collect::<Result<Vec<_>>>()?;
    let libraries = base["libraries"]
        .as_array_mut()
        .context("Missing Minecraft libraries")?;
    let mut merged = vec![];
    for library in libraries.iter() {
        if !keys.contains(&library_key(library)?) {
            merged.push(library.clone());
        }
    }
    merged.extend(children.iter().cloned());
    *libraries = merged;
    for kind in ["game", "jvm"] {
        let inherited = base["arguments"][kind]
            .as_array_mut()
            .context("Missing Minecraft arguments")?;
        if let Some(extra) = profile["arguments"].get(kind) {
            inherited.extend(
                extra
                    .as_array()
                    .context("Invalid loader arguments")?
                    .iter()
                    .cloned(),
            );
        }
    }
    base["id"] = profile["id"].clone();
    base["mainClass"] = profile["mainClass"].clone();
    Ok(base)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn forge_profile_keeps_classifiers_and_inherits_game_assets() {
        let base = json!({"id":"1.20.1","assetIndex":{"id":"5"},"javaVersion":{"majorVersion":17},
            "libraries":[{"name":"org.example:library:1"},{"name":"org.example:library:1:natives"}],
            "arguments":{"game":["--username","${auth_player_name}"],"jvm":["-cp","${classpath}"]}});
        let profile = json!({"id":"1.20.1-forge-47.4.0","inheritsFrom":"1.20.1", "mainClass":"cpw.mods.bootstraplauncher.BootstrapLauncher",
            "libraries":[{"name":"org.example:library:2"}],
            "arguments":{"game":["--launchTarget","forgeclient"],"jvm":["-DlibraryDirectory=${library_directory}"]}});
        let result = merge(base, &profile, "1.20.1", "1.20.1-forge-47.4.0").unwrap();
        assert_eq!(
            result["libraries"],
            json!([{"name":"org.example:library:1:natives"},{"name":"org.example:library:2"}])
        );
        assert_eq!(result["assetIndex"]["id"], "5");
        assert_eq!(result["javaVersion"]["majorVersion"], 17);
        assert_eq!(result["arguments"]["game"].as_array().unwrap().len(), 4);
        assert_eq!(
            profile_id("1.21.1", "21.1.172", Loader::Neoforge),
            "neoforge-21.1.172"
        );
    }
}
