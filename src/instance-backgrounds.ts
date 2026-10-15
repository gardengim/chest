import {api} from './api';
import {loadCardArtwork} from './card-artwork';
import type {InstanceBackground} from './types';

// Share pending pool requests between instance cards and the open header.
// Focus refreshes can still discover screenshots created since the last request.
const pending=new Map<string,Promise<InstanceBackground[]>>();
export const backgroundKey=(image:InstanceBackground)=>JSON.stringify(image);
export function instanceBackgrounds(id:string){
  const existing=pending.get(id);if(existing)return existing;
  const request=api.backgrounds(id).then(images=>{
    const unique=new Map<string,InstanceBackground>();
    for(const image of images || [])unique.set(backgroundKey(image),image);
    return [...unique.values()];
  });
  pending.set(id,request);
  const done=()=>pending.delete(id);void request.then(done,done);
  return request;
}
export function backgroundImage(id:string,image:InstanceBackground,edge=512){
  if(image.kind==='provider')return Promise.resolve(image.url);
  return loadCardArtwork(`thumbnail:${id}:${image.name}:${image.modified}:${edge}`,()=>api.screenshotThumbnail(id,image.name,edge));
}
