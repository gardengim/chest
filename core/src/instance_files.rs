use crate::Core;
use anyhow::{bail,Context,Result};
use base64::Engine;
use serde::{Serialize,Deserialize};
use std::{fs,io::Read,path::{Path,PathBuf}};
#[derive(Serialize,Default)]
pub struct InstanceFiles {pub worlds:Vec<String>,pub screenshots:Vec<String>,pub servers:Vec<Server>}
#[derive(Serialize,Deserialize)]
pub struct Server {pub name:String,pub ip:String,#[serde(default,skip_serializing_if="Option::is_none")]pub icon:Option<String>}
#[derive(Serialize,Default)]
pub struct ServerLibrary {pub servers:Vec<LibraryServer>,pub unavailable:Vec<String>}
#[derive(Serialize)]
pub struct LibraryServer {pub instance_id:String,pub name:String,pub address:String,pub icon:Option<String>}
#[derive(Serialize,Default)]
pub struct ScreenshotLibrary {pub screenshots:Vec<LibraryScreenshot>,pub unavailable:Vec<String>}
#[derive(Serialize)]
pub struct LibraryScreenshot {pub instance_id:String,pub name:String,pub modified:u64}
#[derive(Deserialize,Default)]
struct ServerList {#[serde(default)]servers:Vec<Server>}
pub(crate) fn inside(root:&Path,path:&Path)->Result<PathBuf>{
    let root=root.canonicalize()?;
    let actual=path.canonicalize()?;
    if !actual.starts_with(root) || fs::symlink_metadata(path)?.file_type().is_symlink(){bail!("File is outside the instance folder");}
    Ok(actual)
}
pub(crate) fn names(game:&Path,kind:&str)->Result<Vec<String>>{
    let directory=game.join(kind);
    if !directory.exists(){return Ok(vec![]);}
    let directory=inside(game,&directory)?;
    let mut names=vec![];
    for entry in fs::read_dir(&directory)?{
        let entry=entry?;let ty=entry.file_type()?;
        let name=entry.file_name().to_string_lossy().into_owned();
        if ty.is_symlink(){continue;}
        let valid=if kind=="saves"{ty.is_dir() && entry.path().join("level.dat").is_file()}else{ty.is_file() && name.to_ascii_lowercase().ends_with(".png")};
        if valid{names.push(name);}
    }
    if kind == "screenshots" {
        names.sort_by_cached_key(|name| (std::cmp::Reverse(fs::metadata(directory.join(name))
            .and_then(|meta| meta.modified()).ok()), std::cmp::Reverse(name.clone())));
    } else { names.sort(); }
    Ok(names)
}
pub(crate) fn servers(game:&Path)->Result<Vec<Server>> {
        let file=game.join("servers.dat");
        let servers:Vec<Server>=if file.exists(){
            let file=inside(game,&file)?;
            if fs::metadata(&file)?.len()>1024*1024{bail!("Server list exceeds 1 MiB");}
            let bytes=fs::read(file)?;
            fastnbt::from_bytes::<ServerList>(&bytes).context("Could not read servers.dat")?.servers.into_iter().take(1000).collect()
        }else{vec![]};
        Ok(servers.into_iter().map(|mut server:Server|{server.icon=server.icon.as_deref().and_then(|icon|crate::artwork::supplied_icon(icon).ok());server}).collect())
}
impl Core {
    pub fn screenshot_library(&self)->ScreenshotLibrary{
        let mut library=ScreenshotLibrary::default();
        for instance in self.store.config().instances {
            let result=self.instance_folder(&instance.id).and_then(|game|{
                let files=names(&game,"screenshots")?;
                Ok(files.into_iter().map(|name|{
                    let modified=fs::metadata(game.join("screenshots").join(&name)).and_then(|meta|meta.modified()).ok().and_then(|time|time.duration_since(std::time::UNIX_EPOCH).ok()).map_or(0,|time|time.as_secs());
                    LibraryScreenshot{instance_id:instance.id.clone(),name,modified}
                }).collect::<Vec<_>>())
            });
            match result{Ok(files)=>library.screenshots.extend(files),Err(_)=>library.unavailable.push(instance.name)}
        }
        library.screenshots.sort_by(|a,b|b.modified.cmp(&a.modified).then_with(||b.name.cmp(&a.name)).then_with(||a.instance_id.cmp(&b.instance_id)));
        library
    }
    pub fn server_library(&self)->ServerLibrary{
        let mut library=ServerLibrary::default();
        for instance in self.store.config().instances {
            let result=self.instance_folder(&instance.id).and_then(|game|servers(&game));
            match result {
                Ok(servers)=>library.servers.extend(servers.into_iter().map(|server|LibraryServer{
                    instance_id:instance.id.clone(),name:server.name,address:server.ip,
                    icon:server.icon,
                })),
                Err(_)=>library.unavailable.push(instance.name),
            }
        }
        library
    }

    pub fn instance_files(&self,id:&str)->Result<InstanceFiles>{
        let game=self.instance_folder(id)?;
        if !game.exists(){return Ok(InstanceFiles::default());}
        let worlds=names(&game,"saves")?;
        let screenshots=names(&game,"screenshots")?;
        let servers=servers(&game)?;
        Ok(InstanceFiles{worlds,screenshots,servers})
    }
    pub(crate) fn instance_file(&self,id:&str,kind:&str,name:&str)->Result<PathBuf>{
        if !["saves","screenshots"].contains(&kind) || name.is_empty() || name.contains(['/', '\\']) || name=="." || name==".."{bail!("Invalid instance file");}
        let game=self.instance_folder(id)?;
        inside(&game,&game.join(kind).join(name))
    }
    pub fn open_instance_file(&self,id:&str,kind:&str,name:&str)->Result<()>{open::that(self.instance_file(id,kind,name)?)?;Ok(())}
    pub fn screenshot_image(&self,id:&str,name:&str)->Result<String>{
        if !name.to_ascii_lowercase().ends_with(".png"){bail!("Expected a PNG screenshot");}
        let path=self.instance_file(id,"screenshots",name)?;
        let mut bytes=Vec::new();fs::File::open(path)?.take(16*1024*1024+1).read_to_end(&mut bytes)?;
        if bytes.len()>16*1024*1024 {bail!("Invalid or oversized screenshot");}
        crate::screenshot_images::validate_screenshot(&bytes)?;
        Ok(format!("data:image/png;base64,{}",base64::engine::general_purpose::STANDARD.encode(bytes)))
    }
    pub fn shared_datapacks(&self)->Result<()>{let path=self.store.root.join("datapacks");fs::create_dir_all(&path)?;open::that(path)?;Ok(())}
    pub fn apply_datapacks(&self,id:&str,world:&str)->Result<usize>{
        let _operation=self.operation_lock.lock().unwrap();
        if self.busy(id){bail!("Close this instance before changing world data packs");}
        let world=self.instance_file(id,"saves",world)?;
        let destination=world.join("datapacks");fs::create_dir_all(&destination)?;
        let destination=inside(&world,&destination)?;
        let source=self.store.root.join("datapacks");
        if !source.exists(){return Ok(0);}
        let source=inside(&self.store.root,&source)?;
        let mut count=0;
        for item in fs::read_dir(source)?{
            let item=item?;
            if !item.file_type()?.is_file() || !item.file_name().to_string_lossy().to_ascii_lowercase().ends_with(".zip"){continue;}
            let target=destination.join(item.file_name());
            // Existing world packs are never replaced.
            match fs::OpenOptions::new().write(true).create_new(true).open(&target){
                Ok(mut output)=>{if let Err(error)=std::io::copy(&mut fs::File::open(item.path())?,&mut output){let _=fs::remove_file(&target);return Err(error.into());}count+=1;},
                Err(error) if error.kind()==std::io::ErrorKind::AlreadyExists=>{},
                Err(error)=>return Err(error.into()),
            }
        }
        Ok(count)
    }
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]
    fn collections_include_every_file_beyond_the_previous_limit() {
        let directory=tempfile::tempdir().unwrap();
        fs::create_dir(directory.path().join("screenshots")).unwrap();
        for number in (0..1005).rev() { fs::write(directory.path().join("screenshots").join(format!("{number:04}.png")),[]).unwrap(); }
        let files=names(directory.path(),"screenshots").unwrap();
        assert_eq!(files.len(),1005);
        assert!(files.contains(&"1004.png".into()));
        assert_eq!(files,names(directory.path(),"screenshots").unwrap());
    }
    #[test]fn global_screenshots_list_pngs_without_loading_images(){
        let d=tempfile::tempdir().unwrap();let core=Core::new(d.path().into(), |_|{}, |_|{}).unwrap();
        let instance=core.store.create("Photos".into(),"1.21.4".into(),"grass".into()).unwrap();let game=core.instance_folder(&instance.id).unwrap();
        fs::create_dir_all(game.join("screenshots")).unwrap();
        fs::write(game.join("screenshots/2026-01-01.png"),[]).unwrap();fs::write(game.join("screenshots/ignore.txt"),[]).unwrap();
        let library=core.screenshot_library();assert_eq!(library.screenshots.len(),1);assert_eq!(library.screenshots[0].instance_id,instance.id);assert_eq!(library.screenshots[0].name,"2026-01-01.png");assert!(library.unavailable.is_empty());
    }
    #[test]fn global_servers_reads_each_instance_and_reports_unreadable_lists(){
        let d=tempfile::tempdir().unwrap();let core=Core::new(d.path().into(), |_|{}, |_|{}).unwrap();
        let first=core.store.create("First".into(),"1.21.4".into(),"grass".into()).unwrap();
        let second=core.store.create("Second".into(),"1.21.4".into(),"grass".into()).unwrap();
        let broken=core.store.create("Broken".into(),"1.21.4".into(),"grass".into()).unwrap();
        for instance in [&first,&second,&broken]{fs::create_dir_all(core.instance_folder(&instance.id).unwrap()).unwrap();}
        fs::write(core.instance_folder(&first.id).unwrap().join("servers.dat"),fastnbt::to_bytes(&serde_json::json!({"servers":[{"name":"Friends","ip":"example.test","icon":"invalid"}]})).unwrap()).unwrap();
        fs::write(core.instance_folder(&broken.id).unwrap().join("servers.dat"),b"corrupt").unwrap();
        let library=core.server_library();assert_eq!(library.servers.len(),1);assert_eq!(library.servers[0].instance_id,first.id);assert_eq!(library.servers[0].address,"example.test");assert!(library.servers[0].icon.is_none());assert_eq!(library.unavailable,["Broken"]);
    }
    #[cfg(unix)]
    #[test]fn screenshot_symlinks_cannot_escape_instance(){
        let d=tempfile::tempdir().unwrap();let core=Core::new(d.path().into(), |_|{}, |_|{}).unwrap();
        let instance=core.store.create("World".into(),"1.21.4".into(),"grass".into()).unwrap();let game=core.instance_folder(&instance.id).unwrap();
        fs::create_dir_all(game.join("screenshots")).unwrap();let outside=d.path().join("private.png");fs::write(&outside,b"\x89PNG\r\n\x1a\n").unwrap();
        std::os::unix::fs::symlink(outside,game.join("screenshots/linked.png")).unwrap();
        assert!(core.instance_files(&instance.id).unwrap().screenshots.is_empty());assert!(core.screenshot_image(&instance.id,"linked.png").is_err());
    }
    #[test]fn lists_local_files_and_rejects_traversal(){
        let d=tempfile::tempdir().unwrap();let core=Core::new(d.path().into(), |_|{}, |_|{}).unwrap();
        let instance=core.store.create("World".into(),"1.21.4".into(),"grass".into()).unwrap();
        let game=core.instance_folder(&instance.id).unwrap();
        fs::create_dir_all(game.join("saves/Test")).unwrap();fs::write(game.join("saves/Test/level.dat"),[]).unwrap();
        fs::create_dir_all(game.join("screenshots")).unwrap();fs::write(game.join("screenshots/test.png"),b"\x89PNG\r\n\x1a\n").unwrap();
        fs::write(game.join("servers.dat"),fastnbt::to_bytes(&serde_json::json!({"servers":[{"name":"Local","ip":"localhost"}]})).unwrap()).unwrap();
        let files=core.instance_files(&instance.id).unwrap();assert_eq!(files.worlds,["Test"]);assert_eq!(files.screenshots,["test.png"]);assert_eq!(files.servers[0].ip,"localhost");
        assert!(core.screenshot_image(&instance.id,"../../config.json").is_err());
        fs::create_dir(d.path().join("datapacks")).unwrap();fs::write(d.path().join("datapacks/example.zip"),"first").unwrap();assert_eq!(core.apply_datapacks(&instance.id,"Test").unwrap(),1);
        fs::write(d.path().join("datapacks/example.zip"),"second").unwrap();assert_eq!(core.apply_datapacks(&instance.id,"Test").unwrap(),0);assert_eq!(fs::read_to_string(game.join("saves/Test/datapacks/example.zip")).unwrap(),"first");
    }
}
