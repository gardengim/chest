import {get} from 'svelte/store';
import {developSettings,locale,autoUpdateChecks,doubleClickLaunch,reduceMotion,defaultInstanceLocation,browserLocale,beginPreferenceEdit,finishPreferenceEdit,type Locale} from './preferences';
import {activeScheme,appearanceMode,previewScheme,defaultScheme,applyPreview,beginAppearanceEdit,finishAppearanceEdit,type ModePreference,type ColorScheme} from './themes';
import type {Config} from './types';

export interface SettingsValues {
  memory:number;javaPath:string;locale:Locale;autoUpdateChecks:boolean;doubleClickLaunch:boolean;
  developSettings:boolean;reduceMotion:boolean;defaultInstanceLocation:string;scheme:ColorScheme;mode:ModePreference;
}
export function readSettings(config:Config):SettingsValues {
  return {memory:config.memory_mb,javaPath:config.java_path,locale:get(locale),developSettings:get(developSettings),autoUpdateChecks:get(autoUpdateChecks),
    doubleClickLaunch:get(doubleClickLaunch),reduceMotion:get(reduceMotion),defaultInstanceLocation:get(defaultInstanceLocation),
    scheme:get(activeScheme),mode:get(appearanceMode)};
}
export function beginSettingsEdit(){beginPreferenceEdit();beginAppearanceEdit();}
export function commitSettingsEdit(){applyPreview();finishAppearanceEdit(true);finishPreferenceEdit(true);}
export function discardSettingsEdit(saved:SettingsValues){
  locale.set(saved.locale);autoUpdateChecks.set(saved.autoUpdateChecks);doubleClickLaunch.set(saved.doubleClickLaunch);
  developSettings.set(saved.developSettings);reduceMotion.set(saved.reduceMotion);defaultInstanceLocation.set(saved.defaultInstanceLocation);
  appearanceMode.set(saved.mode);previewScheme.set(null);
  finishAppearanceEdit(false);finishPreferenceEdit(false);
}
export function restoreDefaultSettings(){
  locale.set(browserLocale);autoUpdateChecks.set(true);doubleClickLaunch.set(true);reduceMotion.set(false);developSettings.set(false);
  defaultInstanceLocation.set('');appearanceMode.set('dark');previewScheme.set(defaultScheme);
  return {memory:4096,javaPath:''};
}
