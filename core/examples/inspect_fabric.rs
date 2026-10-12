// Live smoke check for the official profile and verified Fabric library downloads.
use anyhow::Result;
use chest_core::{fabric, install, metadata};

#[tokio::main]
async fn main() -> Result<()> {
    let game = "1.21.4";
    let client = reqwest::Client::builder()
        .user_agent("Chest/0.1.0")
        .build()?;
    let loaders = fabric::versions(&client, game).await?;
    let loader = loaders.first().expect("No stable Fabric loader");
    let manifest: metadata::Manifest = client
        .get(metadata::MANIFEST)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let version = manifest.versions.iter().find(|v| v.id == game).unwrap();
    let temp = tempfile::tempdir()?;
    let path = temp.path().join("base.json");
    install::fetch(
        &client,
        &metadata::Download {
            url: version.url.clone(),
            hash: version.sha1.clone(),
            path: path.clone(),
            phase: "Metadata".into(),
        },
    )
    .await?;
    let base = serde_json::from_slice(&std::fs::read(path)?)?;
    let merged = fabric::prepare(&client, base, game, loader).await?;
    let (files, classpath, _) = metadata::libraries(&merged, temp.path())?;
    let mut count = 0;
    for file in files
        .iter()
        .filter(|f| f.url.starts_with("https://maven.fabricmc.net/"))
    {
        install::fetch(&client, file).await?;
        install::fetch(&client, file).await?; // Verified cache reuse.
        assert!(classpath.contains(&file.path));
        count += 1;
    }
    println!("Minecraft {game}, Fabric {loader}: {count} Fabric libraries verified and reused; entry point {}", merged["mainClass"]);
    Ok(())
}
