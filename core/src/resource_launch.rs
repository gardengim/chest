use crate::Core;
use anyhow::{bail,Context,Result};
use serde_json::Value;
use std::sync::Arc;
#[derive(Clone)]
pub(crate) enum ResourceTarget{World(String),Server(String)}
fn has_flag(value:&Value,flag:&str)->bool{match value{Value::String(text)=>text==flag,Value::Array(items)=>items.iter().any(|item|has_flag(item,flag)),Value::Object(fields)=>fields.values().any(|value|has_flag(value,flag)),_=>false}}
pub(crate) fn arguments(meta:&Value,target:&ResourceTarget)->Result<Vec<String>>{
    match target{
        ResourceTarget::World(folder)=>{if !has_flag(&meta["arguments"]["game"],"--quickPlaySingleplayer"){bail!("Direct world launch requires a Minecraft version with Quick Play support");}Ok(vec!["--quickPlaySingleplayer".into(),folder.clone()])},
        ResourceTarget::Server(address)=>{
            if has_flag(&meta["arguments"]["game"],"--quickPlayMultiplayer"){return Ok(vec!["--quickPlayMultiplayer".into(),address.clone()])}
            let url=url::Url::parse(&format!("minecraft://{address}"))?;
            Ok(vec!["--server".into(),url.host_str().context("Invalid server hostname")?.trim_matches(['[',']']).into(),"--port".into(),url.port().unwrap_or(25565).to_string()])
        }
    }
}
impl Core{
    pub fn launch_resource(self:&Arc<Self>,id:String,kind:&str,item:String)->Result<()>{
        let target=match kind{
            "world"=>{self.instance_file(&id,"saves",&item)?;ResourceTarget::World(item)},
            "server"=>{let game=self.instance_folder(&id)?;if !crate::instance_files::servers(&game)?.iter().any(|server|server.ip.eq_ignore_ascii_case(&item)){bail!("Server is not listed in this instance");}ResourceTarget::Server(item)},
            _=>bail!("Invalid launch target"),
        };
        self.launch_target(id,Some(target))
    }
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn direct_launch_arguments_are_temporary_and_preserve_the_target(){
        let modern=serde_json::json!({"arguments":{"game":[{"value":["--quickPlaySingleplayer","${quickPlaySingleplayer}"]},{"value":["--quickPlayMultiplayer","${quickPlayMultiplayer}"]}]}});
        assert_eq!(arguments(&modern,&ResourceTarget::World("My world".into())).unwrap(),["--quickPlaySingleplayer","My world"]);
        assert_eq!(arguments(&modern,&ResourceTarget::Server("example.com:25566".into())).unwrap(),["--quickPlayMultiplayer","example.com:25566"]);
        assert_eq!(arguments(&Value::Null,&ResourceTarget::Server("example.com:25566".into())).unwrap(),["--server","example.com","--port","25566"]);
        assert!(arguments(&Value::Null,&ResourceTarget::World("Old world".into())).is_err());
    }
}
