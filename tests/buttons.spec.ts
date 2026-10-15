import { test, expect, type Locator, type Page } from '@playwright/test';

async function feedback(page:Page,button:Locator,anchored=false){
  const y=()=>button.evaluate(node=>{return parseFloat(getComputedStyle(node).top)||0;});
  await button.hover();
  expect(await y()).toBe(anchored?0:-1);
  await page.mouse.down();
  expect(await y()).toBe(anchored?0:1);
  await page.mouse.move(600,10);
  await page.mouse.up();
  await page.keyboard.press('Tab');
  await button.focus();
  expect(await button.evaluate(node=>getComputedStyle(node).outlineStyle)).toBe('solid');
}

test('button shapes share pointer, focus, and disabled feedback while tabs stay anchored',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({
    instances:[{id:'world',name:'World',version:'26.3',loader:'fabric',loader_version:'0.19.5',memory_mb:4096,java_path:'',artwork:'grass',installed:false}],
    accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,
  })));
  await page.reload();
  await expect(page.getByRole('heading',{name:'Instances 1',exact:true})).toBeVisible();
  expect(await page.locator('button:not(.ui-button)').count()).toBe(0);
  expect(await page.locator('button:not([type])').count()).toBe(0);
  await feedback(page,page.getByRole('button',{name:'Add',exact:true}));
  const gallery=page.getByRole('radio',{name:'Gallery',exact:true}).first();
  await gallery.hover();await expect(gallery.locator('..')).toHaveCSS('transform','none');
  await page.keyboard.press('Tab');await gallery.focus();await expect(gallery.locator('..')).toHaveCSS('outline-style','solid');
  await feedback(page,page.locator('.instance-card'));
  await feedback(page,page.getByRole('button',{name:'Chest home',exact:true}),true);
  await expect(page.locator('.catalog-results > .pagination')).toHaveCount(0);
  await page.getByRole('button',{name:'World: Not installed',exact:true}).click();
  await feedback(page,page.getByRole('button',{name:'Install',exact:true}));
  await feedback(page,page.getByRole('tab',{name:'Contents',exact:true}),true);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await feedback(page,page.getByRole('button',{name:'Delete',exact:true}));
  await page.getByRole('button',{name:'Delete',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.locator('button:not(.ui-button)').count()).toBe(0);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'World',exact:true})).toBeVisible();
});

test('tab and sidebar hover fills stay clipped and do not lift their open edges',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({
    instances:[{id:'world',name:'World',version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',installed:false}],
    accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,
  })));
  await page.goto('/');
  const surface=(button:Locator)=>button.evaluate(node=>{
    const outer=getComputedStyle(node),outline=getComputedStyle(node,'::before'),fill=getComputedStyle(node,'::after');
    return {background:outer.backgroundColor,transform:outer.transform,shadow:outer.boxShadow,
      outlineClip:outline.clipPath,fillClip:fill.clipPath,outlineBottom:outline.bottom,fillBottom:fill.bottom,fill:fill.backgroundColor};
  });
  const modpacks=page.getByRole('tab',{name:'Modpacks',exact:true});
  await modpacks.scrollIntoViewIfNeeded();
  const rest=await surface(modpacks);
  await modpacks.hover();
  const hover=await surface(modpacks);
  expect(hover.background).toBe('rgba(0, 0, 0, 0)');expect(hover.transform).toBe('none');expect(hover.shadow).toBe('none');
  expect(hover.fill).not.toBe(rest.fill);
  expect(hover.outlineClip).toBe(rest.outlineClip);expect(hover.fillClip).toBe(rest.fillClip);
  expect(hover.outlineBottom).toBe(rest.outlineBottom);expect(hover.fillBottom).toBe(rest.fillBottom);
  await page.mouse.down();await expect(modpacks).toHaveCSS('transform','none');
  await page.mouse.move(600,10);await page.mouse.up();
  await modpacks.hover();await modpacks.locator('..').screenshot({path:info.outputPath('hovered-tabs.png')});
  const rail=page.getByRole('button',{name:'World: Not installed',exact:true});
  const normal=await surface(rail);await rail.hover();const highlighted=await surface(rail);
  expect(highlighted.background).toBe('rgba(0, 0, 0, 0)');expect(highlighted.transform).toBe('none');
  expect(highlighted.fill).not.toBe(normal.fill);expect(highlighted.fillClip).toBe(normal.fillClip);
  await rail.locator('..').screenshot({path:info.outputPath('hovered-sidebar.png')});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await rail.evaluate(node=>node.setAttribute('data-activity','running'));
  expect(await rail.evaluate(node=>getComputedStyle(node,'::after').animationName)).toBe('status-background-pulse');
  await expect(rail).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
});
