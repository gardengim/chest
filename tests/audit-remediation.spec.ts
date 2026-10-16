import {test,expect,type Page} from '@playwright/test';

async function fixture(page:Page,count=49){
  await page.addInitScript(count=>{
    const w=window as any;w.isTauri=true;w.__contentCount=count;w.__failLoader=false;w.__resourceCount=count;
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',reduceMotion:true,homeShelves:['instances','worlds','servers']}));
    const instance={id:'library',name:'Library',version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true};
    const worlds=Array.from({length:count},(_,i)=>({instance_id:'library',folder:`World ${i}`,name:`World ${i}`,version:'26.3',data_version:1,last_played:1,game_mode:'Creative'}));
    const servers=Array.from({length:count},(_,i)=>({instance_id:'library',name:`Server ${i}`,address:`host${i}.example`,icon:null}));
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string)=>{
      if(name==='get_config')return {instances:[instance],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_versions')return [{id:'26.3',type:'release'}];
      if(name==='get_instance_icons')return w.__icons || {};
      if(name==='get_world_icon')return '/minecraft.png';
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='get_worlds')return {worlds,unavailable:[]};
      if(name==='get_servers')return {servers,unavailable:[]};
      if(name==='get_content')return Array.from({length:w.__contentCount},(_,i)=>({name:`mod-${i}.jar`,kind:'mods',enabled:true}));
      if(name==='get_instance_files'){if(w.__failFiles)throw new Error('Filesystem unavailable');return {worlds:worlds.slice(0,w.__hideWorlds?0:w.__resourceCount).map(world=>world.folder),servers:servers.slice(0,w.__resourceCount).map(server=>({name:server.name,ip:server.address})),screenshots:[]};}
      if(name==='get_instance_worlds'){await new Promise(resolve=>setTimeout(resolve,w.__worldMetadataDelay || 0));w.__worldMetadataLoaded=true;return worlds;}
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
  await page.evaluate(()=>(window as any).__contentCount=25);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
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

test('late world metadata does not undo a page change after following a deep link',async({page})=>{
  await fixture(page);await page.evaluate(()=>{(window as any).__worldMetadataDelay=1000;});
  await page.locator('[data-home-section="worlds"]').getByRole('button',{name:'View all',exact:true}).click();
  await page.getByLabel('Search worlds',{exact:true}).fill('World 48');
  await page.locator('.world-list .launcher-card').click();
  await expect(page.getByRole('status',{name:'Page 3 of 3',exact:true})).toBeVisible();
  await page.locator('.pagination').getByRole('button',{name:'Previous',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__worldMetadataLoaded)).toBe(true);
  await expect(page.getByRole('status',{name:'Page 2 of 3',exact:true})).toBeVisible();
});


test('focus discovers absent resource tabs and leaves emptied tabs without treating errors as empty',async({page})=>{
  await fixture(page,1);
  await page.evaluate(()=>(window as any).__resourceCount=0);
  await page.getByRole('button',{name:'Library: Ready to play',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Worlds',exact:true})).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'Servers',exact:true})).toHaveCount(0);
  await page.evaluate(()=>{(window as any).__resourceCount=1;window.dispatchEvent(new Event('focus'));});
  await expect(page.getByRole('tab',{name:'Worlds',exact:true})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Servers',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Worlds',exact:true}).click();
  await page.evaluate(()=>{(window as any).__failFiles=true;window.dispatchEvent(new Event('focus'));});
  const error=page.getByRole('alert').filter({hasText:'Filesystem unavailable'});await expect(error).toBeVisible();
  expect(await error.evaluate(node=>{const css=getComputedStyle(node);const probe=document.createElement('span');probe.style.background='var(--theme-danger)';node.append(probe);const expected=getComputedStyle(probe).backgroundColor;probe.remove();return {actual:css.backgroundColor,expected,shadow:css.boxShadow};})).toMatchObject({actual:expect.any(String),shadow:expect.not.stringMatching(/^none$/)});
  expect(await error.evaluate(node=>{const probe=document.createElement('span');probe.style.background='var(--theme-danger)';node.append(probe);const matches=getComputedStyle(probe).backgroundColor===getComputedStyle(node).backgroundColor;probe.remove();return matches;})).toBe(true);
  await expect(page.getByRole('tab',{name:'Worlds',exact:true})).toHaveAttribute('aria-selected','true');
  await page.evaluate(()=>{(window as any).__failFiles=false;(window as any).__resourceCount=0;window.dispatchEvent(new Event('focus'));});
  await expect(page.getByRole('tab',{name:'Worlds',exact:true})).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'Servers',exact:true})).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
  await page.evaluate(()=>{(window as any).__resourceCount=1;window.dispatchEvent(new Event('focus'));});
  await expect(page.getByRole('tab',{name:'Worlds',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Contents',exact:true}).click();
  await page.getByRole('tab',{name:'Worlds',exact:true}).click();
  await page.evaluate(()=>{(window as any).__hideWorlds=true;window.dispatchEvent(new Event('focus'));});
  await expect(page.getByRole('tab',{name:'Worlds',exact:true})).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'Servers',exact:true})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Contents',exact:true})).toHaveAttribute('aria-selected','true');
});

test('world cards show real metadata, translucent actions and shared menu actions',async({page})=>{
  await fixture(page,1);
  const shelf=page.locator('[data-home-section="worlds"]');
  const card=shelf.locator('.launcher-card');
  await expect(card).not.toContainText('26.3');
  await expect(card).toContainText('Library');
  await expect(card).toContainText('Creative');
  await expect(card).toContainText('Last played');
  await card.click({button:'right'});
  const menu=page.getByRole('menu');
  await expect(menu.getByRole('menuitem',{name:'Play',exact:true})).toBeVisible();
  await expect(menu.locator('svg[data-symbol]')).not.toHaveCount(0);
  await page.keyboard.press('Escape');
  await card.click();
  const action=page.locator('.world-list .launcher-card .ui-button').first();
  await expect(action).toBeVisible();
  const paint=await action.evaluate(node=>({fill:getComputedStyle(node).backgroundColor,blur:getComputedStyle(node).backdropFilter}));
  expect(paint.fill).toMatch(/rgba\(0, 0, 0, 0\.4\)/);
  expect(paint.blur).toContain('blur');
  await action.hover();
  await expect(action).toHaveCSS('background-color','rgba(0, 0, 0, 0.533)');
});


test('instance icons recover to bundled artwork and shelf focus outlines are not clipped',async({page},info)=>{
  await fixture(page,1);
  const card=page.locator('.instance-card').first();
  await expect(card.locator('.shared-card-art img')).toHaveAttribute('src',/^data:image\/png;base64,/);
  await page.evaluate(()=>{(window as any).__icons={library:'data:image/png;base64,invalid'};window.dispatchEvent(new Event('focus'));});
  await expect(card.locator('.shared-card-art img')).toHaveAttribute('src',/^data:image\/png;base64,(?!invalid)/);
  await page.keyboard.press('Tab');await card.focus();
  await expect(card).toBeFocused();await card.scrollIntoViewIfNeeded();
  const box=(await card.boundingBox())!;
  const distance=await card.evaluate(n=>{const css=getComputedStyle(n);return parseFloat(css.outlineOffset)+parseFloat(css.outlineWidth)/2;});
  const screenshot=await page.screenshot({path:info.outputPath('complete-card-focus.png')});
  const {pixels,focus}=await page.evaluate(async({png,box,distance})=>{
    const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);const scale=image.width/innerWidth;
    const pixels=[[box.x-distance,box.y+box.height/2],[box.x+box.width+distance,box.y+box.height/2],[box.x+box.width/2,box.y-distance],[box.x+box.width/2,box.y+box.height+distance]].map(([x,y])=>Array.from(ctx.getImageData(Math.floor(x*scale),Math.floor(y*scale),1,1).data).slice(0,3));
    ctx.fillStyle=getComputedStyle(document.querySelector('.instance-card')!).outlineColor;ctx.fillRect(0,0,1,1);
    return {pixels,focus:Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3)};
  },{png:screenshot.toString('base64'),box,distance});
  expect(pixels).toEqual([focus,focus,focus,focus]);
});
