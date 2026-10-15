//! Forge-family installers own their processors. Chest stages their output and
//! feeds the resulting profile to the same launcher used for other loaders.
use crate::{
    install, loaders, metadata,
    store::{safe_join, valid_segment, Instance, Loader},
    Core, Job,
};
use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::Stdio,
    sync::atomic::Ordering,
};

const FORGE: &str = "https://maven.minecraftforge.net";
const NEO: &str = "https://maven.neoforged.net/releases";

pub async fn versions(client: &reqwest::Client, game: &str, loader: Loader) -> Result<Vec<String>> {
    valid_segment(game)?;
    if !metadata::supported_release(game) {
        return Ok(vec![]);
    }
    let mut versions = match loader {
        Loader::Forge => {
            let xml = client
                .get(format!(
                    "{FORGE}/net/minecraftforge/forge/maven-metadata.xml"
                ))
                .send()
                .await?
                .error_for_status()?
                .text()
                .await?;
            forge_versions(&xml, game)
        }
        Loader::Neoforge => {
            let Some(prefix) = neo_prefix(game) else {
                return Ok(vec![]);
            };
            let data: Value = client.get("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge")
                .send().await?.error_for_status()?.json().await?;
            data["versions"]
                .as_array()
                .context("Missing NeoForge versions")?
                .iter()
                .filter_map(Value::as_str)
                .filter(|v| v.starts_with(&prefix) && !v.contains('-'))
                .map(str::to_owned)
                .collect()
        }
        _ => bail!("Not a Forge-family loader"),
    };
    versions.retain(|v| valid_segment(v).is_ok());
    versions.sort_by_cached_key(|v| {
        std::cmp::Reverse(
            v.split('.')
                .map(|p| p.parse::<u32>().unwrap_or(0))
                .collect::<Vec<_>>(),
        )
    });
    versions.dedup();
    Ok(versions)
}

fn forge_versions(xml: &str, game: &str) -> Vec<String> {
    let prefix = format!("{game}-");
    xml.split("<version>")
        .skip(1)
        .filter_map(|part| part.split_once("</version>"))
        .filter_map(|(v, _)| v.strip_prefix(&prefix))
        .filter(|v| !v.contains('-'))
        .map(str::to_owned)
        .collect()
}

// NeoForge's stable version scheme encodes Minecraft's minor and patch numbers.
// The old 1.20.1 fork and snapshot/year-based schemes are deliberately excluded.
fn neo_prefix(game: &str) -> Option<String> {
    let parts = game
        .split('.')
        .map(str::parse::<u32>)
        .collect::<std::result::Result<Vec<_>, _>>()
        .ok()?;
    if parts.first() != Some(&1) || !(parts.len() == 2 || parts.len() == 3) {
        return None;
    }
    let minor = parts[1];
    let patch = parts.get(2).copied().unwrap_or(0);
    if !(20..=21).contains(&minor) || (minor == 20 && patch < 2) {
        return None;
    }
    Some(format!("{minor}.{patch}."))
}

pub(crate) fn validate_version(game: &str, version: &str, loader: Loader) -> Result<()> {
    valid_segment(game)?;
    valid_segment(version)?;
    if !metadata::supported_release(game) {
        bail!("Forge requires Minecraft 1.19 or newer");
    }
    if !version
        .split('.')
        .all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
    {
        bail!("Choose a stable numeric loader version");
    }
    if loader == Loader::Neoforge {
        let prefix = neo_prefix(game)
            .context("NeoForge supports stable Minecraft 1.20.2–1.21.x releases")?;
        if !version.starts_with(&prefix) {
            bail!("NeoForge version does not match this Minecraft release");
        }
    }
    Ok(())
}

fn installer_url(instance: &Instance) -> Result<String> {
    validate_version(&instance.version, &instance.loader_version, instance.loader)?;
    Ok(match instance.loader {
        Loader::Forge => {
            let version = format!("{}-{}", instance.version, instance.loader_version);
            format!("{FORGE}/net/minecraftforge/forge/{version}/forge-{version}-installer.jar")
        }
        Loader::Neoforge => {
            let version = &instance.loader_version;
            format!("{NEO}/net/neoforged/neoforge/{version}/neoforge-{version}-installer.jar")
        }
        _ => bail!("Not a Forge-family loader"),
    })
}

fn archive_json(archive: &mut zip::ZipArchive<fs::File>, name: &str) -> Result<Value> {
    let file = archive.by_name(name)?;
    if file.size() > 4 * 1024 * 1024 {
        bail!("Installer metadata exceeds limit");
    }
    let mut bytes = Vec::new();
    file.take(4 * 1024 * 1024 + 1).read_to_end(&mut bytes)?;
    if bytes.len() > 4 * 1024 * 1024 {
        bail!("Installer metadata exceeds limit");
    }
    Ok(serde_json::from_slice(&bytes)?)
}

fn validate_profile(profile: &Value, installer: &Value, instance: &Instance) -> Result<()> {
    let expected =
        loaders::profile_id(&instance.version, &instance.loader_version, instance.loader);
    if profile["id"] != expected
        || profile["inheritsFrom"] != instance.version
        || installer["minecraft"] != instance.version
        || installer["version"] != expected
        || installer["spec"] != 1
    {
        bail!("Installer does not match the selected Minecraft and loader versions");
    }
    metadata::text(profile, "mainClass")?;
    Ok(())
}

struct WorkDir(PathBuf);
impl Drop for WorkDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

pub async fn prepare(core: &Core, instance: &Instance, job: &Job, base: Value) -> Result<Value> {
    let id = &instance.id;
    install::checkpoint(core, id, job, None, "Downloading mod loader installer").await?;
    let url = installer_url(instance)?;
    let hash = core
        .client
        .get(format!("{url}.sha1"))
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;
    let hash = hash.trim().to_ascii_lowercase();
    let path = core.store.root.join("installers").join(format!(
        "{}.jar",
        loaders::profile_id(&instance.version, &instance.loader_version, instance.loader)
    ));
    install::fetch(
        &core.client,
        &metadata::Download {
            url,
            hash,
            path: path.clone(),
            phase: "Mod loader installer".into(),
        },
    )
    .await?;
    let (installer, profile) = {
        let mut zip = zip::ZipArchive::new(fs::File::open(&path)?)?;
        (
            archive_json(&mut zip, "install_profile.json")?,
            archive_json(&mut zip, "version.json")?,
        )
    };
    validate_profile(&profile, &installer, instance)?;
    install::checkpoint(
        core,
        id,
        job,
        None,
        "Preparing Java for mod loader installation",
    )
    .await?;
    let java = install::java(core, &base, &instance.java_path).await?;
    let work = WorkDir(
        core.store
            .root
            .join("installers")
            .join(format!("work-{}", uuid::Uuid::new_v4())),
    );
    fs::create_dir_all(&work.0)?;
    fs::write(work.0.join("launcher_profiles.json"), b"{\"profiles\":{}}")?;
    let game_dir = metadata::version_dir(&core.store.root, &instance.version)?;
    let target = metadata::version_dir(&work.0, &instance.version)?;
    fs::create_dir_all(&target)?;
    for extension in ["jar", "json"] {
        let name = format!("{}.{}", instance.version, extension);
        fs::copy(game_dir.join(&name), target.join(&name))?;
    }
    // Seed only the installer's declared libraries; copying the whole global
    // cache would make installation slower as the user's library grows.
    for lib in installer["libraries"]
        .as_array()
        .context("Missing installer libraries")?
        .iter()
        .chain(
            profile["libraries"]
                .as_array()
                .context("Missing loader libraries")?,
        )
    {
        if let Some(relative) = lib
            .pointer("/downloads/artifact/path")
            .and_then(Value::as_str)
        {
            let source = safe_join(&core.store.root.join("libraries"), relative)?;
            if source.is_file() {
                let destination = safe_join(&work.0.join("libraries"), relative)?;
                fs::create_dir_all(destination.parent().context("Invalid library path")?)?;
                fs::copy(source, destination)?;
            }
        }
    }
    install::checkpoint(
        core,
        id,
        job,
        None,
        "Installing mod loader · pause applies after processing",
    )
    .await?;
    let log = fs::File::create(work.0.join("installer-output.log"))?;
    let mut command = tokio::process::Command::new(java);
    command
        .arg("-Djava.awt.headless=true")
        .arg("-jar")
        .arg(&path)
        .arg("--installClient")
        .arg(&work.0)
        .current_dir(&work.0)
        .stdin(Stdio::null())
        .stdout(log.try_clone()?)
        .stderr(log)
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    let mut child = command
        .spawn()
        .context("Could not start the modloader installer")?;
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(1200);
    let status = loop {
        if job.cancel.load(Ordering::Relaxed) || tokio::time::Instant::now() >= deadline {
            child.kill().await?;
            child.wait().await?;
            bail!(if job.cancel.load(Ordering::Relaxed) {
                "Operation cancelled"
            } else {
                "Modloader installation timed out"
            });
        }
        if let Some(status) = child.try_wait()? {
            break status;
        }
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    };
    if !status.success() {
        // Stream a bounded tail into Chest's existing copyable instance log.
        let log_path = work.0.join("installer-output.log");
        let mut file = fs::File::open(log_path)?;
        use std::io::{Seek, SeekFrom};
        file.seek(SeekFrom::End(-(file.metadata()?.len().min(16384) as i64)))?;
        let mut tail = String::new();
        file.read_to_string(&mut tail)?;
        for line in tail.lines() {
            core.log(id, line);
        }
        bail!("Modloader installation failed; see Log for installer output");
    }
    install::checkpoint(core, id, job, None, "Verifying mod loader installation").await?;
    let expected =
        loaders::profile_id(&instance.version, &instance.loader_version, instance.loader);
    let output = metadata::version_dir(&work.0, &expected)?.join(format!("{expected}.json"));
    let profile: Value = serde_json::from_slice(&fs::read(output)?)?;
    validate_profile(&profile, &installer, instance)?;
    // Check published runtime artifacts before exposing any new launch profile.
    let (downloads, _, _) = metadata::libraries(&profile, &work.0)?;
    for file in downloads {
        if install::hash_file(&file.path, false)? != file.hash {
            bail!("Modloader library verification failed");
        }
    }
    let libraries = work.0.join("libraries");
    let mut generated = vec![];
    publish_libraries(
        &libraries,
        &libraries,
        &core.store.root.join("libraries"),
        &mut generated,
    )?;
    let mut merged = loaders::merge(base, &profile, &instance.version, &expected)?;
    adapt_client_jar(&mut merged, &instance.version)?;
    fix_macos_jna(&mut merged, metadata::os())?;
    // Generated patched Minecraft artifacts aren't necessarily on the classpath;
    // loaders resolve them by Maven coordinate at runtime. Track them as well.
    merged["chestLoaderFiles"] = json!(generated);
    Ok(merged)
}

fn adapt_client_jar(profile: &mut Value, game: &str) -> Result<()> {
    // Official Launcher names the inherited client JAR after the child profile.
    // Chest keeps the shared vanilla JAR's original name. Forge must ignore that
    // JAR as well, otherwise its patched Minecraft module exports collide.
    for argument in profile["arguments"]["jvm"]
        .as_array_mut()
        .context("Missing JVM arguments")?
    {
        if let Some(value) = argument.as_str().filter(|s| s.starts_with("-DignoreList=")) {
            *argument = json!(format!("{value},{game}.jar"));
        }
    }
    Ok(())
}

fn fix_macos_jna(profile: &mut Value, platform: &str) -> Result<()> {
    if platform != "osx" {
        return Ok(());
    }
    // JNA <5.13 can abort on macOS while reporting a long native-library lookup
    // error (java-native-access/jna#1452). These are Mojang's 1.20.2 artifacts.
    for (artifact, hash) in [
        ("jna", "1200e7ebeedbe0d10062093f32925a912020e747"),
        ("jna-platform", "88e9a306715e9379f3122415ef4ae759a352640d"),
    ] {
        let prefix = format!("net.java.dev.jna:{artifact}:");
        let mut replaced = vec![];
        for library in profile["libraries"]
            .as_array_mut()
            .context("Missing libraries")?
        {
            let Some(version) = library["name"]
                .as_str()
                .and_then(|name| name.strip_prefix(&prefix))
            else {
                continue;
            };
            let parts = version
                .split('.')
                .map(str::parse::<u32>)
                .collect::<std::result::Result<Vec<_>, _>>()?;
            if parts.as_slice() >= [5, 13, 0].as_slice() {
                continue;
            }
            let old_jar = format!("{artifact}-{version}.jar");
            let path = format!("net/java/dev/jna/{artifact}/5.13.0/{artifact}-5.13.0.jar");
            *library = json!({"name":format!("{prefix}5.13.0"),"downloads":{"artifact":{"path":path,"url":format!("https://libraries.minecraft.net/{path}"),"sha1":hash}}});
            replaced.push(old_jar);
        }
        for old_jar in replaced {
            for arg in profile["arguments"]["jvm"]
                .as_array_mut()
                .context("Missing JVM arguments")?
            {
                if let Some(value) = arg.as_str().filter(|v| v.starts_with("-DmergeModules=")) {
                    *arg = json!(value.replace(&old_jar, &format!("{artifact}-5.13.0.jar")));
                }
            }
        }
    }
    Ok(())
}

fn publish_libraries(
    source: &Path,
    base: &Path,
    target: &Path,
    files: &mut Vec<String>,
) -> Result<()> {
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let kind = entry.file_type()?;
        if kind.is_symlink() {
            bail!("Installer produced an unsupported symbolic link");
        }
        if kind.is_dir() {
            publish_libraries(&entry.path(), base, target, files)?;
        } else if kind.is_file() {
            let relative = entry
                .path()
                .strip_prefix(base)?
                .to_string_lossy()
                .replace('\\', "/");
            let destination = safe_join(target, &relative)?;
            let hash = install::hash_file(&entry.path(), false)?;
            if !destination.is_file() || install::hash_file(&destination, false)? != hash {
                fs::create_dir_all(destination.parent().context("Invalid library path")?)?;
                let temp = destination.with_extension("chest-install");
                fs::copy(entry.path(), &temp)?;
                fs::rename(temp, &destination)?;
            }
            files.push(relative);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn versions_match_exact_game_and_sort_numerically() {
        assert_eq!(forge_versions("<version>1.20.1-47.4.0</version><version>1.20-46.0.1</version><version>1.20.1-47.3.9</version>", "1.20.1"), vec!["47.4.0", "47.3.9"]);
        assert_eq!(neo_prefix("1.21.1").as_deref(), Some("21.1."));
        assert_eq!(neo_prefix("1.21").as_deref(), Some("21.0."));
        for game in ["1.20.1", "1.19.4", "26.1", "../1.21", "1.21.1.2"] {
            assert!(neo_prefix(game).is_none());
        }
        assert!(validate_version("1.21.1", "21.2.100", Loader::Neoforge).is_err());
        assert!(validate_version("1.21.1", "21.1.100-beta", Loader::Neoforge).is_err());
        assert!(validate_version("1.21.1", "../installer", Loader::Forge).is_err());
    }
    #[test]
    fn profile_requires_exact_loader_and_game() {
        let temp = tempfile::tempdir().unwrap();
        let store = crate::store::Store::new(temp.path().into()).unwrap();
        let instance = store
            .create_with_loader(
                "Neo".into(),
                "1.21.1".into(),
                "grass".into(),
                Loader::Neoforge,
                "21.1.172".into(),
            )
            .unwrap();
        let mut profile = json!({"id":"neoforge-21.1.172","inheritsFrom":"1.21.1","mainClass":"cpw.mods.bootstraplauncher.BootstrapLauncher"});
        let installer = json!({"spec":1,"minecraft":"1.21.1","version":"neoforge-21.1.172"});
        assert!(validate_profile(&profile, &installer, &instance).is_ok());
        profile["inheritsFrom"] = json!("1.21.2");
        assert!(validate_profile(&profile, &installer, &instance).is_err());
        assert!(installer_url(&instance).unwrap().starts_with(NEO));
    }
    #[test]
    fn library_publication_is_repeatable() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("source");
        let target = temp.path().join("target");
        fs::create_dir_all(source.join("net/example")).unwrap();
        fs::write(source.join("net/example/client.jar"), b"patched").unwrap();
        for _ in 0..2 {
            let mut files = vec![];
            publish_libraries(&source, &source, &target, &mut files).unwrap();
            assert_eq!(files, vec!["net/example/client.jar"]);
            assert_eq!(fs::read(target.join(&files[0])).unwrap(), b"patched");
        }
    }

    #[test]
    fn shared_vanilla_jar_is_excluded_from_the_patched_module_scan() {
        let mut profile = json!({"arguments":{"jvm":["-DignoreList=client-extra,${version_name}.jar","-DlibraryDirectory=${library_directory}"]}});
        adapt_client_jar(&mut profile, "1.21.1").unwrap();
        assert_eq!(
            profile["arguments"]["jvm"][0],
            "-DignoreList=client-extra,${version_name}.jar,1.21.1.jar"
        );
        assert_eq!(
            profile["arguments"]["jvm"][1],
            "-DlibraryDirectory=${library_directory}"
        );
    }

    #[test]
    fn old_jna_is_replaced_only_on_macos_with_matching_module_names() {
        let original = json!({"libraries":[{"name":"net.java.dev.jna:jna:5.10.0"},{"name":"net.java.dev.jna:jna-platform:5.10.0"},{"name":"net.java.dev.jna:jna:5.17.0"}],
            "arguments":{"jvm":["-DmergeModules=jna-5.10.0.jar,jna-platform-5.10.0.jar"]}});
        let mut windows = original.clone();
        fix_macos_jna(&mut windows, "windows").unwrap();
        assert_eq!(windows, original);
        let mut mac = original;
        fix_macos_jna(&mut mac, "osx").unwrap();
        assert_eq!(mac["libraries"][0]["name"], "net.java.dev.jna:jna:5.13.0");
        assert_eq!(
            mac["libraries"][1]["name"],
            "net.java.dev.jna:jna-platform:5.13.0"
        );
        assert_eq!(mac["libraries"][2]["name"], "net.java.dev.jna:jna:5.17.0");
        assert_eq!(
            mac["arguments"]["jvm"][0],
            "-DmergeModules=jna-5.13.0.jar,jna-platform-5.13.0.jar"
        );
    }

    #[cfg(unix)]
    #[test]
    fn installer_output_cannot_publish_symbolic_links() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("source");
        fs::create_dir(&source).unwrap();
        fs::write(temp.path().join("outside.jar"), b"outside").unwrap();
        std::os::unix::fs::symlink(temp.path().join("outside.jar"), source.join("escape.jar"))
            .unwrap();
        assert!(
            publish_libraries(&source, &source, &temp.path().join("target"), &mut vec![]).is_err()
        );
        assert!(!temp.path().join("target/escape.jar").exists());
    }
}
