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
