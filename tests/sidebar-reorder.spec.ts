import {test,expect} from '@playwright/test';

test('dragging reorders only instances, persists, and overflow fades clear at the edges',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({
    instances:Array.from({length:18},(_,i)=>({id:`world-${i}`,name:`World ${i}`,version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true})),
    accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,
  })));
  await page.reload();
  const rail=page.locator('.instance-rail'),items=page.locator('.rail-item');
  await expect(rail).toHaveClass(/fade-bottom/);
  await expect(rail).not.toHaveClass(/fade-top/);
  const source=await items.nth(0).boundingBox(),target=await items.nth(2).boundingBox();
  await page.mouse.move(source!.x+25,source!.y+25);await page.mouse.down();
  await page.mouse.move(target!.x+25,target!.y+48,{steps:8});await page.mouse.up();
  await expect(items.nth(2)).toHaveAttribute('data-instance-id','world-0');
  await expect(page.getByRole('heading',{name:'Library 18',exact:true})).toBeVisible();
  await page.reload();
  await expect(items.nth(2)).toHaveAttribute('data-instance-id','world-0');
  await rail.evaluate(n=>n.scrollTop=n.scrollHeight);
  await expect(rail).toHaveClass(/fade-top/);await expect(rail).not.toHaveClass(/fade-bottom/);
  await expect(rail.locator('button').last()).toHaveAttribute('aria-label','Create instance');
  await expect(page.getByRole('button',{name:'Accounts and settings',exact:true})).toBeVisible();
});
