import { derived, writable } from 'svelte/store';
import { locale, type Locale } from './preferences';
type Values=Record<string,string|number>;
type Dictionary=Record<string,string>;
const loaders={ko:()=>import('./locales/ko.json'),es:()=>import('./locales/es.json'),ja:()=>import('./locales/ja.json'),'zh-Hans':()=>import('./locales/zh-Hans.json'),'zh-Hant':()=>import('./locales/zh-Hant.json')};
const dictionary=writable<{language:Locale;values:Dictionary}>({language:'en',values:{}});
let requested:Locale='en';
locale.subscribe(language=>{
  requested=language;
  if(language==='en')return;
  void loaders[language]().then(module=>{
    if(requested===language)dictionary.set({language,values:module.default});
  }).catch(()=>{/* English remains usable if a translation file cannot load. */});
});
export const t=derived([locale,dictionary],([language,loaded])=>(key:string,values:Values={})=>{
  const text=loaded.language===language?(loaded.values[key] || key):key;
  return text.replace(/\{(\w+)\}/g,(match,name)=>values[name]===undefined?match:String(values[name]));
});
