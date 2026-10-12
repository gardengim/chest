use anyhow::{bail, Result};
use serde::Serialize;
use serde_json::Value;

const FEED: &str = "https://launchercontent.mojang.com/v2/news.json";

#[derive(Clone, Serialize)]
pub struct Article {
    pub title: String,
    pub date: String,
    pub url: String,
}
fn article_url(link: &str) -> bool {
    url::Url::parse(link).is_ok_and(|url| {
        url.scheme() == "https" && matches!(url.host_str(), Some("www.minecraft.net" | "modrinth.com" | "www.curseforge.com" | "fabricmc.net" | "quiltmc.org"))
            && url.username().is_empty() && url.password().is_none() && url.port().is_none()
    })
}
fn articles(feed: &Value) -> Vec<Article> {
    let mut items: Vec<_> = feed["entries"].as_array().into_iter().flatten()
        .filter(|entry| entry["newsType"].as_array().is_some_and(|types| types.iter().any(|kind| kind == "Java")))
        .filter_map(|entry| {
            let title = entry["title"].as_str()?;
            let date = entry["date"].as_str()?;
            let link = entry["readMoreLink"].as_str()?;
            if title.is_empty() || !article_url(link) || url::Url::parse(link).ok()?.host_str() != Some("www.minecraft.net") { return None; }
            Some(Article { title: title.into(), date: date.into(), url: link.into() })
        }).collect();
    items.sort_by(|a,b| b.date.cmp(&a.date));
    items
}
pub async fn latest(client: &reqwest::Client) -> Result<Vec<Article>> {
    let feed: Value = client.get(FEED).timeout(std::time::Duration::from_secs(10))
        .send().await?.error_for_status()?.json().await?;
    Ok(articles(&feed))
}
pub fn open(link: &str) -> Result<()> {
    if !article_url(link) { bail!("Invalid news URL"); }
    open::that(link)?;
    Ok(())
}

#[derive(Clone, Serialize)]
pub struct InstanceArticle {
    #[serde(flatten)]
    pub article: Article,
    pub source: String,
    pub instance_id: String,
}
#[derive(Default, Serialize)]
pub struct InstanceNews {
    pub articles: Vec<InstanceArticle>,
    pub unavailable: Vec<String>,
}
fn newer_loader<'a>(versions: &'a [String], installed: &str) -> Option<&'a str> {
    versions.iter().position(|v| v == installed).filter(|index| *index > 0)?;
    versions.first().map(String::as_str)
}
fn newer_pack<'a>(releases: &'a [crate::catalog::Release], installed: &str) -> Option<&'a crate::catalog::Release> {
    let current = releases.iter().find(|r| r.id == installed)?;
    releases.iter().filter(|r| r.published > current.published).max_by_key(|r| &r.published)
}
fn pack_record(root: &std::path::Path) -> Result<Option<Value>> {
    use std::io::Read;
    let path = root.join("game/.chest-modpack.json");
    if !path.try_exists()? { return Ok(None); }
    let root = root.canonicalize()?;
    let path = path.canonicalize()?;
    if !path.starts_with(&root) { bail!("Invalid modpack record"); }
    let mut bytes = vec![];
    std::fs::File::open(path)?.take(1024 * 1024 + 1).read_to_end(&mut bytes)?;
    if bytes.len() > 1024 * 1024 { bail!("Modpack record exceeds limit"); }
    Ok(Some(serde_json::from_slice(&bytes)?))
}
async fn loader_article(core: &crate::Core, instance: &crate::store::Instance) -> Result<Option<InstanceArticle>> {
    use crate::store::Loader;
    let (versions, source, url) = match instance.loader {
        Loader::Vanilla => return Ok(None),
        Loader::Fabric => (crate::fabric::versions(&core.client, &instance.version).await?, "Fabric", "https://fabricmc.net/use/installer/"),
        Loader::Quilt => (crate::fabric::quilt_versions(&core.client, &instance.version).await?, "Quilt", "https://quiltmc.org/en/install/client/"),
    };
    Ok(newer_loader(&versions, &instance.loader_version).map(|version| InstanceArticle {
        article: Article { title: format!("{} {version}", source), date: String::new(), url: url.into() },
        source: source.into(), instance_id: instance.id.clone(),
    }))
}
async fn pack_article(core: &crate::Core, instance: &crate::store::Instance) -> Result<Option<InstanceArticle>> {
    use crate::catalog::{self, Source};
    use anyhow::Context;
    let Some(record) = pack_record(&core.store.dir(&instance.id)?)? else { return Ok(None); };
    let source: Source = serde_json::from_value(record["source"].clone())?;
    if source == Source::Curseforge && !catalog::sources().curseforge { bail!("CurseForge is not configured"); }
    let project = record["project"].as_str().context("Missing pack project")?;
    let installed = record["version"].as_str().context("Missing pack release")?;
    crate::store::valid_segment(project)?;
    let releases = crate::modpack::releases(&core.client, source, project, "", "").await?;
    let Some(release) = newer_pack(&releases, installed) else { return Ok(None); };
    crate::store::valid_segment(&release.id)?;
    let (label, url) = match source {
        Source::Modrinth => ("Modrinth", format!("https://modrinth.com/modpack/{project}/version/{}", release.id)),
        Source::Curseforge => {
            let info = crate::modpack::project_info(&core.client, source, project).await?;
            let slug = info["slug"].as_str().context("Missing pack slug")?;
            crate::store::valid_segment(slug)?;
            ("CurseForge", format!("https://www.curseforge.com/minecraft/modpacks/{slug}/files/{}", release.id))
        }
    };
    Ok(Some(InstanceArticle {
        article: Article { title: release.name.clone(), date: release.published.chars().take(10).collect(), url },
        source: label.into(), instance_id: instance.id.clone(),
    }))
}
pub async fn instance_updates(core: &crate::Core, id: &str) -> Result<InstanceNews> {
    use std::time::Duration;
    let instance = core.store.instance(id)?;
    if !instance.installed || instance.version == "pending" { return Ok(InstanceNews::default()); }
    let (loader, pack) = tokio::join!(
        tokio::time::timeout(Duration::from_secs(15), loader_article(core, &instance)),
        tokio::time::timeout(Duration::from_secs(15), pack_article(core, &instance)),
    );
    let mut news = InstanceNews::default();
    for (source, result) in [("Loader", loader), ("Modpack", pack)] {
        match result {
            Ok(Ok(Some(article))) => news.articles.push(article),
            Ok(Ok(None)) => {},
            _ => news.unavailable.push(source.into()),
        }
    }
    Ok(news)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn filters_java_news_and_orders_by_date() {
        let feed=json!({"entries":[
            {"title":"Old","date":"2026-01-01","readMoreLink":"https://www.minecraft.net/article/old","newsType":["Java"]},
            {"title":"Bedrock","date":"2026-03-01","readMoreLink":"https://www.minecraft.net/article/bedrock","newsType":["Bedrock"]},
            {"title":"New","date":"2026-02-01","readMoreLink":"https://www.minecraft.net/article/new","newsType":["Java","Bedrock"]},
            {"title":"External","date":"2026-04-01","readMoreLink":"https://example.com","newsType":["Java"]}
        ]});
        let result=articles(&feed);
        assert_eq!(result.iter().map(|a| a.title.as_str()).collect::<Vec<_>>(),vec!["New","Old"]);
    }
    #[test]
    fn article_links_require_official_https_host() {
        assert!(article_url("https://www.minecraft.net/article/news"));
        for link in ["http://www.minecraft.net/article/news","https://www.minecraft.net.evil.test/news","https://user@www.minecraft.net/news","file:///tmp/news"] {
            assert!(!article_url(link));
        }
    }
    #[test]
    fn updates_require_a_known_older_installed_release() {
        let versions = vec!["0.19.5".into(), "0.18.0".into()];
        assert_eq!(newer_loader(&versions, "0.18.0"), Some("0.19.5"));
        assert_eq!(newer_loader(&versions, "0.19.5"), None);
        assert_eq!(newer_loader(&versions, "unknown"), None);
        let releases = vec![
            crate::catalog::Release { id:"new".into(), name:"2".into(), published:"2026-02-01T00:00:00Z".into() },
            crate::catalog::Release { id:"old".into(), name:"1".into(), published:"2026-01-01T00:00:00Z".into() },
        ];
        assert_eq!(newer_pack(&releases, "old").unwrap().id, "new");
        assert!(newer_pack(&releases, "new").is_none());
        assert!(newer_pack(&releases, "unknown").is_none());
    }
    #[test]
    fn release_links_allow_only_known_provider_hosts() {
        for link in ["https://modrinth.com/modpack/example/version/new", "https://www.curseforge.com/minecraft/modpacks/example/files/123", "https://fabricmc.net/use/installer/", "https://quiltmc.org/en/install/client/"] {
            assert!(article_url(link));
        }
        for link in ["https://modrinth.com.evil.test/modpack/x", "https://user@fabricmc.net/", "http://quiltmc.org/", "https://example.com/news", "https://fabricmc.net:444/"] {
            assert!(!article_url(link));
        }
    }
    #[test]
    fn pack_record_is_bounded_and_stays_inside_instance() {
        let directory = tempfile::tempdir().unwrap();
        assert!(pack_record(directory.path()).unwrap().is_none());
        std::fs::create_dir(directory.path().join("game")).unwrap();
        let path = directory.path().join("game/.chest-modpack.json");
        std::fs::write(&path, br#"{"source":"modrinth","project":"pack","version":"old"}"#).unwrap();
        assert_eq!(pack_record(directory.path()).unwrap().unwrap()["version"], "old");
        std::fs::write(&path, vec![b' '; 1024 * 1024 + 1]).unwrap();
        assert!(pack_record(directory.path()).is_err());
        #[cfg(unix)] {
            std::fs::remove_file(&path).unwrap();
            let outside = tempfile::NamedTempFile::new().unwrap();
            std::os::unix::fs::symlink(outside.path(), &path).unwrap();
            assert!(pack_record(directory.path()).is_err());
        }
    }

}
