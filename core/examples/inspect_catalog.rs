// Live discovery + verified download smoke check; writes only to a temporary instance.
use anyhow::{Context, Result};
use chest_core::{
    catalog::{self, Kind, Query, Source},
    fabric, install, metadata,
    store::Loader,
    Core,
};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<()> {
    let temp = tempfile::tempdir()?;
    let core = Arc::new(Core::new(temp.path().to_path_buf(), |_| {}, |_| {})?);
    let page = catalog::search(
        &core.client,
        Query {
            source: Source::Modrinth,
            kind: Kind::Mod,
            query: "Mod Menu".into(),
            sort: "relevance".into(),
            offset: 0,
            limit: 20,
            game: "1.21.4".into(),
            loader: "fabric".into(),
        },
    )
    .await?;
    assert!(!page.projects.is_empty());
    let instance = core.store.create_with_loader(
        "Catalog smoke".into(),
        "1.21.4".into(),
        "grass".into(),
        Loader::Fabric,
        "0.16.10".into(),
    )?;
    let versions = catalog::releases(
        &core.client,
        Source::Modrinth,
        "modmenu",
        &instance,
        Kind::Mod,
    )
    .await?;
    let release = versions.first().context("No matching Mod Menu release")?;
    let files = core
        .install_content(
            instance.id.clone(),
            Source::Modrinth,
            "modmenu".into(),
            release.id.clone(),
            Kind::Mod,
        )
        .await?;
    assert!(!files.is_empty());
    let again = core
        .install_content(
            instance.id.clone(),
            Source::Modrinth,
            "modmenu".into(),
            release.id.clone(),
            Kind::Mod,
        )
        .await?;
    assert_eq!(files, again);
    println!("Modrinth: {} results, {} matching releases; {} verified files, repeated add preserved existing files",page.total,versions.len(),files.len());
    core.toggle_content(&instance.id, "mods", &files[0])?;
    assert!(core
        .install_content(
            instance.id.clone(),
            Source::Modrinth,
            "modmenu".into(),
            release.id.clone(),
            Kind::Mod
        )
        .await
        .is_err());
    println!("Disabled-file conflict rejected");
    let loaders = fabric::quilt_versions(&core.client, "1.21.4").await?;
    let loader = loaders.first().context("No stable Quilt loader")?;
    let manifest: metadata::Manifest = core
        .client
        .get(metadata::MANIFEST)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let vanilla = manifest
        .versions
        .iter()
        .find(|v| v.id == "1.21.4")
        .context("Missing game version")?;
    let path = temp.path().join("base.json");
    install::fetch(
        &core.client,
        &metadata::Download { size: None,
            url: vanilla.url.clone(),
            hash: vanilla.sha1.clone(),
            path: path.clone(),
            phase: "Metadata".into(),
        },
    )
    .await?;
    let base = serde_json::from_slice(&std::fs::read(path)?)?;
    let merged = fabric::prepare_quilt(&core.client, base, "1.21.4", loader).await?;
    let (libraries, _, _) = metadata::libraries(&merged, temp.path())?;
    let mut count = 0;
    for file in libraries.iter().filter(|f| {
        f.url.starts_with("https://maven.fabricmc.net/")
            || f.url.starts_with("https://maven.quiltmc.org/")
    }) {
        install::fetch(&core.client, file).await?;
        count += 1;
    }
    println!(
        "Quilt {loader}: {count} verified loader libraries, main class {}",
        merged["mainClass"]
    );
    Ok(())
}
