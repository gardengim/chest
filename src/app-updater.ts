import {writable,get} from 'svelte/store';
import {Channel,invoke} from '@tauri-apps/api/core';
import {native} from './api';
import {emit} from '@tauri-apps/api/event';
import {autoUpdateChecks} from './preferences';
export interface UpdateInfo {current_version:string;development:boolean;test_profile?:boolean;version:string|null;notes:string|null;}
interface Progress {downloaded:number;total:number|null;installing:boolean;}
interface UpdateState {info:UpdateInfo|null;phase:'idle'|'checking'|'available'|'downloading'|'installing'|'ready'|'current'|'error';progress:Progress|null;error:string;}
export const appUpdate=writable<UpdateState>({info:null,phase:'idle',progress:null,error:''});
let initialized=false;
export async function initializeUpdater(){
  if(initialized || !native)return;initialized=true;
  try{const info=await invoke<UpdateInfo>('get_app_update_info');if(!info)return;appUpdate.update(s=>({...s,info}));if(!info.development && !info.test_profile && get(autoUpdateChecks))await checkForUpdates();}catch{initialized=false;}
}
export async function checkForUpdates(){
  if(!native || ['checking','downloading','installing','ready'].includes(get(appUpdate).phase))return;
  appUpdate.update(s=>({...s,phase:'checking',error:''}));
  try{const info=await invoke<UpdateInfo>('check_app_update');appUpdate.update(s=>({...s,info,phase:info.version?'available':'current'}));}
  catch(error){appUpdate.update(s=>({...s,phase:'error',error:String(error)}));}
}
export async function installUpdate(){
  const state=get(appUpdate);
  if(!state.info?.version || state.info.development || state.info.test_profile || !['available','error'].includes(state.phase))return;
  appUpdate.update(s=>({...s,phase:'downloading',error:'',progress:null}));
  const channel=new Channel<Progress>();
  channel.onmessage=progress=>appUpdate.update(s=>({...s,progress,phase:progress.installing?'installing':'downloading'}));
  try{await invoke('install_app_update',{onProgress:channel});appUpdate.update(s=>({...s,phase:'ready'}));}
  catch(error){appUpdate.update(s=>({...s,phase:'error',error:String(error)}));}
}
export async function restartUpdatedApp(){
  try{await emit('desktop-menu','restart');}catch(error){appUpdate.update(s=>({...s,error:String(error)}));}
}
