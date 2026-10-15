import {test,expect} from '@playwright/test';

test('radio segments share button feedback and keep the checked option recessed',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  const control=page.getByRole('radiogroup',{name:'Project layout',exact:true});await control.scrollIntoViewIfNeeded();
  const gallery=control.getByRole('radio',{name:'Gallery',exact:true}),list=control.getByRole('radio',{name:'List',exact:true});
  const galleryLabel=gallery.locator('..'),listLabel=list.locator('..');
  expect(await control.locator(':scope > label').count()).toBe(2);
  await expect(control).toHaveCSS('border-width','0px');
  const appearance=(label:import('@playwright/test').Locator)=>label.evaluate(node=>{
    const css=getComputedStyle(node);return {fill:css.backgroundColor,shadow:css.boxShadow,transform:css.transform,border:css.borderColor};
  });
  const selected=await appearance(galleryLabel),raised=await appearance(listLabel);
  expect(selected.shadow).not.toBe(raised.shadow);
  await gallery.hover();expect(await appearance(galleryLabel)).toEqual(selected);
  await page.mouse.down();expect(await appearance(galleryLabel)).toEqual(selected);await page.mouse.up();
  await expect(gallery).toBeChecked();
  await list.hover();const hovered=await appearance(listLabel);
  expect(hovered.fill).not.toBe(raised.fill);expect(hovered.border).not.toBe(raised.border);
  expect(await listLabel.evaluate(node=>new DOMMatrix(getComputedStyle(node).transform).m42)).toBe(-1);
  const pressed=await page.evaluate(()=>{const probe=document.createElement('span');probe.style.boxShadow='var(--bevel-pressed)';document.body.append(probe);const shadow=getComputedStyle(probe).boxShadow;probe.remove();return shadow;});
  await page.mouse.down();await expect(listLabel).toHaveCSS('box-shadow',pressed);await page.mouse.up();
  await expect(list).toBeChecked();await expect(gallery).not.toBeChecked();
  expect((await appearance(listLabel)).shadow).toBe(selected.shadow);
  await gallery.evaluate(node=>(node as HTMLInputElement).disabled=true);await gallery.hover();
  await expect(galleryLabel).toHaveCSS('opacity','0.5');
  await gallery.click({force:true});await expect(list).toBeChecked();
  await gallery.evaluate(node=>(node as HTMLInputElement).disabled=false);
  await page.keyboard.press('Tab');await gallery.focus();await expect(galleryLabel).toHaveCSS('outline-style','solid');
});

test('layout radio groups use pixel icons and native keyboard selection independently',async({page},info)=>{
  await page.addInitScript(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({instances:[{id:'world',name:'World',version:'1.21.4',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:false}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096})));
  await page.goto('/');
  const library=page.getByRole('radiogroup',{name:'Library layout',exact:true});
  const project=page.getByRole('radiogroup',{name:'Project layout',exact:true});
  for(const control of [library,project]){
    await control.scrollIntoViewIfNeeded();
    const gallery=control.getByRole('radio',{name:'Gallery',exact:true}),list=control.getByRole('radio',{name:'List',exact:true});
    await expect(gallery.locator('..').locator('svg')).toHaveAttribute('data-symbol','layout-gallery');
    await expect(list.locator('..').locator('svg')).toHaveAttribute('data-symbol','layout-list');
    await expect(gallery.locator('..').locator('path')).toHaveAttribute('shape-rendering','crispEdges');
    const [left,right]=await Promise.all([gallery.locator('..').boundingBox(),list.locator('..').boundingBox()]);
    expect(Math.abs(left!.x+left!.width-right!.x)).toBeLessThan(1);
    await gallery.focus();await page.keyboard.press('ArrowRight');
    await expect(list).toBeFocused();await expect(list).toBeChecked();await expect(gallery).not.toBeChecked();
    await page.keyboard.press('ArrowLeft');await expect(gallery).toBeFocused();await expect(gallery).toBeChecked();
    await list.evaluate(node=>(node as HTMLInputElement).disabled=true);
    await page.keyboard.press('ArrowRight');await expect(gallery).toBeChecked();
    await list.evaluate(node=>(node as HTMLInputElement).disabled=false);
    await page.keyboard.press('ArrowRight');await page.keyboard.press('Tab');await expect(list).not.toBeFocused();
    await page.keyboard.press('Shift+Tab');await expect(list).toBeFocused();
    await control.screenshot({path:info.outputPath(`${await control.getAttribute('aria-label')}.png`),animations:'disabled'});
  }
  await expect(library.getByRole('radio',{name:'List',exact:true})).toBeChecked();
  await project.getByRole('radio',{name:'Gallery',exact:true}).check();
  await expect(library.getByRole('radio',{name:'List',exact:true})).toBeChecked();
});

test('collection toolbars share search geometry, action order and spacing without changing filtering',async({page},testInfo)=>{
  await page.addInitScript(()=>{
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['instances','news','explore','worlds','servers','screenshots']}));
    localStorage.setItem('chest-preview-v1',JSON.stringify({instances:Array.from({length:8},(_,index)=>index===0?'Adventure':index===1?'Classic':`Library ${index}`).map((name,index)=>({id:`instance-${index}`,name,version:'1.21.4',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:false})),accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096}));
  });
  await page.setViewportSize({width:1440,height:900});await page.goto('/');
  const instanceSearch=page.getByRole('searchbox',{name:'Search instances',exact:true});
  await instanceSearch.fill('Adventure');await expect(page.locator('.instance-card')).toHaveCount(1);
  await instanceSearch.fill('');await expect(page.locator('.instance-card')).toHaveCount(8);
  const fields=page.locator('.search-field');
  await expect(fields).toHaveCount(4);
  const geometry=await fields.evaluateAll(nodes=>nodes.map(node=>{const css=getComputedStyle(node);const input=getComputedStyle(node.querySelector('input')!);return {height:node.getBoundingClientRect().height,border:css.border,padding:css.padding,gap:css.gap,font:input.fontSize,icon:getComputedStyle(node.querySelector('svg')!).color};}));
  for(const field of geometry)expect(field).toEqual(geometry[0]);
  const instances=page.locator('.home-library .collection-toolbar');
  const servers=page.locator('.collection-toolbar').filter({has:page.getByRole('searchbox',{name:'Search servers',exact:true})});
  for(const toolbar of [instances,servers]){
    const add=toolbar.getByRole('button',{name:'Add',exact:true});
    await expect(add).toHaveAttribute('data-tone','accent');
    await expect(add.locator('[data-symbol="plus"]')).toHaveCount(1);
    // Lazy shelves above can move this toolbar between separate protocol calls.
    // Read both boxes in one browser task and retain the actual geometry checks.
    await expect.poll(()=>toolbar.evaluate(node=>{
      const search=node.querySelector('.search-field')!.getBoundingClientRect();
      const button=node.querySelector('[data-tool="add"] .ui-button')!.getBoundingClientRect();
      return {aligned:Math.abs(search.y-button.y)<=1,addBeforeSearch:button.x<search.x};
    })).toEqual({aligned:true,addBeforeSearch:true});
  }
  expect(await instances.locator('[data-tool="add"] .ui-button').allTextContents()).toEqual(['Add']);
  expect(await servers.locator('[data-tool] > .ui-button').allTextContents()).toEqual(['Add','Refresh']);
  await expect(instances.getByRole('heading',{name:'Instances 8'})).toBeVisible();
  await expect(instances.getByRole('button',{name:'View all',exact:true})).toBeVisible();
  const switchControl=instances.getByRole('radiogroup',{name:'Library layout'});
  const switchX=(await switchControl.boundingBox())!.x;
  const switchBox=(await switchControl.boundingBox())!,toolbarBox=(await instances.boundingBox())!;
  expect(switchBox.x+switchBox.width).toBe(toolbarBox.x+toolbarBox.width);
  await instanceSearch.fill('Adventure');await expect(instances.getByRole('button',{name:'View all',exact:true})).toHaveCount(0);
  expect((await switchControl.boundingBox())!.x).toBe(switchX);
  await instanceSearch.fill('');await expect(instances.getByRole('button',{name:'View all',exact:true})).toBeVisible();
  const heading=await instances.getByRole('heading').boundingBox();
  expect(Math.abs(heading!.y+heading!.height/2-(await instanceSearch.boundingBox())!.y-(await instanceSearch.boundingBox())!.height/2)).toBeLessThanOrEqual(1);
  const spacing=await page.locator('.collection-toolbar').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).marginBottom));
  expect(new Set(spacing).size).toBe(1);
  for(const [name,toolbar] of [['instances',instances],['servers',servers]] as const)await toolbar.screenshot({path:testInfo.outputPath(`${name}-toolbar.png`)});
  const source=page.getByRole('combobox',{name:'Content source',exact:true});
  await expect(source).toHaveValue('modrinth');
  const sourceBox=(await source.boundingBox())!,catalogSearch=(await page.locator('.catalog-controls .search-field').boundingBox())!;
  expect(Math.abs(sourceBox.y-catalogSearch.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(sourceBox.height-catalogSearch.height)).toBeLessThanOrEqual(1);
  await expect(source).toHaveCSS('margin-top','0px');
  expect(await source.locator('..').evaluate(node=>getComputedStyle(node,'::after').color)).toBe(geometry[0].icon);
  expect((await source.boundingBox())!.width).toBeGreaterThan(100);
  await page.locator('.catalog-controls').screenshot({path:testInfo.outputPath('catalog-controls.png')});
  const screenshots=page.locator('[data-home-section="screenshots"] .collection-toolbar');
  await expect(screenshots.getByRole('button',{name:'Refresh',exact:true})).toHaveCount(1);
  await screenshots.screenshot({path:testInfo.outputPath('screenshots-toolbar.png')});
  await page.setViewportSize({width:520,height:800});
  const more=instances.getByRole('button',{name:'More actions',exact:true});
  await expect(more).toBeVisible();
  await expect(instances.getByRole('button',{name:'View all',exact:true})).toBeVisible();
  await expect(instances.getByRole('navigation',{name:'Instances navigation'})).toBeVisible();
  await more.click();
  const overflow=instances.getByRole('dialog',{name:'More actions'});
  await expect(overflow).toBeVisible();
  await expect(overflow.getByRole('radio',{name:'List',exact:true})).toHaveCount(0);
  await expect(instances.getByRole('radiogroup',{name:'Library layout'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await instances.getByRole('radio',{name:'List',exact:true}).click();
  await page.setViewportSize({width:1440,height:900});
  await expect(more).toHaveCount(0);
  await expect(instances.getByRole('radio',{name:'List',exact:true})).toBeChecked();
  await instances.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByRole('heading',{name:'New instance',exact:true})).toBeVisible();
});
