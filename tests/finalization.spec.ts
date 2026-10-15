import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ9kAAAAASUVORK5CYII=';
async function fixture(page:Page,mode='dark',count=1){
  await page.addInitScript(({mode,count,png})=>{
    localStorage.setItem('chest-appearance-mode-v1',mode);
    const w=window as any;w.isTauri=true;w.__exits=[];w.__imageRequests=[];w.__storageReads=0;w.__cacheClears=0;
    const callbacks=new Map<number,Function>(),listeners=new Map<string,number>();let sequence=0;
    w.__exit=(action:string)=>callbacks.get(listeners.get('desktop-menu')!)?.({payload:action});
    let config={instances:Array.from({length:count},(_,i)=>({id:`world-${i}`,name:`World ${i}`,version:'1.21.4',loader:'vanilla',loader_version:'',artwork:'grass',installed:true,memory_mb:4096,java_path:''})),accounts:[],active_account:null,client_id:'2a46389b-7bf0-4854-95b8-0e808d0ac054',java_path:'',memory_mb:4096};
    w.__TAURI_INTERNALS__={transformCallback:(callback:Function)=>{callbacks.set(++sequence,callback);return sequence;},invoke:async(name:string,args:any)=>{
      if(name==='plugin:event|listen'){listeners.set(args.event,args.handler);return sequence;}
      if(name==='complete_exit'){w.__exits.push(args.action);return;}
      if(name==='get_config')return structuredClone(config);
      if(name==='save_settings'){config={...config,memory_mb:args.memoryMb,java_path:args.javaPath};return structuredClone(config);}
      if(name==='get_debug_launch')return {available:false,enabled:false};
      if(name==='get_instance_icons')return {};
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='take_instance_intent'||name==='get_world_icon')return null;
      if(name==='get_instance_files')return {worlds:['Survival'],screenshots:['image.png'],servers:[]};
      if(name==='get_instance_worlds')return [{instance_id:'world-0',folder:'Survival',name:'Survival',version:'1.21.4',data_version:null,last_played:null}];
      if(name==='get_screenshot_image'){w.__imageRequests.push(args);return png;}
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='get_storage_usage'){w.__storageReads++;return {instance_bytes:100,shared_bytes:200,cache_bytes:w.__cacheClears?0:1024,clearable_bytes:w.__cacheClears?0:1024,other_bytes:10,complete:true};}
      if(name==='clear_image_cache'){w.__cacheClears++;return 1024;}
      return [];
    }};
  },{mode,count,png});
  await page.goto('/');
  await expect(page.locator('.instance-card').first()).toBeVisible();
}
async function settings(page:Page){
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
}

test('close and quit reuse Cancel, Discard and Save before approving native exit',async({page})=>{
  await fixture(page);await settings(page);
  await page.getByLabel('Memory (MB)',{exact:true}).fill('6144');
  await page.evaluate(()=>(window as any).__exit('close'));
  let dialog=page.getByRole('dialog',{name:'Save settings changes?'});
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__exits)).toEqual([]);
  await page.evaluate(()=>(window as any).__exit('quit'));
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__exits)).toEqual(['quit']);
  await page.getByLabel('Memory (MB)',{exact:true}).fill('8192');
  await page.evaluate(()=>(window as any).__exit('close'));
  await dialog.getByRole('button',{name:'Discard',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__exits)).toEqual(['quit','close']);
});

test('storage scans only on demand and clearing requires a concrete confirmation',async({page})=>{
  await fixture(page);await settings(page);
  expect(await page.evaluate(()=>(window as any).__storageReads)).toBe(0);
  await page.getByRole('button',{name:'Check storage',exact:true}).click();
  await expect(page.getByRole('button',{name:'Clear image cache',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Clear image cache',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Clear image cache?'});
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__cacheClears)).toBe(0);
  await page.getByRole('button',{name:'Clear image cache',exact:true}).click();
  await dialog.getByRole('button',{name:'Clear',exact:true}).click();
  await expect(page.getByRole('button',{name:'Clear image cache',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>(window as any).__cacheClears)).toBe(1);
});

for(const mode of ['light','dark'])test(`image-free world page has accessible contrast in ${mode}`,async({page})=>{
  await fixture(page,mode);
  await page.locator('.instance-card').first().click();
  await page.getByRole('tab',{name:'Worlds',exact:true}).click();
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)}))).toEqual([]);
});

test('cards request thumbnails and full images load only when previewing',async({page})=>{
  await fixture(page);await page.locator('.instance-card').first().click();
  await page.getByRole('tab',{name:'Screenshots',exact:true}).click();
  await expect(page.locator('.screenshot-card .shared-card-art img')).toBeVisible();
  let requests=await page.evaluate(()=>(window as any).__imageRequests);
  expect(requests.every((request:any)=>[256,512,1024].includes(request.edge))).toBe(true);
  await page.locator('.screenshot-card').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as any).__imageRequests.some((request:any)=>request.edge===undefined))).toBe(true);
});

test('large instance collections render bounded pages and keep every item reachable',async({page})=>{
  await fixture(page,'dark',1000);
  await expect(page.locator('.instance-card')).toHaveCount(24);
  await page.locator('#home-instances').getByRole('button',{name:'View all',exact:true}).click();
  await expect(page.locator('.instance-card')).toHaveCount(24);
  await page.locator('.pagination').getByRole('button').last().click();
  await expect(page.locator('.instance-card').first()).toContainText('World 24');
  await page.getByLabel('Search instances').fill('World 999');
  await expect(page.locator('.instance-card')).toHaveCount(1);
  await expect(page.locator('.instance-card')).toContainText('World 999');
});
