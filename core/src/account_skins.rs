use crate::{instance_files::inside,Core};
use anyhow::{bail,Context,Result};
use base64::{engine::general_purpose::STANDARD,Engine};
use serde_json::Value;
use std::{fs,io::Read,path::Path,time::Duration};

const MAX_SKIN:usize=256*1024;
fn skin(bytes:&[u8])->Result<String>{
    if bytes.len()<24 || bytes.len()>MAX_SKIN || &bytes[..8]!=b"\x89PNG\r\n\x1a\n" || &bytes[12..16]!=b"IHDR"{bail!("Invalid skin image");}
    let width=u32::from_be_bytes(bytes[16..20].try_into()?);let height=u32::from_be_bytes(bytes[20..24].try_into()?);
    if width!=64 || ![32,64].contains(&height){bail!("Unsupported skin dimensions");}
    Ok(format!("data:image/png;base64,{}",STANDARD.encode(bytes)))
}
fn cached(root:&Path,path:&Path)->Option<String>{
    let path=inside(root,path).ok()?;let mut bytes=vec![];
    fs::File::open(path).ok()?.take(MAX_SKIN as u64+1).read_to_end(&mut bytes).ok()?;skin(&bytes).ok()
}
fn texture_url(profile:&Value)->Result<Option<url::Url>>{
    let encoded=profile.get("properties").and_then(Value::as_array).and_then(|properties|properties.iter().find(|property|property["name"]=="textures")).and_then(|property|property["value"].as_str());
    let Some(encoded)=encoded else{return Ok(None)};
    if encoded.len()>64*1024{bail!("Oversized skin profile");}
    let textures:Value=serde_json::from_slice(&STANDARD.decode(encoded)?)?;
    let Some(address)=textures.pointer("/textures/SKIN/url").and_then(Value::as_str) else{return Ok(None)};
    let mut url=url::Url::parse(address)?;
    if !["http","https"].contains(&url.scheme()) || url.host_str()!=Some("textures.minecraft.net") || url.port().is_some() || !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some(){bail!("Invalid skin texture URL");}
    let hash=url.path().strip_prefix("/texture/").context("Invalid skin texture path")?;
    if hash.is_empty() || hash.len()>64 || !hash.bytes().all(|byte|byte.is_ascii_hexdigit()){bail!("Invalid skin texture hash");}
    url.set_scheme("https").map_err(|_|anyhow::anyhow!("Invalid skin scheme"))?;Ok(Some(url))
}
async fn bounded(mut response:reqwest::Response,limit:usize)->Result<Vec<u8>>{
    response=response.error_for_status()?;
    if response.content_length().is_some_and(|length|length>limit as u64){bail!("Skin response exceeds size limit");}
    let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await?{if bytes.len()+chunk.len()>limit{bail!("Skin response exceeds size limit");}bytes.extend_from_slice(&chunk);}Ok(bytes)
}
impl Core{
    pub async fn account_skin(&self,id:&str)->Result<Option<String>>{
        let uuid=uuid::Uuid::parse_str(id)?;
        if !self.store.config().accounts.iter().any(|account|uuid::Uuid::parse_str(&account.id).ok()==Some(uuid)){bail!("Account not found");}
        let directory=self.store.root.join("skins");fs::create_dir_all(&directory)?;let directory=inside(&self.store.root,&directory)?;
        let file=directory.join(format!("{}.png",uuid.simple()));let previous=cached(&directory,&file);
        let fresh=fs::metadata(&file).and_then(|meta|meta.modified()).ok().and_then(|modified|modified.elapsed().ok()).is_some_and(|age|age<Duration::from_secs(6*60*60));
        if fresh && previous.is_some(){return Ok(previous)}
        let download=async{
            let profile=self.client.get(format!("https://sessionserver.mojang.com/session/minecraft/profile/{}",uuid.simple())).timeout(Duration::from_secs(6)).send().await?;
            let profile:Value=serde_json::from_slice(&bounded(profile,64*1024).await?)?;
            let Some(url)=texture_url(&profile)? else{return Ok(None)};
            let bytes=bounded(self.client.get(url).timeout(Duration::from_secs(6)).send().await?,MAX_SKIN).await?;
            let image=skin(&bytes)?;
            let temporary=directory.join(format!("{}.tmp",uuid::Uuid::new_v4()));
            // Artwork caching is optional and never changes account credentials.
            if fs::write(&temporary,&bytes).is_ok(){let _=fs::rename(&temporary,&file);let _=fs::remove_file(&temporary);}
            Ok::<_,anyhow::Error>(Some(image))
        }.await;
        match download{Ok(value)=>Ok(value.or(previous)),Err(_) if previous.is_some()=>Ok(previous),Err(error)=>Err(error)}
    }
}
#[cfg(test)]mod tests{
    use super::*;
    #[tokio::test]async fn cached_skin_works_offline_and_unknown_accounts_are_rejected(){
        let directory=tempfile::tempdir().unwrap();let core=Core::new(directory.path().into(), |_|{}, |_|{}).unwrap();let id="11111111111111111111111111111111";
        core.store.change(|config|{config.accounts.push(crate::store::Account{id:id.into(),name:"Player".into()});Ok(())}).unwrap();
        let mut png=vec![0;24];png[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");png[12..16].copy_from_slice(b"IHDR");png[16..20].copy_from_slice(&64u32.to_be_bytes());png[20..24].copy_from_slice(&64u32.to_be_bytes());
        fs::create_dir(directory.path().join("skins")).unwrap();fs::write(directory.path().join(format!("skins/{id}.png")),&png).unwrap();
        assert_eq!(core.account_skin(id).await.unwrap(),Some(skin(&png).unwrap()));assert!(core.account_skin("22222222222222222222222222222222").await.is_err());
    }
    #[test]fn accepts_only_minecraft_textures_and_upgrades_https(){
        let profile=|url:&str|serde_json::json!({"properties":[{"name":"textures","value":STANDARD.encode(serde_json::to_vec(&serde_json::json!({"textures":{"SKIN":{"url":url}}})).unwrap())}]});
        assert_eq!(texture_url(&profile("http://textures.minecraft.net/texture/abcdef")).unwrap().unwrap().as_str(),"https://textures.minecraft.net/texture/abcdef");
        for url in ["https://example.com/texture/abc","file:///texture/abc","https://textures.minecraft.net/texture/../secret","https://textures.minecraft.net:8080/texture/abc","https://textures.minecraft.net/texture/abc?token=secret"]{assert!(texture_url(&profile(url)).is_err());}
        assert!(texture_url(&serde_json::json!({})).unwrap().is_none());
    }
    #[test]fn supports_modern_and_legacy_skins_and_rejects_invalid_sizes(){
        let mut png=vec![0;24];png[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");png[12..16].copy_from_slice(b"IHDR");png[16..20].copy_from_slice(&64u32.to_be_bytes());
        for height in [32u32,64]{png[20..24].copy_from_slice(&height.to_be_bytes());assert!(skin(&png).is_ok());}
        png[20..24].copy_from_slice(&128u32.to_be_bytes());assert!(skin(&png).is_err());
    }
}
