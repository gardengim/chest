import {test,expect} from '@playwright/test';

test('groups can be created, joined, collapsed, persisted, and left',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({
    instances:['A','B','C'].map(name=>({id:name,name,version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true})),
    accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,
  })));
  await page.reload();
  async function group(instance:string,name:string){
    await page.getByRole('button',{name:`${instance}: Ready to play`,exact:true}).click({button:'right'});
    await page.getByRole('menuitem',{name:'Group…'}).click();
    await page.getByLabel('Group name',{exact:true}).fill(name);
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await group('A','Friends');await group('B','Friends');
  const header=page.getByRole('button',{name:'Friends group',exact:true});
  await expect(header).toHaveAttribute('data-count','2');
  await header.click();await expect(header).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('.rail-item')).toHaveCount(1);
  await page.reload();await expect(header).toHaveAttribute('aria-expanded','false');
  await header.click();await expect(page.locator('.rail-item')).toHaveCount(3);
  // Drag an ungrouped instance onto a group header.
  const c=await page.getByRole('button',{name:'C: Ready to play',exact:true}).boundingBox();
  const h=await header.boundingBox();
  await page.mouse.move(c!.x+25,c!.y+25);await page.mouse.down();
  await page.mouse.move(h!.x+25,h!.y+12,{steps:8});
  await expect(page.locator('.rail-drag-preview')).toBeVisible();
  await page.mouse.up();await expect(header).toHaveAttribute('data-count','3');
  await page.reload();await expect(header).toHaveAttribute('data-count','3');
  await group('A','');await expect(header).toHaveAttribute('data-count','2');
  await group('B','');await group('C','');await expect(header).toHaveCount(0);
  await expect(page.locator('.rail-item')).toHaveCount(3);
});

test('collapsed groups show icon mosaics and retain their selected instance',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.evaluate(()=>{
    const instances=Array.from({length:21},(_,i)=>({id:`m${i}`,name:`Member ${i}`,version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true}));
    let offset=0;
    const sidebar_groups=Array.from({length:6},(_,i)=>{const ids=instances.slice(offset,offset+i+1).map(i=>i.id);offset+=i+1;return {name:`Group ${i+1}`,ids,collapsed:true};});
    localStorage.setItem('chest-preview-v1',JSON.stringify({instances,sidebar_groups,accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096}));
  });
  await page.reload();
  for(let count=1;count<=6;count++){
    const group=page.getByRole('button',{name:`Group ${count} group`,exact:true});
    await expect(group.locator('.group-mosaic .artwork')).toHaveCount(count>4?3:count);
    if(count>4)await expect(group.locator('.group-overflow')).toHaveText(`+${count-3}`);
    else await expect(group.locator('.group-overflow')).toHaveCount(0);
    expect((await group.boundingBox())!.height).toBe(56);
  }
  const group=page.getByRole('button',{name:'Group 2 group',exact:true});
  await group.click();
  expect((await group.boundingBox())!.height).toBe(28);
  const shell=group.locator('..');
  expect((await shell.boundingBox())!.height).toBe(142);
  const rows=shell.locator('.rail-item');
  const first=await rows.nth(0).boundingBox(),second=await rows.nth(1).boundingBox();
  expect(second!.y).toBe(first!.y+first!.height);
  expect(await rows.nth(1).locator('button').evaluate(n=>getComputedStyle(n,'::before').display)).toBe('block');
  await page.mouse.move(first!.x+25,first!.y+25);await page.mouse.down();
  await page.mouse.move(second!.x+25,second!.y+25,{steps:8});await page.mouse.up();
  await expect(rows.nth(1)).toHaveAttribute('data-instance-id','m1');
  await expect(group.locator('.group-mosaic')).toHaveCount(0);
  await page.getByRole('button',{name:'Member 1: Ready to play',exact:true}).click();
  await group.click();
  await expect(group).toHaveAttribute('data-selected','true');
  await expect(group).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('heading',{name:'Member 1',exact:true})).toBeVisible();
  await group.click();
  await expect(group).not.toHaveAttribute('data-selected');
  await expect(page.getByRole('button',{name:'Member 1: Ready to play',exact:true})).toHaveAttribute('data-selected','true');
});

test('whole collapsed and expanded groups accept drops, with feedback and outside cancellation',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({
    instances:['A','B','C'].map(name=>({id:name,name,version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true})),
    sidebar_groups:[{name:'Friends',ids:['A'],collapsed:true}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,
  })));
  await page.reload();
  const area=page.locator('[data-drop-group="Friends"]');
  const group=page.getByRole('button',{name:'Friends group',exact:true});
  async function begin(name:string){
    const box=await page.getByRole('button',{name:`${name}: Ready to play`,exact:true}).boundingBox();
    await page.mouse.move(box!.x+25,box!.y+25);await page.mouse.down();
  }
  let box=await area.boundingBox();
  await begin('B');await page.mouse.move(box!.x+15,box!.y+25,{steps:8});
  await expect(area).toHaveClass(/group-drop-target/);
  await page.mouse.up();await expect(group).toHaveAttribute('data-count','2');
  await expect(group).toHaveAttribute('aria-expanded','false');
  await begin('C');await page.mouse.move(box!.x+15,box!.y+25,{steps:8});
  await expect(area).toHaveClass(/group-drop-target/);
  await page.mouse.move(300,box!.y+25);await expect(area).not.toHaveClass(/group-drop-target/);
  await page.mouse.up();await expect(group).toHaveAttribute('data-count','2');
  await group.click();box=await area.boundingBox();
  await begin('C');await page.mouse.move(box!.x+15,box!.y+box!.height-1,{steps:8});
  await expect(area).toHaveClass(/group-drop-target/);
  await page.mouse.up();await expect(group).toHaveAttribute('data-count','3');
  await page.reload();await expect(group).toHaveAttribute('data-count','3');
});

test('holding a dragged icon over another creates a persistent group on release',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({
    instances:['A','B','C','D','E','F'].map(name=>({id:name,name,version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true})),
    sidebar_groups:[{name:'Group',ids:['D','E'],collapsed:true}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,
  })));
  await page.reload();
  await page.locator('.instance-card').filter({has:page.getByRole('heading',{name:'A',exact:true})}).click();
  async function hold(source:string,target:string){
    const start=await page.getByRole('button',{name:`${source}: Ready to play`,exact:true}).boundingBox();
    const end=await page.getByRole('button',{name:`${target}: Ready to play`,exact:true}).boundingBox();
    await page.mouse.move(start!.x+28,start!.y+28);await page.mouse.down();
    await page.mouse.move(end!.x+28,end!.y+28,{steps:8});
    await expect(page.locator(`[data-instance-id="${target}"]`)).toHaveClass(/group-ready/);
    await expect(page.locator('.group-drop-hint')).toHaveText('Release to create group');
  }
  await hold('A','B');
  await expect(page.getByRole('button',{name:'Group 2 group',exact:true})).toHaveCount(0);
  await page.mouse.up();
  const group=page.getByRole('button',{name:'Group 2 group',exact:true});
  await expect(group).toHaveAttribute('data-count','2');
  await expect(group).toHaveAttribute('data-selected','true');
  await page.reload();await expect(group).toHaveAttribute('data-count','2');
  await hold('C','F');await page.keyboard.press('Escape');await page.mouse.up();
  await expect(page.getByRole('button',{name:'Group 3 group',exact:true})).toHaveCount(0);
  await expect(page.locator('.group-drop-hint')).toHaveCount(0);
  await group.click();
  await hold('A','F');await page.mouse.up();
  await expect(group).toHaveAttribute('data-count','1');
  await expect(page.getByRole('button',{name:'Group 3 group',exact:true})).toHaveAttribute('data-count','2');
});

test('groups reorder as blocks and members can leave an entirely grouped sidebar',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({
    instances:['A','B','C','D'].map(name=>({id:name,name,version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true})),
    sidebar_groups:[{name:'First',ids:['A','B'],collapsed:true},{name:'Second',ids:['C','D'],collapsed:true}],
    accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,
  })));
  await page.reload();
  const first=page.getByRole('button',{name:'First group',exact:true});
  const second=page.getByRole('button',{name:'Second group',exact:true});
  let source=await first.boundingBox(),target=await second.boundingBox();
  await page.mouse.move(source!.x+25,source!.y+25);await page.mouse.down();
  await page.mouse.move(target!.x+25,target!.y+15,{steps:8});
  await expect(page.locator('.rail-drag-preview')).not.toHaveClass(/over-target/);
  await page.mouse.move(target!.x+25,target!.y+40,{steps:4});
  await page.mouse.up();
  await expect(page.locator('[data-group-name]').first()).toHaveAttribute('data-group-name','Second');
  await page.reload();
  await expect(page.locator('[data-group-name]').first()).toHaveAttribute('data-group-name','Second');
  await first.click();
  source=await page.locator('[data-instance-id="A"]').boundingBox();
  target=await page.getByRole('button',{name:'Create instance',exact:true}).boundingBox();
  await page.mouse.move(source!.x+25,source!.y+25);await page.mouse.down();
  await page.mouse.move(target!.x+25,target!.y+25,{steps:8});await page.mouse.up();
  await expect(first).toHaveAttribute('data-count','1');
  await expect(page.locator('.sidebar-entry').last().locator('[data-instance-id="A"]')).toBeVisible();
  await page.reload();
  await expect(first).toHaveAttribute('data-count','1');
  await expect(page.locator('.sidebar-entry').last().locator('[data-instance-id="A"]')).toBeVisible();
  // Instance previews shrink while hovering another group, before release.
  source=await page.locator('[data-instance-id="A"]').boundingBox();
  target=await second.boundingBox();
  await page.mouse.move(source!.x+25,source!.y+25);await page.mouse.down();
  await page.mouse.move(target!.x+25,target!.y+25,{steps:8});
  await expect(page.locator('.rail-drag-preview')).toHaveClass(/over-target/);
  await page.keyboard.press('Escape');await page.mouse.up();
  await expect(first).toHaveAttribute('data-count','1');
  await expect(second).toHaveAttribute('data-count','2');
});

test('topmost group allows upward extraction, mosaics stay small, and grouping is immediate',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({
    instances:['A','B','C','D','E'].map(name=>({id:name,name,version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true})),
    sidebar_groups:[{name:'First',ids:['A','B'],collapsed:false},{name:'Second',ids:['C','D'],collapsed:true}],
    accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,
  })));
  await page.reload();
  const second=page.getByRole('button',{name:'Second group',exact:true});
  let source=await second.boundingBox();
  await page.mouse.move(source!.x+25,source!.y+25);await page.mouse.down();
  await page.mouse.move(source!.x+25,source!.y+33);
  const sizes=await page.locator('.rail-drag-preview .artwork').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).width));
  expect(sizes).toEqual(['18px','18px']);
  await page.keyboard.press('Escape');await page.mouse.up();

  source=await page.locator('[data-instance-id="B"]').boundingBox();
  const rail=await page.locator('.instance-rail').boundingBox();
  await page.mouse.move(source!.x+25,source!.y+25);await page.mouse.down();
  await page.mouse.move(source!.x+25,rail!.y-8,{steps:8});await page.mouse.up();
  await expect(page.locator('.sidebar-entry').first().locator('[data-instance-id="B"]')).toBeVisible();
  await expect(page.getByRole('button',{name:'First group',exact:true})).toHaveAttribute('data-count','1');
  await page.reload();
  await expect(page.locator('.sidebar-entry').first().locator('[data-instance-id="B"]')).toBeVisible();

  source=await page.locator('[data-instance-id="B"]').boundingBox();
  const target=await page.locator('[data-instance-id="E"]').boundingBox();
  await page.mouse.move(source!.x+25,source!.y+25);await page.mouse.down();
  await page.mouse.move(target!.x+25,target!.y+28);
  // Release without waiting for a dwell timer.
  await page.mouse.up();
  await expect(page.getByRole('button',{name:'Group group',exact:true})).toHaveAttribute('data-count','2');
});
