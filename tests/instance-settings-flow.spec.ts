import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function fixture(page:Page){
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;w.__calls=[];w.__listeners={};w.__events={};w.__menu=(action:string)=>w.__listeners[w.__events['desktop-menu']]?.({payload:action});
    const instance={id:'world',name:'World',version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true};
    const config={instances:[instance],accounts:[],active_account:null,client_id:'',java_path:'/default/java',memory_mb:8192};
    let launch={width:854,height:480,fullscreen:false,graphics_api:'default',account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
    w.__TAURI_INTERNALS__={transformCallback:(fn:any)=>{const key=Object.keys(w.__listeners).length+1;w.__listeners[key]=fn;return key;},invoke:async(name:string,args:any)=>{
      w.__calls.push({name,args});
      if(name==='plugin:event|listen'){w.__events[args.event]=args.handler;return args.handler;}
      if(name==='get_config')return structuredClone(config);
      if(name==='get_launch_settings')return structuredClone(launch);
      if(name==='save_instance'){
        if(w.__delay)await new Promise(resolve=>w.__resume=resolve);
        if(w.__fail)throw new Error('Test save failure');
        config.instances[0]=args.instance;if(args.settings)launch=args.settings;return structuredClone(config);
      }
      if(name==='get_versions')return [{id:'26.3',type:'release'}];
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_instance_icons')return {};
      if(name==='get_instance_news')return {articles:[],unavailable:[]};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='get_worlds')return {worlds:[],unavailable:[]};
      if(name==='get_servers')return {servers:[],unavailable:[]};
      if(name==='get_screenshots')return {screenshots:[],unavailable:[]};
      if(name==='take_instance_intent')return null;
      return [];
    }};
  });
  await page.goto('/');await page.getByRole('button',{name:'World: Ready to play',exact:true}).click();
  await expect(page.locator('.details')).not.toContainText('Account');
  expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c.name==='get_launch_settings').length)).toBe(0);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Window width',{exact:true})).toHaveValue('854');
}
const dialog=(page:Page)=>page.getByRole('dialog',{name:'Save settings changes?'});
const footer=(page:Page)=>page.locator('.instance-settings-actions');

test('one footer saves all settings; reset stages defaults and preserves identity',async({page})=>{
  await fixture(page);
  await expect(page.getByRole('button',{name:'Save',exact:true})).toHaveCount(1);
  await expect(footer(page).getByRole('button',{name:'Save',exact:true})).toBeDisabled();
  await page.getByLabel('Name',{exact:true}).fill('Renamed');
  await page.getByLabel('Memory (MB)',{exact:true}).fill('12288');
  await page.getByLabel('Window width',{exact:true}).fill('1280');
  await footer(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('.notification')).toContainText('Instance saved.');
  const calls=await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c.name==='save_instance'));
  expect(calls).toHaveLength(1);expect(calls[0].args.instance).toMatchObject({name:'Renamed',memory_mb:12288});expect(calls[0].args.settings.width).toBe(1280);
  await footer(page).getByRole('button',{name:'Restore defaults',exact:true}).click();
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Renamed');
  await expect(page.getByLabel('Memory (MB)',{exact:true})).toHaveValue('8192');
  await expect(page.getByLabel('Java executable',{exact:true})).toHaveValue('/default/java');
  await expect(page.getByLabel('Window width',{exact:true})).toHaveValue('854');
  expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c.name==='save_instance').length)).toBe(1);
  await page.getByRole('tab',{name:'Overview',exact:true}).click();
  await dialog(page).getByRole('button',{name:'Discard',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Memory (MB)',{exact:true})).toHaveValue('12288');
  await expect(page.getByLabel('Window width',{exact:true})).toHaveValue('1280');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('tab and page navigation protect drafts; failed and invalid saves stay editable',async({page})=>{
  await fixture(page);await page.getByLabel('Name',{exact:true}).fill('Draft');
  await page.getByRole('tab',{name:'Contents',exact:true}).click();
  await expect(dialog(page).getByRole('button')).toHaveText(['Cancel','Discard','Save']);
  await expect(dialog(page).getByRole('button',{name:'Close',exact:true})).toHaveCount(0);
  await dialog(page).getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Settings',exact:true})).toHaveAttribute('aria-selected','true');
  await page.locator('.launch-settings summary').click();
  await page.getByLabel('Environment variables',{exact:true}).fill('INVALID');
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await dialog(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog(page).getByRole('alert')).toContainText('NAME=value');
  expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c.name==='save_instance').length)).toBe(0);
  await dialog(page).getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByLabel('Environment variables',{exact:true}).fill('TEST=value');
  await page.evaluate(()=>(window as any).__fail=true);
  await page.getByRole('tab',{name:'Overview',exact:true}).click();
  await dialog(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog(page).getByRole('alert')).toHaveText('Test save failure');
  await page.evaluate(()=>(window as any).__fail=false);
  await dialog(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog(page)).toHaveCount(0);await expect(page.getByRole('heading',{name:'Draft',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();await expect(page.getByLabel('Environment variables',{exact:true})).toHaveValue('TEST=value');
});

test('navigation cannot discard or edit an in-flight save',async({page})=>{
  await fixture(page);await page.getByLabel('Name',{exact:true}).fill('Saved name');
  await page.evaluate(()=>(window as any).__delay=true);
  await footer(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByLabel('Name',{exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await expect(dialog(page).getByRole('button',{name:'Discard',exact:true})).toBeDisabled();
  await page.evaluate(()=>(window as any).__resume());
  await expect(dialog(page).getByRole('button',{name:'Save',exact:true})).toBeEnabled();
  await dialog(page).getByRole('button',{name:'Save',exact:true}).click();
  // The second save has the same deliberate delay.
  await page.evaluate(()=>(window as any).__resume());
  await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
});

test('native quit waits for unsaved instance settings and only exits after the decision',async({page})=>{
  await fixture(page);await page.getByLabel('Name',{exact:true}).fill('Unsaved');
  await page.evaluate(()=>(window as any).__menu('quit'));
  await expect(dialog(page)).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c.name==='complete_exit').length)).toBe(0);
  await dialog(page).getByRole('button',{name:'Cancel',exact:true}).click();
  await page.evaluate(()=>(window as any).__menu('quit'));
  await dialog(page).getByRole('button',{name:'Discard',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__calls.some((c:any)=>c.name==='complete_exit'))).toBe(true);
});
