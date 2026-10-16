export type Tab = 'Overview' | 'Worlds' | 'Servers' | 'Screenshots' | 'Content' | 'Versions' | 'Settings' | 'Log';
export type Status = 'idle' | 'installing' | 'pausing' | 'paused' | 'running' | 'starting' | 'stopping' | 'working' | 'crashed' | 'launch_failed' | 'failed';
export type Loader = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge';
export interface Instance { id:string; name:string; version:string; loader:Loader; loader_version:string; memory_mb:number; java_path:string; artwork:string; installed:boolean; playtime_seconds?:number; }
export type InstanceBackground={kind:'provider';url:string}|{kind:'screenshot';name:string;modified:number};
export interface Account { id:string; name:string; }
export interface SidebarGroup { name:string; ids:string[]; collapsed:boolean; }
export interface Config { server_bookmarks?:ServerBookmark[]; sidebar_groups?:SidebarGroup[]; instances:Instance[]; accounts:Account[]; active_account:string|null; client_id:string; java_path:string; memory_mb:number; }
export interface Activity { id:string; status:Status; progress:number|null; phase:string; }
export interface Version { id:string; type:string; }
export interface Content { name:string; kind:string; enabled:boolean; }
export const tabs:Tab[] = ['Overview','Content','Versions','Settings','Log'];

export type CatalogSource = 'modrinth' | 'curseforge';
export type CatalogKind = 'mod' | 'resourcepack' | 'shader' | 'modpack';
export interface CatalogProject { id:string; title:string; description:string; author:string; icon:string|null; background?:string|null; downloads:number; url:string; }
export interface ProjectDescription {format:'markdown'|'html';body:string}
export interface CatalogPage { projects:CatalogProject[]; total:number; }
export interface CatalogRelease { id:string; name:string; published:string; }
export interface CatalogQuery {source:CatalogSource;kind:CatalogKind;query:string;sort:string;offset:number;limit?:number;game:string;loader:string;}
export const loaderLabel=(loader:Loader)=>({vanilla:'Vanilla',fabric:'Fabric',quilt:'Quilt',forge:'Forge',neoforge:'NeoForge'})[loader] || 'Vanilla';

export interface DebugLaunch { available: boolean; enabled: boolean; account?: Account | null; }

export interface LocalContent { path:string; kind:'mods'|'resourcepacks'|'shaderpacks'; enabled:boolean; }
export interface PackSelection { source:CatalogSource; project:string; release:string; title:string; icon:string|null; releaseName:string; }
export interface ArchivePreview { path:string; instance:Instance; }
export interface CreationRequest { name:string; default_name:string; version:string; loader:Loader; loader_version:string; parent:string; archive:string|null; pack:PackSelection|null; files:LocalContent[]; catalog:StagedContent[]; }

export interface StagedContent { icon?:string|null; background?:string|null; source:CatalogSource; project:string; release:string; kind:CatalogKind; title:string; releaseName:string; enabled:boolean; }

export interface NewsArticle { title:string; date:string; url:string; source?:string; instance_id?:string; }
export interface InstanceNews { articles:NewsArticle[]; unavailable:string[]; }

export type GraphicsApi='default'|'open_gl'|'vulkan';
export function supportsGraphicsApi(version:string){const [major,minor]=version.split(/[.-]/).map(value=>Number(value));return Number.isInteger(major) && Number.isInteger(minor) && (major>26 || major===26 && minor>=2);}
export interface LaunchSettings { width:number; height:number; fullscreen:boolean; graphics_api:GraphicsApi; account_id:string|null; java_args:string[]; game_args:string[]; environment:Record<string,string>; before_launch:string[]; after_exit:string[]; open_log:boolean; }
export const defaultLaunchSettings=():LaunchSettings=>({width:854,height:480,fullscreen:false,graphics_api:'default',account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false});

export interface InstanceFiles {worlds:string[];screenshots:string[];servers:{name:string;ip:string;icon?:string|null}[];}

export interface WorldEntry {instance_id:string;folder:string;name:string;version:string|null;data_version:number|null;last_played:number|null;game_mode?:string|null;}
export interface WorldLibrary {worlds:WorldEntry[];unavailable:string[];}
export interface ServerBookmark {id:string;name:string;address:string;instance_id:string|null;expected_version:string;expected_loader:Loader|null;}

export interface LibraryServer {instance_id:string;name:string;address:string;icon:string|null;}
export interface ServerLibrary {servers:LibraryServer[];unavailable:string[];}

export interface LibraryScreenshot {instance_id:string;name:string;modified:number;}
export interface ScreenshotLibrary {screenshots:LibraryScreenshot[];unavailable:string[];}
