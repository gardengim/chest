import {finishCreation} from './creation-helpers';
import { test, expect } from '@playwright/test';

test('project dialogs share overlay colors, restore focus, and clean up; broken artwork falls back and can recover', async ({ page }) => {
  await page.route('**/broken-art.png', route => route.abort());
  await page.addInitScript(() => {
    const w=window as any;w.isTauri=true;
    const broken='http://127.0.0.1:1420/broken-art.png';
    w.__icons={world:broken};
    const callbacks=new Map<number,Function>();const listeners=new Map<string,number>();let n=0;
    w.__emit=(payload:any)=>callbacks.get(listeners.get('activity')!)?.({event:'activity',payload});
    w.__TAURI_INTERNALS__={transformCallback:(fn:Function)=>{callbacks.set(++n,fn);return n;},invoke:async(name:string,args:any)=>{
      if(name==='plugin:event|listen'){listeners.set(args.event,args.handler);return n;}
      if(name==='get_config')return {instances:[{id:'world',name:'World',version:'1.21.4',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:false}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_activities')return [];
      if(name==='get_instance_icons')return w.__icons;
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[{id:'pack',title:'Artwork pack',author:'Creator',description:'A test pack',icon:broken,downloads:1000,url:'https://modrinth.com/modpack/pack'}],total:1};
      if(name==='get_modpack_releases')return [{id:'release',name:'Pack release',published:'2026-01-01'}];
      return null;
    }};
  });
  await page.goto('/');
  await expect(page.locator('.instance-icon img')).toHaveAttribute('src','/minecraft.png');
  await page.getByRole('tab',{name:'Modpacks',exact:true}).click();
  const card=page.locator('.catalog-card');
  await expect(card.locator('.catalog-art > svg')).toBeVisible();
  await card.click();
  await expect(page.locator('#overlays > dialog')).toBeVisible();
  await expect(page.locator('.project-dialog-icon > svg')).toBeVisible();
  const colors=await page.locator('dialog').evaluate(dialog=>({
    background:getComputedStyle(dialog).backgroundColor,
    text:getComputedStyle(dialog.querySelector('h2')!).color,
    label:getComputedStyle(dialog.querySelector('label')!).color,
    description:getComputedStyle(dialog.querySelector('p')!).color,
  }));
  await page.keyboard.press('Escape');
  await expect(page.locator('#overlays')).toBeEmpty();
  await expect(card).toBeFocused();
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.getByRole('tab',{name:'Modpacks',exact:true}).click();
  await page.getByRole('button',{name:'Choose',exact:true}).click();
  await page.locator('.catalog-card').click();
  await expect(page.locator('#overlays > dialog')).toHaveCount(2);
  expect(await page.locator('dialog').last().evaluate(dialog=>({
    background:getComputedStyle(dialog).backgroundColor,
    text:getComputedStyle(dialog.querySelector('h2')!).color,
    label:getComputedStyle(dialog.querySelector('label')!).color,
    description:getComputedStyle(dialog.querySelector('p')!).color,
  }))).toEqual(colors);
  await page.getByRole('button',{name:'Close project'}).click();
  await page.getByRole('button',{name:'Close modpack browser'}).click();
  await expect(page.locator('#overlays')).toBeEmpty();
  await page.evaluate(()=>{
    const w=window as any;
    w.__icons={world:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='};
    w.__emit({id:'world',status:'idle',progress:null,phase:'Ready'});
  });
  await expect(page.locator('.instance-icon img')).toBeVisible();
  await expect.poll(()=>page.locator('.instance-icon img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(1);
  await expect(page.locator('.instance-icon svg.artwork')).toHaveCount(0);
});

test('page extraction preserves library choices, creation draft, settings draft, and each instance editor', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({instances:[{id:'world',name:'World',version:'1.21.4',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:false}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096})));
  await page.reload();
  await page.getByLabel('Search instances').fill('world');
  await page.getByRole('group',{name:'Library layout'}).getByRole('button',{name:'List',exact:true}).click();
  await page.getByRole('button',{name:'World: Not installed',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('Unsaved world');
  await page.getByLabel('Memory (MB)').fill('8192');
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.getByLabel('Instance name').fill('Draft world');
  await page.getByRole('button',{name:'Accounts and settings'}).click();
  await page.getByRole('button',{name:'Discard'}).click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByLabel('Memory (MB)').fill('6144');
  await page.getByLabel('Java executable').fill('/draft/java');
  await page.getByRole('button',{name:'Chest home'}).click();
  await expect(page.getByLabel('Search instances')).toHaveValue('world');
  await expect(page.locator('.instance-grid')).toHaveClass(/library-list/);
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await expect(page.getByLabel('Instance name')).toHaveValue('');
  await page.getByRole('button',{name:'World: Not installed',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Unsaved world');
  await expect(page.getByLabel('Memory (MB)')).toHaveValue('8192');
  await page.getByRole('button',{name:'Accounts and settings'}).click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Memory (MB)')).toHaveValue('6144');
  await expect(page.getByLabel('Java executable')).toHaveValue('/draft/java');
});

test('pending form submissions remain disabled after leaving and returning to their page',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;
    const config={instances:[] as any[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_config')return JSON.parse(JSON.stringify(config));
      if(name==='get_activities')return [];
      if(name==='get_instance_icons')return {};
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='create_wizard')return new Promise(resolve=>w.__finishCreate=()=>{
        args={...args.request,loaderVersion:args.request.loader_version};
        const instance={id:'world',name:args.name,version:args.version,loader:args.loader,loader_version:args.loaderVersion,java_path:'',memory_mb:4096,artwork:'grass',installed:false};
        config.instances.push(instance);resolve(instance);
      });
      if(name==='save_settings')return new Promise(resolve=>w.__finishSettings=()=>resolve(structuredClone(config)));
      return null;
    }};
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.getByLabel('Instance name').fill('Pending world');
  await finishCreation(page);
  await expect(page.getByRole('button',{name:'Creating…',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Chest home'}).click();
  await expect(page.getByRole('button',{name:'Discard'})).toBeDisabled();
  await page.getByRole('button',{name:'Stay',exact:true}).click();
  await expect(page.getByRole('button',{name:'Creating…',exact:true})).toBeDisabled();
  await page.evaluate(()=>(window as any).__finishCreate());
  await expect(page.locator('.instance-hero')).toContainText('Pending world');
  await page.getByRole('button',{name:'Accounts and settings'}).click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('button',{name:'Saving…',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Chest home'}).click();
  await page.getByRole('button',{name:'Accounts and settings'}).click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('button',{name:'Saving…',exact:true})).toBeDisabled();
  await page.evaluate(()=>(window as any).__finishSettings());
  await expect(page.getByRole('button',{name:'Save',exact:true})).toBeEnabled();
});

test('inventory controls align and discovery tabs support the same keyboard navigation',async({page})=>{
  await page.goto('/');
  const bounds=await page.locator('.library-tools > button[data-tone="accent"], .library-tools > .search, .library-tools .view-switch button').evaluateAll(nodes=>nodes.map(node=>({top:node.getBoundingClientRect().top,height:node.getBoundingClientRect().height})));
  expect(Math.max(...bounds.map(b=>b.top))-Math.min(...bounds.map(b=>b.top))).toBeLessThanOrEqual(1);
  expect(new Set(bounds.map(b=>b.height)).size).toBe(1);
  const types=page.getByRole('tablist',{name:'Content types'});
  await types.getByRole('tab',{name:'Mods',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(types.getByRole('tab',{name:'Resource packs',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tabpanel',{name:'Resource packs',exact:true})).toBeVisible();
  await page.setViewportSize({width:700,height:650});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('instance screenshot backgrounds ignore late responses after switching instances',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;
    const instances=['one','two'].map(id=>({id,name:id,version:'1.21.4',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true}));
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_config')return {instances,accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_instance_screenshots') {
        if(args.id==='one')return new Promise(resolve=>w.__oldScreenshots=resolve);
        return ['/chest.svg'];
      }
      if(name==='get_activities'||name==='get_logs'||name==='get_content')return [];
      if(name==='get_instance_icons')return {};
      if(name==='search_catalog')return {projects:[],total:0};
      return null;
    }};
  });
  await page.goto('/');
  await page.getByRole('button',{name:'one: Ready to play',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof (window as any).__oldScreenshots)).toBe('function');
  await page.getByRole('button',{name:'two: Ready to play',exact:true}).click();
  await expect(page.locator('.instance-backdrop img.visible')).toHaveAttribute('src','/chest.svg');
  await page.evaluate(()=>(window as any).__oldScreenshots(['/old.png']));
  await expect(page.locator('.instance-backdrop img')).toHaveCount(1);
  await expect(page.locator('.instance-backdrop img.visible')).toHaveAttribute('src','/chest.svg');
});

test('sidebar group toggles preserve card and instance backdrop nodes and do not reload screenshots',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;w.__screenshotCalls=0;
    const instances=['one','two'].map(id=>({id,name:id,version:'1.21.4',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true}));
    const config={instances,sidebar_groups:[{name:'Friends',ids:['one','two'],collapsed:true}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_config')return JSON.parse(JSON.stringify(config));
      if(name==='set_sidebar_groups'){config.sidebar_groups=args.groups;return JSON.parse(JSON.stringify(config));}
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_instance_screenshots'){w.__screenshotCalls++;return ['/chest.svg','/chest.svg?frame=2'];}
      if(name==='get_activities'||name==='get_logs'||name==='get_content')return [];
      if(name==='get_instance_icons')return {};
      if(name==='search_catalog')return {projects:[],total:0};
      return null;
    }};
  });
  await page.goto('/');
  await expect(page.locator('.instance-card .instance-backdrop img')).toHaveCount(4);
  await page.locator('.instance-card .instance-backdrop img').evaluateAll(nodes=>nodes.forEach(n=>(n as any).__original=true));
  const calls=await page.evaluate(()=>(window as any).__screenshotCalls);
  const group=page.getByRole('button',{name:'Friends group',exact:true});
  await group.click();await expect(group).toHaveAttribute('aria-expanded','true');
  await group.click();await expect(group).toHaveAttribute('aria-expanded','false');
  expect(await page.locator('.instance-card .instance-backdrop img').evaluateAll(nodes=>nodes.every(n=>(n as any).__original))).toBe(true);
  expect(await page.evaluate(()=>(window as any).__screenshotCalls)).toBe(calls);
  await group.click();
  await page.getByRole('button',{name:'one: Ready to play',exact:true}).click();
  await expect(page.locator('.instance-scene .instance-backdrop img')).toHaveCount(2);
  await page.locator('.instance-scene .instance-backdrop img').evaluateAll(nodes=>nodes.forEach(n=>(n as any).__original=true));
  const heroCalls=await page.evaluate(()=>(window as any).__screenshotCalls);
  await group.click();await expect(group).toHaveAttribute('aria-expanded','false');
  await group.click();await expect(group).toHaveAttribute('aria-expanded','true');
  expect(await page.locator('.instance-scene .instance-backdrop img').evaluateAll(nodes=>nodes.every(n=>(n as any).__original))).toBe(true);
  expect(await page.evaluate(()=>(window as any).__screenshotCalls)).toBe(heroCalls);
  // Refreshing the same URLs when the window regains focus keeps existing images.
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect.poll(()=>page.evaluate(()=>(window as any).__screenshotCalls)).toBe(heroCalls+1);
  expect(await page.locator('.instance-scene .instance-backdrop img').evaluateAll(nodes=>nodes.every(n=>(n as any).__original))).toBe(true);
});
