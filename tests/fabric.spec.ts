import {finishCreation} from './creation-helpers';
import {test,expect} from '@playwright/test';

test('Fabric selection persists through cancelled navigation, restart, and duplication',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.getByLabel('Instance name').fill('Fabric world');
  await page.locator('.custom-instance').getByLabel('Minecraft version').selectOption('1.21.4');
  await page.getByRole('combobox',{name:'Mod loader',exact:true}).selectOption('fabric');
  await page.getByRole('combobox',{name:/^Fabric loader version/}).selectOption('0.16.9');
  await page.getByRole('button',{name:'Chest home'}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Mod loader',exact:true})).toHaveValue('fabric');
  await expect(page.getByRole('combobox',{name:/^Fabric loader version/})).toHaveValue('0.16.9');
  await finishCreation(page);
  await expect(page.locator('.instance-hero')).toContainText('Fabric 0.16.9');
  await page.reload();await page.getByRole('button',{name:/Fabric world: Not installed/}).click();
  await expect(page.locator('.instance-hero')).toContainText('Fabric 0.16.9');
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Duplicate',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Fabric world copy',exact:true})).toBeVisible();
  await expect(page.locator('.instance-hero')).toContainText('Fabric 0.16.9');
  await page.getByRole('tab',{name:'Versions',exact:true}).click();
  await page.getByRole('combobox',{name:'Mod loader',exact:true}).selectOption('vanilla');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('.instance-hero .instance-brief')).toHaveText('1.21.4 · Not played yet');
  const instances=await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-preview-v1')!).instances);
  expect(instances[1].loader_version).toBe('');
  expect(instances[0].loader).toBe('fabric');
});

test('legacy Vanilla settings load and a loader change requires installation',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({instances:[{id:'legacy',name:'Legacy',version:'1.21.4',artwork:'grass',memory_mb:4096,java_path:'',installed:true}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096})));await page.reload();
  await page.getByRole('button',{name:'Legacy: Ready to play'}).click();
  await page.getByRole('tab',{name:'Versions',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Mod loader',exact:true})).toHaveValue('vanilla');
  await page.getByRole('combobox',{name:'Mod loader',exact:true}).selectOption('fabric');
  await expect(page.getByRole('button',{name:'Save',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('.install-button')).toContainText('Install');
});

test('loader lookup retries failures and ignores responses for a previous game version',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;let attempts=0;
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      if(name==='get_config')return {instances:[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_activities')return [];
      if(name==='get_versions')return [{id:'1.21.4',type:'release'},{id:'1.20.1',type:'release'},{id:'1.19',type:'release'}];
      if(name==='get_fabric_versions'){
        attempts++;
        if(attempts===1)throw new Error('Fabric service unavailable');
        if(args.version==='1.21.4')return new Promise(resolve=>{w.__resolveOldFabric=resolve;});
        if(args.version==='1.19')return [];
        return ['0.16.9'];
      }
      return null;
    }};
  });
  await page.goto('/');await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.getByLabel('Instance name').fill('Retry world');
  await page.getByRole('combobox',{name:'Mod loader',exact:true}).selectOption('fabric');
  await expect(page.locator('.notification.error')).toContainText('Fabric service unavailable');
  const create=page.getByRole('button',{name:'Create',exact:true}).last();
  await expect(create).toBeDisabled();
  await page.getByRole('button',{name:'Retry'}).click();
  await expect.poll(()=>page.evaluate(()=>typeof (window as any).__resolveOldFabric)).toBe('function');
  await page.locator('.custom-instance').getByLabel('Minecraft version').selectOption('1.20.1');
  await expect(page.getByRole('combobox',{name:/^Fabric loader version/})).toHaveValue('0.16.9');
  await page.evaluate(()=>(window as any).__resolveOldFabric(['0.16.10']));
  await expect(page.getByRole('combobox',{name:/^Fabric loader version/})).toHaveValue('0.16.9');
  await expect(create).toBeEnabled();
  await page.locator('.custom-instance').getByLabel('Minecraft version').selectOption('1.19');
  await expect(page.getByText('No stable Fabric loader is available for this release.')).toBeVisible();
  await expect(create).toBeDisabled();
});
