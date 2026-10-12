use crate::store::{safe_join, valid_segment};
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashMap, path::PathBuf};

pub const MANIFEST: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
#[derive(Clone, Deserialize, Serialize)]
pub struct Version {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub url: String,
    pub sha1: String,
}
#[derive(Deserialize)]
pub struct Manifest {
    pub versions: Vec<Version>,
}
#[derive(Clone, Debug)]
pub struct Download {
    pub url: String,
    pub hash: String,
    pub path: PathBuf,
    pub phase: String,
}
pub fn os() -> &'static str {
    match std::env::consts::OS {
        "macos" => "osx",
        other => other,
    }
}
pub fn arch() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "amd64",
        "x86" => "x86",
        other => other,
    }
}
pub fn supported_release(id: &str) -> bool {
    let n = id
        .split('.')
        .filter_map(|n| n.parse::<u32>().ok())
        .collect::<Vec<_>>();
    n.first().is_some_and(|n| *n >= 2)
        || (n.first() == Some(&1) && n.get(1).is_some_and(|n| *n >= 19))
}
pub fn allowed(item: &Value, platform: &str, architecture: &str) -> bool {
    let Some(rules) = item.get("rules").and_then(Value::as_array) else {
        return true;
    };
    let mut allow = false;
    for rule in rules {
        let features = rule
            .get("features")
            .and_then(Value::as_object)
            .map(|f| f.values().all(|v| v == false))
            .unwrap_or(true);
        let os_match = rule
            .get("os")
            .map(|o| {
                let name = o
                    .get("name")
                    .and_then(Value::as_str)
                    .map(|n| n == platform)
                    .unwrap_or(true);
                let arch = o
                    .get("arch")
                    .and_then(Value::as_str)
                    .map(|a| {
                        regex::Regex::new(a)
                            .map(|r| r.is_match(architecture))
                            .unwrap_or(false)
                    })
                    .unwrap_or(true);
                // Modern vanilla metadata only uses Windows version matching for Windows 10-specific args.
                let version = o
                    .get("version")
                    .and_then(Value::as_str)
                    .map(|v| {
                        platform == "windows"
                            && regex::Regex::new(v)
                                .map(|r| r.is_match("10.0"))
                                .unwrap_or(false)
                    })
                    .unwrap_or(true);
                name && arch && version
            })
            .unwrap_or(true);
        if features && os_match {
            allow = rule.get("action").and_then(Value::as_str) == Some("allow");
        }
    }
    allow
}
pub fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str> {
    v.get(key)
        .and_then(Value::as_str)
        .with_context(|| format!("Metadata is missing {key}"))
}
pub fn download(v: &Value, path: PathBuf, phase: &str) -> Result<Download> {
    let url = text(v, "url")?.to_string();
    if !url.starts_with("https://") {
        bail!("Download URL must use HTTPS");
    }
    Ok(Download {
        url,
        hash: text(v, "sha1")?.into(),
        path,
        phase: phase.into(),
    })
}
pub fn libraries(
    meta: &Value,
    root: &std::path::Path,
) -> Result<(Vec<Download>, Vec<PathBuf>, Vec<PathBuf>)> {
    let mut downloads = vec![];
    let mut classpath = vec![];
    let mut natives = vec![];
    for lib in meta
        .get("libraries")
        .and_then(Value::as_array)
        .context("Missing libraries")?
    {
        if !allowed(lib, os(), arch()) {
            continue;
        }
        if let Some(a) = lib.pointer("/downloads/artifact") {
            let path = safe_join(&root.join("libraries"), text(a, "path")?)?;
            downloads.push(download(a, path.clone(), "Downloading libraries")?);
            classpath.push(path);
        }
        if let Some(native) = lib
            .get("natives")
            .and_then(|n| n.get(os()))
            .and_then(Value::as_str)
        {
            let classifier = native.replace(
                "${arch}",
                if cfg!(target_pointer_width = "64") {
                    "64"
                } else {
                    "32"
                },
            );
            let a = lib
                .get("downloads")
                .and_then(|d| d.get("classifiers"))
                .and_then(|c| c.get(&classifier))
                .context("Missing native library")?;
            let path = safe_join(&root.join("libraries"), text(a, "path")?)?;
            downloads.push(download(a, path.clone(), "Downloading native libraries")?);
            natives.push(path);
        }
    }
    Ok((downloads, classpath, natives))
}
pub fn expand_arguments(arguments: &Value, vars: &HashMap<String, String>) -> Result<Vec<String>> {
    let mut out = vec![];
    for arg in arguments
        .as_array()
        .context("Unsupported legacy version: choose Minecraft 1.19 or newer")?
    {
        let value = if arg.is_string() {
            arg
        } else {
            if !allowed(arg, os(), arch()) {
                continue;
            }
            &arg["value"]
        };
        let list = if let Some(s) = value.as_str() {
            vec![s]
        } else {
            value
                .as_array()
                .context("Invalid argument")?
                .iter()
                .map(|v| v.as_str().context("Invalid argument"))
                .collect::<Result<Vec<_>>>()?
        };
        for value in list {
            let mut result = value.to_string();
            for (k, v) in vars {
                result = result.replace(&format!("${{{k}}}"), v);
            }
            if result.contains("${") {
                bail!("Unsupported launch argument: {value}");
            }
            out.push(result);
        }
    }
    Ok(out)
}
pub fn version_dir(root: &std::path::Path, id: &str) -> Result<PathBuf> {
    valid_segment(id)?;
    Ok(root.join("versions").join(id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn rule_order_and_features() {
        let item = json!({"rules":[{"action":"allow"},{"action":"disallow","os":{"name":"osx"}}]});
        assert!(allowed(&item, "windows", "amd64"));
        assert!(!allowed(&item, "osx", "aarch64"));
        assert!(!allowed(
            &json!({"rules":[{"action":"allow","features":{"is_demo_user":true}}]}),
            "linux",
            "amd64"
        ));
        assert!(allowed(
            &json!({"rules":[{"action":"allow","os":{"arch":"aarch64"}}]}),
            "osx",
            "aarch64"
        ));
    }
    #[test]
    fn expands_without_shell_splitting() {
        let vars = HashMap::from([("game_directory".into(), "/a folder/game".into())]);
        assert_eq!(
            expand_arguments(&json!(["--gameDir", "${game_directory}"]), &vars).unwrap(),
            vec!["--gameDir", "/a folder/game"]
        );
        assert!(expand_arguments(&json!(["${unknown}"]), &vars).is_err());
    }
    #[test]
    fn modern_versions() {
        assert!(supported_release("26.3"));
        assert!(supported_release("1.21.4"));
        assert!(!supported_release("1.12.2"));
    }
}
