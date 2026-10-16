import type { Loader, PackSelection, ArchivePreview, LocalContent, StagedContent } from './types';

export type Perform = (task: () => Promise<unknown>) => Promise<unknown>;
// Retain drafts and pending submissions while their page is unmounted.
export interface CreationFormState {
  pending: boolean;
  method: 'Custom' | 'Modpacks' | 'Import';
  name: string;
  version: string;
  loader: Loader;
  loaderVersion: string;
  parent: string;
  pack: PackSelection | null;
  archive: ArchivePreview | null;
  files: LocalContent[];
  catalog: StagedContent[];
}
export interface LibraryView { filter: string; layout: 'gallery' | 'list'; }
export interface SettingsFormState { pending: boolean; clientId: string; javaPath: string; memory: number; }

import {defaultLaunchSettings,type LaunchSettings} from './types';
export interface LaunchDraft {settings:LaunchSettings;loaded:boolean;loading:boolean;pending:boolean;error:string;account:string;javaArgs:string;gameArgs:string;environment:string;before:string;after:string;baseline:string;}
export const createLaunchDraft=():LaunchDraft=>({settings:defaultLaunchSettings(),loaded:false,loading:false,pending:false,error:'',account:'',javaArgs:'',gameArgs:'',environment:'',before:'',after:'',baseline:''});
export type SettingsTab='Accounts'|'Settings'|'Develop'|'About';
