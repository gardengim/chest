//! Bounded local PNG derivatives. Originals are never modified.
use crate::{instance_files::inside, Core};
use anyhow::{bail, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{ImageFormat, ImageReader};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Cursor, Read},
    path::Path,
    time::UNIX_EPOCH,
};

const MAX_FILE: u64 = 16 * 1024 * 1024;
const CACHE_BYTES: u64 = 128 * 1024 * 1024;

fn encoded(bytes: &[u8]) -> String {
    format!("data:image/png;base64,{}", STANDARD.encode(bytes))
}

fn validate(bytes: &[u8]) -> Result<()> {
    if bytes.len() < 24 || &bytes[..8] != b"\x89PNG\r\n\x1a\n" || &bytes[12..16] != b"IHDR" {
        bail!("Invalid screenshot");
    }
    let width = u32::from_be_bytes(bytes[16..20].try_into()?);
    let height = u32::from_be_bytes(bytes[20..24].try_into()?);
    if width == 0
        || height == 0
        || width > 8192
        || height > 8192
        || u64::from(width) * u64::from(height) > 36_000_000
    {
        bail!("Screenshot is too large to preview; open the original file instead");
    }
    Ok(())
}

impl Core {
    pub fn screenshot_thumbnail(&self, id: &str, name: &str, edge: u32) -> Result<String> {
        let _cache = self.image_cache_lock.lock().unwrap();
        let edge = match edge {
            0..=256 => 256,
            257..=512 => 512,
            _ => 1024,
        };
        let path = self.instance_file(id, "screenshots", name)?;
        if !name.to_ascii_lowercase().ends_with(".png") {
            bail!("Expected a PNG screenshot");
        }
        let metadata = fs::metadata(&path)?;
        if metadata.len() > MAX_FILE {
            bail!("Invalid or oversized screenshot");
        }
        let signature = format!(
            "v1:{id}:{name}:{}:{:?}:{edge}",
            metadata.len(),
            metadata.modified()?.duration_since(UNIX_EPOCH)?
        );
        let key = format!("{:x}.png", Sha256::digest(signature.as_bytes()));
        let directory = self.store.root.join("thumbnails");
        // Viewing an original must still work when the optional cache is unwritable.
        let cache = fs::create_dir_all(&directory)
            .ok()
            .and_then(|_| inside(&self.store.root, &directory).ok());
        if let Some(directory) = &cache {
            let destination = directory.join(&key);
            if let Ok(file) = inside(directory, &destination) {
                if fs::metadata(&file).is_ok_and(|metadata| metadata.len() <= 8 * 1024 * 1024) {
                    if let Ok(bytes) = fs::read(file) {
                        if validate(&bytes).is_ok()
                            && u32::from_be_bytes(bytes[16..20].try_into()?) <= edge
                            && u32::from_be_bytes(bytes[20..24].try_into()?) <= edge
                        {
                            return Ok(encoded(&bytes));
                        }
                    }
                }
            }
        }
        let mut bytes = Vec::new();
        fs::File::open(path)?
            .take(MAX_FILE + 1)
            .read_to_end(&mut bytes)?;
        if bytes.len() as u64 > MAX_FILE {
            bail!("Invalid or oversized screenshot");
        }
        validate(&bytes)?;
        let mut reader = ImageReader::with_format(Cursor::new(bytes), ImageFormat::Png);
        let mut limits = image::Limits::default();
        limits.max_image_width = Some(8192);
        limits.max_image_height = Some(8192);
        limits.max_alloc = Some(128 * 1024 * 1024);
        reader.limits(limits);
        let image = reader.decode()?.thumbnail(edge, edge);
        let mut output = Cursor::new(Vec::new());
        image.write_to(&mut output, ImageFormat::Png)?;
        let bytes = output.into_inner();
        if let Some(directory) = cache {
            let _ = cache_image(&directory, &key, &bytes);
        }
        Ok(encoded(&bytes))
    }
}

pub(crate) fn cache_image(directory: &Path, key: &str, bytes: &[u8]) -> Result<()> {
    let destination = directory.join(key);
    let temporary = directory.join(format!("{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| -> Result<()> {
        fs::write(&temporary, bytes)?;
        fs::rename(&temporary, destination)?;
        let mut files = fs::read_dir(directory)?
            .filter_map(Result::ok)
            .filter(|entry| {
                entry.file_type().is_ok_and(|kind| kind.is_file())
                    && entry.path().extension().is_some_and(|ext| ext == "png")
            })
            .filter_map(|entry| {
                entry
                    .metadata()
                    .ok()
                    .map(|meta| (meta.modified().ok(), meta.len(), entry.path()))
            })
            .collect::<Vec<_>>();
        files.sort_by_key(|file| file.0);
        let mut total: u64 = files.iter().map(|file| file.1).sum();
        let mut count = files.len();
        for (_, size, file) in files {
            if total <= CACHE_BYTES && count <= 256 {
                break;
            }
            if fs::remove_file(file).is_ok() {
                total -= size;
                count -= 1;
            }
        }
        Ok(())
    })();
    let _ = fs::remove_file(temporary);
    result
}

pub(crate) fn validate_screenshot(bytes: &[u8]) -> Result<()> {
    validate(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn thumbnails_are_bounded_cached_and_preserve_originals() {
        let temp = tempfile::tempdir().unwrap();
        let core = Core::new(temp.path().into(), |_| {}, |_| {}).unwrap();
        let instance = core
            .store
            .create("Photos".into(), "1.21.4".into(), "grass".into())
            .unwrap();
        let directory = core
            .instance_folder(&instance.id)
            .unwrap()
            .join("screenshots");
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("large.png");
        image::RgbaImage::new(2048, 1024).save(&path).unwrap();
        let original = fs::read(&path).unwrap();
        let first = core
            .screenshot_thumbnail(&instance.id, "large.png", 256)
            .unwrap();
        let decoded = STANDARD.decode(first.split_once(',').unwrap().1).unwrap();
        let small = image::load_from_memory(&decoded).unwrap();
        assert_eq!((small.width(), small.height()), (256, 128));
        assert_eq!(
            core.screenshot_thumbnail(&instance.id, "large.png", 256)
                .unwrap(),
            first
        );
        assert_eq!(fs::read(path).unwrap(), original);
        let mut oversized = decoded;
        oversized[16..20].copy_from_slice(&100_000u32.to_be_bytes());
        assert!(validate(&oversized).is_err());
    }
}
