import {test,expect} from '@playwright/test';

test('gallery requests complete rows at every width and pagination neither skips nor repeats projects',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_config')return {instances:[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_instance_icons')return {};
      if(name==='get_versions')return [{id:'26.3',type:'release'}];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:true};
      if(name==='search_catalog'){
        const q=args.query;w.__query=q;
        return {projects:Array.from({length:Math.min(q.limit,103-q.offset)},(_,index)=>({id:String(q.offset+index),title:'Project '+(q.offset+index),author:'Author',description:'',downloads:1,icon:null,url:'https://modrinth.com/mod/project'})),total:103};
      }
      return [];
    }};
  });
  await page.goto('/');
  for(const width of [1150,1450,900]){
    await page.setViewportSize({width,height:900});
    await expect.poll(()=>page.locator('.catalog-card').count()).toBeGreaterThanOrEqual(20);
    await expect.poll(async()=>{
      const count=await page.locator('.catalog-card').count();
      const columns=await page.locator('.catalog-grid').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length);
      return count%columns;
    }).toBe(0);
    const query=await page.evaluate(()=>(window as any).__query);
    await expect(page.locator('.catalog-card')).toHaveCount(query.limit);
  }
  const query=await page.evaluate(()=>(window as any).__query);
  await page.locator('.catalog-pagination').getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.locator('.catalog-card').first()).toContainText('Project '+query.limit);
  expect(await page.evaluate(()=>(window as any).__query.offset)).toBe(query.limit);
  await page.locator('.catalog-pagination').getByRole('button',{name:'Previous',exact:true}).click();
  await expect(page.locator('.catalog-card').first()).toContainText('Project 0');
  await page.getByRole('group',{name:'Project layout'}).getByRole('button',{name:'List',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__query.limit)).toBe(20);
  await expect(page.locator('.catalog-card')).toHaveCount(20);
});
