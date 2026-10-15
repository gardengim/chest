use crate::{instance_files::inside, Core};
use anyhow::{bail, Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::Path,
    time::Duration,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const MAX_ICON: usize = 256 * 1024;
const MAX_STATUS: usize = 512 * 1024;
fn png(bytes: &[u8]) -> Result<String> {
    if bytes.len() > MAX_ICON
        || bytes.len() < 24
        || &bytes[..8] != b"\x89PNG\r\n\x1a\n"
        || &bytes[12..16] != b"IHDR"
    {
        bail!("Invalid icon");
    }
    let width = u32::from_be_bytes(bytes[16..20].try_into()?);
    let height = u32::from_be_bytes(bytes[20..24].try_into()?);
    if width == 0 || height == 0 || width > 512 || height > 512 {
        bail!("Oversized icon dimensions");
    }
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
}
fn read_png(root: &Path, path: &Path) -> Result<String> {
    let path = inside(root, path)?;
    let mut bytes = Vec::new();
    fs::File::open(path)?
        .take(MAX_ICON as u64 + 1)
        .read_to_end(&mut bytes)?;
    png(&bytes)
}
pub(crate) fn supplied_icon(icon: &str) -> Result<String> {
    let encoded = icon.strip_prefix("data:image/png;base64,").unwrap_or(icon);
    if encoded.len() > MAX_ICON * 4 / 3 + 4 {
        bail!("Oversized server icon");
    }
    png(&STANDARD.decode(encoded)?)
}
fn varint(value: i32, bytes: &mut Vec<u8>) {
    let mut remaining = value as u32;
    loop {
        let mut byte = (remaining & 0x7f) as u8;
        remaining >>= 7;
        if remaining != 0 {
            byte |= 0x80;
        }
        bytes.push(byte);
        if remaining == 0 {
            break;
        }
    }
}
fn parse_varint(bytes: &[u8], cursor: &mut usize) -> Result<usize> {
    let mut value = 0u32;
    for shift in (0..35).step_by(7) {
        let byte = *bytes.get(*cursor).context("Incomplete status response")?;
        *cursor += 1;
        if shift == 28 && byte > 7 {
            bail!("Invalid status length");
        }
        value |= u32::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 {
            return Ok(value as usize);
        }
    }
    bail!("Invalid status length")
}
async fn status_icon(address: &str) -> Result<Option<String>> {
    let address = url::Url::parse(&format!("minecraft://{address}"))?;
    let host = address
        .host_str()
        .context("Missing server hostname")?
        .trim_matches(['[', ']']);
    let port = address.port().unwrap_or(25565);
    let mut socket = tokio::net::TcpStream::connect((host, port)).await?;
    let mut handshake = vec![0];
    varint(-1, &mut handshake);
    varint(host.len() as i32, &mut handshake);
    handshake.extend_from_slice(host.as_bytes());
    handshake.extend_from_slice(&port.to_be_bytes());
    handshake.push(1); // Status, never login.
    let mut request = Vec::new();
    varint(handshake.len() as i32, &mut request);
    request.extend(handshake);
    request.extend([1, 0]); // Status request.
    socket.write_all(&request).await?;
    let mut prefix = Vec::new();
    loop {
        let byte = socket.read_u8().await?;
        prefix.push(byte);
        if byte & 0x80 == 0 {
            break;
        }
        if prefix.len() >= 5 {
            bail!("Invalid status frame");
        }
    }
    let length = parse_varint(&prefix, &mut 0)?;
    if length > MAX_STATUS {
        bail!("Server status exceeds size limit");
    }
    let mut response = vec![0; length];
    socket.read_exact(&mut response).await?;
    let mut cursor = 0;
    if parse_varint(&response, &mut cursor)? != 0 {
        bail!("Unexpected status packet");
    }
    let length = parse_varint(&response, &mut cursor)?;
    if length != response.len().saturating_sub(cursor) {
        bail!("Invalid status payload");
    }
    let value: serde_json::Value = serde_json::from_slice(&response[cursor..])?;
    value
        .get("favicon")
        .and_then(|icon| icon.as_str())
        .map(supplied_icon)
        .transpose()
}
impl Core {
    pub fn world_icon(&self, id: &str, name: &str) -> Result<Option<String>> {
        let world = self.instance_file(id, "saves", name)?;
        // Artwork is optional; corrupt or absent images must not hide the world.
        Ok(read_png(&world, &world.join("icon.png")).ok())
    }
    pub async fn server_icon(&self, id: &str) -> Result<Option<String>> {
        uuid::Uuid::parse_str(id)?;
        let bookmark = self
            .store
            .config()
            .server_bookmarks
            .into_iter()
            .find(|item| item.id == id)
            .context("Server bookmark not found")?;
        if let Some(instance) = &bookmark.instance_id {
            if let Ok(servers) = self
                .instance_folder(instance)
                .and_then(|game| crate::instance_files::servers(&game))
            {
                if let Some(icon) = servers
                    .iter()
                    .find(|server| server.ip.eq_ignore_ascii_case(&bookmark.address))
                    .and_then(|server| server.icon.as_deref())
                    .and_then(|icon| supplied_icon(icon).ok())
                {
                    return Ok(Some(icon));
                }
            }
        }
        let path = self.store.root.join("artwork/servers").join(format!(
            "{id}-{:x}.png",
            Sha256::digest(bookmark.address.as_bytes())
        ));
        let cached = read_png(&self.store.root, &path).ok();
        let fresh = fs::metadata(&path)
            .and_then(|metadata| metadata.modified())
            .ok()
            .and_then(|modified| modified.elapsed().ok())
            .is_some_and(|age| age < Duration::from_secs(24 * 60 * 60));
        if fresh && cached.is_some() {
            return Ok(cached);
        }
        // A bounded, on-demand request, with no startup scan or polling.
        match tokio::time::timeout(Duration::from_secs(3), status_icon(&bookmark.address)).await {
            Ok(Ok(Some(icon))) => {
                let create_cache = (|| -> Result<std::path::PathBuf> {
                    let artwork = self.store.root.join("artwork");
                    if !artwork.exists() {
                        fs::create_dir(&artwork)?;
                    }
                    let artwork = inside(&self.store.root, &artwork)?;
                    let directory = artwork.join("servers");
                    if !directory.exists() {
                        fs::create_dir(&directory)?;
                    }
                    inside(&self.store.root, &directory)
                })();
                if let Ok(directory) = create_cache {
                    let target = directory.join(format!(
                        "{id}-{:x}.png",
                        Sha256::digest(bookmark.address.as_bytes())
                    ));
                    let temporary = directory.join(format!("{}.tmp", uuid::Uuid::new_v4()));
                    let save = (|| -> Result<()> {
                        let bytes =
                            STANDARD.decode(icon.trim_start_matches("data:image/png;base64,"))?;
                        let mut file = fs::OpenOptions::new()
                            .write(true)
                            .create_new(true)
                            .open(&temporary)?;
                        file.write_all(&bytes)?;
                        drop(file);
                        // Renaming replaces the directory entry, never follows a target link.
                        fs::rename(&temporary, &target)?;
                        Ok(())
                    })();
                    if save.is_err() {
                        let _ = fs::remove_file(temporary);
                    }
                }
                Ok(Some(icon))
            }
            _ => Ok(cached),
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn image() -> Vec<u8> {
        STANDARD.decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ9kAAAAASUVORK5CYII=").unwrap()
    }
    #[test]
    fn validates_icon_type_size_and_dimensions() {
        assert!(png(&image()).is_ok());
        assert!(png(b"not a png").is_err());
        let mut big = image();
        big[16..20].copy_from_slice(&10000u32.to_be_bytes());
        assert!(png(&big).is_err());
        assert!(supplied_icon("data:image/svg+xml,anything").is_err());
        assert!(png(&vec![0; MAX_ICON + 1]).is_err());
    }
    #[test]
    fn world_icons_are_optional_and_confined() {
        let directory = tempfile::tempdir().unwrap();
        let core = Core::new(directory.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core
            .store
            .create("World".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        let world = core
            .instance_folder(&instance.id)
            .unwrap()
            .join("saves/Test");
        fs::create_dir_all(&world).unwrap();
        assert!(core.world_icon(&instance.id, "Test").unwrap().is_none());
        fs::write(world.join("icon.png"), image()).unwrap();
        assert!(core.world_icon(&instance.id, "Test").unwrap().is_some());
        assert!(core.world_icon(&instance.id, "../Test").is_err());
        #[cfg(unix)]
        {
            fs::remove_file(world.join("icon.png")).unwrap();
            let outside = directory.path().join("private.png");
            fs::write(&outside, image()).unwrap();
            std::os::unix::fs::symlink(outside, world.join("icon.png")).unwrap();
            assert!(core.world_icon(&instance.id, "Test").unwrap().is_none());
        }
    }
    #[tokio::test]
    async fn uses_minecraft_cached_icons_without_network() {
        let directory = tempfile::tempdir().unwrap();
        let core = Core::new(directory.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core
            .store
            .create("World".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        let game = core.instance_folder(&instance.id).unwrap();
        fs::create_dir_all(&game).unwrap();
        let expected = png(&image()).unwrap();
        fs::write(game.join("servers.dat"),fastnbt::to_bytes(&serde_json::json!({"servers":[{"name":"Friends","ip":"unreachable.invalid","icon":STANDARD.encode(image())}]})).unwrap()).unwrap();
        let config = core
            .save_server_bookmark(crate::server_bookmarks::ServerBookmark {
                id: String::new(),
                name: "Friends".into(),
                address: "unreachable.invalid".into(),
                instance_id: Some(instance.id),
                expected_version: String::new(),
                expected_loader: None,
            })
            .unwrap();
        assert_eq!(
            core.server_icon(&config.server_bookmarks[0].id)
                .await
                .unwrap(),
            Some(expected)
        );
    }
    #[tokio::test]
    async fn reads_status_icon_from_a_real_framed_response() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            // Consume the handshake and status frames even when the client fragments them.
            for _ in 0..2 {
                let mut prefix = Vec::new();
                loop {
                    let byte = socket.read_u8().await.unwrap();
                    prefix.push(byte);
                    assert!(prefix.len() <= 5);
                    if byte & 0x80 == 0 { break; }
                }
                let length = parse_varint(&prefix, &mut 0).unwrap();
                assert!(length <= 512);
                let mut frame = vec![0; length];
                socket.read_exact(&mut frame).await.unwrap();
            }
            let json = serde_json::json!({"favicon":png(&image()).unwrap()}).to_string();
            let mut response = vec![0];
            varint(json.len() as i32, &mut response);
            response.extend(json.as_bytes());
            let mut frame = Vec::new();
            varint(response.len() as i32, &mut frame);
            frame.extend(response);
            for chunk in frame.chunks(3) {
                socket.write_all(chunk).await.unwrap();
            }
        });
        assert!(status_icon(&address.to_string()).await.unwrap().is_some());
        task.await.unwrap();
    }
}
