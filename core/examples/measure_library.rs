// Disposable, offline workload; never opens the user's Chest data directory.
use anyhow::Result;
use chest_core::{store::{Config, Instance, Loader}, Core};
use std::{fs, time::Instant};
use uuid::Uuid;
fn main()->Result<()> {
    for count in [100,500,1000] {
        let temp=tempfile::tempdir()?;
        let config=Config {instances:(0..count).map(|n|Instance {
            id:Uuid::new_v4().to_string(),name:format!("World {n}"),version:"1.21.4".into(),
            loader:Loader::Vanilla,loader_version:String::new(),memory_mb:4096,java_path:String::new(),
            artwork:"grass".into(),installed:false,playtime_seconds:0,storage_parent:String::new(),
        }).collect(),..Config::default()};
        fs::write(temp.path().join("config.json"),serde_json::to_vec(&config)?)?;
        let start=Instant::now();
        let core=Core::new(temp.path().into(), |_|{}, |_|{})?;
        let startup=start.elapsed();
        let mut samples=vec![];
        for _ in 0..5 {let start=Instant::now();assert!(core.instance_icons().is_empty());samples.push(start.elapsed());}
        samples.sort();
        println!("{count} instances: core startup {:.2} ms; missing-icon scan median {:.2} ms",startup.as_secs_f64()*1000.,samples[2].as_secs_f64()*1000.);
    }
    Ok(())
}
