import {test,expect} from '@playwright/test';

test('native events keep selection, halo, and progress separate; keyboard exposes pause',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;w.__fileScans=0;
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{w.__copied=text;}}});
    const callbacks=new Map<number,Function>();const listeners=new Map<string,number>();let n=0;
    const config={instances:[{id:'running',name:'Running world',version:'1.21.4',artwork:'grass',memory_mb:4096,java_path:'',installed:true},{id:'installing',name:'Installing world',version:'1.21.4',artwork:'stone',memory_mb:4096,java_path:'',installed:false}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    const activities=[{id:'running',status:'running',progress:null,phase:'Minecraft is running'},{id:'installing',status:'installing',progress:.45,phase:'Downloading assets'}];
    w.__testEmit=(event:string,payload:any)=>callbacks.get(listeners.get(event)!)?.({event,payload});
    w.__TAURI_INTERNALS__={transformCallback:(fn:Function)=>{callbacks.set(++n,fn);return n;},invoke:async(name:string,args:any)=>{
      if(name==='get_instance_files'){w.__fileScans++;return {worlds:[],servers:[],screenshots:[]};}
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      if(name==='plugin:event|listen'){listeners.set(args.event,args.handler);return n;}
      if(name==='get_config')return structuredClone(config);if(name==='get_activities')return activities;if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='pause_install'){w.__testEmit('activity',{id:args.id,status:args.paused?'paused':'installing',progress:.45,phase:args.paused?'Paused':'Downloading assets'});return;}
      if(name==='remove_instance')throw new Error('Deletion failed. Some files may have been removed. Retry deletion.');
      if(name==='get_logs'||name==='get_content')return [];
      return null;
    }};
  });
  await page.goto('/');await expect(page.locator('.rail-item.running')).toHaveCount(1);
  await page.getByRole('button',{name:'Installing world: Downloading assets'}).click();
  await expect(page.locator('.rail-item.running [data-selected]')).toHaveCount(0);
  await expect(page.locator('.rail-item [data-selected]')).toHaveCount(1);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','45');
  const progress=await page.getByRole('progressbar').boundingBox();
  const tab=await page.getByRole('button',{name:'Installing world: Downloading assets'}).boundingBox();
  const art=await page.locator('.rail-item .instance-icon').last().locator('.artwork').boundingBox();
  expect(progress!.x).toBeGreaterThan(tab!.x);
  expect(progress!.x+progress!.width).toBeLessThan(tab!.x+tab!.width);
  expect(progress!.y).toBeGreaterThan(art!.y);
  expect(progress!.y+progress!.height).toBeLessThan(art!.y+art!.height);
  await expect.poll(()=>page.evaluate(()=>(window as any).__fileScans)).toBe(1);
  const scans=await page.evaluate(()=>(window as any).__fileScans);
  await page.evaluate(async()=>{
    for(let i=0;i<5;i++){
      (window as any).__testEmit('activity',{id:'installing',status:'installing',progress:.46+i/100,phase:'Downloading assets'});
      await new Promise(requestAnimationFrame);
    }
  });
  expect(await page.evaluate(()=>(window as any).__fileScans)).toBe(scans);
  const action=page.locator('.install-button');await action.focus();await expect(action).toContainText('Pause');await action.press('Enter');
  await expect(page.locator('.mini-progress')).toHaveClass(/paused/);await expect(action).toContainText('Resume');
  await expect.poll(()=>page.evaluate(()=>(window as any).__fileScans)).toBe(scans+1);
  await page.evaluate(()=>{(window as any).__testEmit('activity',{id:'running',status:'crashed',progress:null,phase:'Unexpected exit'});});
  await expect(page.locator('.rail-item.crashed')).toHaveCount(1);await expect(page.locator('.rail-item.running')).toHaveCount(0);
  await page.getByRole('button',{name:'Running world: Unexpected exit',exact:true}).click();
  await page.locator('.crash-notice').getByRole('button',{name:'Copy',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__copied)).toBe('Minecraft stopped unexpectedly.\nUnexpected exit');
  await expect(page.locator('.crash-notice').getByRole('button',{name:'Copied',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Log',exact:true}).click();
  await page.evaluate(()=>{for(let i=0;i<3000;i++)(window as any).__testEmit('log',{id:'running',line:`line-${i}`});});
  await expect(page.locator('.console')).toContainText('line-2999');
  expect(await page.locator('.console').evaluate(node=>node.textContent!.split('\n'))).toHaveLength(2000);
  await expect(page.locator('.console')).toContainText('Earlier logs omitted.');
  await expect(page.locator('.console')).toContainText('line-1001');
  await expect(page.locator('.console')).not.toContainText('line-1000');
  await page.getByLabel('Search log',{exact:true}).fill('line-2999');
  await page.evaluate(()=>(window as any).__testEmit('activity',{id:'running',status:'idle',progress:null,phase:'Finished'}));
  await expect(page.getByRole('button',{name:'Running world: Finished',exact:true})).toBeVisible();
  await expect(page.getByLabel('Search log',{exact:true})).toHaveValue('line-2999');
  await expect(page.locator('.console')).toHaveText('line-2999');
  await page.evaluate(()=>(window as any).__testEmit('activity',{id:'running',status:'working',progress:null,phase:'Copying…'}));
  await expect(page.locator('.install-button')).toContainText('Copying…');
  await expect(page.locator('.install-button')).toBeDisabled();
  await expect(page.getByRole('button',{name:'Stop',exact:true})).toHaveCount(0);
  const copying=page.getByRole('button',{name:'Running world: Copying…',exact:true});
  await copying.click({button:'right'});
  await expect(page.getByRole('menuitem',{name:'Duplicate',exact:true})).toBeDisabled();
  await expect(page.getByRole('menuitem',{name:'Delete',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByLabel('Search log',{exact:true}).fill('line-2998');
  await expect(page.locator('.console')).toHaveText('line-2998');
  await page.evaluate(()=>(window as any).__testEmit('activity',{id:'running',status:'idle',progress:null,phase:'Finished'}));
  await page.getByRole('button',{name:'Running world: Finished',exact:true}).click({button:'right'});
  await expect(page.getByRole('menuitem',{name:'Duplicate',exact:true})).toBeEnabled();
  await page.getByRole('menuitem',{name:'Delete',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();
  const failure=page.getByRole('alert').filter({hasText:'Deletion failed.'});
  await expect(failure).toContainText('Retry deletion.');
  await page.evaluate(()=>(window as any).__testEmit('activity',{id:'installing',status:'idle',progress:null,phase:'Finished'}));
  await expect(page.getByRole('button',{name:'Installing world: Finished',exact:true})).toBeVisible();
  await expect(failure).toContainText('Retry deletion.');
});
