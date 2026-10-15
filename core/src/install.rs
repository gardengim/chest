use crate::{
    metadata::{self, Download, Manifest},
    store::{safe_join, valid_segment},
    Activity, Core, Job,
};
use anyhow::{bail, Context, Result};
use futures_util::StreamExt;
use serde_json::Value;
use sha1::{Digest, Sha1};
use sha2::Sha256;
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::{atomic::Ordering, Arc},
};
use tokio::io::AsyncWriteExt;

pub fn hash_file(path: &Path, sha256: bool) -> Result<String> {
    let mut file = fs::File::open(path)?;
    let mut buffer = [0u8; 65536];
    if sha256 {
        let mut hash = Sha256::new();
        loop {
            let n = file.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            hash.update(&buffer[..n]);
        }
        Ok(format!("{:x}", hash.finalize()))
    } else {
        let mut hash = Sha1::new();
        loop {
            let n = file.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            hash.update(&buffer[..n]);
        }
        Ok(format!("{:x}", hash.finalize()))
    }
}
// Download intermediates belong to this operation, including on cancellation/error.
struct PartialFile(PathBuf);
impl Drop for PartialFile {
    fn drop(&mut self) { let _ = fs::remove_file(&self.0); }
}
const MAX_DOWNLOAD_BYTES: u64 = 2 * 1024 * 1024 * 1024;
pub async fn fetch(client: &reqwest::Client, file: &Download) -> Result<()> {
    if ![40, 64].contains(&file.hash.len()) || !file.hash.chars().all(|c| c.is_ascii_hexdigit()) {
        bail!("Invalid file checksum");
    }
    if file.path.is_file() && file.size.is_none_or(|size| fs::metadata(&file.path).is_ok_and(|metadata| metadata.len() == size)) && hash_file(&file.path, file.hash.len() == 64)? == file.hash {
        return Ok(());
    }
    let limit = file.size.unwrap_or(MAX_DOWNLOAD_BYTES);
    if limit > MAX_DOWNLOAD_BYTES { bail!("Download exceeds size limit"); }
    let parent = file.path.parent().context("Invalid download path")?;
    let directory = parent.to_owned();
    let _directory = tokio::task::spawn_blocking(move || crate::download_temp::DownloadDirectory::acquire(&directory)).await??;
    // Recheck after waiting for a writer in another process.
    if file.path.is_file() && file.size.is_none_or(|size| fs::metadata(&file.path).is_ok_and(|metadata| metadata.len() == size)) && hash_file(&file.path, file.hash.len() == 64)? == file.hash {
        return Ok(());
    }
    let temp = crate::download_temp::temporary_path(parent);
    let _partial = PartialFile(temp.clone());
    let response = client.get(&file.url).send().await?.error_for_status()?;
    if response.content_length().is_some_and(|size| size > limit) {
        bail!("Download exceeds size limit");
    }
    let mut downloaded = 0u64;
    let mut stream = response.bytes_stream();
    let mut output = tokio::fs::File::create(&temp).await?;
    let mut sha1 = Sha1::new();
    let mut sha256 = Sha256::new();
    while let Some(bytes) = stream.next().await {
        let bytes = bytes?;
        downloaded = downloaded.checked_add(bytes.len() as u64).context("Download exceeds size limit")?;
        if downloaded > limit { bail!("Download exceeds size limit"); }
        output.write_all(&bytes).await?;
        if file.hash.len() == 64 {
            sha256.update(&bytes);
        } else {
            sha1.update(&bytes);
        }
    }
    if file.size.is_some_and(|size| downloaded != size) { bail!("Download size does not match metadata"); }
    output.flush().await?;
    drop(output);
    let hash = if file.hash.len() == 64 {
        format!("{:x}", sha256.finalize())
    } else {
        format!("{:x}", sha1.finalize())
    };
    if hash != file.hash {
        let _ = fs::remove_file(&temp);
        bail!("File verification failed; retry installation");
    }
    fs::rename(temp, &file.path)?;
    Ok(())
}
pub async fn checkpoint(
    core: &Core,
    id: &str,
    job: &Job,
    progress: Option<f64>,
    phase: &str,
) -> Result<()> {
    if job.cancel.load(Ordering::Relaxed) {
        bail!("Operation cancelled");
    }
    if job.paused.load(Ordering::Relaxed) {
        core.activity(Activity::new(id, "paused", progress, "Installation paused"));
        while job.paused.load(Ordering::Relaxed) {
            if job.cancel.load(Ordering::Relaxed) {
                bail!("Operation cancelled");
            }
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        }
    }
    core.activity(Activity::new(id, "installing", progress, phase));
    Ok(())
}
pub async fn install(core: Arc<Core>, id: String, job: Arc<Job>) -> Result<()> {
    let _permit = core.download_lock.acquire().await?;
    let instance = core.store.instance(&id)?;
    checkpoint(&core, &id, &job, None, "Loading version metadata").await?;
    let manifest: Manifest = core
        .client
        .get(metadata::MANIFEST)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let version = manifest
        .versions
        .iter()
        .find(|v| v.id == instance.version)
        .context("Minecraft version not found")?;
    let version_dir = metadata::version_dir(&core.store.root, &instance.version)?;
    let meta_path = version_dir.join(format!("{}.json", instance.version));
    fetch(
        &core.client,
        &Download { size: None,
            url: version.url.clone(),
            hash: version.sha1.clone(),
            path: meta_path.clone(),
            phase: "Metadata".into(),
        },
    )
    .await?;
    let mut meta: Value = serde_json::from_slice(&fs::read(meta_path)?)?;
    if meta.get("arguments").is_none() {
        bail!("This first version supports Minecraft 1.19 and newer");
    }
    let mut files = vec![metadata::download(
        &meta["downloads"]["client"],
        version_dir.join(format!("{}.jar", instance.version)),
        "Downloading Minecraft",
    )?];
    if instance.loader != crate::store::Loader::Vanilla {
        checkpoint(&core, &id, &job, None, "Loading mod loader metadata").await?;
        meta = match instance.loader {
            crate::store::Loader::Fabric => crate::fabric::prepare(&core.client, meta, &instance.version, &instance.loader_version).await?,
            crate::store::Loader::Quilt => crate::fabric::prepare_quilt(&core.client, meta, &instance.version, &instance.loader_version).await?,
            crate::store::Loader::Forge | crate::store::Loader::Neoforge => {
                fetch(&core.client, &files[0]).await?;
                crate::forge::prepare(&core, &instance, &job, meta).await?
            }
            crate::store::Loader::Vanilla => unreachable!(),
        };
    }
    let (libs, _, native_archives) = metadata::libraries(&meta, &core.store.root)?;
    files.extend(libs);
    let index = &meta["assetIndex"];
    let index_id = metadata::text(index, "id")?;
    valid_segment(index_id)?;
    let index_file = core
        .store
        .root
        .join("assets/indexes")
        .join(format!("{index_id}.json"));
    fetch(
        &core.client,
        &metadata::download(index, index_file.clone(), "Downloading asset index")?,
    )
    .await?;
    let assets: Value = serde_json::from_slice(&fs::read(index_file)?)?;
    for object in assets["objects"]
        .as_object()
        .context("Missing asset objects")?
        .values()
    {
        let hash = metadata::text(object, "hash")?;
        if hash.len() != 40 || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
            bail!("Invalid asset checksum");
        }
        let path = core
            .store
            .root
            .join("assets/objects")
            .join(&hash[..2])
            .join(hash);
        files.push(Download { size: object["size"].as_u64(),
            url: format!(
                "https://resources.download.minecraft.net/{}/{hash}",
                &hash[..2]
            ),
            hash: hash.into(),
            path,
            phase: "Downloading assets".into(),
        });
    }
    if let Some(logging) = meta.pointer("/logging/client/file") {
        files.push(metadata::download(
            logging,
            safe_join(
                &core.store.root.join("logging"),
                metadata::text(logging, "id")?,
            )?,
            "Downloading logging configuration",
        )?);
    }
    // A small fixed batch keeps downloads quick without a separate scheduler.
    let mut seen = std::collections::HashSet::new();
    files.retain(|file| seen.insert(file.path.clone()));
    for (n, batch) in files.chunks(8).enumerate() {
        checkpoint(
            &core,
            &id,
            &job,
            Some((n * 8) as f64 / files.len() as f64),
            &format!(
                "{} · {} / {} files verified",
                batch[0].phase,
                n * 8,
                files.len()
            ),
        )
        .await?;
        futures_util::future::try_join_all(batch.iter().map(|file| fetch(&core.client, file)))
            .await?;
    }
    checkpoint(&core, &id, &job, None, "Preparing native libraries").await?;
    let native_dir = core.store.dir(&id)?.join("natives");
    if native_dir.exists() {
        fs::remove_dir_all(&native_dir)?;
    }
    fs::create_dir_all(&native_dir)?;
    for archive in native_archives {
        extract_zip(&archive, &native_dir, true)?;
    }
    checkpoint(&core, &id, &job, None, "Preparing Java").await?;
    java(&core, &meta, &instance.java_path).await?;
    checkpoint(&core, &id, &job, None, "Finishing installation").await?;
    if instance.loader != crate::store::Loader::Vanilla {
        let directory = core.store.dir(&id)?;
        fs::create_dir_all(directory.join("game/mods"))?;
        let temp = directory.join("launch.json.tmp");
        fs::write(&temp, serde_json::to_vec_pretty(&meta)?)?;
        fs::rename(temp, directory.join("launch.json"))?;
    }
    core.store.installed(&id)?;
    Ok(())
}
pub fn extract_zip(archive: &Path, target: &Path, natives_only: bool) -> Result<()> {
    let mut zip = zip::ZipArchive::new(fs::File::open(archive)?)?;
    for n in 0..zip.len() {
        let mut item = zip.by_index(n)?;
        let path = item
            .enclosed_name()
            .context("Archive contains an unsafe path")?;
        if natives_only && (path.starts_with("META-INF") || item.is_dir()) {
            continue;
        }
        let output = target.join(path);
        if item.is_dir() {
            fs::create_dir_all(output)?;
            continue;
        }
        if item.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000) {
            bail!("Archive contains an unsupported symbolic link");
        }
        fs::create_dir_all(output.parent().context("Invalid archive path")?)?;
        let mut file = fs::File::create(&output)?;
        std::io::copy(&mut item, &mut file)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = item.unix_mode() {
                fs::set_permissions(&output, fs::Permissions::from_mode(mode & 0o777))?;
            }
        }
    }
    Ok(())
}
pub async fn java(core: &Core, meta: &Value, override_path: &str) -> Result<PathBuf> {
    let required = meta
        .pointer("/javaVersion/majorVersion")
        .and_then(Value::as_u64)
        .unwrap_or(17);
    if !override_path.trim().is_empty() {
        let path = PathBuf::from(override_path);
        check_java(&path, required).await?;
        return Ok(path);
    }
    let platform = match std::env::consts::OS {
        "macos" => "mac",
        other => other,
    };
    let architecture = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "x86" => "x32",
        other => other,
    };
    let destination = core
        .store
        .root
        .join("java")
        .join(format!("{required}-{platform}-{architecture}"));
    let marker = destination.join("executable.txt");
    if marker.exists() {
        let path = safe_join(&destination, fs::read_to_string(&marker)?.trim())?;
        if path.exists() {
            return Ok(path);
        }
    }
    let url=format!("https://api.adoptium.net/v3/assets/latest/{required}/hotspot?architecture={architecture}&image_type=jre&os={platform}");
    let packages: Value = core
        .client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let package = packages.pointer("/0/binary/package").context(
        "Automatic Java is unavailable for this system. Set a Java executable manually.",
    )?;
    let name = metadata::text(package, "name")?;
    valid_segment(name)?;
    let archive = core.store.root.join("java/downloads").join(name);
    fetch(
        &core.client,
        &Download { size: package["size"].as_u64(),
            url: metadata::text(package, "link")?.into(),
            hash: metadata::text(package, "checksum")?.into(),
            path: archive.clone(),
            phase: "Java".into(),
        },
    )
    .await?;
    fs::create_dir_all(&destination)?;
    if name.ends_with(".zip") {
        extract_zip(&archive, &destination, false)?;
    } else if name.ends_with(".tar.gz") {
        tar::Archive::new(flate2::read::GzDecoder::new(fs::File::open(archive)?))
            .unpack(&destination)?;
    } else {
        bail!("Unsupported Java archive");
    }
    let mut candidate = None;
    for entry in fs::read_dir(&destination)? {
        let p = entry?.path();
        for bin in [
            p.join(if cfg!(windows) {
                "bin/java.exe"
            } else {
                "bin/java"
            }),
            p.join("Contents/Home/bin/java"),
        ] {
            if bin.is_file() {
                candidate = Some(bin);
                break;
            }
        }
    }
    let path = candidate.context("Java executable was not found after extraction")?;
    check_java(&path, required).await?;
    fs::write(
        marker,
        path.strip_prefix(&destination)?
            .to_string_lossy()
            .replace('\\', "/"),
    )?;
    Ok(path)
}
async fn check_java(path: &Path, required: u64) -> Result<()> {
    let mut command=tokio::process::Command::new(path);
    command.arg("-version").kill_on_drop(true);
    let output=tokio::time::timeout(std::time::Duration::from_secs(10),command.output()).await
        .context("Java check timed out; check the executable path")?
        .context("Could not run Java; check the executable path")?;
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stderr),
        String::from_utf8_lossy(&output.stdout)
    );
    let capture = regex::Regex::new(r#"version "(\d+)(?:\.(\d+))?"#)?
        .captures(&text)
        .context("Could not determine Java version")?;
    let mut version = capture[1].parse::<u64>()?;
    if version == 1 {
        version = capture
            .get(2)
            .context("Invalid Java version")?
            .as_str()
            .parse()?;
    }
    if !output.status.success() || version != required {
        bail!("Minecraft needs Java {required}; selected executable reports Java {version}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    async fn server(responses: Vec<&'static str>) -> (String, tokio::task::JoinHandle<()>) {
        use tokio::io::AsyncReadExt;
        let listener=tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url=format!("http://{}/file",listener.local_addr().unwrap());
        let task=tokio::spawn(async move {
            for response in responses {
                let (mut socket,_)=listener.accept().await.unwrap();
                let mut request=vec![];
                while !request.ends_with(b"\r\n\r\n") {
                    let mut byte=[0];socket.read_exact(&mut byte).await.unwrap();request.push(byte[0]);
                    assert!(request.len()<8192);
                }
                socket.write_all(response.as_bytes()).await.unwrap();
                socket.shutdown().await.unwrap();
            }
        });
        (url,task)
    }
    #[tokio::test]
    async fn interrupted_and_unverified_downloads_preserve_destination_and_retry() {
        let (url,server)=server(vec![
            "HTTP/1.1 200 OK\r\nContent-Length: 10\r\nConnection: close\r\n\r\na",
            "HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\nbad",
            "HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            "HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\nabc",
        ]).await;
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("file.jar");fs::write(&path,b"existing").unwrap();
        let file=Download { size: None,url,hash:"a9993e364706816aba3e25717850c26c9cd0d89d".into(),path:path.clone(),phase:"Test".into()};
        let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(3)).build().unwrap();
        for _ in 0..3 {
            assert!(fetch(&client,&file).await.is_err());
            assert_eq!(fs::read(&path).unwrap(),b"existing");
            assert_eq!(fs::read_dir(dir.path()).unwrap().filter(|entry| entry.as_ref().unwrap().file_name() != ".chest-downloads.lock").count(),1,"failed transfers must remove their intermediates");
        }
        fetch(&client,&file).await.unwrap();assert_eq!(fs::read(&path).unwrap(),b"abc");
        server.await.unwrap();
        // No server remains: a verified cache hit must work entirely offline.
        fetch(&client,&file).await.unwrap();
    }
    #[tokio::test]
    async fn filesystem_failure_does_not_publish_download() {
        let (url,server)=server(vec!["HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\nabc"]).await;
        let dir=tempfile::tempdir().unwrap();let parent=dir.path().join("blocked");fs::write(&parent,b"keep").unwrap();
        let file=Download { size: None,url,hash:"a9993e364706816aba3e25717850c26c9cd0d89d".into(),path:parent.join("file.jar"),phase:"Test".into()};
        assert!(fetch(&reqwest::Client::new(),&file).await.is_err());assert_eq!(fs::read(parent).unwrap(),b"keep");
        assert!(!file.path.exists());server.abort();
    }
    #[cfg(unix)]
    #[tokio::test]
    async fn manual_java_rejects_missing_unexecutable_and_wrong_versions() {
        use std::os::unix::fs::PermissionsExt;
        let dir=tempfile::tempdir().unwrap();let java=dir.path().join("java");
        assert!(check_java(&java,21).await.is_err());
        fs::write(&java,b"#!/bin/sh\necho 'java version \"1.8.0\"' >&2\n").unwrap();
        fs::set_permissions(&java,fs::Permissions::from_mode(0o600)).unwrap();assert!(check_java(&java,21).await.is_err());
        fs::set_permissions(&java,fs::Permissions::from_mode(0o700)).unwrap();
        assert!(check_java(&java,21).await.unwrap_err().to_string().contains("needs Java 21"));
        check_java(&java,8).await.unwrap();
    }
    #[test]
    fn verifies_hashes() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("file");
        fs::write(&p, b"abc").unwrap();
        assert_eq!(
            hash_file(&p, false).unwrap(),
            "a9993e364706816aba3e25717850c26c9cd0d89d"
        );
        assert_eq!(
            hash_file(&p, true).unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
    #[test]
    fn rejects_zip_escape() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("bad.zip");
        let mut z = zip::ZipWriter::new(fs::File::create(&p).unwrap());
        z.start_file("../escaped", zip::write::SimpleFileOptions::default())
            .unwrap();
        z.write_all(b"bad").unwrap();
        z.finish().unwrap();
        assert!(extract_zip(&p, &d.path().join("out"), false).is_err());
        assert!(!d.path().join("escaped").exists());
    }
}
