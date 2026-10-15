//! Disposable, offline workloads; never opens the normal library or credentials.
use chest_core::{Core, install::{hash_file,fetch}, metadata::Download};
use std::{fs, io::{Read,Write}, time::Instant};

fn main() -> anyhow::Result<()> {
    let root = std::env::temp_dir().join(format!("chest-workload-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&root)?;
    struct Cleanup(std::path::PathBuf);
    impl Drop for Cleanup { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }
    let _cleanup = Cleanup(root.clone());
    let core = Core::new_scoped(root.clone(), Some("audit-workloads".into()), |_| {}, |_| {})?;
    let instance = core.store.create("Audit".into(), "1.21.4".into(), "grass".into())?;
    let game = core.instance_folder(&instance.id)?;
    let shots = game.join("screenshots");
    fs::create_dir_all(&shots)?;
    for n in 0..50_000 { fs::write(shots.join(format!("shot-{n:05}.png")), [])?; }
    for sample in 0..3 {
        let start = Instant::now();
        let files = core.instance_files(&instance.id)?;
        assert_eq!(files.screenshots.len(), 50_000);
        println!("{}", serde_json::json!({"workload":"50000-screenshot-metadata","sample":sample,"ms":start.elapsed().as_secs_f64()*1000.0}));
    }
    fs::remove_dir_all(shots)?;
    let source = game.join("workload.bin");
    let bytes = 2u64*1024*1024*1024;
    let mut file = fs::File::create(&source)?;
    let block = vec![0x5a; 1024*1024];
    for _ in 0..2048 { file.write_all(&block)?; }
    file.sync_all()?;
    drop(file);
    let start = Instant::now();
    let original = hash_file(&source, true)?;
    println!("{}", serde_json::json!({"workload":"sha256","bytes":bytes,"ms":start.elapsed().as_secs_f64()*1000.0}));
    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
    let address = listener.local_addr()?;
    let served = source.clone();
    let server = std::thread::spawn(move || -> std::io::Result<()> {
        let (mut socket,_) = listener.accept()?;
        let mut request = Vec::new();
        while !request.ends_with(b"\r\n\r\n") {
            let mut byte = [0];socket.read_exact(&mut byte)?;request.push(byte[0]);
            assert!(request.len()<8192);
        }
        write!(socket,"HTTP/1.1 200 OK\r\nContent-Length: {bytes}\r\nConnection: close\r\n\r\n")?;
        std::io::copy(&mut fs::File::open(served)?,&mut socket)?;
        Ok(())
    });
    let destination = root.join("downloaded.bin");
    let download = Download {url:format!("http://{address}/workload"),path:destination.clone(),size:Some(bytes),hash:original.clone(),phase:"Audit".into()};
    let start = Instant::now();
    tokio::runtime::Runtime::new()?.block_on(fetch(&reqwest::Client::new(),&download))?;
    server.join().unwrap()?;
    let duration = start.elapsed().as_secs_f64()*1000.0;
    assert_eq!(hash_file(&destination,true)?,original);
    println!("{}",serde_json::json!({"workload":"verified-local-download","bytes":bytes,"ms":duration,"verified":true}));
    let start = Instant::now();
    let copy = core.duplicate(&instance.id)?;
    let duration = start.elapsed().as_secs_f64()*1000.0;
    assert_eq!(hash_file(&core.instance_folder(&copy.id)?.join("workload.bin"), true)?, original);
    println!("{}", serde_json::json!({"workload":"duplicate","bytes":bytes,"ms":duration,"verified":true}));
    let start = Instant::now();
    core.remove(&copy.id)?;
    assert_eq!(fs::metadata(&source)?.len(), bytes);
    println!("{}", serde_json::json!({"workload":"delete-copy","bytes":bytes,"ms":start.elapsed().as_secs_f64()*1000.0,"sourcePreserved":true}));
    let line = "x".repeat(8192);
    let start = Instant::now();
    for n in 0..100_000 { core.log(&format!("session-{}", n%100), &line); }
    let retained: usize = (0..100).map(|n| core.logs(&format!("session-{n}")).iter().map(String::len).sum::<usize>()).sum();
    assert!(retained <= 16*1024*1024 + 100*"Earlier logs omitted.".len());
    println!("{}", serde_json::json!({"workload":"100000-logs-100-sessions","inputBytes":819_200_000,"retainedBytes":retained,"ms":start.elapsed().as_secs_f64()*1000.0}));
    Ok(())
}
