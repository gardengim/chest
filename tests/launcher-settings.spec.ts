import {test,expect} from '@playwright/test';

test('launcher preferences persist and reduced motion applies globally',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Accounts and settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByLabel('Double-click to play',{exact:true}).uncheck();
  await page.getByLabel('Check for updates on startup',{exact:true}).uncheck();
  await page.getByLabel('Reduce motion',{exact:true}).check();
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion','');
  await page.reload();
  await page.getByRole('button',{name:'Accounts and settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Double-click to play',{exact:true})).not.toBeChecked();
  await expect(page.getByLabel('Check for updates on startup',{exact:true})).not.toBeChecked();
  await expect(page.getByLabel('Reduce motion',{exact:true})).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion','');
  await expect(page.getByRole('button',{name:'Browse',exact:true})).toBeDisabled();
});

test('desktop settings browse and check Java, open storage, and confirm sign-out',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',autoUpdateChecks:false}));
    const config:any={instances:[],accounts:[{id:'account',name:'Player'}],active_account:'account',client_id:'123',java_path:'',memory_mb:4096};
    w.__calls=[];
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      w.__calls.push(name);
      if(name==='get_config')return config;
      if(name==='get_instance_icons')return {};
      if(name==='get_versions')return [{id:'26.3',type:'release'}];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='get_app_update_info')return {current_version:'0.1.0',development:false,version:null,notes:null};
      if(name==='get_launcher_info')return {version:'0.1.0',platform:'macos',architecture:'aarch64',data_path:'/Users/player/Chest'};
      if(name==='choose_instance_location')return '/Users/player/Instances';
      if(name==='create_wizard'){w.__creation=args.request;const instance={id:'world',name:'World',version:'26.3',loader:'vanilla',loader_version:'',java_path:config.java_path,memory_mb:config.memory_mb,installed:false};config.instances.push(instance);return instance;}
      if(name==='choose_java')return '/Library/Java/bin/java';
      if(name==='inspect_java'){if(args.path==='/bad/java')throw new Error('Invalid Java executable');return 'openjdk version "21.0.5"';}
      if(name==='save_settings'){Object.assign(config,{client_id:args.clientId,java_path:args.javaPath,memory_mb:args.memoryMb});return config;}
      if(name==='sign_out'){config.accounts=[];config.active_account=null;return;}
      return [];
    }};
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Accounts and settings',exact:true}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Sign out Player?');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__calls.includes('sign_out'))).toBe(false);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Browse',exact:true}).click();
  await expect(page.getByLabel('Java executable',{exact:true})).toHaveValue('/Library/Java/bin/java');
  const runtime=page.locator('form.panel');
  await runtime.getByRole('button',{name:'Check',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('21.0.5');
  await page.getByLabel('Java executable',{exact:true}).fill('/bad/java');
  await expect(page.locator('.java-report')).toHaveCount(0);
  await runtime.getByRole('button',{name:'Check',exact:true}).click();
  await expect(runtime.getByRole('alert')).toContainText('Invalid Java executable');
  await page.getByRole('button',{name:'Browse',exact:true}).click();
  await page.getByLabel('Memory (MB)',{exact:true}).fill('8192');
  await runtime.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByLabel('Chest data folder',{exact:true})).toHaveValue('/Users/player/Chest');
  await page.getByRole('button',{name:'Open folder',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__calls.includes('open_data_folder'))).toBe(true);
  expect(await page.evaluate(()=>(window as any).__calls.includes('check_app_update'))).toBe(false);
  await page.getByRole('button',{name:'Choose instance folder',exact:true}).click();
  await expect(page.getByLabel('Default instance folder',{exact:true})).toHaveValue('/Users/player/Instances');
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await expect(page.getByLabel('Instance location',{exact:true})).toHaveAttribute('placeholder','/Users/player/Instances');
  await page.getByRole('button',{name:'Create',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__creation?.parent)).toBe('/Users/player/Instances');
  await page.getByRole('button',{name:'Accounts and settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByLabel('Double-click to play',{exact:true}).uncheck();
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await page.locator('.instance-card').dblclick();
  expect(await page.evaluate(()=>(window as any).__calls.includes('install_instance'))).toBe(false);
  await page.getByRole('button',{name:'Accounts and settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByLabel('Double-click to play',{exact:true}).check();
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await page.locator('.instance-card').dblclick();
  await expect.poll(()=>page.evaluate(()=>(window as any).__calls.includes('install_instance'))).toBe(true);
  await page.getByRole('button',{name:'Accounts and settings',exact:true}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.locator('.account-row')).toHaveCount(0);
});
