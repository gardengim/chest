import {test,expect} from '@playwright/test';

async function startupFixture(page:import('@playwright/test').Page,race=false,hold=false){
  await page.addInitScript(({race,hold})=>{
    const w=window as any;w.isTauri=true;w.__calls=[];
    const callbacks=new Map<number,Function>(),listeners=new Map<string,number>();let sequence=0;
    const config={instances:[{id:'world',name:'Startup world',version:'1.21.4',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:true}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    w.__TAURI_INTERNALS__={transformCallback:(fn:Function)=>{callbacks.set(++sequence,fn);return sequence;},invoke:async(name:string,args:any)=>{
      w.__calls.push(name);
      if(name==='plugin:event|listen'){listeners.set(args.event,args.handler);return sequence;}
      if(name==='get_config')return hold?new Promise(resolve=>{w.__configReady=()=>resolve(config);}):config;
      if(name==='get_debug_launch')return {available:false,enabled:false};
      if(name==='get_activities'){
        if(race){
          callbacks.get(listeners.get('activity')!)?.({event:'activity',payload:{id:'world',status:'running',progress:null,phase:'Minecraft is running'}});
          return [{id:'world',status:'idle',progress:null,phase:'Ready to play'}];
        }
        const current=[{id:'world',status:'running',progress:null,phase:'Minecraft is running'}];
        return hold?new Promise(resolve=>{w.__activitiesReady=()=>resolve(current);}):current;
      }
      // None of these unresolved operations may block library interaction.
      if(['get_instance_icons','get_versions','get_news','get_instance_news','get_app_update_info','take_instance_intent'].includes(name))return new Promise(()=>{});
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='get_screenshot_backgrounds'||name==='get_logs')return [];
      return null;
    }};
  },{race,hold});
}

test('library and navigation work while optional startup requests never resolve',async({page},info)=>{
  await startupFixture(page);
  const failures:string[]=[];page.on('pageerror',error=>failures.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Instances',exact:false})).toBeVisible();
  await expect(page.locator('.rail-item.running')).toHaveCount(1);
  await page.getByLabel('Search instances').fill('unmatched');
  await expect(page.locator('.instance-card')).toHaveCount(0);
  await page.getByLabel('Search instances').fill('Startup');
  await expect(page.locator('.instance-card')).toHaveCount(1);
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>entry.name));
  expect(resources.some(url=>/\/(CreatePage|SettingsPage|InstancePage)[-.]/.test(url))).toBe(false);
  await page.getByRole('button',{name:'Startup world: Minecraft is running',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Overview',exact:true})).toBeVisible();
  await expect(page.locator('.install-button')).toContainText('Stop');
  const timing=await page.evaluate(()=>performance.getEntriesByName('chest:library-ready')[0].startTime);
  await info.attach('startup.json',{body:JSON.stringify({libraryReadyMs:timing,optionalRequestsUnresolved:true}),contentType:'application/json'});
  expect(failures).toEqual([]);
});

test('an activity event arriving during startup wins over the older snapshot',async({page})=>{
  await startupFixture(page,true);await page.goto('/');
  await expect(page.locator('.rail-item.running')).toHaveCount(1);
  await page.getByRole('button',{name:'Startup world: Minecraft is running',exact:true}).click();
  await expect(page.locator('.install-button')).toContainText('Stop');
});

test('config and activity startup overlap, but launch controls wait for the activity snapshot',async({page})=>{
  await startupFixture(page,false,true);await page.goto('/');
  await page.waitForFunction(()=>!!(window as any).__configReady && !!(window as any).__activitiesReady);
  expect(await page.evaluate(()=>(window as any).__calls)).toContain('get_debug_launch');
  await page.evaluate(()=>(window as any).__configReady());
  await expect(page.locator('.instance-card')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Opening Chest…'})).toBeVisible();
  await page.evaluate(()=>(window as any).__activitiesReady());
  await expect(page.locator('.rail-item.running')).toHaveCount(1);
  await page.getByRole('button',{name:'Startup world: Minecraft is running',exact:true}).click();
  await expect(page.locator('.install-button')).toContainText('Stop');
});
