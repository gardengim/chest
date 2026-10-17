import {finishCreation} from './creation-helpers';
import {test,expect} from '@playwright/test';

test('creation tabs preserve custom setup and expose pack releases without browser installation',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.getByLabel('Instance name',{exact:true}).fill('My world');
  await page.getByRole('tab',{name:'Modpacks',exact:true}).click();
  await expect(page.locator('.custom-instance')).toBeHidden();
  await page.getByRole('button',{name:'Choose',exact:true}).click();
  await page.locator('.catalog-card').first().click();
  await expect(page.getByLabel('Pack release')).toHaveValue('preview-release');
  await expect(page.getByRole('button',{name:'Select'})).toBeEnabled();
  await page.getByRole('button',{name:'Close project'}).click();
  await page.getByRole('button',{name:'Close modpack browser'}).click();
  await page.getByRole('tab',{name:'Import',exact:true}).click();
  await expect(page.getByRole('button',{name:'Choose'})).toBeDisabled();
  await page.getByRole('tab',{name:'Import',exact:true}).press('Home');
  await expect(page.getByRole('tab',{name:'Custom'})).toHaveAttribute('aria-selected','true');

  await expect(page.getByLabel('Instance name',{exact:true})).toHaveValue('My world');
});

test('modpacks queue immediately, allow navigation, and report background progress, failure and retry',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;
    const callbacks=new Map<number,Function>();const listeners=new Map<string,number>();let n=0;
    const config={instances:[] as any[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};w.__config=config;
    w.__emit=(payload:any)=>callbacks.get(listeners.get('activity')!)?.({event:'activity',payload});
    w.__TAURI_INTERNALS__={transformCallback:(fn:Function)=>{callbacks.set(++n,fn);return n;},invoke:async(name:string,args:any)=>{
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      if(name==='plugin:event|listen'){listeners.set(args.event,args.handler);return n;}
      if(name==='get_config')return structuredClone(config);
      if(name==='get_activities')return [];
      if(name==='get_instance_icons')return {};
      if(name==='get_fabric_versions')return ['0.16.10'];
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[{id:'pack',title:'Example pack',description:'A pack',author:'Creator',icon:null,downloads:1000,url:'https://modrinth.com/modpack/pack'}],total:1};
      if(name==='get_modpack_releases')return [{id:'version-1',name:'Pack 1',published:'2026-01-01'}];
      if(name==='create_wizard'){
        args={...args.request,version:args.request.pack.release,project:args.request.pack.project,source:args.request.pack.source};
        w.__installPack=args;
        const instance={id:'new-pack',name:args.name,version:'pending',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:false};
        config.instances.push(instance);w.__emit({id:instance.id,status:'installing',progress:null,phase:'Waiting to prepare modpack'});return instance;
      }
      if(name==='install_instance'){w.__retry=args.id;w.__emit({id:args.id,status:'installing',progress:null,phase:'Waiting to prepare modpack'});return;}
      return null;
    }};
  });
  await page.goto('/');await page.getByRole('tab',{name:'Modpacks',exact:true}).click();
  await page.locator('.catalog-card').click();
  await expect(page.getByLabel('Pack release')).toHaveValue('version-1');
  await page.getByRole('button',{name:'Select'}).click();
  await expect(page.getByRole('heading',{name:'New instance',exact:true})).toBeVisible();
  await page.getByLabel('Instance name',{exact:true}).fill('My pack');
  await finishCreation(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.instance-hero')).toContainText('Preparing modpack');
  await expect(page.getByRole('button',{name:'My pack: Waiting to prepare modpack'})).toBeVisible();
  await page.getByRole('button',{name:'Chest home'}).click();
  await expect(page.getByRole('heading',{name:'Instances 1'})).toBeVisible();
  await page.evaluate(()=>(window as any).__emit({id:'new-pack',status:'installing',progress:.4,phase:'Preparing modpack files'}));
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','40');
  await page.evaluate(()=>(window as any).__emit({id:'new-pack',status:'failed',progress:null,phase:'Pack verification failed'}));
  await expect(page.locator('.mini-progress.failed')).toHaveCount(1);
  await page.getByRole('button',{name:'My pack: Pack verification failed'}).click();
  await expect(page.locator('.notification.error')).toContainText('Pack verification failed');
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('button',{name:'Duplicate',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Export',exact:true})).toBeDisabled();
  await expect(page.locator('.instance-settings-actions').getByRole('button',{name:'Save',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Delete',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'My pack: Pack verification failed'}).click({button:'right'});
  await expect(page.getByRole('menuitem',{name:'Duplicate',exact:true})).toBeDisabled();
  await expect(page.getByRole('menuitem',{name:'Export',exact:true})).toBeDisabled();
  await expect(page.getByRole('menuitem',{name:'Retry',exact:true})).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.locator('.install-button').click();
  expect(await page.evaluate(()=>(window as any).__retry)).toBe('new-pack');
  await page.evaluate(()=>{
    const w=window as any;Object.assign(w.__config.instances[0],{version:'1.21.4',loader:'fabric',loader_version:'0.16.10'});
    w.__emit({id:'new-pack',status:'installing',progress:null,phase:'Modpack prepared'});
  });
  await expect(page.locator('.instance-hero')).toContainText('Fabric 0.16.10');
  await page.getByRole('tab',{name:'Versions',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Release',exact:true})).toHaveValue('1.21.4');
  expect(await page.evaluate(()=>(window as any).__installPack)).toMatchObject({source:'modrinth',project:'pack',version:'version-1',name:'My pack'});
});
