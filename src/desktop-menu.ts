import {invoke} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {native} from './api';

export type DesktopMenuAction='create'|'settings'|'about'|'updates'|'issues'|'home'|'instances'|'servers'|'worlds'|'news'|'screenshots'|'explore'|'data-folder';

export async function subscribeDesktopMenu(onaction:(action:DesktopMenuAction)=>void,onerror:(message:string)=>void){
  if(!native)return ()=>{};
  const actions=await listen<DesktopMenuAction>('desktop-menu',event=>onaction(event.payload));
  try{
    const errors=await listen<string>('desktop-menu-error',event=>onerror(event.payload));
    return ()=>{actions();errors();};
  }catch(error){actions();throw error;}
}

export const desktopMenuLabels=['Settings…','Check for updates…','About Chest','Quit Chest','File','New instance…','Edit','Undo','Redo','Cut','Copy','Paste','Select all','View','Home','Instances','Servers','Worlds','News','Screenshots','Explore','Zoom in','Zoom out','Actual size','Toggle full screen','Window','Minimize','Maximize / Restore','Close window','Help','Report an issue…','Developer','Toggle Web Inspector','Reload UI','Open data folder','Services','Hide Chest','Hide others','Show all','Bring all to front','World backup','Color scheme','Content','Chest archive'] as const;
export async function translateDesktopMenu(translate:(key:string)=>string){
  if(native)await invoke('set_menu_labels',{labels:Object.fromEntries(desktopMenuLabels.map(key=>[key,translate(key)]))});
}
