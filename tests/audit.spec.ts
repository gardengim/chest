import {test,expect} from '@playwright/test';

test('library backdrop requests and rotation stay bounded by visibility and motion preferences',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;w.__shots=[];w.__newsPending=[];w.__hidden=false;w.__rotations=new Set();
    Object.defineProperty(document,'hidden',{get:()=>w.__hidden});
    const interval=window.setInterval.bind(window),clear=window.clearInterval.bind(window);
    window.setInterval=((callback:any,delay:number,...args:any[])=>{const id=interval(callback,delay,...args);if(delay===8000)w.__rotations.add(id);return id;}) as any;
    window.clearInterval=(id:any)=>{w.__rotations.delete(id);clear(id);};
    const instances=Array.from({length:40},(_,i)=>({id:`world-${i}`,name:`World ${i}`,version:'1.21.4',loader:'vanilla',loader_version:'',installed:true,memory_mb:4096,java_path:'',artwork:'grass'}));
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_config')return {instances,accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_instance_icons')return {};
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_instance_backgrounds'){w.__shots.push(args.id);return Array.from({length:8},(_,i)=>({kind:'provider',url:`/chest.svg?slide=${i}`}));}
      if(name==='get_instance_news')return new Promise(resolve=>w.__newsPending.push(resolve));
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      return [];
    }};
  });
  await page.goto('/');await expect(page.locator('.instance-card')).toHaveCount(24);
  await expect.poll(()=>page.evaluate(()=>(window as any).__shots.length)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>(window as any).__shots.length)).toBeLessThan(40);
  expect(await page.evaluate(()=>(window as any).__shots.includes('world-23'))).toBe(false);
  await expect.poll(()=>page.evaluate(()=>(window as any).__rotations.size)).toBeGreaterThan(0);
  expect(await page.locator('.instance-card .instance-backdrop').evaluateAll(nodes=>nodes.every(n=>n.querySelectorAll('img').length<=2))).toBe(true);
  await page.evaluate(()=>{(window as any).__hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(()=>page.evaluate(()=>(window as any).__rotations.size)).toBe(0);
  await page.evaluate(()=>{(window as any).__hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(()=>page.evaluate(()=>(window as any).__rotations.size)).toBeGreaterThan(0);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(()=>page.evaluate(()=>(window as any).__rotations.size)).toBe(0);
  await page.locator('.instance-card').last().scrollIntoViewIfNeeded();
  await expect.poll(()=>page.evaluate(()=>(window as any).__shots.includes('world-23'))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>(window as any).__newsPending.length)).toBe(4);
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.evaluate(async()=>{
    const w=window as any;for(const resolve of [...w.__newsPending])resolve({articles:[],unavailable:[]});
    await new Promise(resolve=>setTimeout(resolve,0));
  });
  expect(await page.evaluate(()=>(window as any).__newsPending.length)).toBe(4);
});

test('pixel borders, corner steps and bevels scale together across nested controls',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');await page.getByRole('button',{name:'Create instance',exact:true}).click();
  await page.evaluate(()=>document.documentElement.style.setProperty('--pixel','2px'));
  for(const control of [page.getByRole('button',{name:'Add',exact:true}),page.locator('.collection-panel'),page.getByLabel('Instance name',{exact:true})]){
    expect(await control.evaluate(node=>getComputedStyle(node).borderTopWidth)).toBe('4px');
    expect(await control.evaluate(node=>getComputedStyle(node).borderRadius)).toBe('0px');
    expect(await control.evaluate(node=>getComputedStyle(node).boxShadow)).toContain('2px');
  }
  const outline=await page.getByRole('tab',{name:'Mods',exact:true}).evaluate(node=>getComputedStyle(node,'::before').clipPath);
  expect(outline).toContain('8px');expect(outline).toContain('4px');
});
