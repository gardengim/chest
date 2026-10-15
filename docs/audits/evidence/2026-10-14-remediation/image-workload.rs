use chest_core::Core;
use std::{fs, path::PathBuf, time::{Instant,SystemTime,UNIX_EPOCH}};
struct OwnedRoot(PathBuf);
impl Drop for OwnedRoot {fn drop(&mut self){let _=fs::remove_dir_all(&self.0);}}
fn main(){
 let path=std::env::temp_dir().join(format!("chest-image-workload-{}-{}",std::process::id(),SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
 fs::create_dir(&path).unwrap(); let root=OwnedRoot(path);
 let core=Core::new_scoped(root.0.clone(),Some("image-audit".into()),|_|{},|_|{}).unwrap();
 let instance=core.store.create("Image workload".into(),"1.21.4".into(),"grass".into()).unwrap();
 let shots=core.instance_folder(&instance.id).unwrap().join("screenshots");fs::create_dir(&shots).unwrap();
 for (width,height) in [(3840,2160),(7680,4320)]{
  let name=format!("{width}x{height}.png");let original=shots.join(&name);
  let image=image::RgbImage::from_fn(width,height,|x,y|image::Rgb([((x/32)%256) as u8,((y/32)%256) as u8,(((x+y)/32)%256) as u8]));
  image.save(&original).unwrap();drop(image);
  let before=fs::read(&original).unwrap();
  for edge in [256,512,1024]{
   let start=Instant::now();let first=core.screenshot_thumbnail(&instance.id,&name,edge).unwrap();let cold=start.elapsed().as_secs_f64()*1000.0;
   let start=Instant::now();let second=core.screenshot_thumbnail(&instance.id,&name,edge).unwrap();let warm=start.elapsed().as_secs_f64()*1000.0;
   assert_eq!(first,second);
   println!("{{\"width\":{width},\"height\":{height},\"edge\":{edge},\"originalBytes\":{},\"dataUrlBytes\":{},\"generationMs\":{cold},\"cacheHitMs\":{warm}}}",before.len(),first.len());
  }
  assert_eq!(before,fs::read(original).unwrap());
 }
}
