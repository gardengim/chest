import { derived } from 'svelte/store';
import { locale } from './preferences';
import korean from './locales/ko.json';
type Values=Record<string,string|number>;
const dictionary:Record<string,string>=korean;
export const t=derived(locale,language=>(key:string,values:Values={})=>{
  const text=language==='ko'?(dictionary[key] || key):key;
  return text.replace(/\{(\w+)\}/g,(match,name)=>values[name]===undefined?match:String(values[name]));
});
