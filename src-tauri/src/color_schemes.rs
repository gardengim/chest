use std::{fs, io::{Read, Write}, path::Path};

const LIMIT: usize = 64 * 1024;

pub fn read(path: &Path) -> Result<String, String> {
    let mut source = String::new();
    fs::File::open(path).map_err(|e| e.to_string())?
        .take(LIMIT as u64 + 1).read_to_string(&mut source).map_err(|e| e.to_string())?;
    if source.len() > LIMIT { return Err("Themes must not exceed 64 KB.".into()); }
    Ok(source)
}

pub fn write(path: &Path, source: &str) -> Result<(), String> {
    if source.len() > LIMIT { return Err("Themes must not exceed 64 KB.".into()); }
    // Export is normalized JSON. Never truncate an existing file for bad input
    // or a failed write: publish a complete sibling file with an atomic rename.
    serde_json::from_str::<serde_json::Value>(source).map_err(|e| e.to_string())?;
    let temporary = path.with_file_name(format!(".chest-scheme-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| -> std::io::Result<()> {
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temporary)?;
        file.write_all(source.as_bytes())?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, path)
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scheme_files_round_trip_reject_oversized_input_and_preserve_existing_exports() {
        let dir = std::env::temp_dir().join(format!("chest-scheme-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&dir).unwrap();
        let path = dir.join("palette.json");
        let source = r##"{"version":1,"name":"Palette","mode":"dark","colors":{"page":"#123456"}}"##;
        write(&path, source).unwrap();
        assert_eq!(read(&path).unwrap(), source);
        assert!(write(&path, "not JSON").is_err());
        assert_eq!(read(&path).unwrap(), source);
        let large = "x".repeat(LIMIT + 1);
        assert!(write(&path, &large).is_err());
        assert_eq!(read(&path).unwrap(), source);
        fs::write(&path, large).unwrap();
        assert!(read(&path).is_err());
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 1);
        fs::remove_dir_all(dir).unwrap();
    }
}
