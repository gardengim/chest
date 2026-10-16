import {test,expect,type Page} from '@playwright/test';

async function fixture(page:Page,count=49){
  await page.addInitScript(count=>{
    const w=window as any;w.isTauri=true;w.__contentCount=count;w.__failLoader=false;
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',reduceMotion:true,homeShelves:['worlds','servers']}));
    const instance={id:'library',name:'Library',version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true};
    const worlds=Array.from({length:count},(_,i)=>({instance_id:'library',folder:`World ${i}`,name:`World ${i}`,version:'26.3',data_version:1,last_played:1}));
    const servers=Array.from({length:count},(_,i)=>({instance_id:'library',name:`Server ${i}`,address:`host${i}.example`,icon:null}));
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string)=>{
      if(name==='get_config')return {instances:[instance],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_versions')return [{id:'26.3',type:'release'}];
      if(name==='get_instance_icons')return {};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='get_worlds')return {worlds,unavailable:[]};
      if(name==='get_servers')return {servers,unavailable:[]};
      if(name==='get_content')return Array.from({length:w.__contentCount},(_,i)=>({name:`mod-${i}.jar`,kind:'mods',enabled:true}));
      if(name==='get_instance_files')return {worlds:worlds.map(world=>world.folder),servers:servers.map(server=>({name:server.name,ip:server.address})),screenshots:[]};
      if(name==='get_instance_worlds')return worlds;
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,graphics_api:'default',account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='get_instance_news')return {articles:[],unavailable:[]};
      if(name==='get_instance_folder')return '/synthetic/library/game';
      if(name==='take_instance_intent')return null;
      if(name==='get_loader_versions' || name==='get_fabric_versions'){if(w.__failLoader)throw new Error('Loader request failed');return ['0.19.5'];}
      return [];
    }};
  },count);
  await page.goto('/');
}

test('large Home shelves are bounded and View all searches the complete library',async({page})=>{
  await fixture(page,1000);
  await expect(page.locator('.world-list .launcher-card')).toHaveCount(24);
  await expect(page.locator('.server-list .launcher-card')).toHaveCount(24);
  const worlds=page.locator('[data-home-section="worlds"]');
  await worlds.getByRole('button',{name:'View all',exact:true}).click();
  await expect(page.locator('.world-list .launcher-card')).toHaveCount(24);
  await expect(page.getByRole('status',{name:'Page 1 of 42',exact:true})).toBeVisible();
  await page.getByLabel('Search worlds',{exact:true}).fill('World 999');
  await expect(page.locator('.world-list .launcher-card')).toHaveCount(1);
  await expect(page.locator('.world-list')).toContainText('World 999');
});

for(const kind of ['world','server'] as const)test(`${kind} paging and off-page deep links focus the intended instance resource`,async({page})=>{
  await fixture(page);await page.locator(`[data-home-section="${kind==='world'?'worlds':'servers'}"]`).getByRole('button',{name:'View all',exact:true}).click();
  const list=page.locator(kind==='world'?'.world-list':'.server-list');
  await expect(list.locator('.launcher-card')).toHaveCount(24);
  const pagination=page.locator('.pagination');
  await pagination.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByRole('status',{name:'Page 2 of 3',exact:true})).toBeVisible();
  await pagination.getByRole('button',{name:'Next',exact:true}).click();
  await expect(list.locator('.launcher-card')).toHaveCount(1);
  await list.locator('.launcher-card').click();
  const key=kind==='world'?'world:World 48':'server:host48.example';
  const target=page.locator(`[data-resource-key="${key}"]`);
  await expect(target).toHaveAttribute('data-highlighted','true');await expect(target).toBeFocused();
  await expect(page.getByRole('status',{name:'Page 3 of 3',exact:true})).toBeVisible();
  await expect(page.locator(kind==='world'?'.world-list .launcher-card':'.server-cards .launcher-card')).toHaveCount(1);
  await page.locator('.pagination').getByRole('button',{name:'Previous',exact:true}).click();
  await expect(page.getByRole('status',{name:'Page 2 of 3',exact:true})).toBeVisible();
});

test('Contents filters before paging, resets searches and clamps after refresh',async({page})=>{
  await fixture(page);await page.getByRole('button',{name:'Library: Ready to play',exact:true}).click();
  await page.getByRole('tab',{name:'Contents',exact:true}).click();
  await expect(page.locator('.content-entry')).toHaveCount(24);
  const pagination=page.locator('.pagination');
  await pagination.getByRole('button',{name:'Next',exact:true}).click();await pagination.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.locator('.content-entry')).toHaveCount(1);
  await page.getByLabel('Search content',{exact:true}).fill('mod-0.jar');
  await expect(page.locator('.content-entry')).toHaveCount(1);await expect(page.locator('.content-entry')).toContainText('mod-0.jar');
  await page.getByLabel('Search content',{exact:true}).fill('');
  await expect(page.locator('.content-entry')).toHaveCount(24);
  await pagination.getByRole('button',{name:'Next',exact:true}).click();await pagination.getByRole('button',{name:'Next',exact:true}).click();
  await page.evaluate(()=>(window as any).__contentCount=25);await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.getByRole('status',{name:'Page 2 of 2',exact:true})).toBeVisible();
  await expect(page.locator('.content-entry')).toHaveCount(1);await expect(page.locator('.content-entry')).toContainText('mod-24.jar');
  await page.getByRole('tab',{name:'Shaders',exact:true}).click();await expect(page.locator('.pagination')).toHaveCount(0);
});

test('loader failure is announced and associated, retry preserves a usable focus target',async({page})=>{
  await fixture(page,1);await page.evaluate(()=>(window as any).__failLoader=true);
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  const loader=page.getByLabel('Mod loader',{exact:true});await loader.focus();await loader.selectOption('fabric');
  const error=page.getByRole('alert').filter({hasText:'Loader request failed'});await expect(error).toBeVisible();
  const version=page.getByLabel('Fabric loader version',{exact:true});
  await expect(version).toBeDisabled();await expect(version).toHaveAttribute('aria-invalid','true');
  await expect(version).toHaveAttribute('aria-describedby',(await error.getAttribute('id'))!);await expect(loader).toBeFocused();
  await page.evaluate(()=>(window as any).__failLoader=false);await error.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(version).toBeEnabled();await expect(version).toHaveValue('0.19.5');await expect(loader).toBeFocused();await expect(error).toHaveCount(0);
});
