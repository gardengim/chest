import {test,expect,type Page} from '@playwright/test';
import {openHomeTool} from './home-helpers';
async function fixture(page:Page,small=false){
  await page.addInitScript((small:boolean)=>{
    const w=window as any;w.isTauri=true;w.__pageRequests=[];w.__shotCount=small?1:25;
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',...(small?{homeShelves:['instances','news','explore','worlds','servers','screenshots']}: {})}));
    const instances=Array.from({length:small?1:8},(_,i)=>({id:`instance-${i}`,name:`Instance ${i}`,version:'26.2',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true}));
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_config')return {instances,accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_versions')return [{id:'26.2',type:'release'}];
      if(name==='get_instance_icons')return {};
      if(name==='get_instance_news')return {articles:[],unavailable:[]};
      if(name==='get_news')return Array.from({length:small?1:13},(_,i)=>({title:`Article ${i}`,date:'2026-10-13',url:`https://www.minecraft.net/article/${i}`}));
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog'){
        const q=args.query;w.__pageRequests.push(q);
        const result={projects:Array.from({length:Math.min(q.limit,(small?1:103)-q.offset)},(_,i)=>({id:String(q.offset+i),title:`Project ${q.offset+i}`,author:'Author',description:'',downloads:1,icon:null})),total:small?1:103};
        if(w.__holdPage && q.offset>0)return new Promise(resolve=>w.__releasePage=()=>resolve(result));
        return result;
      }
      if(name==='get_screenshots')return {screenshots:Array.from({length:w.__shotCount},(_,i)=>({instance_id:'instance-0',name:`image-${i}.png`,modified:1})),unavailable:[]};
      if(name==='get_screenshot_image')return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ9kAAAAASUVORK5CYII=';
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:['image-0.png']};
      if(name==='get_worlds')return {worlds:[],unavailable:[]};
      if(name==='get_servers')return {servers:[],unavailable:[]};
      if(name==='get_launch_settings')return {};
      if(name==='take_instance_intent')return null;
      return [];
    }};
  },small);
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
}
test('shelf, news, catalog and screenshot navigation use the same arrows and button geometry',async({page},testInfo)=>{
  await fixture(page);
  const viewAll=page.locator('.home-library').getByRole('button',{name:'View all',exact:true});
  await expect(viewAll).toHaveAttribute('data-shape','button');
  await expect(viewAll).toHaveCSS('border-style','solid');
  const shelf=page.getByRole('navigation',{name:'Instances navigation',exact:true});
  await expect(shelf.getByRole('button',{name:'Previous Instances',exact:true})).toBeDisabled();
  const dimensions=await shelf.getByRole('button').last().evaluate(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,border:getComputedStyle(node).borderWidth}));
  for(const nav of [shelf,page.getByRole('navigation',{name:'News pages',exact:true}),page.getByRole('navigation',{name:'Mods pages',exact:true})]){
    await expect(nav).toBeVisible();
    for(const [index,direction] of ['left','right'].entries()){
      const button=nav.getByRole('button').nth(index);
      await expect(button.locator('.direction-icon')).toHaveAttribute('data-direction',direction);
      await expect(button.locator('svg')).toHaveAttribute('data-symbol','chevron');
      expect(await button.evaluate(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,border:getComputedStyle(node).borderWidth}))).toEqual(dimensions);
    }
  }
  await shelf.screenshot({path:testInfo.outputPath('shelf-navigation.png')});
  const body=page.locator('[data-home-section=instances] .shelf-body');
  await body.hover();
  expect(await body.evaluate(node=>getComputedStyle(node).scrollbarWidth)).toBe('none');
  const horizontal=page.getByRole('scrollbar',{name:'Instances navigation',exact:true});
  const vertical=page.getByRole('scrollbar',{name:'Scroll page'});
  const bar=await horizontal.locator('.thumb').evaluate(node=>({size:getComputedStyle(node).height,bevel:getComputedStyle(node).boxShadow,radius:getComputedStyle(node).borderRadius}));
  expect(await horizontal.evaluate(node=>getComputedStyle(node).height)).toBe(await vertical.evaluate(node=>getComputedStyle(node).width));
  expect(bar.size).toBe(await vertical.locator('.thumb').evaluate(node=>getComputedStyle(node).width));
  expect(bar.bevel).toBe(await vertical.locator('.thumb').evaluate(node=>getComputedStyle(node).boxShadow));
  expect(bar.radius).toBe('0px');
  await horizontal.screenshot({path:testInfo.outputPath('horizontal-scrollbar.png')});
  const initial=await body.evaluate(node=>node.scrollLeft);
  await shelf.getByRole('button',{name:'Next Instances',exact:true}).click();await expect.poll(()=>body.evaluate(node=>node.scrollLeft)).toBeGreaterThan(initial);
  await expect(shelf.getByRole('button',{name:'Previous Instances',exact:true})).toBeEnabled();
  await horizontal.focus();await page.keyboard.press('End');
  await expect.poll(()=>body.evaluate(node=>Math.abs(node.scrollLeft+node.clientWidth-node.scrollWidth))).toBeLessThan(2);
  await page.keyboard.press('Home');await expect.poll(()=>body.evaluate(node=>node.scrollLeft)).toBe(0);
  const track=(await horizontal.boundingBox())!;
  await page.mouse.move(track.x+5,track.y+track.height/2);await page.mouse.down();
  await page.mouse.move(track.x+track.width/2,track.y+track.height/2);await page.mouse.up();
  await expect.poll(()=>body.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);

  const news=page.getByRole('navigation',{name:'News pages',exact:true});
  // Safari does not focus buttons on pointer clicks; test focus retention through
  // explicit keyboard activation consistently across engines.
  const nextNews=news.getByRole('button',{name:'Next',exact:true});await nextNews.focus();
  await nextNews.press('Enter');await expect(news.getByRole('status')).toHaveText('2 / 3');
  await nextNews.press('Enter');await expect(news.getByRole('status')).toHaveText('3 / 3');
  await expect(news.getByRole('button',{name:'Next',exact:true})).toBeDisabled();await expect(news.getByRole('button',{name:'Next',exact:true})).toBeFocused();
  await news.screenshot({path:testInfo.outputPath('news-navigation.png')});
  await openHomeTool(page,'Screenshots');
  const shots=page.getByRole('navigation',{name:'Screenshots pages',exact:true});await expect(shots.getByRole('status')).toHaveText('1 / 2');
  await shots.getByRole('button',{name:'Next',exact:true}).click();await expect(shots.getByRole('status')).toHaveText('2 / 2');await expect(page.locator('.screenshot-tile')).toHaveCount(1);
  await shots.screenshot({path:testInfo.outputPath('screenshot-navigation.png')});
});
test('catalog controls stay focused through loading and reject repeated disabled activation',async({page},testInfo)=>{
  await fixture(page);
  const pager=page.getByRole('navigation',{name:'Mods pages',exact:true}),next=pager.getByRole('button',{name:'Next',exact:true});
  await expect(next).toBeEnabled();
  await page.evaluate(()=>{(window as any).__holdPage=true;(window as any).__nextNode=document.querySelector('.catalog-results .navigation-controls button:last-child');});
  await next.focus();await page.keyboard.press('Space');await expect(next).toBeDisabled();await expect(next).toBeFocused();
  await page.keyboard.press('Space');
  await expect.poll(()=>page.evaluate(()=>typeof (window as any).__releasePage)).toBe('function');
  expect(await page.evaluate(()=>(window as any).__pageRequests.filter((q:any)=>q.offset>0).length)).toBe(1);
  await page.evaluate(()=>(window as any).__releasePage());await expect(next).toBeEnabled();await expect(next).toBeFocused();
  expect(await next.evaluate(node=>node===(window as any).__nextNode)).toBe(true);
  await expect(pager.getByRole('status')).toHaveAttribute('aria-label',/Page 2 of/);
  await pager.screenshot({path:testInfo.outputPath('catalog-navigation.png')});
  const caret=page.locator('.select-shell').first();
  const mask=await caret.evaluate(node=>getComputedStyle(node,'::after').maskImage);expect(mask).not.toBe('none');
  expect(await caret.evaluate(node=>getComputedStyle(node,'::after').rotate)).toBe('180deg');
});

test('navigation disappears for fitting shelves and single-page collections, then returns only when needed',async({page})=>{
  await fixture(page,true);
  await expect(page.locator('.instance-card')).toHaveCount(1);
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await page.locator('[data-home-section="screenshots"]').scrollIntoViewIfNeeded();
  await expect(page.locator('.screenshot-tile')).toHaveCount(1);
  await expect(page.locator('.shelf-navigation')).toHaveCount(0);
  await expect(page.locator('.pagination')).toHaveCount(0);
  const screenshotTool=page.getByRole('navigation',{name:'Home sections'}).getByRole('button',{name:'Screenshots',exact:true});
  await screenshotTool.focus();await page.keyboard.press('Alt+ArrowDown');
  await openHomeTool(page,'Screenshots');
  await expect(page.locator('.pagination')).toHaveCount(0);
  for(const [count,pages] of [[24,0],[25,1],[0,0]] as const){
    await page.evaluate(count=>(window as any).__shotCount=count,count);
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await expect(page.locator('.screenshot-tile')).toHaveCount(Math.min(count,24));
    await expect(page.locator('.pagination')).toHaveCount(pages);
  }
  await page.getByRole('button',{name:'Instance 0: Ready to play',exact:true}).click();
  await page.getByRole('tab',{name:'Screenshots',exact:true}).click();
  await expect(page.locator('.screenshot-tile')).toHaveCount(1);
  await expect(page.locator('.pagination')).toHaveCount(0);
});
test('shelf navigation follows actual overflow after resizing and searching',async({page})=>{
  await fixture(page);
  const shelf=page.locator('[data-home-section="instances"]');
  await expect(shelf.getByRole('navigation',{name:'Instances navigation'})).toBeVisible();
  await shelf.getByRole('searchbox',{name:'Search instances'}).fill('Instance 0');
  await expect(shelf.locator('.shelf-navigation')).toHaveCount(0);
  await shelf.getByRole('searchbox',{name:'Search instances'}).fill('');
  await expect(shelf.getByRole('navigation',{name:'Instances navigation'})).toBeVisible();
  await page.setViewportSize({width:5000,height:900});
  await expect(shelf.locator('.shelf-navigation')).toHaveCount(0);
  await page.setViewportSize({width:1150,height:800});
  await expect(shelf.getByRole('navigation',{name:'Instances navigation'})).toBeVisible();
});
