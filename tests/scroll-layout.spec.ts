import {test,expect} from '@playwright/test';

test('sidebar and main scroll independently, with edge-to-edge instance backgrounds',async({page})=>{
  await page.setViewportSize({width:1900,height:800});
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({
    instances:Array.from({length:30},(_,i)=>({id:`world-${i}`,name:`World ${i}`,version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true})),
    accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,
  })));
  await page.reload();
  const rail=page.locator('.instance-rail'),main=page.locator('main');
  await expect(page.locator('.rail-item')).toHaveCount(30);
  await main.hover();await page.mouse.wheel(0,500);
  await expect.poll(()=>main.evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
  const mainTop=await main.evaluate(n=>n.scrollTop);
  await rail.hover();await page.mouse.wheel(0,500);
  await expect.poll(()=>rail.evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
  expect(await main.evaluate(n=>n.scrollTop)).toBe(mainTop);
  await rail.evaluate(n=>n.scrollTop=n.scrollHeight);
  await page.mouse.wheel(0,1000);
  await page.waitForTimeout(150);
  expect(await main.evaluate(n=>n.scrollTop)).toBe(mainTop);
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  await rail.evaluate(n=>n.scrollTop=0);
  await page.getByRole('button',{name:'World 0: Ready to play',exact:true}).click();
  await main.evaluate(n=>n.scrollTop=0);
  const bg=await page.locator('.instance-scene > .instance-backdrop').boundingBox();
  const bounds=await main.boundingBox();
  expect(bg!.x).toBeCloseTo(bounds!.x,0);
  expect(bg!.y).toBeCloseTo(0,0);
  expect(bg!.width).toBeCloseTo(bounds!.width,0);
  const tab=await page.locator('.rail-item button').first().boundingBox();
  const next=await page.locator('.rail-item button').nth(1).boundingBox();
  expect(next!.y-tab!.y-tab!.height).toBe(2);
  await rail.evaluate(n=>n.scrollTop=n.scrollHeight);
  const add=await page.getByRole('button',{name:'Create instance',exact:true}).boundingBox();
  expect(add!.height).toBe(tab!.height);
  const gaps=await rail.evaluate(n=>{
    const add=n.querySelector<HTMLElement>('.add')!,previous=add.previousElementSibling!.getBoundingClientRect();
    const box=add.getBoundingClientRect(),style=getComputedStyle(n);
    return {left:box.left-n.getBoundingClientRect().left,right:n.clientWidth-parseFloat(style.paddingRight)-(box.right-n.getBoundingClientRect().left),
      top:box.top-previous.bottom,bottom:parseFloat(getComputedStyle(add).marginBottom)+parseFloat(style.paddingBottom)};
  });
  expect(gaps).toEqual({left:8,right:-2,top:2,bottom:6});
  expect(await page.locator('.instance-hero h1').evaluate(n=>getComputedStyle(n).userSelect)).toBe('none');
  expect(await page.locator('.chest img').evaluate(n=>!n.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true})))).toBe(true);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  expect(await page.getByLabel('Name',{exact:true}).evaluate(n=>getComputedStyle(n).userSelect)).toBe('text');
});
