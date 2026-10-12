use anyhow::Result;
use chest_core::{
    install,
    metadata::{self, Download},
    Core,
};
use std::{fs, sync::Arc};
#[tokio::main]
async fn main() -> Result<()> {
    let dir = tempfile::tempdir()?;
    let core = Arc::new(Core::new(dir.path().into(), |_| {}, |_| {})?);
    let versions = core.versions().await?;
    let version = &versions[0];
    let path = dir.path().join("version.json");
    install::fetch(
        &core.client,
        &Download {
            url: version.url.clone(),
            hash: version.sha1.clone(),
            path: path.clone(),
            phase: "metadata".into(),
        },
    )
    .await?;
    let meta = serde_json::from_slice(&fs::read(path)?)?;
    let (files, classpath, natives) = metadata::libraries(&meta, dir.path())?;
    println!(
        "Verified release {}: {} downloads, {} classpath entries, {} native archives, Java {}",
        version.id,
        files.len(),
        classpath.len(),
        natives.len(),
        meta["javaVersion"]["majorVersion"]
    );
    Ok(())
}
