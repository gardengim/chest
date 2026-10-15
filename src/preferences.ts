import './themes';
import { writable, get } from 'svelte/store';
import {normalizeShelves,defaultShelves,homeSections,normalizeDockPosition,defaultDockPosition,type DockOrientation} from './home-layout';
import {isLocale,detectLocale,type Locale} from './languages';
export {languages,type Locale} from './languages';
const key='chest-ui-preferences-v1';
function read(){
  try{
    const value=JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value==='object'?value:{};
  }catch{return {};}
}
const saved=read();
export const browserLocale=detectLocale(navigator.languages?.length?navigator.languages:[navigator.language]);
export const locale=writable<Locale>(isLocale(saved.locale)?saved.locale:browserLocale);
export const autoUpdateChecks=writable(saved.autoUpdateChecks!==false);
export const doubleClickLaunch=writable(saved.doubleClickLaunch!==false);
export const defaultInstanceLocation=writable(typeof saved.defaultInstanceLocation==='string'?saved.defaultInstanceLocation:'');
export const homeShelves=writable(normalizeShelves(saved.homeShelves));
export const homeHiddenOrder=writable(normalizeShelves(saved.homeHiddenOrder || [...homeSections]));
export const homeDockPosition=writable(normalizeDockPosition(saved.homeDockPosition));
export const homeDockOrientation=writable<DockOrientation>(['horizontal','vertical'].includes(saved.homeDockOrientation)?saved.homeDockOrientation:'auto');
export const reduceMotion=writable(saved.reduceMotion===true);
let editingSettings=false;
export function beginPreferenceEdit(){editingSettings=true;}
export function finishPreferenceEdit(commit:boolean){editingSettings=false;if(commit)apply();}
function apply(){
  document.documentElement.lang=get(locale);
  document.documentElement.toggleAttribute('data-reduce-motion',get(reduceMotion));
  if(editingSettings)return;
  try{localStorage.setItem(key,JSON.stringify({locale:get(locale),...(JSON.stringify(get(homeHiddenOrder))===JSON.stringify(homeSections)?{}:{homeHiddenOrder:get(homeHiddenOrder)}),...(get(homeDockPosition)===defaultDockPosition?{}:{homeDockPosition:get(homeDockPosition)}),...(get(homeDockOrientation)==='auto'?{}:{homeDockOrientation:get(homeDockOrientation)}),...(JSON.stringify(get(homeShelves))===JSON.stringify(defaultShelves)?{}:{homeShelves:get(homeShelves)}),...(get(autoUpdateChecks)?{}:{autoUpdateChecks:false}),...(get(doubleClickLaunch)?{}:{doubleClickLaunch:false}),...(get(reduceMotion)?{reduceMotion:true}:{}),...(get(defaultInstanceLocation)?{defaultInstanceLocation:get(defaultInstanceLocation)}:{})}));}catch{/* Preferences still apply when storage is unavailable. */}
}
locale.subscribe(apply);

autoUpdateChecks.subscribe(apply);
doubleClickLaunch.subscribe(apply);
reduceMotion.subscribe(apply);
defaultInstanceLocation.subscribe(apply);

homeShelves.subscribe(apply);

homeDockPosition.subscribe(apply);
homeDockOrientation.subscribe(apply);

homeHiddenOrder.subscribe(apply);
