import { writable, get } from 'svelte/store';
export type Locale = 'en' | 'ko';
const key='chest-ui-preferences-v1';
function read(){
  try{
    const value=JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value==='object'?value:{};
  }catch{return {};}
}
const saved=read();
export const locale=writable<Locale>(saved.locale==='ko' || saved.locale==='en'?saved.locale:navigator.language.startsWith('ko')?'ko':'en');
export const autoUpdateChecks=writable(saved.autoUpdateChecks!==false);
export const doubleClickLaunch=writable(saved.doubleClickLaunch!==false);
export const defaultInstanceLocation=writable(typeof saved.defaultInstanceLocation==='string'?saved.defaultInstanceLocation:'');
export const reduceMotion=writable(saved.reduceMotion===true);
function apply(){
  document.documentElement.lang=get(locale);
  document.documentElement.toggleAttribute('data-reduce-motion',get(reduceMotion));
  try{localStorage.setItem(key,JSON.stringify({locale:get(locale),...(get(autoUpdateChecks)?{}:{autoUpdateChecks:false}),...(get(doubleClickLaunch)?{}:{doubleClickLaunch:false}),...(get(reduceMotion)?{reduceMotion:true}:{}),...(get(defaultInstanceLocation)?{defaultInstanceLocation:get(defaultInstanceLocation)}:{})}));}catch{/* Preferences still apply when storage is unavailable. */}
}
locale.subscribe(apply);

autoUpdateChecks.subscribe(apply);
doubleClickLaunch.subscribe(apply);
reduceMotion.subscribe(apply);
defaultInstanceLocation.subscribe(apply);
