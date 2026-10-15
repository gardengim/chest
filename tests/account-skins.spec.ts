import {test,expect} from '@playwright/test';
const first='11111111111111111111111111111111',second='22222222222222222222222222222222';
async function fixture(page:import('@playwright/test').Page){
  await page.addInitScript(({first,second})=>{
    const w=window as any;w.isTauri=true;w.__calls=[];
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const context=canvas.getContext('2d')!;
    context.fillStyle='#855932';context.fillRect(8,8,8,8);context.fillStyle='#40b6d2';context.fillRect(40,8,4,4);w.__skin=canvas.toDataURL();
    const instance={id:'world',name:'World',version:'1.21.4',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:true};
    const config={instances:[instance],accounts:[{id:first,name:'First player'},{id:second,name:'Second player'}],active_account:first,client_id:'123',java_path:'',memory_mb:4096};
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      w.__calls.push({name,args});
      if(name==='get_config')return structuredClone(config);
      if(name==='get_account_skin')return args.id===first?w.__skin:null;
      if(name==='select_account'){config.active_account=args.id;return structuredClone(config);}
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_instance_icons')return {};
      if(name==='get_instance_files')return {worlds:[],screenshots:[],servers:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:first,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='get_instance_news')return {articles:[],unavailable:[]};
      if(name==='get_launcher_info')return {version:'test',data_directory:'/tmp/chest',java:'java'};
      return [];
    }};
  },{first,second});
}

test('active account face includes hat layer, uses crisp scaling, shares requests and falls back on missing skins',async({page})=>{
  await fixture(page);await page.goto('/');
  const profile=page.getByRole('button',{name:'Settings',exact:true});
  await expect(profile.locator('.skin-face')).toHaveAttribute('data-account',first);
  await expect(profile.locator('img.base')).toHaveAttribute('src',/^data:image\/png/);
  await expect(profile.locator('img.hat')).toHaveCount(1);
  await expect(profile.locator('img.base')).toHaveCSS('image-rendering','pixelated');
  expect(await profile.locator('img.base').evaluate(node=>getComputedStyle(node).left)).toBe('-32px');
  expect(await profile.locator('img.hat').evaluate(node=>getComputedStyle(node).left)).toBe('-160px');
  await profile.click();const rows=page.locator('.account-row');
  await expect(rows.first().locator('img.base')).toBeVisible();
  await expect(rows.last().locator('svg[data-symbol="user"]')).toBeVisible();
  expect(await page.evaluate((id)=>(window as any).__calls.filter((call:any)=>call.name==='get_account_skin' && call.args.id===id).length,first)).toBe(1);
  await rows.last().getByRole('button',{name:'Use',exact:true}).click();await expect(profile.locator('.skin-face')).toHaveAttribute('data-account',second);
  await expect(profile.locator('img.base')).toHaveCount(0);await expect(profile.locator('svg[data-symbol="user"]')).toBeVisible();
});

test('instance account names and account picker options include their skin faces',async({page})=>{
  await fixture(page);await page.goto('/');await page.getByRole('button',{name:'World: Ready to play',exact:true}).click();
  await expect(page.locator('.account-name').filter({hasText:'First player'}).locator('img.base')).toBeVisible();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByLabel('Account',{exact:true}).click();
  await expect(page.getByRole('option',{name:'First player',exact:true}).locator('img.base')).toBeVisible();
});
