import {test,expect} from '@playwright/test';

test('creation stays on one page, retains drafts, defaults blank names, and aligns controls',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Game and modloader'})).toBeVisible();
  await expect(page.getByLabel('Instance name',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Content',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Next',exact:true})).toHaveCount(0);
  await page.getByLabel('Minecraft version',{exact:true}).selectOption('1.21.4');
  await page.getByLabel('Modloader',{exact:true}).selectOption('fabric');
  await expect(page.getByLabel('Instance name',{exact:true})).toHaveAttribute('placeholder','Fabric 1.21.4');
  await page.getByLabel('Instance name',{exact:true}).fill('Draft');
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Discard draft?'})).toBeVisible();
  await page.getByRole('button',{name:'Stay',exact:true}).click();
  await expect(page.getByLabel('Instance name',{exact:true})).toHaveValue('Draft');
  const location=await page.getByLabel('Instance location',{exact:true}).boundingBox();
  const choose=await page.getByRole('button',{name:'Browse',exact:true}).boundingBox();
  expect(choose!.x).toBeGreaterThan(location!.x+location!.width);
  expect(choose!.y).toBeCloseTo(location!.y,0);
  const nameField=await page.getByLabel('Instance name',{exact:true}).boundingBox();
  expect(nameField!.y).toBeCloseTo(location!.y,0);
  const tab=await page.getByRole('tab',{name:'Custom',exact:true}).boundingBox();
  const panel=await page.locator('.creation-form').boundingBox();
  expect(Math.abs(tab!.y+tab!.height-panel!.y)).toBeLessThanOrEqual(4);
  await page.getByLabel('Instance name',{exact:true}).fill('   ');
  await page.getByRole('button',{name:'Create',exact:true}).last().click();
  await expect(page.locator('.instance-hero h1')).toHaveText('Fabric 1.21.4');
});

test('home Explore hands a pack to creation and does not install immediately',async({page})=>{
  await page.goto('/');
  await page.getByRole('tab',{name:'Modpacks',exact:true}).click();
  await page.locator('.catalog-card').first().click();
  await page.getByRole('button',{name:'Select',exact:true}).click();
  await expect(page.getByRole('heading',{name:'New instance',exact:true})).toBeVisible();
  await expect(page.getByLabel('Instance name',{exact:true})).toHaveAttribute('placeholder','Fabulously Optimized');
  await expect(page.getByRole('heading',{name:'Fabulously Optimized',exact:true})).toBeVisible();
  await expect(page.locator('.selected-pack > .artwork')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-preview-v1') || '{"instances":[]}').instances.length)).toBe(0);
  await expect(page.getByRole('heading',{name:'Content',exact:true})).toBeVisible();
});

test('import, local files and catalog releases share one final submission',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;w.__request=null;
    const config={instances:[] as any[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    const imported={id:'original',name:'Imported world',version:'1.21.4',loader:'fabric',loader_version:'0.16.10',installed:false,artwork:'grass',java_path:'',memory_mb:4096};
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_config')return structuredClone(config);
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_activities'||name==='get_content'||name==='get_logs'||name==='get_instance_screenshots')return [];
      if(name==='get_instance_icons')return {};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog'){w.__catalogQuery=args.query;return {projects:[{id:'sodium',title:'Sodium',description:'Performance',author:'Creator',icon:null,downloads:1000,url:'https://modrinth.com/mod/sodium'}],total:1};}
      if(name==='get_creation_releases'){w.__releaseQuery=args;return [{id:'release-1',name:'Sodium 1',published:'2026-01-01'}];}
      if(name==='choose_creation_archive')return {path:'/tmp/world.zip',instance:imported};
      if(name==='choose_instance_location')return '/tmp/Worlds';
      if(name==='choose_creation_files')return ['/tmp/example.jar'];
      if(name==='create_wizard'){w.__request=args.request;const instance={...imported,id:'new',name:args.request.name.trim()||args.request.default_name};config.instances.push(instance);return instance;}
      return null;
    }};
  });
  await page.goto('/');await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.getByRole('tab',{name:'Import',exact:true}).click();
  await expect(page.getByRole('button',{name:'Create',exact:true}).last()).toBeDisabled();
  await page.getByRole('button',{name:'Choose',exact:true}).click();
  await page.getByRole('button',{name:'Browse',exact:true}).click();
  await expect(page.getByLabel('Instance location',{exact:true})).toHaveValue('/tmp/Worlds');
  await page.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Add content'}).getByRole('tab',{name:'Modpacks',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Choose file',exact:true}).click();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Add content'}).getByLabel('Content source')).toHaveValue('modrinth');
  await page.getByRole('dialog',{name:'Add content'}).locator('.catalog-card').click();
  await expect(page.getByLabel('Install into instance')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__catalogQuery)).toMatchObject({game:'1.21.4',loader:'fabric',kind:'mod'});
  await page.getByRole('dialog').last().getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__releaseQuery)).toMatchObject({game:'1.21.4',loader:'fabric',kind:'mod'});
  await expect(page.locator('.creation-file')).toHaveCount(2);
  expect(await page.locator('.creation-file').first().evaluate(node=>getComputedStyle(node).borderBottomWidth)).toBe('0px');
  expect(await page.locator('.creation-file').last().evaluate(node=>getComputedStyle(node).borderTopWidth)).toBe('1px');
  await page.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.locator('.catalog-card')).toContainText('Already added');
  await page.locator('.catalog-card').click();
  await expect(page.getByRole('button',{name:'Added',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Close project'}).click();
  await page.getByRole('button',{name:'Close content browser'}).click();
  expect(await page.evaluate(()=>(window as any).__request)).toBeNull();
  await page.getByRole('button',{name:'Create',exact:true}).last().click();
  await expect(page.locator('.instance-hero h1')).toHaveText('Imported world');
  expect(await page.evaluate(()=>(window as any).__request)).toMatchObject({default_name:'Imported world',parent:'/tmp/Worlds',archive:'/tmp/world.zip',files:[{path:'/tmp/example.jar',kind:'mods',enabled:true}],catalog:[{source:'modrinth',project:'sodium',release:'release-1',enabled:true}]});
});

test('discard confirmation resets creation and cancels navigation on Escape',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.getByLabel('Instance name',{exact:true}).fill('Discard me');
  await page.getByRole('button',{name:'Accounts and settings',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Instance name',{exact:true})).toHaveValue('Discard me');
  await page.getByRole('button',{name:'Accounts and settings',exact:true}).click();
  await page.getByRole('button',{name:'Discard',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Accounts & settings'})).toBeVisible();
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await expect(page.getByLabel('Instance name',{exact:true})).toHaveValue('');
});

test('Vanilla hides loader mods and creation sections follow content then details',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Create instance',exact:true}).click();
  const content=await page.getByRole('heading',{name:'Content',exact:true}).boundingBox();
  const details=await page.getByRole('heading',{name:'Instance details',exact:true}).boundingBox();
  expect(details!.y).toBeGreaterThan(content!.y);
  await page.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Vanilla does not load mods.'})).toBeVisible();
  await expect(page.locator('.catalog-card')).toHaveCount(0);
  await page.getByRole('button',{name:'Close content browser'}).click();
  for(const method of ['Modpacks','Import']){
    await page.getByRole('tab',{name:method,exact:true}).click();
    expect(await page.locator(`#create-panel-${method}`).evaluate(node=>getComputedStyle(node).borderTopWidth)).toBe('0px');
  }
});


test('unchanged creation exits freely, including after reverting edits',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await expect(page.getByLabel('Minecraft version',{exact:true})).toHaveValue('26.3');
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Library 0',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.getByLabel('Instance name',{exact:true}).fill('Temporary');
  await page.getByLabel('Instance name',{exact:true}).fill('');
  await page.getByLabel('Minecraft version',{exact:true}).selectOption('1.21.4');
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Discard draft?');
  await page.getByRole('button',{name:'Stay',exact:true}).click();
  await page.getByLabel('Minecraft version',{exact:true}).selectOption('26.3');
  await page.getByRole('button',{name:'Accounts and settings',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Accounts & settings',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
