import {api} from './api';
const cache=new Map<string,{expires:number;image:Promise<string|null>}>();
export function accountSkin(id:string):Promise<string|null>{
  const stored=cache.get(id);if(stored && stored.expires>Date.now())return stored.image;
  const entry={expires:Date.now()+10*60*1000,image:api.accountSkin(id).catch(()=>null)};
  void entry.image.then(image=>{if(!image)entry.expires=Date.now()+30*1000;});
  cache.delete(id);cache.set(id,entry);
  if(cache.size>32)cache.delete(cache.keys().next().value!);
  return entry.image;
}
