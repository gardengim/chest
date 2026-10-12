import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Activity, Account, DebugLaunch, SidebarGroup, Config, Content, Instance, Loader, Version, CatalogPage, CatalogQuery, CatalogRelease, CatalogSource, CatalogKind, CreationRequest, ArchivePreview } from './types';
export const native = isTauri();
const key = 'chest-preview-v1';
const initial:Config = { instances:[], accounts:[], active_account:null, client_id:'', java_path:'', memory_mb:4096 };
function read():Config { try { return JSON.parse(localStorage.getItem(key) || 'null') || structuredClone(initial); } catch { return structuredClone(initial); } }
function write(config:Config) { localStorage.setItem(key,JSON.stringify(config)); return config; }
async function call<T>(name:string,args:Record<string,unknown>={}):Promise<T> {
  if (native) return invoke<T>(name,args);
  const config=read();let result:unknown;
  switch(name) {
    case 'get_instance_folder': result=null;break;
    case 'get_debug_launch': result={available:false,enabled:false};break;
    case 'get_config': result={...config,instances:config.instances.map(i=>({...i,loader:i.loader || 'vanilla',loader_version:i.loader_version || ''}))}; break;
    case 'get_instance_icons': result={};break;
    case 'get_activities': result=[];break;
    case 'get_news': result=[];break;
    case 'get_instance_news': result={articles:[],unavailable:[]};break;
    case 'get_versions': result=[{id:'26.3',type:'release'},{id:'1.21.4',type:'release'},{id:'1.20.1',type:'release'}];break;
    case 'get_quilt_versions': result=['0.24.0','0.23.1'];break;
    case 'get_catalog_sources': result={modrinth:true,curseforge:false};break;
    case 'search_catalog': result=previewCatalog(args.query as CatalogQuery);break;
    case 'get_creation_releases': case 'get_modpack_releases': case 'get_catalog_releases': result=[{id:'preview-release',name:'Example compatible release',published:'2026-01-01'}];break;
    case 'get_fabric_versions': result=['0.16.10','0.16.9'];break;
    case 'create_wizard': {
      const r=args.request as CreationRequest;
      if(r.pack || r.archive || r.files.length || r.catalog?.some(c=>c.enabled) || r.parent)throw new Error('This source or location needs the Chest desktop app.');
      const instance:Instance={id:crypto.randomUUID(),name:r.name.trim() || r.default_name,version:r.version,loader:r.loader,loader_version:r.loader_version,artwork:'grass',java_path:config.java_path,memory_mb:config.memory_mb,installed:false};
      config.instances.push(instance);write(config);result=instance;break;
    }
    case 'create_instance': {
      const instance:Instance={id:crypto.randomUUID(),name:String(args.name).trim(),version:String(args.version),loader:args.loader as Loader,loader_version:String(args.loaderVersion || ''),artwork:'grass',java_path:config.java_path,memory_mb:config.memory_mb,installed:false};
      config.instances.push(instance);write(config);result=instance;break;
    }
    case 'set_sidebar_groups': config.sidebar_groups=args.groups as SidebarGroup[];result=write(config);break;
    case 'reorder_instances': {const ids=args.ids as string[];config.instances.sort((a,b)=>(ids.includes(a.id)?ids.indexOf(a.id):Infinity)-(ids.includes(b.id)?ids.indexOf(b.id):Infinity));result=write(config);break;}
    case 'save_instance': { const instance=args.instance as Instance;config.instances=config.instances.map(i=>i.id===instance.id?{...instance,playtime_seconds:i.playtime_seconds || 0,installed:i.installed && i.version===instance.version && (i.loader || 'vanilla')===instance.loader && (i.loader_version || '')===instance.loader_version}:i);result=write(config);break; }
    case 'save_settings': config.client_id=String(args.clientId).trim();config.java_path=String(args.javaPath).trim();config.memory_mb=Number(args.memoryMb);result=write(config);break;
    case 'remove_instance': config.instances=config.instances.filter(i=>i.id!==args.id);config.sidebar_groups=config.sidebar_groups?.map(g=>({...g,ids:g.ids.filter(id=>id!==args.id)})).filter(g=>g.ids.length);result=write(config);break;
    case 'duplicate_instance': {const old=config.instances.find(i=>i.id===args.id)!;const instance={...old,id:crypto.randomUUID(),name:`${old.name} copy`,installed:false,playtime_seconds:0};config.instances.push(instance);write(config);result=instance;break;}
    case 'get_instance_screenshots': case 'get_logs': case 'get_content': result=[];break;
    case 'acknowledge':result=null;break;
    default: throw new Error('This action needs the Chest desktop app. Browser preview only saves instance settings.');
  }
  return result as T;
}
function previewCatalog(query:CatalogQuery):CatalogPage {
  const names:Record<CatalogKind,string[]>={mod:['Sodium','Fabric API','Iris Shaders','Jade','AppleSkin','Lithium'],resourcepack:['Faithful','Fresh Animations','Stay True'],shader:['Complementary Reimagined','BSL Shaders','MakeUp Ultra Fast'],modpack:['Fabulously Optimized','Simply Optimized','Adrenaline']};
  if(query.source==='curseforge')throw new Error('CurseForge needs a Chest API key. Browser preview uses Modrinth examples.');
  const projects=names[query.kind].filter(name=>name.toLowerCase().includes(query.query.toLowerCase())).map((title,index)=>({id:title.toLowerCase().replaceAll(' ','-'),title,description:({mod:'A community project to make your next world feel at home.',resourcepack:'A fresh look for familiar blocks and worlds.',shader:'A different light on your Minecraft adventure.',modpack:'A curated way to explore, build, and play.'})[query.kind],author:'Example creator',icon:null,downloads:12000000-index*950000,url:`https://modrinth.com/${query.kind}/${title.toLowerCase().replaceAll(' ','-')}`}));
  return {projects:projects.slice(query.offset,query.offset+20),total:projects.length};
}
export const api = {
  debugLaunch:()=>call<DebugLaunch | null>('get_debug_launch'),
  debugOffline:(enabled:boolean)=>call<DebugLaunch>('set_debug_offline',{enabled}),
  config:()=>call<Config>('get_config'), activities:()=>call<Activity[]>('get_activities'), versions:()=>call<Version[]>('get_versions'),
  news:()=>call<import('./types').NewsArticle[]>('get_news'),
  instanceNews:(id:string)=>call<import('./types').InstanceNews>('get_instance_news',{id}),
  openNews:(url:string)=>call<void>('open_news',{url}),
  fabricVersions:(version:string)=>call<string[]>('get_fabric_versions',{version}),
  quiltVersions:(version:string)=>call<string[]>('get_quilt_versions',{version}),
  catalogSources:()=>call<{modrinth:boolean;curseforge:boolean}>('get_catalog_sources'),
  searchCatalog:(query:CatalogQuery)=>call<CatalogPage>('search_catalog',{query}),
  catalogReleases:(source:CatalogSource,project:string,id:string,kind:CatalogKind)=>call<CatalogRelease[]>('get_catalog_releases',{source,project,id,kind}),
  addContent:(source:CatalogSource,project:string,id:string,version:string,kind:CatalogKind)=>call<string[]>('add_catalog_content',{source,project,id,version,kind}),
  packReleases:(source:CatalogSource,project:string,game:string,loader:string)=>call<CatalogRelease[]>('get_modpack_releases',{source,project,game,loader}),
  installPack:(source:CatalogSource,project:string,version:string,name:string)=>call<Instance>('install_modpack',{source,project,version,name}),
  openProject:(source:CatalogSource,url:string)=>call<void>('open_project',{source,url}),
  screenshots:(id:string)=>call<string[]>('get_instance_screenshots',{id}),
  icons:()=>call<Record<string,string>>('get_instance_icons'),
  creationReleases:(source:CatalogSource,project:string,game:string,loader:string,kind:CatalogKind)=>call<CatalogRelease[]>('get_creation_releases',{source,project,game,loader,kind}),
  createWizard:(request:CreationRequest)=>call<Instance>('create_wizard',{request}),
  chooseLocation:()=>call<string|null>('choose_instance_location'),
  chooseCreationFiles:()=>call<string[]>('choose_creation_files'),
  chooseArchive:()=>call<ArchivePreview|null>('choose_creation_archive'),
  create:(name:string,version:string,loader:Loader='vanilla',loaderVersion='')=>call<Instance>('create_instance',{name,version,loader,loaderVersion}),
  groups:(groups:SidebarGroup[])=>call<Config>('set_sidebar_groups',{groups}),
  reorder:(ids:string[])=>call<Config>('reorder_instances',{ids}),
  save:(instance:Instance)=>call<Config>('save_instance',{instance}),
  remove:(id:string)=>call<Config>('remove_instance',{id}), duplicate:(id:string)=>call<Instance>('duplicate_instance',{id}),
  install:(id:string)=>call<void>('install_instance',{id}),pause:(id:string,paused:boolean)=>call<void>('pause_install',{id,paused}),
  launch:(id:string)=>call<void>('launch_instance',{id}),stop:(id:string)=>call<void>('stop_instance',{id}),
  folderPath:(id:string)=>call<string|null>('get_instance_folder',{id}),
  folder:(id:string)=>call<void>('open_instance_folder',{id}), acknowledge:(id:string)=>call<void>('acknowledge',{id}),
  content:(id:string)=>call<Content[]>('get_content',{id}), toggle:(id:string,kind:string,name:string)=>call<void>('toggle_content',{id,kind,name}),
  logs:(id:string)=>call<string[]>('get_logs',{id}),
  signIn:()=>call<Account>('sign_in'),cancelSignIn:()=>call<void>('cancel_sign_in'),signOut:(id:string)=>call<void>('sign_out',{id}),
  account:(id:string)=>call<Config>('select_account',{id}),
  launcherInfo:()=>call<{version:string;platform:string;architecture:string;data_path:string}>('get_launcher_info'),
  dataFolder:()=>call<void>('open_data_folder'),
  chooseJava:()=>call<string|null>('choose_java'),
  inspectJava:(path:string)=>call<string>('inspect_java',{path}),
  settings:(client_id:string,java_path:string,memory_mb:number)=>call<Config>('save_settings',{clientId:client_id,javaPath:java_path,memoryMb:memory_mb}),
  export:(id:string)=>call<boolean>('export_instance',{id}),import:()=>call<Instance|null>('import_instance'),
};
export async function subscribe(activity:(a:Activity)=>void,log:(l:{id:string;line:string})=>void) {
  if (!native) return ()=>{};
  const a=await listen<Activity>('activity',e=>activity(e.payload));
  const b=await listen<{id:string;line:string}>('log',e=>log(e.payload));
  return ()=>{a();b();};
}
