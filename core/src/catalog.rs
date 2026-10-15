//! Catalog requests stay in Rust; the UI receives normalized public metadata only.
use crate::{
    install,
    metadata::Download,
    store::{self, Instance, Loader},
    Core,
};
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Modrinth,
    Curseforge,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Mod,
    Resourcepack,
    Shader,
    Modpack,
}
impl Kind {
    fn name(self) -> &'static str {
        match self {
            Self::Mod => "mod",
            Self::Resourcepack => "resourcepack",
            Self::Shader => "shader",
            Self::Modpack => "modpack",
        }
    }
    fn folder(self) -> Result<&'static str> {
        match self {
            Self::Mod => Ok("mods"),
            Self::Resourcepack => Ok("resourcepacks"),
            Self::Shader => Ok("shaderpacks"),
            Self::Modpack => bail!("Modpack installation is not available yet"),
        }
    }
    fn class(self) -> u32 {
        match self {
            Self::Mod => 6,
            Self::Resourcepack => 12,
            Self::Shader => 6552,
            Self::Modpack => 4471,
        }
    }
}
#[derive(Deserialize)]
pub struct Query {
    pub source: Source,
    pub kind: Kind,
    pub query: String,
    pub sort: String,
    pub offset: u32,
    #[serde(default = "default_page_size")]
    pub limit: u32,
    pub game: String,
    pub loader: String,
}
fn default_page_size() -> u32 { 20 }
#[derive(Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub title: String,
    pub description: String,
    pub author: String,
    pub icon: Option<String>,
    #[serde(default)]
    pub background: Option<String>,
    pub downloads: u64,
    pub url: String,
}
#[derive(Serialize, Deserialize)]
pub struct Page {
    pub projects: Vec<Project>,
    pub total: u32,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Release {
    pub id: String,
    pub name: String,
    pub published: String,
}
#[derive(Serialize)]
pub struct Sources {
    pub modrinth: bool,
    pub curseforge: bool,
}
pub fn sources() -> Sources {
    Sources {
        modrinth: true,
        curseforge: std::env::var("CHEST_CURSEFORGE_API_KEY").is_ok_and(|v| !v.trim().is_empty()),
    }
}
fn string(v: &Value, key: &str) -> String {
    v[key].as_str().unwrap_or_default().to_owned()
}
fn image(v: &Value) -> Option<String> {
    v.as_str()
        .filter(|s| s.starts_with("https://"))
        .map(str::to_owned)
}
fn identifier(id: &str) -> Result<()> {
    store::valid_segment(id)
}
fn search_background(source: Source, project: &Value) -> Option<String> {
    let candidates = match source {
        Source::Modrinth => std::iter::once(&project["featured_gallery"])
            .chain(project["gallery"].as_array().into_iter().flatten())
            .filter_map(Value::as_str)
            .collect::<Vec<_>>(),
        Source::Curseforge => project["screenshots"].as_array().into_iter().flatten()
            .filter_map(|image| image["url"].as_str()).collect(),
    };
    candidates.into_iter().find(|url| crate::modpack::gallery_url(url)).map(str::to_owned)
}
pub(crate) async fn cf(
    client: &reqwest::Client,
    path: &str,
    params: &[(&str, String)],
) -> Result<Value> {
    let key=std::env::var("CHEST_CURSEFORGE_API_KEY").ok().filter(|s|!s.trim().is_empty()).context("CurseForge needs a Chest API key. Set CHEST_CURSEFORGE_API_KEY before starting the app.")?;
    Ok(client
        .get(format!("https://api.curseforge.com/v1/{path}"))
        .header("x-api-key", key)
        .query(params)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?)
}
pub async fn search(client: &reqwest::Client, q: Query) -> Result<Page> {
    if q.query.len() > 200 || q.offset > 9900 || !(1..=60).contains(&q.limit) {
        bail!("Search limit exceeded");
    }
    if !q.game.is_empty() {
        identifier(&q.game)?;
    }
    if !["", "fabric", "quilt", "forge", "neoforge"].contains(&q.loader.as_str()) {
        bail!("Unknown loader filter");
    }
    if !["relevance", "downloads", "newest", "updated"].contains(&q.sort.as_str()) {
        bail!("Unknown sort order");
    }
    match q.source {
        Source::Modrinth => {
            let mut facets = vec![vec![format!("project_type:{}", q.kind.name())]];
            if !q.game.is_empty() {
                facets.push(vec![format!("versions:{}", q.game)]);
            }
            if !q.loader.is_empty() && matches!(q.kind, Kind::Mod | Kind::Modpack) {
                facets.push(vec![format!("categories:{}", q.loader)]);
            }
            let v: Value = client
                .get("https://api.modrinth.com/v2/search")
                .query(&[
                    ("query", q.query),
                    ("facets", serde_json::to_string(&facets)?),
                    ("index", q.sort),
                    ("offset", q.offset.to_string()),
                    ("limit", q.limit.to_string()),
                ])
                .send()
                .await?
                .error_for_status()?
                .json()
                .await?;
            let projects = v["hits"]
                .as_array()
                .context("Invalid Modrinth search response")?
                .iter()
                .map(|p| Project {
                    id: string(p, "project_id"),
                    title: string(p, "title"),
                    description: string(p, "description"),
                    author: string(p, "author"),
                    icon: image(&p["icon_url"]),
                    background: search_background(Source::Modrinth, p),
                    downloads: p["downloads"].as_u64().unwrap_or(0),
                    url: format!(
                        "https://modrinth.com/{}/{}",
                        q.kind.name(),
                        string(p, "slug")
                    ),
                })
                .collect();
            Ok(Page {
                projects,
                total: v["total_hits"].as_u64().unwrap_or(0) as u32,
            })
        }
        Source::Curseforge => {
            let sort = match q.sort.as_str() {
                "downloads" => "6",
                "newest" => "11",
                "updated" => "3",
                _ => "1",
            };
            let mut params = vec![
                ("gameId", "432".into()),
                ("classId", q.kind.class().to_string()),
                ("searchFilter", q.query),
                ("sortField", sort.into()),
                ("sortOrder", "desc".into()),
                ("index", q.offset.to_string()),
                ("pageSize", q.limit.to_string()),
            ];
            if !q.game.is_empty() {
                params.push(("gameVersion", q.game));
            }
            if !q.loader.is_empty() && matches!(q.kind, Kind::Mod | Kind::Modpack) {
                params.push(("modLoaderType", loader_number(&q.loader)?.into()));
            }
            let v = cf(client, "mods/search", &params).await?;
            let projects = v["data"]
                .as_array()
                .context("Invalid CurseForge search response")?
                .iter()
                .map(|p| Project {
                    id: p["id"].to_string(),
                    title: string(p, "name"),
                    description: string(p, "summary"),
                    author: p["authors"]
                        .as_array()
                        .map(|a| {
                            a.iter()
                                .filter_map(|a| a["name"].as_str())
                                .collect::<Vec<_>>()
                                .join(", ")
                        })
                        .unwrap_or_default(),
                    icon: image(&p["logo"]["thumbnailUrl"]),
                    background: search_background(Source::Curseforge, p),
                    downloads: p["downloadCount"].as_f64().unwrap_or(0.) as u64,
                    url: string(&p["links"], "websiteUrl"),
                })
                .collect();
            Ok(Page {
                projects,
                total: v["pagination"]["totalCount"].as_u64().unwrap_or(0) as u32,
            })
        }
    }
}
fn loader_number(loader: &str) -> Result<&'static str> {
    match loader {
        "fabric" => Ok("4"),
        "quilt" => Ok("5"),
        "forge" => Ok("1"),
        "neoforge" => Ok("6"),
        _ => bail!("Unsupported loader"),
    }
}
fn loader_name(i: &Instance) -> &'static str {
    match i.loader {
        Loader::Vanilla => "vanilla",
        Loader::Fabric => "fabric",
        Loader::Quilt => "quilt",
        Loader::Forge => "forge",
        Loader::Neoforge => "neoforge",
    }
}
fn compatible(v: &Value, source: Source, i: &Instance, kind: Kind) -> bool {
    let (games, loaders) = match source {
        Source::Modrinth => (&v["game_versions"], &v["loaders"]),
        Source::Curseforge => (&v["gameVersions"], &v["gameVersions"]),
    };
    let includes = |values: &Value, wanted: &str| {
        values.as_array().is_some_and(|a| {
            a.iter()
                .any(|v| v.as_str().is_some_and(|s| s.eq_ignore_ascii_case(wanted)))
        })
    };
    includes(games, &i.version)
        && (kind != Kind::Mod || (i.loader != Loader::Vanilla && includes(loaders, loader_name(i))))
}
async fn versions(
    client: &reqwest::Client,
    source: Source,
    project: &str,
    i: &Instance,
    kind: Kind,
) -> Result<Vec<Value>> {
    identifier(project)?;
    kind.folder()?;
    if kind == Kind::Mod && i.loader == Loader::Vanilla {
        bail!("Choose a modloader in this instance’s Versions page first");
    }
    let project_info: Value = match source {
        Source::Modrinth => {
            client
                .get(format!("https://api.modrinth.com/v2/project/{project}"))
                .send()
                .await?
                .error_for_status()?
                .json()
                .await?
        }
        Source::Curseforge => cf(client, &format!("mods/{project}"), &[]).await?["data"].clone(),
    };
    let correct = match source {
        Source::Modrinth => project_info["project_type"].as_str() == Some(kind.name()),
        Source::Curseforge => {
            project_info["classId"].as_u64() == Some(kind.class() as u64)
                && project_info["gameId"] == 432
        }
    };
    if !correct {
        bail!("Project type does not match the selected content category");
    }
    let values = match source {
        Source::Modrinth => {
            // Filter games remotely; validate each returned version locally too.
            let v: Vec<Value> = client
                .get(format!(
                    "https://api.modrinth.com/v2/project/{project}/version"
                ))
                .query(&[("game_versions", json!([i.version]).to_string())])
                .send()
                .await?
                .error_for_status()?
                .json()
                .await?;
            v
        }
        Source::Curseforge => {
            let mut params = vec![
                ("gameVersion", i.version.clone()),
                ("pageSize", "50".into()),
            ];
            if kind == Kind::Mod {
                params.push(("modLoaderType", loader_number(loader_name(i))?.into()));
            }
            cf(client, &format!("mods/{project}/files"), &params).await?["data"]
                .as_array()
                .context("Invalid CurseForge versions")?
                .clone()
        }
    };
    Ok(values
        .into_iter()
        .filter(|v| compatible(v, source, i, kind))
        .collect())
}
pub async fn releases(
    client: &reqwest::Client,
    source: Source,
    project: &str,
    i: &Instance,
    kind: Kind,
) -> Result<Vec<Release>> {
    Ok(versions(client, source, project, i, kind)
        .await?
        .iter()
        .map(|v| match source {
            Source::Modrinth => Release {
                id: string(v, "id"),
                name: string(v, "name"),
                published: string(v, "date_published"),
            },
            Source::Curseforge => Release {
                id: v["id"].to_string(),
                name: string(v, "displayName"),
                published: string(v, "fileDate"),
            },
        })
        .collect())
}
pub(crate) struct File {
    pub(crate) project: String,
    pub(crate) version: String,
    pub(crate) name: String,
    pub(crate) url: String,
    pub(crate) hash: String,
}
pub(crate) fn file(source: Source, project: &str, v: &Value, kind: Kind) -> Result<File> {
    let (version, name, url, hash) = match source {
        Source::Modrinth => {
            let files = v["files"].as_array().context("Missing project files")?;
            let f = files
                .iter()
                .find(|f| f["primary"] == true)
                .or_else(|| files.first())
                .context("No project file")?;
            (
                string(v, "id"),
                string(f, "filename"),
                string(f, "url"),
                string(&f["hashes"], "sha1"),
            )
        }
        Source::Curseforge => {
            let hash = v["hashes"]
                .as_array()
                .and_then(|a| a.iter().find(|h| h["algo"] == 1))
                .map(|h| string(h, "value"))
                .context("Missing file SHA-1")?;
            (
                v["id"].to_string(),
                string(v, "fileName"),
                string(v, "downloadUrl"),
                hash,
            )
        }
    };
    validate_file(&name, &url, &hash, source, kind)?;
    Ok(File {
        project: project.into(),
        version,
        name,
        url,
        hash: hash.to_ascii_lowercase(),
    })
}
fn validate_file(name: &str, url: &str, hash: &str, source: Source, kind: Kind) -> Result<()> {
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains(':')
        || !name.ends_with(match (kind, source) {
            (Kind::Mod, _) => ".jar",
            (Kind::Modpack, Source::Modrinth) => ".mrpack",
            _ => ".zip",
        })
    {
        bail!("Invalid project filename");
    }
    store::safe_join(Path::new("content"), name)?;
    let url=url::Url::parse(url).context("File is unavailable for third-party download. Open the project website to download it manually.")?;
    let host = url.host_str().unwrap_or_default();
    let allowed = match source {
        Source::Modrinth => host == "cdn.modrinth.com",
        Source::Curseforge => host == "edge.forgecdn.net" || host == "mediafilez.forgecdn.net",
    };
    if url.scheme() != "https" || !allowed || !url.username().is_empty() || url.password().is_some()
    {
        bail!("Unsupported project download host");
    }
    if hash.len() != 40 || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        bail!("Invalid project checksum");
    }
    Ok(())
}
fn checked_dir(path: &Path) -> Result<()> {
    if let Ok(meta) = fs::symlink_metadata(path) {
        if !meta.is_dir() || meta.file_type().is_symlink() {
            bail!("Content folder must be a real directory");
        }
    } else {
        fs::create_dir(path)?;
    }
    Ok(())
}
#[derive(Serialize, Deserialize, Clone)]
struct Receipt {
    source: Source,
    project: String,
    version: String,
    folder: String,
    name: String,
    hash: String,
}
// Resolve all required dependencies before writing into the game folder. Never replace
// existing files or silently install a second version of a previously managed project.
pub async fn install(
    core: &Arc<Core>,
    id: &str,
    source: Source,
    project: &str,
    version: &str,
    kind: Kind,
) -> Result<Vec<String>> {
    identifier(project)?;
    identifier(version)?;
    let folder = kind.folder()?;
    let i = core.store.instance(id)?;
    let mut queue = vec![(project.to_owned(), Some(version.to_owned()))];
    let mut seen = HashMap::<String, String>::new();
    let mut files = vec![];
    while let Some((project, pinned)) = queue.pop() {
        if files.len() >= 100 {
            bail!("Too many project dependencies");
        }
        if let Some(existing) = seen.get(&project) {
            if pinned.as_ref().is_some_and(|p| p != existing) {
                bail!("Conflicting required dependency versions");
            }
            continue;
        }
        let available = versions(&core.client, source, &project, &i, kind).await?;
        let v = available
            .iter()
            .find(|v| {
                pinned.as_ref().is_none_or(|p| match source {
                    Source::Modrinth => v["id"].as_str() == Some(p),
                    Source::Curseforge => v["id"].as_u64() == p.parse::<u64>().ok(),
                })
            })
            .context("No compatible release found for this project or a required dependency")?;
        let f = file(source, &project, v, kind)?;
        seen.insert(project.clone(), f.version.clone());
        if let Some(deps) = v["dependencies"].as_array() {
            for d in deps {
                let required = match source {
                    Source::Modrinth => d["dependency_type"] == "required",
                    Source::Curseforge => d["relationType"] == 3,
                };
                if !required {
                    continue;
                }
                let (dependency, pin) = match source {
                    Source::Modrinth => {
                        let pin = d["version_id"].as_str().map(str::to_owned);
                        let dependency = if let Some(p) = d["project_id"].as_str() {
                            p.to_owned()
                        } else if let Some(pin) = &pin {
                            identifier(pin)?;
                            let resolved: Value = core
                                .client
                                .get(format!("https://api.modrinth.com/v2/version/{pin}"))
                                .send()
                                .await?
                                .error_for_status()?
                                .json()
                                .await?;
                            string(&resolved, "project_id")
                        } else {
                            bail!("A required dependency must be installed manually");
                        };
                        (dependency, pin)
                    }
                    Source::Curseforge => (d["modId"].to_string(), None),
                };
                queue.push((dependency, pin));
            }
        }
        files.push(f);
    }
    let directory = core.store.dir(id)?;
    checked_dir(&directory)?;
    let game = directory.join("game");
    checked_dir(&game)?;
    let target = game.join(folder);
    checked_dir(&target)?;
    let receipt_path = game.join(".chest-content.json");
    if fs::symlink_metadata(&receipt_path).is_ok_and(|m| !m.is_file() || m.file_type().is_symlink())
    {
        bail!("Invalid content record");
    }
    let mut receipts: Vec<Receipt> = if receipt_path.exists() {
        serde_json::from_slice(&fs::read(&receipt_path)?)?
    } else {
        vec![]
    };
    let mut names = HashSet::new();
    for f in &files {
        if !names.insert(f.name.clone()) {
            bail!("Two projects use the same filename");
        }
        if receipts.iter().any(|r| {
            r.source == source
                && r.project == f.project
                && r.version != f.version
                && game.join(&r.folder).join(&r.name).exists()
        }) {
            bail!("Another version of a required project is already installed. Remove it from the instance folder first.");
        }
        let path = target.join(&f.name);
        if fs::symlink_metadata(&path).is_ok() {
            let m = fs::symlink_metadata(&path)?;
            if !m.is_file()
                || m.file_type().is_symlink()
                || install::hash_file(&path, false)? != f.hash
            {
                bail!(
                    "An existing content file conflicts with this download: {}",
                    f.name
                );
            }
        }
        if target.join(format!("{}.disabled", f.name)).exists() {
            bail!(
                "{} is already present but disabled. Enable it from Content first.",
                f.name
            );
        }
    }
    let stage = core
        .store
        .dir(id)?
        .join(format!(".content-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&stage)?;
    let result = async {
        for f in &files {
            // Preflight already verified existing files. Reuse them on repeated adds.
            if target.join(&f.name).is_file() { continue; }
            install::fetch(
                &core.client,
                &Download {
                    path: stage.join(&f.name),
                    url: f.url.clone(),
                    hash: f.hash.clone(),
                    phase: format!("Downloading {}", f.name),
                },
            )
            .await?;
        }
        let mut added: Vec<PathBuf> = vec![];
        for f in &files {
            receipts.retain(|r| !(r.source == source && r.project == f.project));
            receipts.push(Receipt { source, project:f.project.clone(), version:f.version.clone(), folder:folder.into(), name:f.name.clone(), hash:f.hash.clone() });
        }
        let record = stage.join("record.json");
        fs::write(&record, serde_json::to_vec_pretty(&receipts)?)?;
        let commit = (|| -> Result<()> {
            for f in &files {
                let path = target.join(&f.name);
                if fs::symlink_metadata(&path).is_ok() {
                    let info = fs::symlink_metadata(&path)?;
                    if !info.is_file() || info.file_type().is_symlink() || install::hash_file(&path, false)? != f.hash {
                        bail!("Content changed while downloading; retry after checking the instance folder");
                    }
                    continue;
                }
                // Publishing by hard link refuses to overwrite a concurrently created file.
                fs::hard_link(stage.join(&f.name), &path)?;
                added.push(path);
            }
            fs::rename(record, &receipt_path)?;
            Ok(())
        })();
        if let Err(e) = commit { for path in added { let _ = fs::remove_file(path); } return Err(e); }
        Ok(files.iter().map(|f| f.name.clone()).collect())
    }
    .await;
    let _ = fs::remove_dir_all(stage);
    result
}

pub fn open_project(source: Source, link: &str) -> Result<()> {
    let parsed = url::Url::parse(link)?;
    let host = match source {
        Source::Modrinth => "modrinth.com",
        Source::Curseforge => "www.curseforge.com",
    };
    if parsed.scheme() != "https"
        || parsed.host_str() != Some(host)
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        bail!("Invalid project URL");
    }
    open::that(link)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn catalog_backgrounds_prefer_featured_images_and_validate_fallbacks() {
        let featured = "https://cdn.modrinth.com/data/pack/featured.webp";
        let fallback = "https://cdn.modrinth.com/data/pack/gallery.webp";
        let mut project = json!({"featured_gallery": featured, "gallery": [fallback]});
        assert_eq!(search_background(Source::Modrinth, &project).as_deref(), Some(featured));
        project["featured_gallery"] = json!("https://untrusted.example/image.png");
        assert_eq!(search_background(Source::Modrinth, &project).as_deref(), Some(fallback));
        let cf = json!({"screenshots":[{"url":"https://media.forgecdn.net/attachments/1/full.png","thumbnailUrl":"https://media.forgecdn.net/attachments/1/thumb.png"}]});
        assert_eq!(search_background(Source::Curseforge, &cf).as_deref(), Some("https://media.forgecdn.net/attachments/1/full.png"));
        assert!(search_background(Source::Modrinth, &json!({})).is_none());
    }
    #[test]
    fn rejects_unsafe_catalog_files() {
        let hash = "a".repeat(40);
        assert!(validate_file(
            "sodium.jar",
            "https://cdn.modrinth.com/data/id/sodium.jar",
            &hash,
            Source::Modrinth,
            Kind::Mod
        )
        .is_ok());
        for name in [
            "../sodium.jar",
            "a/b.jar",
            "a\\b.jar",
            "C:evil.jar",
            "mod.exe",
        ] {
            assert!(validate_file(
                name,
                "https://cdn.modrinth.com/a",
                &hash,
                Source::Modrinth,
                Kind::Mod
            )
            .is_err());
        }
        for url in [
            "http://cdn.modrinth.com/a",
            "https://evil.test/a",
            "https://cdn.modrinth.com.evil.test/a",
        ] {
            assert!(validate_file("mod.jar", url, &hash, Source::Modrinth, Kind::Mod).is_err());
        }
        assert!(validate_file(
            "mod.jar",
            "https://cdn.modrinth.com/a",
            "bad",
            Source::Modrinth,
            Kind::Mod
        )
        .is_err());
    }
    #[test]
    fn compatibility_requires_game_and_modloader_for_mods() {
        let temp = tempfile::tempdir().unwrap();
        let core = Core::new(temp.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core
            .store
            .create_with_loader(
                "Test".into(),
                "1.21.4".into(),
                "grass".into(),
                Loader::Quilt,
                "0.30.1".into(),
            )
            .unwrap();
        let quilt = json!({"game_versions":["1.21.4"],"loaders":["quilt"]});
        assert!(compatible(&quilt, Source::Modrinth, &instance, Kind::Mod));
        assert!(!compatible(
            &json!({"game_versions":["1.21.4"],"loaders":["fabric"]}),
            Source::Modrinth,
            &instance,
            Kind::Mod
        ));
        assert!(!compatible(
            &json!({"game_versions":["1.20.1"],"loaders":["quilt"]}),
            Source::Modrinth,
            &instance,
            Kind::Mod
        ));
        assert!(compatible(
            &json!({"gameVersions":["1.21.4","Quilt"]}),
            Source::Curseforge,
            &instance,
            Kind::Mod
        ));
        assert!(!compatible(
            &json!({"gameVersions":["1.21.4","Forge"]}),
            Source::Curseforge,
            &instance,
            Kind::Mod
        ));
        let vanilla = Instance {
            loader: Loader::Vanilla,
            loader_version: String::new(),
            ..instance
        };
        assert!(!compatible(&quilt, Source::Modrinth, &vanilla, Kind::Mod));
        assert!(compatible(
            &quilt,
            Source::Modrinth,
            &vanilla,
            Kind::Resourcepack
        ));
    }
    #[test]
    fn forge_and_neoforge_are_distinct_for_both_providers() {
        let temp = tempfile::tempdir().unwrap();
        let store = crate::store::Store::new(temp.path().into()).unwrap();
        for (loader, version, name, other) in [(Loader::Forge, "52.0.1", "forge", "neoforge"), (Loader::Neoforge, "21.1.172", "neoforge", "forge")] {
            let instance = store.create_with_loader(name.into(), "1.21.1".into(), "grass".into(), loader, version.into()).unwrap();
            assert!(compatible(&json!({"game_versions":["1.21.1"],"loaders":[name]}), Source::Modrinth, &instance, Kind::Mod));
            assert!(!compatible(&json!({"game_versions":["1.21.1"],"loaders":[other]}), Source::Modrinth, &instance, Kind::Mod));
            assert!(compatible(&json!({"gameVersions":["1.21.1",name]}), Source::Curseforge, &instance, Kind::Mod));
            assert!(!compatible(&json!({"gameVersions":["1.21.1",other]}), Source::Curseforge, &instance, Kind::Mod));
        }
    }
    #[test]
    fn curseforge_file_requires_an_allowed_download_and_sha1() {
        let data = json!({"id":123,"fileName":"mod.jar","downloadUrl":"https://edge.forgecdn.net/files/123/mod.jar","hashes":[{"algo":1,"value":"a".repeat(40)}]});
        assert!(file(Source::Curseforge, "10", &data, Kind::Mod).is_ok());
        let mut unavailable = data.clone();
        unavailable["downloadUrl"] = Value::Null;
        assert!(file(Source::Curseforge, "10", &unavailable, Kind::Mod).is_err());
        let mut unverified = data;
        unverified["hashes"] = json!([{"algo":2,"value":"a".repeat(32)}]);
        assert!(file(Source::Curseforge, "10", &unverified, Kind::Mod).is_err());
    }
    #[test]
    fn directory_guard_rejects_symlinks() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("mods");
        checked_dir(&path).unwrap();
        checked_dir(&path).unwrap();
        #[cfg(unix)]
        {
            let link = temp.path().join("link");
            std::os::unix::fs::symlink(&path, &link).unwrap();
            assert!(checked_dir(&link).is_err());
        }
    }
}
