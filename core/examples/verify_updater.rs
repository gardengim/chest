// Verify the exact updater signature format, then reject a modified artifact.
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};
use std::{env, fs};
fn decoded(text:&str)->Result<String>{Ok(String::from_utf8(STANDARD.decode(text.trim())?)?)}
fn main()->Result<()> {
    let args:Vec<_>=env::args().collect();
    anyhow::ensure!(args.len()==3,"Usage: verify_updater PUBLIC_KEY ARTIFACT (reads ARTIFACT.sig)");
    let key=PublicKey::decode(&decoded(&fs::read_to_string(&args[1])?)?)?;
    let signature=Signature::decode(&decoded(&fs::read_to_string(format!("{}.sig",args[2]))?)?)?;
    let mut bytes=fs::read(&args[2])?;
    key.verify(&bytes,&signature,true).context("Updater signature verification failed")?;
    anyhow::ensure!(!bytes.is_empty(),"Empty updater artifact");
    bytes[0]^=1;
    anyhow::ensure!(key.verify(&bytes,&signature,true).is_err(),"Modified artifact was accepted");
    println!("Updater signature verified; modified artifact rejected.");
    Ok(())
}
