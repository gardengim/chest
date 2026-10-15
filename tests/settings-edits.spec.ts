import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {expectMessageButtons} from './message-helpers';
async function settings(page:Page){
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
}
const saved=(page:Page)=>page.evaluate(()=>Object.fromEntries(['chest-ui-preferences-v1','chest-appearance-mode-v1','chest-color-scheme-v1'].map(key=>[key,localStorage.getItem(key)])));

test('settings sections share a save flow and unsaved previews can be discarded when leaving',async({page},info)=>{
  await page.goto('/');await settings(page);
  await expect(page.locator('.settings-form h2')).toHaveText(['General','Default instance settings','Storage','Updates']);
  const original=await saved(page);
  await expect(page.locator('.settings-actions').getByRole('button',{name:'Discard',exact:true})).toHaveAttribute('data-tone','danger');
  await page.getByLabel('Memory (MB)',{exact:true}).fill('8192');
  await page.getByLabel('Java executable',{exact:true}).fill('/tmp/test-java');
  await page.getByLabel('Default instance folder',{exact:true}).fill('/tmp/test-instances');
  await page.getByLabel('Reduce motion',{exact:true}).check();
  await page.getByRole('radio',{name:'Light',exact:true}).check();
  await expect(page.locator('html')).toHaveCSS('color-scheme','light');
  expect(await saved(page)).toEqual(original);
  await page.getByRole('tab',{name:'About',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Save settings changes?'});
  await expect(dialog).toBeVisible();await expect(dialog.getByRole('button')).toHaveText(['Cancel','Discard','Save']);
  await expect(dialog.getByRole('button',{name:/close/i})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Discard',exact:true})).toHaveAttribute('data-tone','danger');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await dialog.screenshot({path:info.outputPath('unsaved-settings.png')});
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Memory (MB)',{exact:true})).toHaveValue('8192');
  await page.getByRole('button',{name:'Chest home',exact:true}).click();await dialog.getByRole('button',{name:'Discard',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
  await expect(page.locator('html')).toHaveCSS('color-scheme','dark');
  expect(await saved(page)).toEqual(original);
  await settings(page);await expect(page.getByLabel('Memory (MB)',{exact:true})).toHaveValue('4096');
  await expect(page.getByLabel('Java executable',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Default instance folder',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Reduce motion',{exact:true})).not.toBeChecked();
  await page.screenshot({path:info.outputPath('settings.png'),fullPage:true});
  await page.locator('.settings-actions').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('settings-bottom.png')});
});

test('Save persists all settings, restore stages defaults, and Discard restores the saved values',async({page})=>{
  await page.goto('/');await settings(page);
  const [check,checkbox]=await Promise.all([page.locator('.app-updater').getByRole('button',{name:'Check',exact:true}).boundingBox(),page.getByLabel('Check for updates on startup',{exact:true}).locator('..').boundingBox()]);
  expect(checkbox!.x).toBeGreaterThan(check!.x+check!.width);
  expect(Math.abs(checkbox!.y+checkbox!.height/2-check!.y-check!.height/2)).toBeLessThan(1);
  await page.getByLabel('Memory (MB)',{exact:true}).fill('8192');
  await page.getByRole('radio',{name:'Light',exact:true}).check();
  await page.getByLabel('Double-click to launch',{exact:true}).uncheck();
  await page.locator('.settings-actions').getByRole('button',{name:'Save',exact:true}).click();
  const notice=page.locator('.notification[role="status"]');
  await expectMessageButtons(page,notice);
  await notice.getByRole('button',{name:'Dismiss notification',exact:true}).click();
  await expect(notice).toHaveCount(0);
  await expect(page.locator('.settings-actions').getByRole('button',{name:'Save',exact:true})).toBeDisabled();
  await page.getByRole('tab',{name:'About',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Restore defaults',exact:true}).click();
  await expect(page.getByLabel('Memory (MB)',{exact:true})).toHaveValue('4096');
  await expect(page.getByRole('radio',{name:'Dark',exact:true})).toBeChecked();
  await page.locator('.settings-actions').getByRole('button',{name:'Discard',exact:true}).click();
  await expect(page.getByLabel('Memory (MB)',{exact:true})).toHaveValue('8192');
  await expect(page.getByRole('radio',{name:'Light',exact:true})).toBeChecked();
  await expect(page.getByLabel('Double-click to launch',{exact:true})).not.toBeChecked();
  await page.reload();await settings(page);
  await expect(page.getByLabel('Memory (MB)',{exact:true})).toHaveValue('8192');
  await expect(page.getByRole('radio',{name:'Light',exact:true})).toBeChecked();
  await page.setViewportSize({width:320,height:640});await page.addStyleTag({content:'html{font-size:28px!important}'});
  expect(await page.locator('#main-content').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
});

test('native menu navigation waits for Save and failed saves retain changes in the dialog',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;w.__failSave=true;
    const callbacks=new Map<number,Function>(),listeners=new Map<string,number>();let sequence=0;
    let config={instances:[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    w.__menu=(action:string)=>callbacks.get(listeners.get('desktop-menu')!)?.({payload:action});
    w.__TAURI_INTERNALS__={transformCallback:(fn:Function)=>{callbacks.set(++sequence,fn);return sequence;},invoke:async(name:string,args:any)=>{
      if(name==='plugin:event|listen'){listeners.set(args.event,args.handler);return ++sequence;}
      if(name==='get_config')return config;
      if(name==='get_debug_launch')return {available:true,enabled:false};
      if(name==='get_instance_icons')return {};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='take_instance_intent')return null;
      if(name==='get_launcher_info')return {version:'0.1.0',platform:'test',architecture:'test',data_path:'/tmp/chest'};
      if(name==='get_app_update_info')return {current_version:'0.1.0',development:true,version:null,notes:null};
      if(name==='save_settings'){if(w.__failSave)throw new Error('Could not save settings');config={...config,memory_mb:args.memoryMb,java_path:args.javaPath};return config;}
      return [];
    }};
  });
  await page.goto('/');await settings(page);
  await page.getByLabel('Memory (MB)',{exact:true}).fill('8192');
  await page.evaluate(()=>(window as any).__menu('about'));
  const dialog=page.getByRole('dialog',{name:'Save settings changes?'});
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Could not save settings');
  await expect(dialog).toBeVisible();
  await page.evaluate(()=>(window as any).__failSave=false);
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(page.getByRole('tab',{name:'About',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Memory (MB)',{exact:true})).toHaveValue('8192');
});
