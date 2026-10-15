//! Downloads official installer artifacts into a disposable profile. No account
//! or normal Minecraft installation is touched. Pass --launch for a debug launch or --launch-smoke to close after rendering starts.
use anyhow::{bail, Context, Result};
use chest_core::{install, loaders, metadata, store::Loader, Core, Job};
use std::{
    fs,
    sync::{atomic::AtomicBool, Arc},
};

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    let loader = match args.first().map(String::as_str) {
        Some("forge") => Loader::Forge,
        Some("neoforge") => Loader::Neoforge,
        _ => bail!(
            "Usage: inspect_loader forge|neoforge <Minecraft version> [loader version] [--launch|--launch-smoke]"
        ),
    };
    let game = args.get(1).context("Provide a Minecraft version")?;
    let smoke = args.iter().any(|a| a == "--launch-smoke");
    let launch = smoke || args.iter().any(|a| a == "--launch");
    let temp = tempfile::tempdir()?;
    let core = Arc::new(Core::new_scoped(
        temp.path().into(),
        Some("Chest Loader Smoke".into()),
        |a| {
            if !a.phase.contains("files verified") {
                println!("{} {}", a.status, a.phase);
            }
        },
        |l| println!("{}", l.line),
    )?);
    let versions = loaders::versions(&core.client, game, loader).await?;
    let version = args
        .get(2)
        .filter(|v| !v.starts_with("--"))
        .or(versions.first())
        .context("No compatible stable loader")?;
    if !versions.iter().any(|v| v == version) {
        bail!("Selected loader is absent from the official version list");
    }
    let instance = core.store.create_with_loader(
        "Loader smoke".into(),
        game.clone(),
        "grass".into(),
        loader,
        version.clone(),
    )?;
    let job = Arc::new(Job {
        paused: AtomicBool::new(false),
        cancel: AtomicBool::new(false),
        started: AtomicBool::new(false),
        kind: "install",
    });
    install::install(core.clone(), instance.id.clone(), job).await?;
    let meta: serde_json::Value = serde_json::from_slice(&fs::read(
        core.store.dir(&instance.id)?.join("launch.json"),
    )?)?;
    let (_, classpath, _) = metadata::libraries(&meta, &core.store.root)?;
    assert!(classpath.iter().all(|p| p.is_file()));
    assert!(core.store.instance(&instance.id)?.installed);
    println!(
        "Installed {loader:?} {version} for {game}; main class {}; {} classpath entries",
        meta["mainClass"],
        classpath.len()
    );
    if launch {
        core.set_debug_offline(true)?;
        core.launch(instance.id.clone())?;
        println!("Disposable offline development launch; close Minecraft to finish.");
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(120);
        let mut rendered = false;
        let mut stopping = false;
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            if smoke && !stopping {
                rendered = core
                    .logs(&instance.id)
                    .iter()
                    .any(|line| line.contains("Created:") && line.contains("atlas"));
                if rendered || tokio::time::Instant::now() >= deadline {
                    core.stop(&instance.id)?;
                    stopping = true;
                }
            }
            let activities = core.activities();
            if let Some(activity) = activities.iter().find(|a| a.id == instance.id) {
                if activity.status == "crashed" || activity.status == "launch_failed" {
                    bail!("{}", activity.phase);
                }
                if activity.status == "idle" {
                    break;
                }
            }
        }
        if smoke && !rendered {
            bail!("Minecraft did not reach texture atlas creation within 120 seconds");
        }
        if smoke {
            println!("Launch smoke passed: rendering initialized and the game process stopped.");
        }
    }
    Ok(())
}
