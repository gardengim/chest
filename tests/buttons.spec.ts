import { test, expect, type Locator, type Page } from '@playwright/test';

async function feedback(page:Page,button:Locator,anchored=false){
  const y=()=>button.evaluate(node=>{const value=getComputedStyle(node).transform;return value==='none'?0:new DOMMatrix(value).m42;});
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
  await expect(page.getByRole('heading',{name:'Library 1',exact:true})).toBeVisible();
  expect(await page.locator('button:not(.ui-button)').count()).toBe(0);
  expect(await page.locator('button:not([type])').count()).toBe(0);
  await feedback(page,page.getByRole('button',{name:'New',exact:true}));
  await feedback(page,page.getByRole('button',{name:'Gallery',exact:true}).first());
  await feedback(page,page.locator('.instance-card'));
  await feedback(page,page.getByRole('button',{name:'Chest home',exact:true}),true);
  const next=page.locator('.catalog-pagination').getByRole('button',{name:'Next',exact:true});
  await expect(next).toBeDisabled();
  await next.hover({force:true});
  expect(await next.evaluate(node=>({opacity:getComputedStyle(node).opacity,transform:getComputedStyle(node).transform}))).toEqual({opacity:'0.5',transform:'none'});
  await page.getByRole('button',{name:'World: Not installed',exact:true}).click();
  await feedback(page,page.getByRole('button',{name:'Sign in',exact:true}));
  await feedback(page,page.getByRole('tab',{name:'Content',exact:true}),true);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await feedback(page,page.getByRole('button',{name:'Delete',exact:true}));
  await page.getByRole('button',{name:'Delete',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.locator('button:not(.ui-button)').count()).toBe(0);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'World',exact:true})).toBeVisible();
});
