export const languages={en:'English',ko:'한국어',es:'Español',ja:'日本語','zh-Hans':'简体中文','zh-Hant':'繁體中文'} as const;
export type Locale=keyof typeof languages;
export const isLocale=(value:unknown):value is Locale=>typeof value==='string' && Object.hasOwn(languages,value);
export function resolveLocale(language:string):Locale|undefined {
  const parts=language.toLowerCase().replaceAll('_','-').split('-');
  if(parts[0]==='zh'){
    if(parts.includes('hant'))return 'zh-Hant';
    if(parts.includes('hans'))return 'zh-Hans';
    return parts.some(part=>['tw','hk','mo'].includes(part))?'zh-Hant':'zh-Hans';
  }
  return isLocale(parts[0])?parts[0]:undefined;
}
export function detectLocale(preferences:readonly string[]):Locale {
  for(const preference of preferences){const locale=resolveLocale(preference);if(locale)return locale;}
  return 'en';
}
