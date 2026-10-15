import {finishCreation} from './creation-helpers';
import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page.getByRole('heading',{name:/^Instances/})).toBeVisible();});
async function create(page:any,name:string){await page.getByRole('button',{name:'Create instance',exact:true}).click();await page.getByLabel('Instance name').fill(name);await finishCreation(page);await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();}
test('empty sidebar puts + after Chest, creation draft survives cancelled navigation',async({page})=>{
  const buttons=page.locator('aside.rail button');await expect(buttons).toHaveCount(3);await expect(buttons.nth(0)).toHaveAttribute('aria-label','Chest home');await expect(buttons.nth(1)).toHaveAttribute('aria-label','Create instance');await expect(buttons.nth(2)).toHaveAttribute('aria-label','Settings');
  await page.getByRole('button',{name:'Create instance',exact:true}).click();await page.getByLabel('Instance name').fill('Draft world');
  await expect(page.getByText('Choose an icon')).toHaveCount(0);
  await page.getByRole('button',{name:'Chest home'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByLabel('Instance name')).toHaveValue('Draft world');
});
test('switching sidebar instances resets the active tab to Overview',async({page})=>{
  await create(page,'Survival');await page.getByRole('tab',{name:'Contents',exact:true}).click();
  await create(page,'Creative');await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:/Survival: Not installed/}).click();await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
  await page.reload();await page.getByRole('button',{name:/Survival: Not installed/}).click();await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.instance-rail > button').last()).toHaveAttribute('aria-label','Create instance');
});
test('preview refuses actual installation, settings persist, delete requires confirmation',async({page})=>{
  await create(page,'Test world');await page.getByRole('button',{name:'Install',exact:true}).click();await expect(page.getByRole('alert')).toContainText('desktop app');
  await page.getByRole('tab',{name:'Settings',exact:true}).click();await page.getByLabel('Memory (MB)').fill('8192');await page.locator('.instance-settings-actions').getByRole('button',{name:'Save',exact:true}).click();
  await page.reload();await page.getByRole('button',{name:/Test world: Not installed/}).click();await expect(page.getByText('8 GB',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:'Test world',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByText('No instances')).toBeVisible();
});
test('default memory and Java propagate to new instances',async({page})=>{
  await page.getByRole('button',{name:'Settings'}).click();await page.getByRole('tab',{name:'Settings',exact:true}).click();await page.getByLabel('Memory (MB)').fill('6144');await page.getByLabel('Java executable').fill('/custom/java');await page.getByRole('button',{name:'Save'}).click();
  await create(page,'Configured');await expect(page.getByText('6 GB',{exact:true})).toBeVisible();await expect(page.getByText('Custom executable',{exact:true})).toBeVisible();
});
test('instance creation, search, duplicate, and responsive layout',async({page})=>{
  await create(page,'Survival');await page.getByRole('tab',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Duplicate',exact:true}).click();await expect(page.getByRole('heading',{name:'Survival copy',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Chest home'}).click();await page.getByLabel('Search instances').fill('copy');await expect(page.locator('.instance-card')).toHaveCount(1);
  await page.setViewportSize({width:700,height:650});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('instance tabs share creation keyboard navigation and panel relationships',async({page})=>{
  await create(page,'Keyboard world');
  const overview=page.getByRole('tab',{name:'Overview',exact:true});
  await overview.focus();await overview.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'Contents',exact:true})).toBeFocused();
  await expect(page.getByRole('tabpanel',{name:'Contents',exact:true})).toHaveAttribute('aria-labelledby','instance-tab-Content');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab',{name:'Log',exact:true})).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('No output');
  await page.keyboard.press('ArrowRight');
  await expect(overview).toBeFocused();
  await expect(overview).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.tabs button[tabindex="0"]')).toHaveCount(1);
});

test('late content responses stay with their original instance after navigation',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;
    const config={instances:['First','Second'].map(name=>({id:name,name,version:'1.21.4',loader:'fabric',loader_version:'0.16.10',artwork:'grass',memory_mb:4096,java_path:'',installed:true})),accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      if(name==='get_config')return config;
      if(name==='get_activities'||name==='get_logs')return [];
      if(name==='get_instance_icons')return {};
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_content')return args.id==='First'?new Promise(resolve=>w.__resolveContent=resolve):[{name:'second.jar',kind:'mods',enabled:true}];
      return null;
    }};
  });
  await page.goto('/');
  await page.getByRole('button',{name:'First: Ready to play',exact:true}).click();
  await page.getByRole('tab',{name:'Contents',exact:true}).click();
  await page.getByRole('button',{name:'Second: Ready to play',exact:true}).click();
  await page.getByRole('tab',{name:'Contents',exact:true}).click();
  await expect(page.locator('.content-collection')).toContainText('second.jar');
  await page.evaluate(()=>(window as any).__resolveContent([{name:'first.jar',kind:'mods',enabled:true}]));
  await expect(page.locator('.content-collection')).toContainText('second.jar');
  await page.getByRole('button',{name:'First: Ready to play',exact:true}).click();
  await page.getByRole('tab',{name:'Contents',exact:true}).click();
  await expect(page.locator('.content-collection')).toContainText('first.jar');
});

test('accounts and defaults use connected inventory tabs with keyboard navigation',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Settings'}).click();
  const accounts=page.getByRole('tab',{name:'Accounts',exact:true});
  const settings=page.getByRole('tab',{name:'Settings',exact:true});
  await expect(accounts).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tabpanel',{name:'Accounts',exact:true})).toContainText('Microsoft accounts');
  await expect(page.getByLabel('Memory (MB)')).toHaveCount(0);
  await accounts.focus();await page.keyboard.press('ArrowRight');
  await expect(settings).toBeFocused();
  await expect(settings).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tabpanel',{name:'Settings',exact:true})).toContainText('Default instance settings');
  await page.getByLabel('Memory (MB)').fill('6144');
  await page.keyboard.press('Tab');
  await accounts.click();
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(settings).toHaveAttribute('aria-selected','true');
  await expect(page.getByLabel('Memory (MB)')).toHaveValue('6144');
});
