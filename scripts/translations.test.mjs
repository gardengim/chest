import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
import {languages,detectLocale,resolveLocale,localeDirection} from '../src/languages.ts';
import {activityText} from '../src/activity-text.ts';
const translations=await Promise.all(Object.keys(languages).filter(language=>language!=='en').map(async language=>[language,JSON.parse(await readFile(new URL(`src/locales/${language}.json`,root),'utf8'))]));
const keys=Object.keys(translations[0][1]).sort();
const placeholders=text=>[...text.matchAll(/\{\w+\}/g)].map(match=>match[0]).sort();
test('all translations cover the same keys and preserve interpolation placeholders',()=>{
  for(const [language,dictionary] of translations){
    assert.deepEqual(Object.keys(dictionary).sort(),keys,language);
    for(const [key,value] of Object.entries(dictionary)){
      assert.equal(typeof value,'string',`${language}: ${key}`);
      assert.ok(value.trim(),`${language}: ${key} is empty`);
      assert.deepEqual(placeholders(value),placeholders(key),`${language}: ${key}`);
    }
  }
});
test('literal interface translation calls have dictionary entries',async()=>{
  const dictionary=translations[0][1];
  for(const name of await readdir(new URL('src/',root))){
    if(!/\.(svelte|ts)$/.test(name))continue;
    const source=await readFile(new URL(`src/${name}`,root),'utf8');
    for(const match of source.matchAll(/(?:\$t|translate)\(\s*(['"])([^'"\n]+)\1/g))assert.ok(Object.hasOwn(dictionary,match[2]),`${name}: ${match[2]}`);
  }
});

test('locale detection preserves Chinese script and regional preferences',()=>{
  for(const code of ['zh','zh-CN','zh-SG','zh-Hans','zh-Hans-TW'])assert.equal(resolveLocale(code),'zh-Hans',code);
  for(const code of ['zh-TW','zh-HK','zh-MO','zh-Hant','zh_Hant_CN'])assert.equal(resolveLocale(code),'zh-Hant',code);
  assert.equal(detectLocale(['fr-CA','zh-HK','en']),'zh-Hant');
  assert.equal(detectLocale(['es-MX','zh-CN']),'es');
  assert.equal(detectLocale(['fr']),'en');
});
test('language registry, lazy dictionaries and native menu labels have complete coverage',async()=>{
  const files=(await readdir(new URL('src/locales/',root))).filter(name=>name.endsWith('.json')).map(name=>name.slice(0,-5)).sort();
  assert.deepEqual(files,translations.map(([language])=>language).sort());
  const i18n=await readFile(new URL('src/i18n.ts',root),'utf8');
  for(const [language] of translations)assert.ok(i18n.includes(`./locales/${language}.json`),language);
  const menus=await readFile(new URL('src/desktop-menu.ts',root),'utf8');
  const labels=[...menus.match(/desktopMenuLabels=\[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map(match=>match[1]);
  for(const [language,dictionary] of translations){
    for(const key of labels)assert.ok(Object.hasOwn(dictionary,key),`${language}: ${key}`);
    const raw=await readFile(new URL(`src/locales/${language}.json`,root),'utf8');
    assert.equal([...raw.matchAll(/^  \"[^\"\n]+\":/gm)].length,Object.keys(dictionary).length,`${language}: duplicate dictionary keys`);
  }
});

test('known installation progress is localized while unknown diagnostics are preserved',()=>{
  const dictionary=translations.find(([language])=>language==='zh-Hans')[1];
  const translate=(key,values={})=>(dictionary[key] || key).replace(/\{(\w+)\}/g,(match,name)=>values[name] ?? match);
  assert.equal(activityText('Downloading assets · 8 / 16 files verified',translate),'正在下载游戏资源 · 已验证 8 个文件，共 16 个');
  assert.equal(activityText('Preparing modpack files · 2/3',translate),'正在准备整合包文件 · 2/3');
  assert.equal(activityText('Custom filename世界.jar: I/O error',translate),'Custom filename世界.jar: I/O error');
});

test('Arabic locale detection and writing direction are explicit',()=>{
  assert.equal(resolveLocale('ar-SA'),'ar');assert.equal(detectLocale(['ar-EG','en']),'ar');
  for(const language of Object.keys(languages))assert.equal(localeDirection(language),language==='ar'?'rtl':'ltr');
});

test('sign-in return page localizes browser preferences, Chinese scripts and Arabic direction',async()=>{
  const html=await readFile(new URL('core/src/auth-callback.html',root),'utf8');
  const script=html.split('<script>')[1].split('</script>')[0];
  const cases=[...Object.keys(languages).map(code=>[[code],code]),[['fr-FR','ko-KR'],'ko'],[['zh-Hant-CN'],'zh-Hant'],[['zh-Hans-TW'],'zh-Hans'],[['zh-HK'],'zh-Hant'],[['fr-FR'],'en']];
  for(const [preferences,expected] of cases){
    const paragraph={textContent:''},document={documentElement:{},title:'',querySelector:()=>paragraph};
    runInNewContext(script,{navigator:{languages:preferences,language:preferences[0]},document,setTimeout:()=>{}});
    assert.equal(document.documentElement.lang,expected);
    assert.equal(document.documentElement.dir,localeDirection(expected));
    assert.ok(document.title.includes('Chest'));
    assert.ok(paragraph.textContent.includes('Chest'));
    if(expected!=='en')assert.ok(!paragraph.textContent.startsWith('You can return'));
  }
});
