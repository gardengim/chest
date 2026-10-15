use crate::{Core,instance_files::inside};
use anyhow::{bail,Context,Result};
use fastnbt::Value;
use std::{fs,io::{Read,Write},sync::atomic::Ordering};
impl Core{
    pub fn rename_resource(&self,id:&str,kind:&str,item:&str,name:&str)->Result<()>{
        let name=name.trim();if name.is_empty() || name.len()>120 || name.chars().any(char::is_control){bail!("Enter a name between 1 and 120 bytes");}
        let _operation=self.operation_lock.lock().unwrap();if self.busy(id) || self.maintenance.load(Ordering::Acquire){bail!("Close this instance before renaming its content");}
        let game=self.instance_folder(id)?;
        let file=match kind{"world"=>{let world=self.instance_file(id,"saves",item)?;inside(&world,&world.join("level.dat"))?},"server"=>inside(&game,&game.join("servers.dat"))?,_=>bail!("Invalid resource type")};
        if fs::metadata(&file)?.len()>8*1024*1024{bail!("Metadata exceeds size limit");}
        let mut bytes=vec![];if kind=="world"{flate2::read::GzDecoder::new(fs::File::open(&file)?).take(8*1024*1024+1).read_to_end(&mut bytes)?;}else{bytes=fs::read(&file)?;}
        if bytes.len()>8*1024*1024{bail!("Metadata exceeds size limit");}
        let mut root:Value=fastnbt::from_bytes(&bytes)?;
        let Value::Compound(fields)=&mut root else{bail!("Invalid resource metadata")};
        if kind=="world"{
            let Some(Value::Compound(data))=fields.get_mut("Data") else{bail!("Invalid world metadata")};data.insert("LevelName".into(),Value::String(name.into()));
        }else{
            let Some(Value::List(servers))=fields.get_mut("servers") else{bail!("Invalid server list")};
            let server=servers.iter_mut().find_map(|server|match server{Value::Compound(fields) if matches!(fields.get("ip"),Some(Value::String(address)) if address.eq_ignore_ascii_case(item))=>Some(fields),_=>None}).context("Server not found")?;
            server.insert("name".into(),Value::String(name.into()));
        }
        let bytes=fastnbt::to_bytes(&root)?;
        let output=if kind=="world"{let mut encoder=flate2::write::GzEncoder::new(Vec::new(),flate2::Compression::default());encoder.write_all(&bytes)?;encoder.finish()?}else{bytes};
        let temporary=file.parent().context("Invalid resource directory")?.join(format!(".rename-{}",uuid::Uuid::new_v4()));
        let result=(||->Result<()>{let mut output_file=fs::OpenOptions::new().write(true).create_new(true).open(&temporary)?;output_file.write_all(&output)?;output_file.sync_all()?;fs::rename(&temporary,&file)?;Ok(())})();let _=fs::remove_file(&temporary);result
    }
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn rename_preserves_world_and_server_metadata(){
        let dir=tempfile::tempdir().unwrap();let core=Core::new(dir.path().into(), |_|{}, |_|{}).unwrap();let instance=core.store.create("Test".into(),"1.21.4".into(),"grass".into()).unwrap();let game=core.instance_folder(&instance.id).unwrap();fs::create_dir_all(game.join("saves/World")).unwrap();
        let mut encoder=flate2::write::GzEncoder::new(Vec::new(),flate2::Compression::default());encoder.write_all(&fastnbt::to_bytes(&serde_json::json!({"Data":{"LevelName":"Old","DataVersion":4189,"Custom":"keep"}})).unwrap()).unwrap();fs::write(game.join("saves/World/level.dat"),encoder.finish().unwrap()).unwrap();
        core.rename_resource(&instance.id,"world","World","New").unwrap();assert_eq!(core.world_info(&instance.id,"World").unwrap().name,"New");
        let mut bytes=vec![];flate2::read::GzDecoder::new(fs::File::open(game.join("saves/World/level.dat")).unwrap()).read_to_end(&mut bytes).unwrap();let value:Value=fastnbt::from_bytes(&bytes).unwrap();let Value::Compound(root)=value else{panic!()};let Value::Compound(data)=&root["Data"] else{panic!()};assert_eq!(data["Custom"],Value::String("keep".into()));
        fs::write(game.join("servers.dat"),fastnbt::to_bytes(&serde_json::json!({"servers":[{"name":"Old","ip":"example.test","icon":"keep"}],"unknown":"keep"})).unwrap()).unwrap();core.rename_resource(&instance.id,"server","example.test","New server").unwrap();let value:serde_json::Value=fastnbt::from_bytes(&fs::read(game.join("servers.dat")).unwrap()).unwrap();assert_eq!(value["unknown"],"keep");assert_eq!(value["servers"][0]["icon"],"keep");assert_eq!(value["servers"][0]["name"],"New server");
        assert!(core.rename_resource(&instance.id,"world","../escape","Bad").is_err());assert!(core.rename_resource(&instance.id,"world","World","").is_err());
    }
}
