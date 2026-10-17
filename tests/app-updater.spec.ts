import {test,expect} from '@playwright/test';

test('signed updater UI retries checks, streams progress, persists across navigation, and offers restart',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;let checks=0,installs=0;
    const callbacks=new Map<number,Function>(),listeners=new Map<string,number>();let sequence=0;
    const info={current_version:'0.1.0',development:false,version:null,notes:null};
    w.__TAURI_INTERNALS__={transformCallback:(callback:Function)=>{callbacks.set(++sequence,callback);return sequence;},invoke:async(name:string,args:any)=>{
      if(name==='plugin:event|listen'){listeners.set(args.event,args.handler);return sequence;}
      if(name==='plugin:event|emit'){callbacks.get(listeners.get(args.event)!)?.({payload:args.payload});return;}
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      if(name==='get_config')return {instances:[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_instance_icons')return {};
      if(name==='get_versions')return [{id:'26.3',type:'release'}];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='get_app_update_info')return info;
      if(name==='check_app_update'){checks++;if(checks===1)throw new Error('Cannot reach release server');return {...info,version:'0.2.0',notes:'New release'};}
      if(name==='install_app_update'){
        installs++;w.__installCalls=installs;
        if(installs===1)throw new Error('Stop running instances and finish installations before updating Chest.');
        args.onProgress.onmessage({downloaded:25,total:100,installing:false});
        return new Promise<void>(resolve=>{w.__finishUpdate=()=>{args.onProgress.onmessage({downloaded:100,total:100,installing:true});resolve();};});
      }
      if(name==='restart_updated_app'){w.__restarted=true;return;}
      return [];
    }};
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  const panel=page.locator('.app-updater');
  await expect(page.getByRole('alert').filter({hasText:'release server'})).toContainText('Cannot reach release server');
  await panel.getByRole('button',{name:'Check',exact:true}).click();
  await expect(panel).toContainText('0.2.0');
  await expect(panel).toContainText('New release');
  await panel.getByRole('button',{name:'Update',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Stop running instances'})).toContainText('Stop running instances');
  await panel.getByRole('button',{name:'Update',exact:true}).click();
  await expect(panel.getByRole('progressbar')).toHaveAttribute('value','25');
  await expect(panel.getByRole('button',{name:'Update',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>(window as any).__installCalls)).toBe(2);
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await page.evaluate(()=>(window as any).__finishUpdate());
  await page.locator('.notification').getByRole('button',{name:'Restart',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Chest updates',exact:true});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Restart',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__restarted)).toBe(true);
  await dialog.getByRole('button',{name:'Close updater',exact:true}).click();
  await expect(dialog).toHaveCount(0);
});

test('browser preview does not offer native update installation',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  const panel=page.locator('.app-updater');
  await expect(panel).toContainText('Desktop app required');
  await expect(panel.getByRole('button',{name:'Check',exact:true})).toBeDisabled();
  await expect(panel.getByRole('button',{name:'Update',exact:true})).toHaveCount(0);
});

test('test profiles can check but cannot replace the app or check automatically',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;w.__checks=0;
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string)=>{
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      const callbacks=new Map<number,Function>(),listeners=new Map<string,number>();let sequence=0;
    const info={current_version:'0.1.0',development:false,test_profile:true,version:null,notes:null};
      if(name==='get_app_update_info')return info;
      if(name==='check_app_update'){w.__checks++;return {...info,version:'0.2.0'};}
      if(name==='install_app_update')throw new Error('Test must never invoke replacement');
      if(name==='get_config')return {instances:[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_instance_icons')return {};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      return [];
    }};
  });
  await page.goto('/');await page.getByRole('button',{name:'Settings'}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByText('Installing app updates is disabled in test profiles.')).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__checks)).toBe(0);
  await page.getByRole('button',{name:'Check',exact:true}).last().click();
  await expect(page.getByRole('region',{name:'Chest updates',exact:true}).getByRole('button',{name:'Update',exact:true})).toBeDisabled();
});
