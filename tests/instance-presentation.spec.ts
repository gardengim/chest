import {test,expect} from '@playwright/test';

test('activity colors follow tabs and groups; console selects text and settings exposes the folder path',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;w.__opened=[];
    const config={instances:['running','crashed','failed','normal','hidden-a','hidden-b','hidden-c','hidden-run','hidden-issue'].map(id=>({id,name:id,version:'1.21.4',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:true})),
      sidebar_groups:[{name:'Friends',ids:['running','crashed'],collapsed:true},{name:'Hidden',ids:['hidden-a','hidden-b','hidden-c','hidden-run','hidden-issue'],collapsed:true}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    const activities=[{id:'running',status:'running',progress:null,phase:'Minecraft is running'},
      {id:'crashed',status:'crashed',progress:null,phase:'Unexpected exit'},
      {id:'failed',status:'launch_failed',progress:null,phase:'Launch failed'},
      {id:'hidden-run',status:'running',progress:null,phase:'Minecraft is running'},
      {id:'hidden-issue',status:'failed',progress:null,phase:'Installation failed'}];
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      if(name==='get_config')return JSON.parse(JSON.stringify(config));
      if(name==='get_activities')return activities;
      if(name==='set_sidebar_groups'){config.sidebar_groups=args.groups;return JSON.parse(JSON.stringify(config));}
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_instance_icons')return {running:'/chest.svg'};
      if(name==='get_instance_backgrounds'||name==='get_content')return [];
      if(name==='get_logs')return ['Debug console output','Second log line'];
      if(name==='get_instance_folder')return '/Users/example/Chest/instances/'+args.id+'/game';
      if(name==='open_instance_folder'){w.__opened.push(args.id);return;}
      if(name==='search_catalog')return {projects:[],total:0};
      return null;
    }};
  });
  await page.goto('/');
  const group=page.getByRole('button',{name:'Friends group',exact:true});
  await expect(group).toHaveAttribute('data-activity','mixed');
  await expect(group.locator('[data-member-id="running"]')).toHaveAttribute('data-activity','running');
  await expect(group.locator('[data-member-id="crashed"]')).toHaveAttribute('data-activity','issue');
  await expect(page.getByRole('button',{name:'Hidden group',exact:true}).locator('.group-overflow')).toHaveAttribute('data-activity','mixed');
  const smallRunning=group.locator('[data-member-id="running"]');
  const smallIssue=group.locator('[data-member-id="crashed"]');
  expect(await smallRunning.evaluate(n=>getComputedStyle(n,'::before').content)).toBe('none');
  expect(await smallIssue.evaluate(n=>getComputedStyle(n,'::before').content)).toBe('none');
  expect(await smallRunning.locator('.artwork').evaluate(n=>getComputedStyle(n).filter)).toBe('none');
  expect(await group.evaluate(n=>getComputedStyle(n,'::after').animationName)).toBe('none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  expect(await group.evaluate(n=>getComputedStyle(n,'::after').animationName)).toBe('status-background-pulse');
  expect(await group.evaluate(n=>getComputedStyle(n).getPropertyValue('--status-base').trim())).toContain('#365f3d');
  expect(await group.evaluate(n=>getComputedStyle(n).getPropertyValue('--status-bright').trim())).toContain('#773f35');
  expect(await page.locator('[data-instance-id="failed"] button').evaluate(n=>getComputedStyle(n,'::after').animationName)).toBe('status-background-pulse');
  await page.emulateMedia({reducedMotion:'reduce'});

  await expect(page.locator('[data-instance-id="failed"] button')).toHaveAttribute('data-activity','issue');
  await expect(page.locator('[data-instance-id="normal"] button')).not.toHaveAttribute('data-activity');
  await group.hover();
  await page.mouse.down();
  await expect.poll(()=>group.evaluate(n=>getComputedStyle(n,'::after').boxShadow)).toContain('rgba(0, 0, 0, 0.333)');
  expect(await group.locator('.group-mosaic').evaluate(n=>getComputedStyle(n).translate)).toBe('1px 1px');
  await page.mouse.up();
  await expect(group).toHaveAttribute('aria-expanded','true');
  await group.hover();
  await page.mouse.down();
  expect(await group.evaluate(n=>getComputedStyle(n,'::after').display)).toBe('block');
  await page.mouse.up();
  await group.click();
  await expect(group).toHaveAttribute('aria-expanded','true');

  await expect(group).not.toHaveAttribute('data-activity');
  const running=page.locator('[data-instance-id="running"] button');
  const crashed=page.locator('[data-instance-id="crashed"] button');
  await expect(running).toHaveAttribute('data-activity','running');
  await expect(crashed).toHaveAttribute('data-activity','issue');
  await page.mouse.move(600,150);
  // Grouped members keep their own shallow bevel, including on hover.
  for(const button of [running,crashed]) {
    expect(await button.locator('.artwork').evaluate(n=>getComputedStyle(n).filter)).toBe('none');
    expect(await button.evaluate(n=>getComputedStyle(n,'::after').boxShadow)).toContain('rgba(255, 255, 255, 0.25)');
    const frame=await button.evaluate(n=>getComputedStyle(n,'::before').clipPath);
    await button.hover();
    expect(await button.evaluate(n=>getComputedStyle(n,'::before').clipPath)).toBe(frame);
    expect(await button.evaluate(n=>getComputedStyle(n,'::after').boxShadow)).toContain('rgba(255, 255, 255, 0.25)');
    await page.mouse.down();
    await expect.poll(()=>button.evaluate(n=>getComputedStyle(n,'::after').boxShadow)).toContain('rgba(0, 0, 0, 0.333)');
    expect(await button.locator('.artwork').evaluate(n=>getComputedStyle(n).translate)).toBe('1px 1px');
    await page.mouse.up();
  }
  await page.mouse.move(600,150);
  expect(await running.evaluate(n=>getComputedStyle(n,'::after').backgroundColor)).toBe('rgb(54, 95, 61)');
  expect(await crashed.evaluate(n=>getComputedStyle(n,'::after').backgroundColor)).toBe('rgb(119, 63, 53)');
  await running.click();
  await expect(running).toHaveAttribute('data-selected');
  await page.mouse.move(600,150);
  expect(await running.evaluate(n=>getComputedStyle(n,'::after').right)).toBe('-2px');
  expect(await running.evaluate(n=>getComputedStyle(n,'::before').right)).toBe('-2px');
  expect(await running.evaluate(n=>getComputedStyle(n,'::after').boxShadow)).toContain('rgba(255, 255, 255, 0.25)');
  expect(await running.evaluate(n=>getComputedStyle(n,'::after').backgroundImage)).toContain('rgb(28, 29, 31)');
  await running.hover();
  expect(await running.evaluate(n=>getComputedStyle(n,'::after').backgroundImage)).toContain('rgb(28, 29, 31)');
  const selectedBevel=await running.evaluate(n=>getComputedStyle(n,'::after').boxShadow);
  await page.mouse.down();
  expect(await running.evaluate(n=>getComputedStyle(n,'::after').boxShadow)).toBe(selectedBevel);
  expect(await running.locator('.artwork').evaluate(n=>getComputedStyle(n).translate)).toBe('none');
  await page.mouse.up();
  const overview=page.getByRole('tab',{name:'Overview',exact:true});
  await overview.hover();
  const inventoryBevel=await overview.evaluate(n=>getComputedStyle(n,'::after').boxShadow);
  await page.mouse.down();
  expect(await overview.evaluate(n=>getComputedStyle(n,'::after').boxShadow)).toBe(inventoryBevel);
  await page.mouse.up();
  await page.mouse.move(600,150);
  await expect(page.locator('.button-label')).toContainText('Running');
  await expect(page.locator('.button-label svg')).toHaveAttribute('viewBox','0 0 24 24');
  await expect(page.locator('.button-hover')).toContainText('Stop');
  await expect(page.getByText('MINECRAFT JAVA EDITION',{exact:true})).toHaveCount(0);
  await expect(page.locator('.instance-hero button')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Open folder',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'Log',exact:true}).click();
  const console=page.locator('.console');
  await expect(console).toContainText('Debug console output');
  expect(await console.evaluate(n=>getComputedStyle(n).userSelect)).toBe('text');
  await console.click({clickCount:3});
  expect(await page.evaluate(()=>window.getSelection()?.toString())).toMatch(/Debug console output|Second log line/);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.locator('.folder-path')).toHaveValue('/Users/example/Chest/instances/running/game');
  expect(await page.locator('.folder-path').evaluate(n=>getComputedStyle(n).userSelect)).toBe('text');
  await page.getByRole('button',{name:'Open folder',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__opened)).toEqual(['running']);
  // Collapsing summarizes activity on the whole tab without changing the page.
  await group.click();
  await expect(group).toHaveAttribute('data-activity','mixed');
  await expect(group.locator('[data-member-id="running"]')).toHaveAttribute('data-activity','running');
  await expect(group.locator('[data-member-id="crashed"]')).toHaveAttribute('data-activity','issue');
  await expect(page.locator('.instance-hero h1')).toHaveText('running');
});
