use crate::loaders::{merge, validate_profile};
use crate::{
    metadata,
    store::{safe_join, valid_segment},
};
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::Path;

const META: &str = "https://meta.fabricmc.net/v2/versions/loader";

#[derive(Deserialize)]
struct LoaderEntry {
    loader: LoaderVersion,
}
#[derive(Deserialize)]
struct LoaderVersion {
    version: String,
    #[serde(default)]
    stable: bool,
}

pub async fn versions(client: &reqwest::Client, game: &str) -> Result<Vec<String>> {
    loader_versions(client, game, false).await
}
pub async fn quilt_versions(client: &reqwest::Client, game: &str) -> Result<Vec<String>> {
    loader_versions(client, game, true).await
}
async fn loader_versions(client: &reqwest::Client, game: &str, quilt: bool) -> Result<Vec<String>> {
    valid_segment(game)?;
    let entries: Vec<LoaderEntry> = client
        .get(format!(
            "{}/{game}",
            if quilt {
                "https://meta.quiltmc.org/v3/versions/loader"
            } else {
                META
            }
        ))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let mut versions = vec![];
    for entry in entries.into_iter().filter(|e| {
        if quilt {
            !e.loader.version.contains('-')
        } else {
            e.loader.stable
        }
    }) {
        valid_segment(&entry.loader.version)?;
        versions.push(entry.loader.version);
    }
    if quilt {
        versions.sort_by_key(|v| {
            std::cmp::Reverse(
                v.split('.')
                    .map(|p| p.parse::<u32>().unwrap_or(0))
                    .collect::<Vec<_>>(),
            )
        });
        versions.dedup();
    }
    Ok(versions)
}

pub fn profile_id(game: &str, loader: &str) -> String {
    format!("fabric-loader-{loader}-{game}")
}

fn maven_path(name: &str) -> Result<String> {
    let parts = name.split(':').collect::<Vec<_>>();
    if parts.len() != 3 {
        bail!("Unsupported loader library coordinate");
    }
    for part in parts[0].split('.') {
        valid_segment(part)?;
    }
    for part in &parts[1..] {
        if part.is_empty()
            || *part == "."
            || *part == ".."
            || !part
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || ".-_+".contains(c))
        {
            bail!("Invalid loader library coordinate");
        }
    }
    Ok(format!(
        "{}/{}/{}/{}-{}.jar",
        parts[0].replace('.', "/"),
        parts[1],
        parts[2],
        parts[1],
        parts[2]
    ))
}

fn checksum(hash: &str) -> Result<String> {
    let hash = hash.trim().to_ascii_lowercase();
    if hash.len() != 40 || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        bail!("Invalid loader library checksum");
    }
    Ok(hash)
}

// Resolve Maven libraries into the same verified-download format as Mojang.
// Some loader profile entries omit checksums; the official Maven sidecar supplies them.
pub async fn prepare(
    client: &reqwest::Client,
    base: Value,
    game: &str,
    loader: &str,
) -> Result<Value> {
    prepare_loader(client, base, game, loader, false).await
}
pub async fn prepare_quilt(
    client: &reqwest::Client,
    base: Value,
    game: &str,
    loader: &str,
) -> Result<Value> {
    prepare_loader(client, base, game, loader, true).await
}
async fn prepare_loader(
    client: &reqwest::Client,
    base: Value,
    game: &str,
    loader: &str,
    quilt: bool,
) -> Result<Value> {
    valid_segment(game)?;
    valid_segment(loader)?;
    let meta = if quilt {
        "https://meta.quiltmc.org/v3/versions/loader"
    } else {
        META
    };
    let expected = if quilt {
        format!("quilt-loader-{loader}-{game}")
    } else {
        profile_id(game, loader)
    };
    let mut profile: Value = client
        .get(format!("{meta}/{game}/{loader}/profile/json"))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    validate_profile(&profile, game, &expected)?;
    for lib in profile["libraries"]
        .as_array_mut()
        .context("Missing loader libraries")?
    {
        let path = maven_path(metadata::text(lib, "name")?)?;
        // Fabric's own launcher profiles resolve these from its official Maven repository.
        let repository = metadata::text(lib, "url")?;
        if repository != "https://maven.fabricmc.net/"
            && !(quilt && repository == "https://maven.quiltmc.org/repository/release/")
        {
            bail!("Unsupported loader library repository");
        }
        let url = format!("{repository}{path}");
        let hash = match lib.get("sha1").and_then(Value::as_str) {
            Some(hash) => checksum(hash)?,
            None => checksum(
                &client
                    .get(format!("{url}.sha1"))
                    .send()
                    .await?
                    .error_for_status()?
                    .text()
                    .await?,
            )?,
        };
        safe_join(Path::new("libraries"), &path)?;
        lib["downloads"] = json!({"artifact":{"path":path,"url":url,"sha1":hash}});
    }
    merge(base, &profile, game, &expected)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_maven_paths_without_traversal() {
        assert_eq!(
            maven_path("net.fabricmc:sponge-mixin:0.15.4+mixin.0.8.7").unwrap(),
            "net/fabricmc/sponge-mixin/0.15.4+mixin.0.8.7/sponge-mixin-0.15.4+mixin.0.8.7.jar"
        );
        for name in [
            "net..fabricmc:loader:1",
            "net.fabricmc:../loader:1",
            "net.fabricmc:loader:..",
            "a:b:c:d",
        ] {
            assert!(maven_path(name).is_err());
        }
        assert!(checksum("bad").is_err());
    }

    #[test]
    fn inherits_game_data_and_overrides_conflicting_libraries() {
        let base = json!({"id":"1.21.4","mainClass":"vanilla.Main","arguments":{"game":["--gameDir","${game_directory}"],"jvm":["-cp","${classpath}"]},"libraries":[{"name":"org.ow2.asm:asm:9.6"},{"name":"mojang:library:1"}],"assetIndex":{"id":"19"},"javaVersion":{"majorVersion":21},"downloads":{"client":{"sha1":"base"}}});
        let profile = json!({"id":"fabric-loader-0.16.10-1.21.4","inheritsFrom":"1.21.4","mainClass":"net.fabricmc.loader.impl.launch.knot.KnotClient","arguments":{"game":[],"jvm":["-DFabricMcEmu= net.minecraft.client.main.Main "]},"libraries":[{"name":"org.ow2.asm:asm:9.7.1"},{"name":"net.fabricmc:fabric-loader:0.16.10"}]});
        let merged = merge(
            base.clone(),
            &profile,
            "1.21.4",
            "fabric-loader-0.16.10-1.21.4",
        )
        .unwrap();
        assert_eq!(merged["mainClass"], profile["mainClass"]);
        for field in ["assetIndex", "javaVersion", "downloads"] {
            assert_eq!(merged[field], base[field]);
        }
        assert_eq!(merged["libraries"].as_array().unwrap().len(), 3);
        assert_eq!(merged["libraries"][0]["name"], "mojang:library:1");
        assert_eq!(merged["arguments"]["game"], base["arguments"]["game"]);
        assert_eq!(
            merged["arguments"]["jvm"][2],
            profile["arguments"]["jvm"][0]
        );
        assert!(merge(base, &profile, "1.20.1", "fabric-loader-0.16.10-1.21.4").is_err());
    }
}
