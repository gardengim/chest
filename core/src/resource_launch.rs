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
    fn installed_instance() -> (tempfile::TempDir, Arc<Core>, String) {
        let root = tempfile::tempdir().unwrap();
        let core = Arc::new(Core::new(root.path().into(), |_| {}, |_| {}).unwrap());
        let instance = core.store.create("Launch test".into(), "1.21.4".into(), "grass".into()).unwrap();
        core.store.installed(&instance.id).unwrap();
        let game = core.instance_folder(&instance.id).unwrap();
        std::fs::create_dir_all(game.join("saves/Survival")).unwrap();
        std::fs::write(
            game.join("servers.dat"),
            fastnbt::to_bytes(&serde_json::json!({"servers":[{"name":"Test server","ip":"example.test"}]})).unwrap(),
        ).unwrap();
        (root, core, instance.id)
    }

    #[test]
    fn launch_without_runtime_returns_error_without_reserving_a_job() {
        let (_root, core, id) = installed_instance();
        assert!(core.launch(id.clone()).unwrap_err().to_string().contains("async runtime"));
        for (kind, item) in [("world", "Survival"), ("server", "example.test")] {
            let error = core.launch_resource(id.clone(), kind, item.into()).unwrap_err();
            assert!(error.to_string().contains("async runtime"));
            assert!(!core.busy(&id));
            assert!(core.activities().is_empty());
        }
    }

    #[tokio::test]
    async fn world_and_server_launch_run_on_the_runtime_and_report_preparation_errors() {
        let (_root, core, id) = installed_instance();
        for (kind, item) in [("world", "Survival"), ("server", "example.test")] {
            core.launch_resource(id.clone(), kind, item.into()).unwrap();
            tokio::time::timeout(std::time::Duration::from_secs(2), async {
                while core.busy(&id) {
                    tokio::task::yield_now().await;
                }
            }).await.unwrap();
            assert!(core.activities().iter().any(|activity| activity.id == id && activity.status == "launch_failed"));
            assert!(!core.logs(&id).is_empty());
        }
    }

    #[test]fn direct_launch_arguments_are_temporary_and_preserve_the_target(){
        let modern=serde_json::json!({"arguments":{"game":[{"value":["--quickPlaySingleplayer","${quickPlaySingleplayer}"]},{"value":["--quickPlayMultiplayer","${quickPlayMultiplayer}"]}]}});
        assert_eq!(arguments(&modern,&ResourceTarget::World("My world".into())).unwrap(),["--quickPlaySingleplayer","My world"]);
        assert_eq!(arguments(&modern,&ResourceTarget::Server("example.com:25566".into())).unwrap(),["--quickPlayMultiplayer","example.com:25566"]);
        assert_eq!(arguments(&Value::Null,&ResourceTarget::Server("example.com:25566".into())).unwrap(),["--server","example.com","--port","25566"]);
        assert!(arguments(&Value::Null,&ResourceTarget::World("Old world".into())).is_err());
    }
}
