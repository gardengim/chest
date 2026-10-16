import {test,expect,type Page} from '@playwright/test';

async function fixture(page:Page,development=true){
  await page.addInitScript((development)=>{
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({developSettings:true}));
    const w=window as any;w.isTauri=true;
    let enabled=false;
    const account={id:'2b4f29ac7a2f366dacf8457b8011111e',name:'ChestDebug'};
    const config={instances:[{id:'world',name:'Debug world',version:'1.21.4',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:true}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    w.__launches=[];w.__config=config;
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      if(name==='get_debug_launch')return {available:development,enabled,account:enabled?account:null};
      if(name==='set_debug_offline'){if(!development)throw new Error('Offline debugging is only available in development builds');enabled=args.enabled;return {available:development,enabled,account:enabled?account:null};}
      if(name==='get_config')return config;
      if(name==='get_activities'||name==='get_logs'||name==='get_content')return [];
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='launch_instance'){if(!enabled)throw new Error('Sign in before playing');w.__launches.push(args.id);return;}
      return null;
    }};
  },development);
  await page.goto('/');
}

test('development offline mode enables launch without sign-in and leaves real accounts untouched',async({page})=>{
  await fixture(page);
  await page.getByRole('button',{name:'Settings'}).click();
  await expect(page.getByRole('button',{name:'Enable',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'Develop',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Debugging',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Enable',exact:true}).click();
  await expect(page.getByText('Enabled for this session.')).toBeVisible();
  await page.getByRole('button',{name:'Debug world: Ready to play',exact:true}).click();
  await expect(page.locator('.details')).not.toContainText('Account');
  await expect(page.getByRole('button',{name:'Sign in'})).toHaveCount(0);
  await page.locator('.install-button').click();
  expect(await page.evaluate(()=>(window as any).__launches)).toEqual(['world']);
  expect(await page.evaluate(()=>(window as any).__config.accounts)).toEqual([]);
  await page.getByRole('button',{name:'Settings'}).click();
  await page.getByRole('button',{name:'Disable',exact:true}).click();
  await page.getByRole('button',{name:'Debug world: Ready to play',exact:true}).click();
  await expect(page.locator('.details')).not.toContainText('Account');
  await page.locator('.install-button').click();
  await expect(page.getByRole('alert')).toContainText('Sign in before playing');
});

test('browser preview does not offer offline debug mode',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Settings'}).click();
  await expect(page.getByRole('button',{name:'Enable',exact:true})).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'Develop',exact:true})).toHaveCount(0);
});


test('native release Develop tab never exposes offline debugging',async({page})=>{
  await fixture(page,false);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Develop',exact:true}).click();
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(page.getByRole('button',{name:'Enable',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Offline debugging',exact:true})).toHaveCount(0);
});
