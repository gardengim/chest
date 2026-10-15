import { test, expect } from '@playwright/test';

test('cards and instance headers share version, loader, and saved playtime summaries',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({
    instances:[
      {id:'fabric',name:'Modded world',version:'26.3',loader:'fabric',loader_version:'0.19.5',playtime_seconds:8040},
      {id:'vanilla',name:'Fresh world',version:'1.21.4',loader:'vanilla',loader_version:''},
      {id:'pending',name:'Queued pack',version:'pending',loader:'vanilla',loader_version:''},
    ].map(i=>({...i,memory_mb:4096,java_path:'',artwork:'grass',installed:false})),
    accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,
  })));
  await page.reload();
  for(const [name,summary] of [
    ['Modded world','26.3 · Fabric 0.19.5 · 2 h 14 min played'],
    ['Fresh world','1.21.4 · Not played yet'],
    ['Queued pack','Preparing modpack · Not played yet'],
  ]){
    const card=page.locator('.instance-card').filter({has:page.getByRole('heading',{name,exact:true})});
    await expect(card.locator('.instance-brief')).toHaveText(summary);
    await card.click();
    await expect(page.locator('.instance-hero .instance-brief')).toHaveText(summary);
    await page.getByRole('button',{name:'Chest home',exact:true}).click();
  }
  await page.getByRole('radiogroup',{name:'Library layout'}).getByRole('radio',{name:'List',exact:true}).click();
  await expect(page.locator('.instance-card').first().locator('.instance-brief')).toHaveText('26.3 · Fabric 0.19.5 · 2 h 14 min played');
  await page.setViewportSize({width:700,height:650});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
