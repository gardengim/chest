import {test,expect,type Page} from '@playwright/test';

async function fixture(page:Page){
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;w.__menuCalls=[];
    const callbacks=new Map<number,Function>(),listeners=new Map<string,number>();let sequence=0;
    w.__menuEvent=(action:string,event='desktop-menu')=>callbacks.get(listeners.get(event)!)?.({event,payload:action});
    w.__TAURI_INTERNALS__={transformCallback:(fn:Function)=>{callbacks.set(++sequence,fn);return sequence;},invoke:async(name:string,args:any)=>{
      w.__menuCalls.push(name);
      if(name==='set_menu_labels'){w.__menuLabels=args.labels;return;}
      if(name==='plugin:event|listen'){listeners.set(args.event,args.handler);return ++sequence;}
      if(name==='get_config')return {instances:[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_debug_launch')return {available:false,enabled:false};
      if(name==='get_instance_icons')return {};
      if(name==='get_versions')return [{id:'26.3',type:'release'}];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='get_screenshots')return {screenshots:[],unavailable:[]};
      if(name==='get_servers')return {servers:[],unavailable:[]};
      if(name==='get_worlds')return {worlds:[],unavailable:[]};
      if(name==='get_launcher_info')return {version:'0.1.0',platform:'Test',architecture:'test'};
      if(name==='get_app_update_info'||name==='check_app_update')return {current_version:'0.1.0',development:true,version:null,notes:null};
      if(name==='take_instance_intent')return null;
      return [];
    }};
  });
  await page.goto('/');await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
}
async function menu(page:Page,action:string,event='desktop-menu'){
  await page.evaluate(({action,event})=>(window as any).__menuEvent(action,event),{action,event});
}

test('native menus reuse navigation, settings, About, updates and existing external actions',async({page})=>{
  await fixture(page);
  await menu(page,'settings');await expect(page.getByRole('tab',{name:'Settings',exact:true})).toHaveAttribute('aria-selected','true');
  await menu(page,'about');await expect(page.getByRole('tab',{name:'About',exact:true})).toHaveAttribute('aria-selected','true');
  await menu(page,'screenshots');await expect(page.getByRole('heading',{name:'Screenshots',exact:true})).toBeVisible();
  await menu(page,'home');await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
  await menu(page,'issues');await menu(page,'data-folder');
  expect(await page.evaluate(()=>(window as any).__menuCalls)).toEqual(expect.arrayContaining(['open_launcher_link','open_data_folder']));
  await menu(page,'updates');await expect(page.getByRole('dialog',{name:'Chest updates'})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__menuCalls)).toContain('check_app_update');
  // Native navigation must not change the page behind an open application dialog.
  await menu(page,'create');await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close updater'}).click();
  await menu(page,'create');await expect(page.getByRole('heading',{name:'New instance',exact:true})).toBeVisible();
});

test('menu navigation preserves creation drafts and reports native failures in the app',async({page})=>{
  await fixture(page);await menu(page,'create');
  await page.getByRole('textbox',{name:'Instance name',exact:true}).fill('Keep this draft');
  await menu(page,'home');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Instance name',exact:true})).toHaveValue('Keep this draft');
  await menu(page,'Could not change window mode','desktop-menu-error');
  await expect(page.getByRole('alert')).toContainText('Could not change window mode');
});

test('native menu labels follow language previews and revert on Discard',async({page})=>{
  await fixture(page);await menu(page,'settings');
  await expect.poll(()=>page.evaluate(()=>(window as any).__menuLabels?.['Settings…'])).toBe('Settings…');
  await page.getByRole('combobox',{name:'Language',exact:true}).selectOption('zh-Hant');
  await expect.poll(()=>page.evaluate(()=>(window as any).__menuLabels?.['Settings…'])).toBe('設定…');
  await expect.poll(()=>page.evaluate(()=>(window as any).__menuLabels?.['File'])).toBe('檔案');
  await page.locator('.settings-actions button').nth(1).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__menuLabels?.['Settings…'])).toBe('Settings…');
});
