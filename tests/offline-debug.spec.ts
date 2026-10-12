import {test,expect} from '@playwright/test';

test('development offline mode enables launch without sign-in and leaves real accounts untouched',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;
    let enabled=false;
    const account={id:'2b4f29ac7a2f366dacf8457b8011111e',name:'ChestDebug'};
    const config={instances:[{id:'world',name:'Debug world',version:'1.21.4',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:true}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    w.__launches=[];w.__config=config;
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_debug_launch')return {available:true,enabled,account:enabled?account:null};
      if(name==='set_debug_offline'){enabled=args.enabled;return {available:true,enabled,account:enabled?account:null};}
      if(name==='get_config')return config;
      if(name==='get_activities'||name==='get_logs'||name==='get_content')return [];
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='launch_instance'){if(!enabled)throw new Error('Sign in before playing');w.__launches.push(args.id);return;}
      return null;
    }};
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Accounts and settings'}).click();
  await page.getByRole('button',{name:'Enable',exact:true}).click();
  await expect(page.getByText('Enabled for this session.')).toBeVisible();
  await page.getByRole('button',{name:'Debug world: Ready to play',exact:true}).click();
  await expect(page.getByText('ChestDebug (offline debug)',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Sign in'})).toHaveCount(0);
  await page.locator('.install-button').click();
  expect(await page.evaluate(()=>(window as any).__launches)).toEqual(['world']);
  expect(await page.evaluate(()=>(window as any).__config.accounts)).toEqual([]);
  await page.getByRole('button',{name:'Accounts and settings'}).click();
  await page.getByRole('button',{name:'Disable',exact:true}).click();
  await page.getByRole('button',{name:'Debug world: Ready to play',exact:true}).click();
  await expect(page.getByText('Not signed in',{exact:true})).toBeVisible();
  await page.locator('.install-button').click();
  await expect(page.getByRole('alert')).toContainText('Sign in before playing');
});

test('browser preview does not offer offline debug mode',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Accounts and settings'}).click();
  await expect(page.getByRole('button',{name:'Enable',exact:true})).toHaveCount(0);
});
