//! Small instance-artwork derivatives. Source artwork is never modified.
use crate::{instance_files::inside, screenshot_images, Core};
use anyhow::{bail, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{ImageFormat, ImageReader};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::{Cursor, Read},
    path::Path,
    time::UNIX_EPOCH,
};

const EDGE: u32 = 128;
const MAX_FILE: u64 = 2 * 1024 * 1024;
const MAX_THUMBNAIL: u64 = 96 * 1024;
const MAX_PAYLOAD: usize = 8 * 1024 * 1024;
const MAX_ICONS: usize = 512;

fn thumbnail(path: &Path, cache: Option<&Path>) -> Result<Vec<u8>> {
    let info = fs::symlink_metadata(path)?;
    if !info.is_file() || info.len() > MAX_FILE {
        bail!("Invalid instance icon");
    }
    let key = format!(
        "{:x}.png",
        Sha256::digest(
            format!(
                "instance-icon-v1:{}:{}:{:?}",
                path.display(),
                info.len(),
                info.modified()?.duration_since(UNIX_EPOCH)?
            )
            .as_bytes()
        )
    );
    if let Some(directory) = cache {
        if let Ok(path) = inside(directory, &directory.join(&key)) {
            let mut bytes = Vec::new();
            let read = fs::File::open(path)
                .and_then(|file| file.take(MAX_THUMBNAIL + 1).read_to_end(&mut bytes));
            if read.is_ok()
                && bytes.len() as u64 <= MAX_THUMBNAIL
                && screenshot_images::validate_screenshot(&bytes).is_ok()
                && u32::from_be_bytes(bytes[16..20].try_into()?) <= EDGE
                && u32::from_be_bytes(bytes[20..24].try_into()?) <= EDGE
            {
                return Ok(bytes);
            }
        }
    }
    let mut bytes = Vec::new();
    fs::File::open(path)?
        .take(MAX_FILE + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_FILE {
        bail!("Oversized instance icon");
    }
    let (extension, _) =
        crate::artwork_format(&bytes).ok_or_else(|| anyhow::anyhow!("Invalid instance icon"))?;
    let format = match extension {
        "png" => ImageFormat::Png,
        "jpg" => ImageFormat::Jpeg,
        "webp" => ImageFormat::WebP,
        _ => unreachable!(),
    };
    let dimensions = ImageReader::with_format(Cursor::new(&bytes), format).into_dimensions()?;
    if dimensions.0 == 0
        || dimensions.1 == 0
        || dimensions.0 > 4096
        || dimensions.1 > 4096
        || u64::from(dimensions.0) * u64::from(dimensions.1) > 4_000_000
    {
        bail!("Oversized instance icon dimensions");
    }
    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(4096);
    limits.max_image_height = Some(4096);
    limits.max_alloc = Some(32 * 1024 * 1024);
    reader.limits(limits);
    let image = reader.decode()?.thumbnail(EDGE, EDGE);
    let mut output = Cursor::new(Vec::new());
    image.write_to(&mut output, ImageFormat::Png)?;
    let bytes = output.into_inner();
    if bytes.len() as u64 > MAX_THUMBNAIL {
        bail!("Oversized instance thumbnail");
    }
    if let Some(directory) = cache {
        let _ = screenshot_images::cache_image(directory, &key, &bytes);
    }
    Ok(bytes)
}

impl Core {
    pub fn instance_icons(&self) -> HashMap<String, String> {
        let _images = self.image_cache_lock.lock().unwrap();
        let directory = self.store.root.join("thumbnails");
        let cache = fs::create_dir_all(&directory)
            .ok()
            .and_then(|_| inside(&self.store.root, &directory).ok());
        let mut icons = HashMap::new();
        let mut payload = 0;
        for instance in self.store.config().instances {
            if icons.len() >= MAX_ICONS {
                break;
            }
            let Ok(directory) = self.store.dir_for(&instance) else {
                continue;
            };
            for extension in ["png", "jpg", "webp"] {
                let Ok(path) = inside(
                    &directory,
                    &directory.join(format!("game/icon.{extension}")),
                ) else {
                    continue;
                };
                let Ok(bytes) = thumbnail(&path, cache.as_deref()) else {
                    continue;
                };
                let source = format!("data:image/png;base64,{}", STANDARD.encode(bytes));
                if payload + source.len() > MAX_PAYLOAD {
                    return icons;
                }
                payload += source.len();
                icons.insert(instance.id.clone(), source);
                break;
            }
        }
        icons
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn padded_icons_are_small_cached_derivatives_and_originals_survive() {
        let temp = tempfile::tempdir().unwrap();
        let core = Core::new(temp.path().into(), |_| {}, |_| {}).unwrap();
        let mut padded = Cursor::new(Vec::new());
        image::RgbaImage::new(256, 128)
            .write_to(&mut padded, ImageFormat::Png)
            .unwrap();
        let mut padded = padded.into_inner();
        padded.resize(1024 * 1024, 0);
        for i in 0..100 {
            let instance = core
                .store
                .create(format!("Icon {i}"), "1.21.4".into(), "grass".into())
                .unwrap();
            fs::write(
                core.store.dir(&instance.id).unwrap().join("game/icon.png"),
                &padded,
            )
            .unwrap();
        }
        let icons = core.instance_icons();
        assert_eq!(icons.len(), 100);
        assert!(icons.values().map(String::len).sum::<usize>() < 1024 * 1024);
        for instance in core.store.config().instances {
            let bytes = STANDARD
                .decode(icons[&instance.id].split_once(',').unwrap().1)
                .unwrap();
            let icon = image::load_from_memory(&bytes).unwrap();
            assert_eq!((icon.width(), icon.height()), (128, 64));
            assert_eq!(
                fs::read(core.store.dir(&instance.id).unwrap().join("game/icon.png")).unwrap(),
                padded
            );
        }
        assert_eq!(core.instance_icons(), icons);
    }
    #[test]
    fn dimensions_formats_and_aggregate_are_bounded() {
        let temp = tempfile::tempdir().unwrap();
        let cache = temp.path().join("cache");
        fs::create_dir(&cache).unwrap();
        for format in [ImageFormat::Png, ImageFormat::Jpeg, ImageFormat::WebP] {
            let path = temp.path().join(format!(
                "{}.{}",
                format.extensions_str()[0],
                format.extensions_str()[0]
            ));
            image::RgbImage::new(256, 256)
                .save_with_format(&path, format)
                .unwrap();
            let small = thumbnail(&path, Some(&cache)).unwrap();
            assert!(small.len() as u64 <= MAX_THUMBNAIL);
            assert_eq!(image::load_from_memory(&small).unwrap().width(), EDGE);
        }
        let path = temp.path().join("large.png");
        image::RgbaImage::new(4097, 1).save(&path).unwrap();
        assert!(thumbnail(&path, None).is_err());
        image::RgbaImage::new(2048, 2048).save(&path).unwrap();
        assert!(thumbnail(&path, None).is_err());
        let core = Core::new(temp.path().join("profile"), |_| {}, |_| {}).unwrap();
        for i in 0..MAX_ICONS + 1 {
            let instance = core
                .store
                .create(format!("Icon {i}"), "1.21.4".into(), "grass".into())
                .unwrap();
            image::RgbaImage::new(1, 1)
                .save(core.store.dir(&instance.id).unwrap().join("game/icon.png"))
                .unwrap();
        }
        let icons = core.instance_icons();
        assert_eq!(icons.len(), MAX_ICONS);
        assert!(icons.values().map(String::len).sum::<usize>() <= MAX_PAYLOAD);
        // High-entropy derivatives exercise the byte budget before the count budget.
        let mut noise = image::RgbaImage::new(128, 128);
        let mut seed = 1u32;
        for pixel in noise.pixels_mut() {
            for channel in &mut pixel.0 {
                seed ^= seed << 13;
                seed ^= seed >> 17;
                seed ^= seed << 5;
                *channel = seed as u8;
            }
        }
        let mut output = Cursor::new(Vec::new());
        noise.write_to(&mut output, ImageFormat::Png).unwrap();
        for instance in core.store.config().instances {
            fs::write(
                core.store.dir(&instance.id).unwrap().join("game/icon.png"),
                output.get_ref(),
            )
            .unwrap();
        }
        let icons = core.instance_icons();
        assert!(icons.len() < MAX_ICONS);
        assert!(icons.values().map(String::len).sum::<usize>() <= MAX_PAYLOAD);
    }
}
