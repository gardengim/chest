import {test,expect} from '@playwright/test';
import {openHomeTool} from './home-helpers';
import AxeBuilder from '@axe-core/playwright';

async function cardAction(page:import('@playwright/test').Page,card:import('@playwright/test').Locator,name:string){
  await card.click({button:'right'});await page.getByRole('menu').getByRole('menuitem',{name,exact:true}).click();
}
async function nativeFixture(page:import('@playwright/test').Page){
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;w.__calls=[];w.__backup=true;w.__localServers=[];w.__libraryShots=[];
    const instances=[{id:'source',name:'Adventure',version:'1.21.4',loader:'fabric',loader_version:'0.16.10',memory_mb:4096,java_path:'',artwork:'grass',installed:true},{id:'target',name:'Classic',version:'1.20.1',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true}];
    const config={instances,accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,server_bookmarks:[] as any[]};
    const worlds=[{instance_id:'source',folder:'Survival',name:'Survival',version:'1.21.4',data_version:4189,last_played:1234},{instance_id:'source',folder:'Unknown',name:'Unknown world',version:null,data_version:null,last_played:null}];
    let serverAdded=false;
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      w.__calls.push({name,args});
      if(name==='get_config')return structuredClone({...config,instances:w.__instances || config.instances});
      if(name==='get_versions')return [{id:'1.21.4',type:'release'},{id:'1.20.1',type:'release'}];
      if(name==='get_instance_icons')return w.__iconMap || {};
      if(name==='get_screenshots')return {screenshots:structuredClone(w.__libraryShots),unavailable:[]};
      if(name==='get_screenshot_image')return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ9kAAAAASUVORK5CYII=';
      if(name==='get_servers')return {servers:structuredClone(w.__localServers),unavailable:[]};
      if(name==='get_worlds')return {worlds:structuredClone(worlds),unavailable:[]};
      if(name==='get_world_info')return structuredClone(worlds.find(world=>world.instance_id===args.id && world.folder===args.name));
      if(name==='get_instance_worlds')return structuredClone(worlds.filter(world=>world.instance_id===args.id));
      if(name==='get_instance_files')return {worlds:worlds.filter(world=>world.instance_id===args.id).map(world=>world.folder),servers:w.__localServers.some((server:any)=>server.instance_id===args.id)?w.__localServers.filter((server:any)=>server.instance_id===args.id).map((server:any)=>({name:server.name,ip:server.address,icon:server.icon})):args.id==='source'?[{name:w.__serverName || 'Saved server',ip:'local.example'}]:[],screenshots:[]};
      if(name==='launch_resource')return null;
      if(name==='rename_resource'){
        if(args.kind==='world'){const world=worlds.find(world=>world.instance_id===args.id && world.folder===args.item);if(world)world.name=args.name;}
        else{w.__serverName=args.name;for(const server of w.__localServers)if(server.instance_id===args.id && server.address.toLowerCase()===args.item.toLowerCase())server.name=args.name;}
        return null;
      }
      if(name==='backup_world')return w.__backup;
      if(name==='copy_world'){worlds.push({...worlds[0],instance_id:args.target,folder:'world-copy'});return 'world-copy';}
      if(name==='save_server_bookmark'){
        const bookmark={...args.bookmark,id:args.bookmark.id || crypto.randomUUID()};
        const index=config.server_bookmarks.findIndex(b=>b.id===bookmark.id);
        if(index<0)config.server_bookmarks.push(bookmark);else config.server_bookmarks[index]=bookmark;
        return structuredClone(config);
      }
      if(name==='remove_server_bookmark'){config.server_bookmarks=config.server_bookmarks.filter(b=>b.id!==args.id);return structuredClone(config);}
      if(name==='add_bookmarked_server'){const added=!serverAdded;serverAdded=true;return added;}
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='get_instance_news')return {articles:[],unavailable:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      return [];
    }};
  });
}

test('worlds scan on demand, search, back up, and copy with compatibility guidance',async({page},testInfo)=>{
  await nativeFixture(page);await page.goto('/');
  expect(await page.evaluate(()=>(window as any).__calls.filter((call:any)=>call.name==='get_worlds').length)).toBe(0);
  await openHomeTool(page,'Worlds');
  await expect(page.locator('.world-list .launcher-card')).toHaveCount(2);
  await expect(page.locator('.world-list')).toContainText('Adventure');
  await expect(page.locator('.world-list')).toContainText('Unknown world');
  await page.getByLabel('Search worlds',{exact:true}).fill('missing');await expect(page.getByText('No results',{exact:true})).toBeVisible();
  await page.getByLabel('Search worlds',{exact:true}).fill('Survival');
  const world=page.locator('.world-list .launcher-card').first();
  await page.evaluate(()=>(window as any).__backup=false);await cardAction(page,world,'Back up');
  await expect(page.getByText('World backed up.',{exact:true})).toHaveCount(0);
  await page.evaluate(()=>(window as any).__backup=true);await cardAction(page,world,'Back up');
  await expect(page.getByText('World backed up.',{exact:true})).toBeVisible();
  await cardAction(page,world,'Copy');
  const dialog=page.getByRole('dialog',{name:'Copy world',exact:true});
  await expect(dialog.getByLabel('Target instance')).toHaveValue('target');
  await expect(dialog).toContainText('Different Minecraft version.');await expect(dialog).toContainText('Different mod loader.');
  await expect(dialog).toContainText('The original world is preserved.');
  await page.screenshot({path:testInfo.outputPath('copy-world.png'),fullPage:true});
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations).toEqual([]);
  await dialog.getByRole('button',{name:'Copy',exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(page.locator('.world-list .launcher-card')).toHaveCount(2);
  expect(await page.evaluate(()=>(window as any).__calls.find((call:any)=>call.name==='copy_world').args)).toEqual({id:'source',name:'Survival',target:'target'});
  await page.getByLabel('Search worlds',{exact:true}).fill('');await expect(page.locator('.world-list .launcher-card')).toHaveCount(3);
  await page.setViewportSize({width:600,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(600);
});

test('server bookmarks edit, copy addresses, warn before adding, and confirm removal',async({page})=>{
  await nativeFixture(page);await page.goto('/');await openHomeTool(page,'Servers');
  await page.getByRole('button',{name:'Add',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Server bookmark',exact:true});
  await editor.getByLabel('Name',{exact:true}).fill('Home');await editor.getByLabel('Address',{exact:true}).fill('example.com:25565');
  await editor.getByLabel('Preferred instance',{exact:true}).selectOption('target');
  await editor.getByLabel('Expected Minecraft version',{exact:true}).fill('1.21.4');
  await editor.getByLabel('Expected mod loader',{exact:true}).selectOption('fabric');
  await editor.getByRole('button',{name:'Save',exact:true}).click();await expect(editor).toHaveCount(0);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).__copied=text;}}}));
  await cardAction(page,page.locator('.server-list .launcher-card').first(),'Copy');expect(await page.evaluate(()=>(window as any).__copied)).toBe('example.com:25565');
  await cardAction(page,page.locator('.server-list .launcher-card').first(),'Add to instance');
  const adding=page.getByRole('dialog',{name:'Add to instance',exact:true});
  await expect(adding.getByLabel('Target instance')).toHaveValue('target');await expect(adding).toContainText('differs from the server');
  await adding.getByRole('button',{name:'Add',exact:true}).click();await expect(page.getByText('Server added.',{exact:true})).toBeVisible();
  await cardAction(page,page.locator('.server-list .launcher-card').first(),'Add to instance');await adding.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByText('Server already listed.',{exact:true})).toBeVisible();
  await cardAction(page,page.locator('.server-list .launcher-card').first(),'Edit');await editor.getByLabel('Name',{exact:true}).fill('Friends');await editor.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('.server-list h3')).toHaveText('Friends');
  await cardAction(page,page.locator('.server-list .launcher-card').first(),'Remove');const removal=page.getByRole('dialog',{name:'Remove bookmark?',exact:true});await expect(removal).toContainText('remains in existing instance server lists');
  await page.keyboard.press('Escape');await expect(removal).toHaveCount(0);await expect(page.locator('.server-list .launcher-card')).toHaveCount(1);
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations).toEqual([]);
  await cardAction(page,page.locator('.server-list .launcher-card').first(),'Remove');await removal.getByRole('button',{name:'Remove',exact:true}).click();
  await expect(page.getByText('No servers',{exact:true})).toBeVisible();
});

test('bookmarks persist in preview and changed creation drafts still guard global navigation',async({page})=>{
  await page.goto('/');await openHomeTool(page,'Servers');await page.getByRole('button',{name:'Add',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Server bookmark',exact:true});await dialog.getByLabel('Name',{exact:true}).fill('Friends');await dialog.getByLabel('Address',{exact:true}).fill('localhost');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await page.reload();await openHomeTool(page,'Servers');await expect(page.locator('.server-list')).toContainText('Friends');
  await page.getByRole('button',{name:'Create instance',exact:true}).click();await page.getByLabel('Instance name',{exact:true}).fill('Draft');await page.getByRole('button',{name:'Chest home',exact:true}).click();
  const confirm=page.getByRole('dialog',{name:'Discard draft?',exact:true});await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('Instance name',{exact:true})).toHaveValue('Draft');
});


test('existing instance servers can be bookmarked without claiming server requirements',async({page})=>{
  await nativeFixture(page);await page.goto('/');
  await page.getByRole('button',{name:'Adventure: Ready to play',exact:true}).click();
  await page.getByRole('tab',{name:'Servers',exact:true}).click();
  await cardAction(page,page.locator('.server-cards .launcher-card').first(),'Bookmark');
  await page.locator('.server-cards .launcher-card').first().click({button:'right'});await expect(page.getByRole('menuitem',{name:'Already added',exact:true})).toBeDisabled();await page.keyboard.press('Escape');
  const saved=await page.evaluate(()=>(window as any).__calls.find((call:any)=>call.name==='save_server_bookmark').args.bookmark);
  expect(saved).toMatchObject({name:'Saved server',address:'local.example',instance_id:'source',expected_version:'',expected_loader:null});
  await openHomeTool(page,'Servers');await expect(page.locator('.server-list')).toContainText('Saved server');
});


test('global servers discover instance entries, deduplicate bookmarks, refresh and offer both layouts',async({page})=>{
  await nativeFixture(page);
  await page.addInitScript(()=>{
    (window as any).__localServers=[{instance_id:'source',name:'Local friends',address:'LOCAL.example:25565',icon:null},{instance_id:'target',name:'Same friends',address:'local.example',icon:null}];
  });
  await page.goto('/');await openHomeTool(page,'Servers');
  await expect(page.locator('.server-list .launcher-card')).toHaveCount(1);
  await expect(page.locator('.server-list [data-reference]:not(.overflowed)')).toHaveCount(2);
  await expect(page.locator('.server-list [data-reference]').nth(0)).toContainText('Adventure');
  await expect(page.locator('.server-list [data-reference]').nth(1)).toContainText('Classic');
  await expect(page.locator('.server-list')).toHaveClass(/gallery/);
  await page.getByRole('radiogroup',{name:'Servers layout'}).getByRole('radio',{name:'List',exact:true}).click();
  await expect(page.locator('.server-list')).not.toHaveClass(/gallery/);
  await cardAction(page,page.locator('.server-list .launcher-card').first(),'Bookmark');
  await expect(page.locator('.server-list .launcher-card')).toHaveCount(1);
  await page.locator('.server-list .launcher-card').first().click({button:'right'});await expect(page.getByRole('menuitem',{name:'Edit',exact:true})).toBeVisible();await page.keyboard.press('Escape');
  await page.evaluate(()=>(window as any).__localServers.push({instance_id:'source',name:'New server',address:'new.example',icon:null}));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.server-list .launcher-card')).toHaveCount(2);
  await expect(page.locator('.server-list')).toContainText('New server');
});


test('screenshots shelf previews local images, paginates and opens the original',async({page})=>{
  await nativeFixture(page);
  await page.addInitScript(()=>{
    (window as any).__libraryShots=Array.from({length:25},(_,index)=>({instance_id:'source',name:`photo-${index}.png`,modified:25-index}));
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['screenshots']}));
  });
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Screenshots 25',exact:true})).toBeVisible();
  await expect(page.locator('.screenshot-tile')).toHaveCount(24);
  const first=page.getByRole('button',{name:'photo-0.png · Adventure',exact:true});
  await expect(first).toHaveAttribute('data-shape','card');await expect(first).toBeEnabled();await first.click();
  const preview=page.getByRole('dialog',{name:'photo-0.png',exact:true});
  await expect(preview.getByRole('img',{name:'photo-0.png',exact:true})).toHaveAttribute('src',/^data:image\/png/);
  await preview.getByRole('button',{name:'Open',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__calls.find((call:any)=>call.name==='open_instance_file').args)).toEqual({id:'source',kind:'screenshots',name:'photo-0.png'});
  await preview.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'View all',exact:true}).click();
  await page.locator('.pagination').getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.locator('.screenshot-tile')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'photo-24.png · Adventure',exact:true})).toBeVisible();
});


test('clicking global world and server cards opens and focuses their instance items',async({page})=>{
  await nativeFixture(page);await page.addInitScript(()=>{(window as any).__localServers=[{instance_id:'source',name:'Friends',address:'local.example:25565',icon:null}];});
  await page.goto('/');await openHomeTool(page,'Worlds');
  const world=page.locator('.world-list .launcher-card').filter({has:page.getByRole('heading',{name:'Survival',exact:true})});
  await expect(world.locator('button')).toHaveCount(0);await world.click();
  await expect(page.getByRole('heading',{name:'Adventure',exact:true,level:1})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Worlds',exact:true})).toHaveAttribute('aria-selected','true');
  const target=page.locator('[data-resource-key="world:Survival"]');await expect(target).toHaveAttribute('data-highlighted','true');await expect(target).toBeFocused();
  await openHomeTool(page,'Servers');await page.locator('.server-list .launcher-card').click();
  await expect(page.getByRole('tab',{name:'Servers',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('[data-resource-key="server:local.example"]')).toBeFocused();
});

test('a shared server chooses between matching instance cards before opening the correct tab',async({page})=>{
  await nativeFixture(page);await page.addInitScript(()=>{(window as any).__localServers=[{instance_id:'source',name:'Friends',address:'local.example',icon:null},{instance_id:'target',name:'Friends',address:'LOCAL.example:25565',icon:null}];});
  await page.goto('/');await openHomeTool(page,'Servers');await page.locator('.server-list .launcher-card').click();
  const chooser=page.getByRole('dialog',{name:'Choose instance',exact:true});await expect(chooser.locator('.launcher-card')).toHaveCount(2);
  expect((await chooser.boundingBox())!.width).toBeGreaterThan(700);
  for(const width of [600,320,1150]){
    await page.setViewportSize({width,height:800});
    expect(await chooser.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
    const frame=(await chooser.boundingBox())!;expect(frame.x).toBeGreaterThanOrEqual(0);expect(frame.x+frame.width).toBeLessThanOrEqual(width);
  }
  await chooser.getByRole('button',{name:/Classic/}).click();await expect(chooser).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Classic',exact:true,level:1})).toBeVisible();await expect(page.getByRole('tab',{name:'Servers',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('[data-resource-key="server:local.example"]')).toHaveAttribute('data-highlighted','true');await expect(page.locator('[data-resource-key="server:local.example"]')).toBeFocused();
});


test('instance resource cards expose direct actions, overflow menus, rename and icon references',async({page})=>{
  await nativeFixture(page);await page.addInitScript(()=>(window as any).__iconMap={source:'/chest.svg'});await page.goto('/');await openHomeTool(page,'Worlds');
  await expect(page.locator('.world-list .instance-icon-ref img').first()).toHaveAttribute('src','/chest.svg');
  await page.locator('.world-list .launcher-card').filter({has:page.getByRole('heading',{name:'Survival',exact:true})}).click();
  const world=page.locator('.world-list .launcher-card').filter({has:page.getByRole('heading',{name:'Survival',exact:true})});
  await expect(world).toHaveAttribute('data-layout','gallery');
  await expect(page.locator('.world-list')).toHaveCSS('grid-template-columns',/\d/);
  await world.getByRole('button',{name:'Play',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__calls.find((call:any)=>call.name==='launch_resource').args)).toEqual({id:'source',kind:'world',item:'Survival'});
  const action=world.getByRole('button',{name:'Back up',exact:true});await expect(action).toHaveCSS('background-color','rgba(0, 0, 0, 0.4)');
  await world.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'Rename',exact:true}).click();
  const rename=page.getByRole('dialog',{name:'Rename',exact:true});await rename.getByLabel('Name',{exact:true}).fill('New world name');await rename.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('heading',{name:'New world name',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Servers',exact:true}).click();const server=page.locator('.server-cards .launcher-card').first();
  await server.getByRole('button',{name:'Join',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__calls.filter((call:any)=>call.name==='launch_resource').at(-1).args)).toEqual({id:'source',kind:'server',item:'local.example'});
  await server.getByRole('button',{name:'Rename',exact:true}).click();await rename.getByLabel('Name',{exact:true}).fill('New server name');await rename.getByRole('button',{name:'Save',exact:true}).click();await expect(server.getByRole('heading',{name:'New server name',exact:true})).toBeVisible();
  await server.getByRole('button',{name:'More actions',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Bookmark',exact:true})).toBeVisible();await page.keyboard.press('Escape');
  await page.setViewportSize({width:320,height:800});await expect(server.getByRole('button',{name:'Rename',exact:true})).toBeHidden();
  await server.getByRole('button',{name:'More actions',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Rename',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('crowded server instance references collapse to a count and expand when space returns',async({page})=>{
  await nativeFixture(page);
  await page.addInitScript(()=>{
    const w=window as any;
    w.__instances=['Long Adventure Instance','Long Creative Instance','Long Survival Instance','Long Classic Instance'].map((name,index)=>({id:`instance-${index}`,name,version:'1.21.4',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true}));
    w.__localServers=w.__instances.map((instance:any)=>({instance_id:instance.id,name:'Shared server',address:'shared.example',icon:null}));
  });
  await page.goto('/');await openHomeTool(page,'Servers');
  const card=page.locator('.server-list .launcher-card'),refs=card.locator('.instance-references');
  await expect(refs.locator('[data-counter]:not(.measuring)')).toHaveText('+3');
  await expect(refs.locator('[data-reference]:not(.overflowed)')).toHaveCount(1);
  const rect=(await refs.boundingBox())!;expect(rect.width).toBeLessThan((await card.boundingBox())!.width);
  await page.getByRole('radiogroup',{name:'Servers layout'}).getByRole('radio',{name:'List',exact:true}).click();
  await page.setViewportSize({width:1600,height:900});
  await expect(refs.locator('[data-reference]:not(.overflowed)')).toHaveCount(4);
  await expect(refs.locator('[data-counter]')).toBeHidden();
  await page.setViewportSize({width:600,height:800});
  await expect(refs.locator('[data-counter]:not(.measuring)')).toBeVisible();
  await card.click();await expect(page.getByRole('dialog',{name:'Choose instance',exact:true}).locator('.launcher-card')).toHaveCount(4);
});
