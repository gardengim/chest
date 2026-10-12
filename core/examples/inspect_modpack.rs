//! Download a real pack into temporary data; never starts Minecraft or changes user instances.
use chest_core::{catalog::Source, modpack, Core};
use std::sync::Arc;
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let directory = tempfile::tempdir()?;
    let core = Arc::new(Core::new(directory.path().join("data"), |_| {}, |_| {})?);
    let releases = modpack::releases(
        &core.client,
        Source::Modrinth,
        "fabulously-optimized",
        "1.21.4",
        "fabric",
    )
    .await?;
    let release = releases
        .first()
        .ok_or_else(|| anyhow::anyhow!("No pack release"))?;
    println!("Preparing {}", release.name);
    let instance = core
        .install_modpack(
            Source::Modrinth,
            "fabulously-optimized".into(),
            release.id.clone(),
            "Pack acceptance".into(),
        )
        .await?;
    let game = core.store.dir(&instance.id)?.join("game");
    let mods = std::fs::read_dir(game.join("mods"))?.count();
    assert!(mods > 10);
    assert_eq!(instance.version, "1.21.4");
    assert!(!instance.installed);
    assert!(game.join(".chest-modpack.json").is_file());
    println!(
        "Imported {mods} mods, Minecraft {}, {:?} {}, icon: {}",
        instance.version,
        instance.loader,
        instance.loader_version,
        !core.instance_icons().is_empty()
    );
    Ok(())
}
