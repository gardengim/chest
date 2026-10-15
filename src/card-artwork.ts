// Reuse artwork across collection remounts without retaining an unbounded image
// library. Count UTF-16 string bytes conservatively; decoded images belong to
// their rendered components/browser and are not included in this cache budget.
type Entry={expires:number;image:Promise<string|null>;bytes:number};
const cache=new Map<string,Entry>();
const byteLimit=16*1024*1024;
let bytes=0;
function remove(key:string){const entry=cache.get(key);if(entry){bytes-=entry.bytes;cache.delete(key);}}
export function loadCardArtwork(key:string,load:()=>Promise<string|null>){
  const saved=cache.get(key);
  if(saved && saved.expires>Date.now()){
    cache.delete(key);cache.set(key,saved);
    return saved.image;
  }
  remove(key);
  const image=Promise.resolve().then(load).catch(()=>null);
  const entry={expires:Date.now()+60_000,image,bytes:0};
  cache.set(key,entry);
  void image.then(value=>{
    if(cache.get(key)!==entry)return;
    if(!value){remove(key);return;}
    entry.bytes=value.length*2;bytes+=entry.bytes;
    while(bytes>byteLimit || cache.size>64)remove(cache.keys().next().value!);
  });
  while(cache.size>64)remove(cache.keys().next().value!);
  return image;
}
