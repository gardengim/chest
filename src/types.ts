export type Tab = 'Overview' | 'Content' | 'Versions' | 'Settings' | 'Log';
export type Status = 'idle' | 'installing' | 'pausing' | 'paused' | 'running' | 'starting' | 'stopping' | 'crashed' | 'launch_failed' | 'failed';
export type Loader = 'vanilla' | 'fabric' | 'quilt';
export interface Instance { id:string; name:string; version:string; loader:Loader; loader_version:string; memory_mb:number; java_path:string; artwork:string; installed:boolean; playtime_seconds?:number; }
export interface Account { id:string; name:string; }
export interface SidebarGroup { name:string; ids:string[]; collapsed:boolean; }
export interface Config { sidebar_groups?:SidebarGroup[]; instances:Instance[]; accounts:Account[]; active_account:string|null; client_id:string; java_path:string; memory_mb:number; }
export interface Activity { id:string; status:Status; progress:number|null; phase:string; }
export interface Version { id:string; type:string; }
export interface Content { name:string; kind:string; enabled:boolean; }
export const tabs:Tab[] = ['Overview','Content','Versions','Settings','Log'];

export type CatalogSource = 'modrinth' | 'curseforge';
export type CatalogKind = 'mod' | 'resourcepack' | 'shader' | 'modpack';
export interface CatalogProject { id:string; title:string; description:string; author:string; icon:string|null; background?:string|null; downloads:number; url:string; }
export interface CatalogPage { projects:CatalogProject[]; total:number; }
export interface CatalogRelease { id:string; name:string; published:string; }
export interface CatalogQuery {source:CatalogSource;kind:CatalogKind;query:string;sort:string;offset:number;limit?:number;game:string;loader:string;}
export const loaderLabel=(loader:Loader)=>({vanilla:'Vanilla',fabric:'Fabric',quilt:'Quilt'})[loader] || 'Vanilla';

export interface DebugLaunch { available: boolean; enabled: boolean; account?: Account | null; }

export interface LocalContent { path:string; kind:'mods'|'resourcepacks'|'shaderpacks'; enabled:boolean; }
export interface PackSelection { source:CatalogSource; project:string; release:string; title:string; icon:string|null; releaseName:string; }
export interface ArchivePreview { path:string; instance:Instance; }
export interface CreationRequest { name:string; default_name:string; version:string; loader:Loader; loader_version:string; parent:string; archive:string|null; pack:PackSelection|null; files:LocalContent[]; catalog:StagedContent[]; }

export interface StagedContent { source:CatalogSource; project:string; release:string; kind:CatalogKind; title:string; releaseName:string; enabled:boolean; }

export interface NewsArticle { title:string; date:string; url:string; source?:string; instance_id?:string; }
export interface InstanceNews { articles:NewsArticle[]; unavailable:string[]; }
