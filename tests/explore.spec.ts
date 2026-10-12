import {finishCreation} from './creation-helpers';
import {test,expect} from '@playwright/test';

test('Explore supports search, gallery/list, categories, and source setup without desktop downloads',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();
  await expect(page.getByRole('heading',{name:'Explore',exact:true})).toBeVisible();
  await expect(page.locator('.topbar, .welcome, .library-nav')).toHaveCount(0);
  const library=await page.locator('.home-library').boundingBox();
  const explore=await page.locator('.home-explore').boundingBox();
  expect(library!.y+library!.height).toBeLessThan(explore!.y);
  await expect(page.locator('.catalog-card')).toHaveCount(6);
  await page.locator('.home-explore').getByRole('button',{name:'List',exact:true}).click();
  await expect(page.locator('.catalog-grid')).toHaveClass(/catalog-list/);
  await page.getByLabel('Search projects').fill('sodium');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await page.locator('.catalog-card').click();
  await expect(page.getByRole('dialog')).toContainText('Sodium');
  await expect(page.getByRole('button',{name:'Add',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Close project'}).click();
  await page.getByLabel('Search projects').fill('');
  await page.getByRole('tab',{name:'Resource packs',exact:true}).click();
  await expect(page.locator('.catalog-card')).toHaveCount(3);
  await page.getByLabel('Content source').selectOption('curseforge');
  await expect(page.getByRole('alert')).toContainText('Connect CurseForge');
  await page.getByRole('button',{name:'Use Modrinth'}).click();
  await expect(page.locator('.catalog-card')).toHaveCount(3);
  await page.setViewportSize({width:700,height:650});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('native Explore uses the target compatibility, ignores stale searches, and adds the selected release',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;
    const config={instances:[{id:'fabric',name:'Modded world',version:'1.21.4',loader:'fabric',loader_version:'0.16.10',artwork:'grass',memory_mb:4096,java_path:'',installed:false}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    const projects=[{id:'modmenu',title:'Mod Menu',description:'Manage installed mods.',author:'Prospector',icon:null,downloads:1000,url:'https://modrinth.com/mod/modmenu'}];
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_config')return config;
      if(name==='get_activities'||name==='get_content')return [];
      if(name==='get_instance_icons')return {};
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog'){w.__query=args.query;if(args.query.query==='old')return new Promise(resolve=>w.__oldSearch=resolve);return {projects,total:1};}
      if(name==='get_catalog_releases'){w.__releaseArgs=args;return [{id:'release-1',name:'Mod Menu 13',published:'2026-01-01'}];}
      if(name==='add_catalog_content'){w.__addArgs=args;return ['modmenu.jar','fabric-api.jar'];}
      return null;
    }};
  });
  await page.goto('/');await page.getByRole('button',{name:'Modded world: Not installed'}).click();
  await page.getByRole('tab',{name:'Content',exact:true}).click();
  await page.getByRole('button',{name:'Browse',exact:true}).click();
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await expect(page.getByLabel('Target instance')).toHaveValue('fabric');
  await expect(page.getByLabel('Filter Minecraft version')).toBeDisabled();
  expect(await page.evaluate(()=>(window as any).__query)).toMatchObject({game:'1.21.4',loader:'fabric'});
  await page.getByLabel('Search projects').fill('old');
  await expect.poll(()=>page.evaluate(()=>typeof (window as any).__oldSearch)).toBe('function');
  await page.getByLabel('Search projects').fill('new');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await page.evaluate(()=>(window as any).__oldSearch({projects:[],total:0}));
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await page.locator('.catalog-card').click();
  await expect(page.getByLabel('Compatible release')).toHaveValue('release-1');
  await page.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Added 2 files to Modded world.');
  expect(await page.evaluate(()=>(window as any).__addArgs)).toEqual({source:'modrinth',project:'modmenu',id:'fabric',version:'release-1',kind:'mod'});
  await page.getByRole('button',{name:'Close project'}).click();
  await page.getByRole('tab',{name:'Modpacks',exact:true}).click();
  await expect(page.getByLabel('Target instance')).toHaveCount(0);
  await expect(page.getByLabel('Filter Minecraft version')).toBeEnabled();
  await expect(page.getByLabel('Filter loader')).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>(window as any).__query)).toMatchObject({kind:'modpack',game:'',loader:''});
});

test('Quilt loader persists and the library supports list view',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.getByLabel('Instance name').fill('Quilt world');
  await page.locator('.custom-instance').getByLabel('Minecraft version').selectOption('1.21.4');
  await page.getByRole('combobox',{name:'Modloader',exact:true}).selectOption('quilt');
  await expect(page.getByRole('combobox',{name:/^Quilt loader version/})).toHaveValue('0.24.0');
  await finishCreation(page);
  await expect(page.locator('.instance-hero')).toContainText('Quilt 0.24.0');
  await page.reload();await page.getByRole('button',{name:'Quilt world: Not installed'}).click();
  await expect(page.locator('.instance-hero')).toContainText('Quilt 0.24.0');
  await page.getByRole('button',{name:'Chest home'}).click();
  await page.locator('.home-library').getByRole('button',{name:'List',exact:true}).click();
  await expect(page.locator('.instance-grid')).toHaveClass(/library-list/);
});
