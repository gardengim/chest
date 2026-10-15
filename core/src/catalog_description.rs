//! Fetch full descriptions only when requested, with bounded time and response size.
use crate::{catalog::Source, store};
use anyhow::{bail, Context, Result};
use serde::Serialize;
use serde_json::Value;

const RESPONSE_LIMIT: usize = 1024 * 1024;
const BODY_LIMIT: usize = 512 * 1024;
#[derive(Serialize)]
pub struct Description { pub format: &'static str, pub body: String }

fn normalize(source: Source, value: Value) -> Result<Description> {
    let (format, key) = match source {
        Source::Modrinth => ("markdown", "body"),
        Source::Curseforge => ("html", "data"),
    };
    let body = value[key].as_str().context("Invalid description response")?;
    if body.len() > BODY_LIMIT { bail!("Description exceeds size limit"); }
    Ok(Description { format, body: body.into() })
}
async fn fetch(client: &reqwest::Client, source: Source, project: &str) -> Result<Description> {
    let request = match source {
        Source::Modrinth => client.get(format!("https://api.modrinth.com/v2/project/{project}")),
        Source::Curseforge => {
            project.parse::<u64>().context("Invalid CurseForge project ID")?;
            let key = std::env::var("CHEST_CURSEFORGE_API_KEY").ok()
                .filter(|key| !key.trim().is_empty()).context("CurseForge API key is unavailable")?;
            client.get(format!("https://api.curseforge.com/v1/mods/{project}/description")).header("x-api-key", key)
        }
    };
    let mut response = request.send().await?.error_for_status()?;
    if response.content_length().is_some_and(|length| length > RESPONSE_LIMIT as u64) { bail!("Description exceeds size limit"); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        if bytes.len() + chunk.len() > RESPONSE_LIMIT { bail!("Description exceeds size limit"); }
        bytes.extend_from_slice(&chunk);
    }
    normalize(source, serde_json::from_slice(&bytes)?)
}
pub async fn description(client: &reqwest::Client, source: Source, project: &str) -> Result<Description> {
    store::valid_segment(project)?;
    tokio::time::timeout(std::time::Duration::from_secs(15), fetch(client, source, project)).await?
}
fn external_url(link: &str) -> Result<url::Url> {
    let url = url::Url::parse(link)?;
    if !matches!(url.scheme(), "https" | "http") || url.host_str().is_none()
        || !url.username().is_empty() || url.password().is_some() { bail!("Invalid description link"); }
    Ok(url)
}
pub fn open_link(link: &str) -> Result<()> { open::that(external_url(link)?.as_str())?; Ok(()) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normalizes_provider_formats_and_bounds_content() {
        assert_eq!(normalize(Source::Modrinth, serde_json::json!({"body":"# Title"})).unwrap().format, "markdown");
        assert_eq!(normalize(Source::Curseforge, serde_json::json!({"data":"<h1>Title</h1>"})).unwrap().body, "<h1>Title</h1>");
        assert!(normalize(Source::Modrinth, serde_json::json!({"body":"x".repeat(BODY_LIMIT+1)})).is_err());
        assert!(normalize(Source::Curseforge, serde_json::json!({"data":{}})).is_err());
        assert!(external_url("javascript:alert(1)").is_err());
        assert!(external_url("https://user:secret@example.com").is_err());
        assert!(external_url("https://example.com/guide").is_ok());
    }
}
