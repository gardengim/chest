import type {LibraryServer,ServerBookmark} from './types';

export function serverAddressKey(address:string){return address.trim().toLowerCase().replace(/:25565$/,'');}
export type ServerRow=ServerBookmark & {bookmarked:boolean;icon?:string|null;instance_ids:string[]};
// Bookmarks retain their names and preferences; local entries add discovery and artwork.
export function mergeServers(bookmarks:ServerBookmark[],local:LibraryServer[]):ServerRow[]{
  const rows=new Map<string,ServerRow>();
  for(const bookmark of bookmarks){
    const key=serverAddressKey(bookmark.address);
    if(!rows.has(key))rows.set(key,{...bookmark,bookmarked:true,instance_ids:[]});
  }
  for(const server of local){
    const key=serverAddressKey(server.address),existing=rows.get(key);
    if(existing){
      if(!existing.instance_ids.includes(server.instance_id))existing.instance_ids.push(server.instance_id);
      existing.icon ||=server.icon;
      existing.instance_id ||=server.instance_id;
    }else rows.set(key,{id:`instance:${server.instance_id}:${key}`,name:server.name,address:server.address,instance_id:server.instance_id,expected_version:'',expected_loader:null,bookmarked:false,icon:server.icon,instance_ids:[server.instance_id]});
  }
  return [...rows.values()];
}
