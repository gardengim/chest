//! Import provider packs into a private directory, publishing only complete game data.
use crate::{
    catalog::{self, Kind, Release, Source},
    metadata::Download,
    store::{self, Instance, Loader},
    Activity, Core, Job,
};
use anyhow::{bail, Context, Result};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::Arc,
};
use tokio::io::AsyncWriteExt;

const FILE_LIMIT: u64 = 512 * 1024 * 1024;
const TOTAL_LIMIT: u64 = 8 * 1024 * 1024 * 1024;
fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str> {
    v[key]
        .as_str()
        .with_context(|| format!("Missing pack field: {key}"))
}
fn allowed_url(raw: &str) -> Result<()> {
    let u = url::Url::parse(raw)?;
    if u.scheme() != "https"
        || !u.username().is_empty()
        || u.password().is_some()
        || u.port().is_some_and(|p| p != 443)
        || !matches!(
            u.host_str(),
            Some(
                "cdn.modrinth.com"
                    | "media.forgecdn.net"
                    | "edge.forgecdn.net"
                    | "mediafilez.forgecdn.net"
                    | "github.com"
                    | "raw.githubusercontent.com"
                    | "objects.githubusercontent.com"
                    | "release-assets.githubusercontent.com"
                    | "gitlab.com"
            )
        )
    {
        bail!("Unsupported modpack download host");
    }
    Ok(())
}
fn pack_client() -> Result<reqwest::Client> {
    Ok(reqwest::Client::builder()
        .user_agent("Chest/0.1.0")
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(300))
        .redirect(reqwest::redirect::Policy::custom(|a| {
            if a.previous().len() >= 5 || allowed_url(a.url().as_str()).is_err() {
                a.error("Unsupported modpack redirect")
            } else {
                a.follow()
            }
        }))
        .build()?)
}
pub(crate) async fn project_info(client: &reqwest::Client, source: Source, project: &str) -> Result<Value> {
    store::valid_segment(project)?;
    let p: Value = match source {
        Source::Modrinth => {
            client
                .get(format!("https://api.modrinth.com/v2/project/{project}"))
                .send()
                .await?
                .error_for_status()?
                .json()
                .await?
        }
        Source::Curseforge => {
            catalog::cf(client, &format!("mods/{project}"), &[]).await?["data"].clone()
        }
    };
    let valid = match source {
        Source::Modrinth => p["project_type"] == "modpack",
        Source::Curseforge => p["classId"] == 4471 && p["gameId"] == 432,
    };
    if !valid {
        bail!("Selected project is not a Minecraft modpack");
    }
    Ok(p)
}
// Gallery images use the same provider CDNs permitted by the desktop image policy.
pub(crate) fn gallery_url(raw: &str) -> bool {
    url::Url::parse(raw).is_ok_and(|url| {
        url.scheme() == "https"
            && url.username().is_empty()
            && url.password().is_none()
            && url.port().is_none_or(|port| port == 443)
            && matches!(
                url.host_str(),
                Some("cdn.modrinth.com" | "media.forgecdn.net" | "mediafilez.forgecdn.net")
            )
    })
}
fn gallery(source: Source, info: &Value) -> Vec<String> {
    let key = if source == Source::Modrinth {
        "gallery"
    } else {
        "screenshots"
    };
    let mut images: Vec<_> = info[key].as_array().into_iter().flatten().collect();
    if source == Source::Modrinth {
        images.sort_by_key(|image| {
            (
                !image["featured"].as_bool().unwrap_or(false),
                image["ordering"].as_i64().unwrap_or(0),
                image["title"].as_str().unwrap_or_default(),
            )
        });
    }
    let mut urls = vec![];
    for image in images {
        if let Some(url) = image["url"].as_str().filter(|url| gallery_url(url)) {
            if !urls.iter().any(|existing| existing == url) {
                urls.push(url.to_owned());
            }
        }
        if urls.len() == 4 {
            break;
        }
    }
    urls
}
// Local metadata reads belong on the blocking pool; fetching older pack
// receipts' galleries remains asynchronous below.
fn gallery_metadata(directory: PathBuf) -> Result<Option<Value>> {
    let root = directory.canonicalize()?;
    for name in ["game/.chest-modpack.json", REQUEST_FILE] {
        let Ok(path) = root.join(name).canonicalize() else { continue; };
        if !path.starts_with(&root) { continue; }
        let file = fs::File::open(path)?;
        let mut bytes = vec![];
        file.take(1024 * 1024 + 1).read_to_end(&mut bytes)?;
        if bytes.len() > 1024 * 1024 { bail!("Modpack metadata exceeds limit"); }
        return Ok(Some(serde_json::from_slice(&bytes)?));
    }
    Ok(None)
}
impl Core {
    pub(crate) async fn provider_backgrounds(&self, id: &str) -> Result<Vec<String>> {
        self.store.instance(id)?;
        let directory = self.store.dir(id)?;
        let Some(metadata) = tokio::task::spawn_blocking(move || gallery_metadata(directory)).await?? else {
            return Ok(vec![]);
        };
        if let Some(images) = metadata["gallery"].as_array() {
            let mut urls = vec![];
            for url in images.iter().filter_map(Value::as_str).filter(|url| gallery_url(url)) {
                if !urls.iter().any(|existing| existing == url) { urls.push(url.to_owned()); }
                if urls.len() == 4 { break; }
            }
            return Ok(urls);
        }
        let source: Source = serde_json::from_value(metadata["source"].clone())?;
        let project = text(&metadata, "project")?;
        // Existing packs already contain their source identity in the receipt.
        let info = tokio::time::timeout(
            std::time::Duration::from_secs(15),
            project_info(&self.client, source, project),
        ).await??;
        Ok(gallery(source, &info))
    }
}

pub async fn releases(
    client: &reqwest::Client,
    source: Source,
    project: &str,
    game: &str,
    loader: &str,
) -> Result<Vec<Release>> {
    project_info(client, source, project).await?;
    if !game.is_empty() {
        store::valid_segment(game)?;
    }
    if !["", "fabric", "quilt", "forge", "neoforge"].contains(&loader) {
        bail!("Unknown loader filter");
    }
    let values: Vec<Value> = match source {
        Source::Modrinth => {
            let mut params = vec![];
            if !game.is_empty() {
                params.push(("game_versions", json!([game]).to_string()));
            }
            if !loader.is_empty() {
                params.push(("loaders", json!([loader]).to_string()));
            }
            client
                .get(format!(
                    "https://api.modrinth.com/v2/project/{project}/version"
                ))
                .query(&params)
                .send()
                .await?
                .error_for_status()?
                .json()
                .await?
        }
        Source::Curseforge => {
            let mut params = vec![("pageSize", "50".into())];
            if !game.is_empty() {
                params.push(("gameVersion", game.into()));
            }
            if !loader.is_empty() {
                params.push((
                    "modLoaderType",
                    match loader {
                        "fabric" => "4",
                        "quilt" => "5",
                        "forge" => "1",
                        _ => "6",
                    }
                    .into(),
                ));
            }
            catalog::cf(client, &format!("mods/{project}/files"), &params).await?["data"]
                .as_array()
                .context("Invalid pack releases")?
                .clone()
        }
    };
    values
        .iter()
        .map(|v| {
            Ok(match source {
                Source::Modrinth => Release {
                    id: text(v, "id")?.into(),
                    name: text(v, "name")?.into(),
                    published: text(v, "date_published")?.into(),
                },
                Source::Curseforge => Release {
                    id: v["id"].as_u64().context("Invalid release ID")?.to_string(),
                    name: text(v, "displayName")?.into(),
                    published: text(v, "fileDate")?.into(),
                },
            })
        })
        .collect()
}
async fn download(client: &reqwest::Client, file: &Download, total: &mut u64) -> Result<()> {
    allowed_url(&file.url)?;
    if file.hash.len() != 40 || !file.hash.chars().all(|c| c.is_ascii_hexdigit()) {
        bail!("Missing or invalid pack file SHA-1");
    }
    fs::create_dir_all(file.path.parent().context("Invalid destination")?)?;
    let response = client.get(&file.url).send().await?.error_for_status()?;
    if response.content_length().is_some_and(|n| n > FILE_LIMIT) {
        bail!("Pack file exceeds 512 MB limit");
    }
    let mut stream = response.bytes_stream();
    let mut output = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&file.path)
        .await?;
    let mut size = 0;
    while let Some(bytes) = stream.next().await {
        let bytes = bytes?;
        size += bytes.len() as u64;
        *total += bytes.len() as u64;
        if size > FILE_LIMIT || *total > TOTAL_LIMIT {
            bail!("Pack exceeds download size limits");
        }
        output.write_all(&bytes).await?;
    }
    output.flush().await?;
    drop(output);
    if crate::install::hash_file(&file.path, false)? != file.hash.to_ascii_lowercase() {
        bail!("Modpack file verification failed");
    }
    Ok(())
}
fn game_path(game: &Path, relative: &str) -> Result<PathBuf> {
    if relative.is_empty() || relative.len() > 1024 {
        bail!("Invalid pack path");
    }
    store::safe_join(game, relative)
}
fn loader(deps: &Value) -> Result<(String, Loader, String)> {
    let deps = deps.as_object().context("Missing pack dependencies")?;
    let game = deps
        .get("minecraft")
        .and_then(Value::as_str)
        .context("Missing Minecraft version")?
        .to_owned();
    store::valid_segment(&game)?;
    // Chest currently supports Mojang's releases starting with 1.19.
    if game.starts_with("1.")
        && game
            .split('.')
            .nth(1)
            .and_then(|n| n.parse::<u32>().ok())
            .is_none_or(|n| n < 19)
    {
        bail!("This pack requires Minecraft older than 1.19, which Chest does not support yet");
    }
    let mut selected = (Loader::Vanilla, String::new());
    for (key, value) in deps {
        if key == "minecraft" {
            continue;
        }
        let kind = match key.as_str() {
            "fabric-loader" => Loader::Fabric,
            "quilt-loader" => Loader::Quilt,
            "forge" => Loader::Forge,
            "neoforge" => Loader::Neoforge,
            _ => bail!("Unsupported pack dependency: {key}"),
        };
        if selected.0 != Loader::Vanilla {
            bail!("Pack has conflicting loaders");
        }
        let version = value.as_str().context("Invalid loader version")?.to_owned();
        store::valid_segment(&version)?;
        if matches!(kind, Loader::Forge | Loader::Neoforge) {
            crate::forge::validate_version(&game, &version, kind)?;
        }
        selected = (kind, version);
    }
    Ok((game, selected.0, selected.1))
}
fn manifest(archive: &mut zip::ZipArchive<fs::File>, source: Source) -> Result<Value> {
    let name = match source {
        Source::Modrinth => "modrinth.index.json",
        Source::Curseforge => "manifest.json",
    };
    let file = archive.by_name(name)?;
    if file.size() > 4 * 1024 * 1024 {
        bail!("Pack manifest exceeds limit");
    }
    let mut data = vec![];
    file.take(4 * 1024 * 1024 + 1).read_to_end(&mut data)?;
    if data.len() > 4 * 1024 * 1024 {
        bail!("Pack manifest exceeds limit");
    }
    let m: Value = serde_json::from_slice(&data)?;
    match source {
        Source::Modrinth if m["formatVersion"] != 1 || m["game"] != "minecraft" => {
            bail!("Unsupported Modrinth pack format")
        }
        Source::Curseforge
            if m["manifestVersion"] != 1 || m["manifestType"] != "minecraftModpack" =>
        {
            bail!("Unsupported CurseForge pack format")
        }
        _ => {}
    }
    Ok(m)
}
fn dependencies(m: &Value, source: Source) -> Result<Value> {
    if source == Source::Modrinth {
        return Ok(m["dependencies"].clone());
    }
    let mut d = json!({"minecraft":text(&m["minecraft"],"version")?});
    let loaders = m["minecraft"]["modLoaders"]
        .as_array()
        .context("Missing pack loaders")?;
    if loaders.len() > 1 {
        bail!("Pack has conflicting loaders");
    }
    for l in loaders {
        let id = text(l, "id")?;
        let (kind, version) = id.split_once('-').context("Invalid pack loader")?;
        let key = match kind {
            "fabric" => "fabric-loader",
            "quilt" => "quilt-loader",
            other => other,
        };
        d[key] = json!(version);
    }
    Ok(d)
}
fn extract(
    archive: &mut zip::ZipArchive<fs::File>,
    game: &Path,
    layers: &[&str],
    total: &mut u64,
) -> Result<()> {
    if archive.len() > 20000 {
        bail!("Too many files in modpack");
    }
    for layer in layers {
        store::valid_segment(layer)?;
        let prefix = format!("{layer}/");
        let mut seen = HashSet::new();
        for n in 0..archive.len() {
            let mut f = archive.by_index(n)?;
            // Reject unsafe entries, including entries outside the selected client layers.
            if f.enclosed_name().is_none()
                || f.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000)
            {
                bail!("Unsafe archive entry");
            }
            let Some(relative) = f.name().strip_prefix(&prefix) else {
                continue;
            };
            if relative.is_empty() {
                continue;
            }
            let path = game_path(game, relative.trim_end_matches('/'))?;
            if !seen.insert(path.clone()) {
                bail!("Duplicate archive path");
            }
            *total = total.checked_add(f.size()).context("Pack size overflow")?;
            if f.size() > FILE_LIMIT || *total > TOTAL_LIMIT {
                bail!("Pack exceeds extraction limits");
            }
            if f.is_dir() {
                fs::create_dir_all(path)?;
                continue;
            }
            fs::create_dir_all(path.parent().context("Invalid archive path")?)?;
            let mut out = fs::File::create(path)?;
            let written = std::io::copy(&mut (&mut f).take(FILE_LIMIT + 1), &mut out)?;
            if written != f.size() {
                bail!("Invalid archive entry size");
            }
        }
    }
    Ok(())
}
async fn files(
    core: &Core,
    client: &reqwest::Client,
    m: &Value,
    source: Source,
    game: &Path,
    total: &mut u64,
    operation: (&str, &Job),
) -> Result<()> {
    let (id, job) = operation;
    let list = m["files"].as_array().context("Missing pack files")?;
    if list.len() > 2000 {
        bail!("Too many pack downloads");
    }
    for (index, f) in list.iter().enumerate() {
        crate::install::checkpoint(
            core,
            id,
            job,
            Some(index as f64 / list.len().max(1) as f64),
            &format!("Preparing modpack files · {}/{}", index + 1, list.len()),
        )
        .await?;
        let file = match source {
            Source::Modrinth => {
                match f["env"]["client"].as_str() {
                    Some("unsupported" | "optional") => continue,
                    Some("required") | None => {}
                    _ => bail!("Invalid client environment"),
                }
                let path = game_path(game, text(f, "path")?)?;
                let url = f["downloads"]
                    .as_array()
                    .and_then(|a| {
                        a.iter()
                            .filter_map(Value::as_str)
                            .find(|u| allowed_url(u).is_ok())
                    })
                    .context("No supported download URL for pack file")?;
                Download {
                    phase: "Installing modpack".into(),
                    path,
                    url: url.into(),
                    hash: text(&f["hashes"], "sha1")?.into(),
                }
            }
            Source::Curseforge => {
                if f["required"] == false {
                    continue;
                }
                let project = f["projectID"].as_u64().context("Invalid project ID")?;
                let id = f["fileID"].as_u64().context("Invalid file ID")?;
                let p = catalog::cf(&core.client, &format!("mods/{project}"), &[]).await?["data"]
                    .clone();
                let kind = match p["classId"].as_u64() {
                    Some(6) => Kind::Mod,
                    Some(12) => Kind::Resourcepack,
                    Some(6552) => Kind::Shader,
                    _ => bail!("Unsupported pack content type"),
                };
                if p["gameId"] != 432 {
                    bail!("Pack file is not Minecraft content");
                }
                let v = catalog::cf(&core.client, &format!("mods/{project}/files/{id}"), &[])
                    .await?["data"]
                    .clone();
                if v["modId"].as_u64() != Some(project) {
                    bail!("Pack file project mismatch");
                }
                let file = catalog::file(source, &project.to_string(), &v, kind)?;
                let folder = match kind {
                    Kind::Mod => "mods",
                    Kind::Resourcepack => "resourcepacks",
                    _ => "shaderpacks",
                };
                Download {
                    phase: "Installing modpack".into(),
                    path: game_path(game, &format!("{folder}/{}", file.name))?,
                    url: file.url,
                    hash: file.hash,
                }
            }
        };
        download(client, &file, total).await?;
    }
    Ok(())
}
async fn artwork(client: &reqwest::Client, url: &str, game: &Path) -> Result<()> {
    allowed_url(url)?;
    let mut stream = client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .bytes_stream();
    let mut data = vec![];
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        if data.len() + chunk.len() > 2 * 1024 * 1024 {
            bail!("Pack artwork exceeds limit");
        }
        data.extend_from_slice(&chunk);
    }
    if let Some((extension, _)) = crate::artwork_format(&data) {
        if !["png", "jpg", "webp"]
            .iter()
            .any(|ext| game.join(format!("icon.{ext}")).exists())
        {
            fs::write(game.join(format!("icon.{extension}")), data)?;
        }
    }
    Ok(())
}
#[derive(Serialize, Deserialize)]
struct Request {
    source: Source,
    project: String,
    version: String,
}
const REQUEST_FILE: &str = "modpack-request.json";

impl Core {
    // No provider request is made here. The persistent placeholder is returned immediately.
    pub fn queue_modpack(
        self: &Arc<Self>,
        source: Source,
        project: String,
        version: String,
        name: String,
    ) -> Result<Instance> {
        let instance = self.create_modpack(source, project, version, name)?;
        if let Err(e) = self.start_install(instance.id.clone()) {
            let _ = self.store.remove(&instance.id);
            return Err(e);
        }
        Ok(instance)
    }
    pub(crate) fn create_modpack(
        &self,
        source: Source,
        project: String,
        version: String,
        name: String,
    ) -> Result<Instance> {
        store::valid_segment(&project)?;
        store::valid_segment(&version)?;
        let instance = self.store.create(name, "pending".into(), "grass".into())?;
        let path = self.store.dir(&instance.id)?.join(REQUEST_FILE);
        if let Err(e) = fs::write(
            path,
            serde_json::to_vec(&Request {
                source,
                project,
                version,
            })?,
        ) {
            let _ = self.store.remove(&instance.id);
            return Err(e.into());
        }
        Ok(instance)
    }
    // The smoke check prepares only pack data; the desktop path uses queue_modpack instead.
    pub async fn install_modpack(
        self: &Arc<Self>,
        source: Source,
        project: String,
        version: String,
        name: String,
    ) -> Result<Instance> {
        let instance = self.create_modpack(source, project, version, name)?;
        let job = self.reserve(&instance.id, "install")?;
        let result = prepare(self, &instance.id, &job).await;
        self.jobs.lock().unwrap().remove(&instance.id);
        result?;
        self.store.instance(&instance.id)
    }
}

fn finish(core: &Core, id: &str, request: &Request, receipt: &Value) -> Result<()> {
    if receipt["source"] != serde_json::to_value(request.source)?
        || receipt["project"] != request.project
        || receipt["version"] != request.version
    {
        bail!("Modpack preparation receipt does not match the queued release");
    }
    let (version, loader, loader_version) = loader(&receipt["dependencies"])?;
    core.store.change(|c| {
        let instance = c
            .instances
            .iter_mut()
            .find(|i| i.id == id)
            .context("Instance not found")?;
        instance.version = version;
        instance.loader = loader;
        instance.loader_version = loader_version;
        instance.installed = false;
        store::validate(instance)
    })?;
    fs::remove_file(core.store.dir(id)?.join(REQUEST_FILE))?;
    core.activity(Activity::new(id, "installing", None, "Modpack prepared"));
    Ok(())
}

pub(crate) async fn prepare(core: &Arc<Core>, id: &str, job: &Job) -> Result<()> {
    let directory = core.store.dir(id)?;
    let path = directory.join(REQUEST_FILE);
    if !path.exists() {
        return Ok(());
    }
    let request: Request = serde_json::from_slice(&fs::read(path)?)?;
    // Recover a completed game-folder commit if settings persistence was interrupted.
    let receipt_path = directory.join("game/.chest-modpack.json");
    if receipt_path.is_file() {
        let receipt = serde_json::from_slice(&fs::read(receipt_path)?)?;
        return finish(core, id, &request, &receipt);
    }
    core.activity(Activity::new(
        id,
        "installing",
        None,
        "Waiting to prepare modpack",
    ));
    let _permit = core.download_lock.acquire().await?;
    crate::install::checkpoint(core, id, job, None, "Loading modpack metadata").await?;
    let source = request.source;
    let project = &request.project;
    let version = &request.version;
    let info = project_info(&core.client, source, project).await?;
    store::valid_segment(version)?;
    let v: Value = match source {
        Source::Modrinth => {
            core.client
                .get(format!("https://api.modrinth.com/v2/version/{version}"))
                .send()
                .await?
                .error_for_status()?
                .json()
                .await?
        }
        Source::Curseforge => catalog::cf(
            &core.client,
            &format!("mods/{project}/files/{version}"),
            &[],
        )
        .await?["data"]
            .clone(),
    };
    let matches = match source {
        Source::Modrinth => v["project_id"] == info["id"],
        Source::Curseforge => v["modId"] == info["id"],
    };
    if !matches {
        bail!("Pack release belongs to another project");
    }
    let file = catalog::file(source, project, &v, Kind::Modpack)?;
    let client = pack_client()?;
    let stage = core.store.root.join(format!(".pack-{id}"));
    if stage.exists() {
        fs::remove_dir_all(&stage)?;
    }
    fs::create_dir(&stage)?;
    let result = async {
            let game = stage.join("game");
            fs::create_dir(&game)?;
            let mut total = 0;
            crate::install::checkpoint(core,id,job,None,"Downloading modpack archive").await?;
            download(
                &client,
                &Download {
                    phase: "Installing modpack".into(),
                    path: stage.join("pack.zip"),
                    url: file.url,
                    hash: file.hash,
                },
                &mut total,
            )
            .await?;
            crate::install::checkpoint(core,id,job,None,"Reading modpack manifest").await?;
            let mut archive = zip::ZipArchive::new(fs::File::open(stage.join("pack.zip"))?)?;
            let m = manifest(&mut archive, source)?;
            let (game_version, loader, loader_version) = loader(&dependencies(&m, source)?)?;
            let mut instance=core.store.instance(id)?;
            instance.version=game_version;instance.loader=loader;instance.loader_version=loader_version;
            store::validate(&instance)?;
            files(core, &client, &m, source, &game, &mut total, (id, job)).await?;
            let base = if source == Source::Modrinth {
                "overrides"
            } else {
                text(&m, "overrides")?
            };
            let layers = if source == Source::Modrinth {
                vec![base, "client-overrides"]
            } else {
                vec![base]
            };
            crate::install::checkpoint(core,id,job,None,"Applying modpack settings").await?;
            extract(&mut archive, &game, &layers, &mut total)?;
            drop(archive);
            let icon = match source {
                Source::Modrinth => info["icon_url"].as_str(),
                Source::Curseforge => info["logo"]["url"].as_str(),
            };
            if let Some(icon) = icon {
                let _ = artwork(&client, icon, &game).await;
            }
            fs::remove_file(stage.join("pack.zip"))?;
            let receipt=json!({"source":source,"project":project,"version":version,"dependencies":dependencies(&m,source)?,"gallery":gallery(source,&info)});
            fs::write(game.join(".chest-modpack.json"),serde_json::to_vec_pretty(&receipt)?)?;
            crate::install::checkpoint(core,id,job,None,"Finishing modpack preparation").await?;
            // Only an empty placeholder can be replaced. External user files are preserved.
            let destination=directory.join("game");
            fs::remove_dir(&destination).context("The new instance game folder is no longer empty; move its files before retrying")?;
            if let Err(e)=fs::rename(&game,&destination){let _=fs::create_dir(&destination);return Err(e.into());}
            finish(core,id,&request,&receipt)?;
            Ok(())
        }
        .await;
    let _ = fs::remove_dir_all(stage);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    #[test]
    fn queue_without_an_async_runtime_returns_an_error_without_panicking_or_leaving_an_instance() {
        let d = tempfile::tempdir().unwrap();
        let core = Arc::new(Core::new(d.path().join("data"), |_| {}, |_| {}).unwrap());
        let result = core.queue_modpack(
            Source::Modrinth,
            "pack".into(),
            "release".into(),
            "Queued pack".into(),
        );
        assert!(result.unwrap_err().to_string().contains("async runtime"));
        assert!(core.store.config().instances.is_empty());
        assert!(core.activities().is_empty());
        assert!(fs::read_dir(core.store.root.join("instances"))
            .unwrap()
            .next()
            .is_none());
    }
    #[test]
    fn provider_gallery_is_ordered_bounded_and_rejects_untrusted_urls() {
        let info = json!({"gallery":[
            {"url":"https://cdn.modrinth.com/later.png","ordering":2},
            {"url":"https://cdn.modrinth.com/first.png","featured":true,"ordering":3},
            {"url":"https://cdn.modrinth.com/earlier.png","ordering":1},
            {"url":"https://evil.example/image.png","featured":true},
            {"url":"http://cdn.modrinth.com/image.png"},
            {"url":"https://cdn.modrinth.com/earlier.png"}
        ]});
        assert_eq!(
            gallery(Source::Modrinth, &info),
            vec![
                "https://cdn.modrinth.com/first.png",
                "https://cdn.modrinth.com/earlier.png",
                "https://cdn.modrinth.com/later.png"
            ]
        );
        let info = json!({"screenshots":[{"url":"https://media.forgecdn.net/images/one.jpg","thumbnailUrl":"https://media.forgecdn.net/thumb.jpg"}]});
        assert_eq!(
            gallery(Source::Curseforge, &info),
            vec!["https://media.forgecdn.net/images/one.jpg"]
        );
    }
    #[tokio::test]
    async fn provider_backgrounds_use_pack_gallery_metadata() {
        let d = tempfile::tempdir().unwrap();
        let core = Core::new(d.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core
            .store
            .create("World".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        let game = core.store.dir(&instance.id).unwrap().join("game");
        fs::create_dir_all(game.join("screenshots")).unwrap();
        fs::write(
            game.join("screenshots/local.png"),
            b"\x89PNG\r\n\x1a\nimage data",
        )
        .unwrap();
        assert!(core
            .provider_backgrounds(&instance.id)
            .await
            .unwrap()
            .is_empty());
        fs::write(game.join(".chest-modpack.json"),serde_json::to_vec(&json!({"source":"modrinth","project":"pack","gallery":["https://cdn.modrinth.com/image.png","file:///private.png"]})).unwrap()).unwrap();
        assert_eq!(
            core.provider_backgrounds(&instance.id).await.unwrap(),
            vec!["https://cdn.modrinth.com/image.png"]
        );
        let copy = core.duplicate(&instance.id).unwrap();
        assert_eq!(
            core.provider_backgrounds(&copy.id).await.unwrap(),
            core.provider_backgrounds(&instance.id).await.unwrap()
        );
    }
    #[tokio::test]
    async fn queue_returns_before_downloads_and_preserves_request_after_failure() {
        let d = tempfile::tempdir().unwrap();
        let core = Arc::new(Core::new(d.path().join("data"), |_| {}, |_| {}).unwrap());
        let permit = core.download_lock.acquire().await.unwrap();
        let instance = core
            .queue_modpack(
                Source::Modrinth,
                "pack".into(),
                "release".into(),
                "Queued pack".into(),
            )
            .unwrap();
        assert_eq!(instance.version, "pending");
        assert!(core.busy(&instance.id));
        assert_eq!(core.store.config().instances.len(), 1);
        assert!(core
            .store
            .dir(&instance.id)
            .unwrap()
            .join(REQUEST_FILE)
            .is_file());
        assert!(core.save_instance(instance.clone()).is_err());
        assert!(core.remove(&instance.id).is_err());
        core.pause(&instance.id, true).unwrap();
        core.jobs
            .lock()
            .unwrap()
            .get(&instance.id)
            .unwrap()
            .cancel
            .store(true, std::sync::atomic::Ordering::Relaxed);
        drop(permit);
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while core.busy(&instance.id) {
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        assert!(core
            .activities()
            .iter()
            .any(|a| a.id == instance.id && a.status == "failed"));
        let reopened = Core::new(d.path().join("data"), |_| {}, |_| {}).unwrap();
        assert_eq!(
            reopened.store.instance(&instance.id).unwrap().version,
            "pending"
        );
        assert!(reopened
            .store
            .dir(&instance.id)
            .unwrap()
            .join(REQUEST_FILE)
            .exists());
    }
    #[tokio::test]
    async fn committed_pack_recovers_settings_and_keeps_the_queued_identity() {
        let d = tempfile::tempdir().unwrap();
        let core = Arc::new(Core::new(d.path().join("data"), |_| {}, |_| {}).unwrap());
        let instance = core
            .create_modpack(
                Source::Modrinth,
                "pack".into(),
                "release".into(),
                "Queued pack".into(),
            )
            .unwrap();
        let directory = core.store.dir(&instance.id).unwrap();
        let receipt = json!({"source":"modrinth","project":"pack","version":"release","dependencies":{"minecraft":"1.21.4","fabric-loader":"0.16.10"}});
        fs::write(
            directory.join("game/.chest-modpack.json"),
            serde_json::to_vec(&receipt).unwrap(),
        )
        .unwrap();
        fs::write(directory.join("game/options.txt"), b"pack config").unwrap();
        let job = core.reserve(&instance.id, "install").unwrap();
        prepare(&core, &instance.id, &job).await.unwrap();
        let prepared = core.store.instance(&instance.id).unwrap();
        assert_eq!(prepared.name, instance.name);
        assert_eq!(prepared.version, "1.21.4");
        assert_eq!(prepared.loader, Loader::Fabric);
        assert_eq!(core.store.config().instances.len(), 1);
        assert!(!directory.join(REQUEST_FILE).exists());
        assert_eq!(
            fs::read(directory.join("game/options.txt")).unwrap(),
            b"pack config"
        );
        prepare(&core, &instance.id, &job).await.unwrap();
    }
    fn archive(root: &Path, entries: &[(&str, &[u8])]) -> zip::ZipArchive<fs::File> {
        let path = root.join("test.zip");
        let mut w = zip::ZipWriter::new(fs::File::create(&path).unwrap());
        for (name, data) in entries {
            w.start_file(*name, zip::write::SimpleFileOptions::default())
                .unwrap();
            w.write_all(data).unwrap();
        }
        w.finish().unwrap();
        zip::ZipArchive::new(fs::File::open(path).unwrap()).unwrap()
    }
    #[test]
    fn supported_loaders_are_pinned_and_unsupported_dependencies_fail() {
        assert_eq!(
            loader(&json!({"minecraft":"1.21.4","fabric-loader":"0.16.10"})).unwrap(),
            ("1.21.4".into(), Loader::Fabric, "0.16.10".into())
        );
        assert_eq!(
            loader(&json!({"minecraft":"1.21.4","quilt-loader":"0.30.1"}))
                .unwrap()
                .1,
            Loader::Quilt
        );
        for (key, expected, version) in [("forge", Loader::Forge, "54.1.0"), ("neoforge", Loader::Neoforge, "21.4.100")] {
            let deps = json!({"minecraft":"1.21.4",key:version});
            assert_eq!(loader(&deps).unwrap().1, expected);
            let cf = json!({"minecraft":{"version":"1.21.4","modLoaders":[{"id":format!("{key}-{version}"),"primary":true}]}});
            assert_eq!(loader(&dependencies(&cf, Source::Curseforge).unwrap()).unwrap().1, expected);
        }
        for deps in [
            json!({"minecraft":"1.18.2"}),
            json!({"minecraft":"1.21.4","quilt-loader":"0.30","fabric-loader":"0.16"}),
            json!({"minecraft":"1.21.4","unknown":"1"}),
        ] {
            assert!(loader(&deps).is_err());
        }
        let cf = json!({"minecraft":{"version":"1.21.4","modLoaders":[{"id":"fabric-0.16.10","primary":true}]}});
        assert_eq!(
            loader(&dependencies(&cf, Source::Curseforge).unwrap())
                .unwrap()
                .2,
            "0.16.10"
        );
    }
    #[test]
    fn client_overrides_replace_common_files_and_ignore_server_files() {
        let d = tempfile::tempdir().unwrap();
        let game = d.path().join("game");
        fs::create_dir(&game).unwrap();
        let mut zip = archive(
            d.path(),
            &[
                ("overrides/config/options.txt", b"common"),
                ("client-overrides/config/options.txt", b"client"),
                ("server-overrides/server.txt", b"server"),
            ],
        );
        extract(&mut zip, &game, &["overrides", "client-overrides"], &mut 0).unwrap();
        assert_eq!(
            fs::read(game.join("config/options.txt")).unwrap(),
            b"client"
        );
        assert!(!game.join("server.txt").exists());
    }
    #[test]
    fn escaping_paths_and_untrusted_download_urls_are_rejected() {
        for path in [
            "../outside",
            "/outside",
            "C:/outside",
            "mods/../../outside",
            "mods\\outside",
            "",
        ] {
            assert!(game_path(Path::new("game"), path).is_err());
        }
        for url in [
            "http://cdn.modrinth.com/file",
            "https://evil.example/file",
            "https://cdn.modrinth.com.evil.example/file",
            "https://user@cdn.modrinth.com/file",
            "https://cdn.modrinth.com:444/file",
        ] {
            assert!(allowed_url(url).is_err());
        }
        let d = tempfile::tempdir().unwrap();
        let mut zip = archive(d.path(), &[("overrides/../../escaped", b"escape")]);
        assert!(extract(&mut zip, &d.path().join("game"), &["overrides"], &mut 0).is_err());
        assert!(!d.path().join("escaped").exists());
    }
    #[test]
    fn pack_format_and_extraction_limits_are_validated() {
        let d = tempfile::tempdir().unwrap();
        let mut zip = archive(
            d.path(),
            &[(
                "modrinth.index.json",
                br#"{"formatVersion":2,"game":"minecraft"}"#,
            )],
        );
        assert!(manifest(&mut zip, Source::Modrinth).is_err());
        let mut zip = archive(d.path(), &[("overrides/config.txt", b"config")]);
        assert!(
            extract(&mut zip, &d.path().join("game"), &["overrides"], &mut {
                TOTAL_LIMIT
            })
            .is_err()
        );
    }
}
