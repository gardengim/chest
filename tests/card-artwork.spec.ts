import {test,expect} from '@playwright/test';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ9kAAAAASUVORK5CYII=';
async function fixture(page:import('@playwright/test').Page){
  await page.addInitScript(png=>{
    const w=window as any;w.isTauri=true;w.__calls=[];w.__screenshots=[];w.__screenshotLoads=[];w.__screenshotRequests=[];
    const instances=[{id:'instance',name:'Adventure',version:'1.21.4',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true}];
    const config={instances,accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,server_bookmarks:[{id:'server',name:'Friends',address:'example.test',instance_id:'instance',expected_version:'',expected_loader:null}]};
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      w.__calls.push(name);
      if(name==='get_config')return config;
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_instance_icons')return {instance:'/chest.svg'};
      if(name==='get_instance_backgrounds')return w.__backgroundPool || w.__screenshots.map((url:string)=>({kind:'provider',url}));
      if(name==='get_servers')return {servers:[],unavailable:[]};
      if(name==='get_worlds')return {worlds:[{instance_id:'instance',folder:'Survival',name:'Survival',version:'1.21.4',data_version:null,last_played:null}],unavailable:[]};
      if(name==='get_world_icon'||name==='get_server_icon')return png;
      if(name==='get_screenshots')return {screenshots:[{instance_id:'instance',name:'image.png',modified:1}],unavailable:[]};
      if(name==='get_screenshot_image'){w.__screenshotLoads.push(args.name);w.__screenshotRequests.push(args);return png;}
      if(name==='get_instance_files')return {worlds:['Survival'],servers:[{name:'Friends',ip:'example.test',icon:png}],screenshots:['image.png']};
      if(name==='get_instance_worlds')return [{instance_id:'instance',folder:'Survival',name:'Survival',version:'1.21.4',data_version:null,last_played:null}];
      if(name==='get_content')return [{name:'example.jar',kind:'mods',enabled:true}];
      if(name==='get_launch_settings')return {};
      if(name==='get_news'||name==='get_activities')return [];
      if(name==='get_instance_news')return {articles:[],unavailable:[]};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {total:3,projects:[
        {id:'icon-only',title:'Icon only',icon:'/chest.svg',background:null,author:'Author',description:'',downloads:1},
        {id:'gallery',title:'Gallery',icon:'/chest.svg',background:'/minecraft.png',author:'Author',description:'',downloads:1},
        {id:'broken',title:'Broken artwork',icon:'/missing-icon.png',background:'/missing-background.png',author:'Author',description:'',downloads:1},
      ]};
      return null;
    }};
  },png);
}

test('instance cards and header share a mixed background pool, lazily load frames and show one header icon',async({page})=>{
  await page.clock.install();await fixture(page);
  await page.addInitScript(()=>{
    const w=window as any;
    w.__backgroundPool=[{kind:'provider',url:'/minecraft.png'},{kind:'provider',url:'/minecraft.png'},
      ...Array.from({length:20},(_,i)=>({kind:'screenshot',name:`shot-${i}.png`,modified:1}))];
  });
  await page.goto('/');
  await expect(page.locator('.instance-card .card-backdrop img.visible')).toHaveAttribute('src','/minecraft.png');
  // The current provider frame and previous local frame are enough for crossfade.
  await expect.poll(()=>page.evaluate(()=>(window as any).__screenshotLoads)).toEqual(['shot-19.png']);
  await page.getByRole('button',{name:'Adventure: Ready to play',exact:true}).click();
  await expect(page.locator('.instance-hero h1')).toHaveText('Adventure');
  await expect(page.locator('.instance-hero h1 img,.instance-hero h1 svg')).toHaveCount(0);
  await expect(page.locator('.instance-hero .instance-art img')).toHaveCount(1);
  await expect(page.locator('.instance-scene .instance-backdrop img')).toHaveCount(2);
  expect(await page.evaluate(()=>(window as any).__screenshotRequests.map((request:any)=>request.edge))).toEqual([512,1024]);
  // Intersection callbacks arrive independently of image loading. Let the
  // visible header start its rotation before advancing the test clock.
  await page.locator('.instance-scene .instance-backdrop').evaluate(node=>new Promise<void>(resolve=>{
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        observer.disconnect();requestAnimationFrame(()=>resolve());
      }
    });
    observer.observe(node);
  }));
  await page.clock.runFor(8100);
  await expect(page.locator('.instance-scene .instance-backdrop img.visible')).toHaveAttribute('src',png);
  expect(await page.evaluate(()=>(window as any).__screenshotLoads)).toEqual(['shot-19.png','shot-19.png','shot-0.png']);
});

test('cards use blurred icons when backgrounds are missing, but preserve real backgrounds and recover from failures',async({page})=>{
  await fixture(page);await page.goto('/');
  const instance=page.locator('.instance-card');
  await expect(instance.locator('.icon-backdrop')).toHaveAttribute('src','/chest.svg');
  expect(await instance.locator('.icon-backdrop').evaluate(node=>getComputedStyle(node).filter)).toContain('blur(');
  await expect(instance.locator('.shared-card-art img')).toHaveAttribute('src','/chest.svg');
  expect(await instance.locator('.shared-card-art img').evaluate(node=>getComputedStyle(node).filter)).not.toContain('blur(');
  const iconOnly=page.locator('.catalog-card').filter({has:page.getByRole('heading',{name:'Icon only',exact:true})});
  await iconOnly.scrollIntoViewIfNeeded();await expect(iconOnly.locator('.icon-backdrop')).toHaveAttribute('src','/chest.svg');
  const gallery=page.locator('.catalog-card').filter({has:page.getByRole('heading',{name:'Gallery',exact:true})});
  await expect(gallery.locator('.card-backdrop img')).toHaveAttribute('src','/minecraft.png');await expect(gallery.locator('.icon-backdrop')).toHaveCount(0);
  const broken=page.locator('.catalog-card').filter({has:page.getByRole('heading',{name:'Broken artwork',exact:true})});
  await broken.scrollIntoViewIfNeeded();await expect(broken.locator('.icon-backdrop')).toHaveCount(0);
  await expect(broken.locator('.shared-card-art img,.shared-card-art svg')).toHaveCount(0);
  await instance.scrollIntoViewIfNeeded();
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);(window as any).__screenshots=['/minecraft.png'];window.dispatchEvent(new Event('focus'));});
  await expect(instance.locator('.card-backdrop img.visible')).toHaveAttribute('src','/minecraft.png');await expect(instance.locator('.icon-backdrop')).toHaveCount(0);
});

test('world thumbnails are darker backgrounds while servers use blurred icons',async({page})=>{
  await fixture(page);
  await page.addInitScript(()=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['worlds','servers','instances','explore']})));
  await page.goto('/');
  const world=page.locator('.world-list .launcher-card');
  await expect(world.locator('.shared-card-art img')).toHaveAttribute('src',png);
  await expect(world.locator('.card-backdrop img.visible')).toHaveAttribute('src',png);
  await expect(world.locator('.icon-backdrop')).toHaveCount(0);
  await expect(world.locator('.card-backdrop img.visible')).toHaveCSS('opacity','0.45');
  await page.locator('[data-home-section="servers"]').scrollIntoViewIfNeeded();
  const server=page.locator('.server-list .launcher-card');
  await expect(server.locator('.shared-card-art img')).toHaveAttribute('src',png);
  await expect(server.locator('.icon-backdrop')).toHaveAttribute('src',png);
  const calls=()=>page.evaluate(()=>(window as any).__calls.filter((name:string)=>name==='get_server_icon').length);
  expect(await calls()).toBe(1);
  await page.locator('[data-home-section="worlds"]').scrollIntoViewIfNeeded();
  await server.scrollIntoViewIfNeeded();expect(await calls()).toBe(1);
});

test('all card kinds share their shell and media dimensions while grids can control sizing',async({page},testInfo)=>{
  await fixture(page);
  await page.addInitScript(()=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['instances','worlds','servers','screenshots','explore']})));
  await page.goto('/');
  const cards=[page.locator('.instance-card'),page.locator('.world-list .launcher-card'),page.locator('.server-list .launcher-card'),page.locator('.screenshot-card'),page.locator('.catalog-card').first()];
  const dimensions=[];
  for(const card of cards){
    await card.scrollIntoViewIfNeeded();await expect(card).toBeVisible();
    dimensions.push(await card.evaluate(node=>{
      const css=getComputedStyle(node),art=getComputedStyle(node.querySelector('.shared-card-art')!),body=getComputedStyle(node.querySelector('.shared-card-body')!),heading=getComputedStyle(node.querySelector('h3')!);
      return {border:css.border,shadow:getComputedStyle(node,'::after').boxShadow,ratio:art.aspectRatio,padding:body.padding,minimum:body.minHeight,titleSize:heading.fontSize,titleColor:heading.color};
    }));
  }
  for(const geometry of dimensions)expect(geometry).toEqual(dimensions[0]);
  await expect(cards[0].locator('.card-status svg')).toHaveCount(0);
  await expect(cards[0].locator('.instance-brief')).toHaveCSS('display','flex');
  await expect(cards[3]).toHaveAttribute('data-media','image');
  await cards[3].scrollIntoViewIfNeeded();
  await expect(cards[3].locator('.shared-card-art img')).toBeVisible();
  expect(await cards[3].locator('.shared-card-art img').evaluate(node=>getComputedStyle(node).objectFit)).toBe('cover');
  await cards[3].screenshot({path:testInfo.outputPath('screenshot-card.png')});
  await cards[0].screenshot({path:testInfo.outputPath('instance-card.png')});
  const grid=page.locator('.instance-grid');
  await grid.evaluate(node=>{node.style.setProperty('--card-height','24rem');node.style.setProperty('--card-media-ratio','3 / 2');node.style.setProperty('--card-padding','.75rem');});
  expect((await cards[0].boundingBox())!.height).toBe(336);
  await expect(cards[0].locator('.shared-card-art')).toHaveCSS('aspect-ratio','3 / 2');
  await expect(cards[0].locator('.shared-card-body')).toHaveCSS('padding','10.5px');
});
test('world, server and installed-content card actions share translucent dark backgrounds and blur',async({page},testInfo)=>{
  await fixture(page);await page.goto('/');
  await page.getByRole('button',{name:'Adventure: Ready to play',exact:true}).click();
  for(const tab of ['Worlds','Servers','Contents']){
    await page.getByRole('tab',{name:tab,exact:true}).click();
    const actions=page.locator('.shared-card-actions .ui-button');await expect.poll(()=>actions.count()).toBeGreaterThan(0);
    await page.locator('.shared-card-actions').first().screenshot({path:testInfo.outputPath(`${tab.toLowerCase()}-card-actions.png`)});
    const button=actions.first();
    const normal=await button.evaluate(node=>{const css=getComputedStyle(node);return {border:css.borderTopColor,shadow:css.boxShadow,top:css.top};});
    await button.hover();
    await expect.poll(()=>button.evaluate(node=>getComputedStyle(node).borderTopColor)).not.toBe(normal.border);
    await expect(button).toHaveCSS('top','-1px');
    await page.mouse.down();
    await expect.poll(()=>button.evaluate(node=>getComputedStyle(node).boxShadow)).not.toBe(normal.shadow);
    await page.mouse.move(0,0);await page.mouse.up();
    await expect(button).toHaveCSS('top',normal.top);

    await button.evaluate(node=>(node.closest('.shared-card-body') as HTMLElement).style.background='rgb(180, 50, 30)');
    const warm=await button.screenshot({animations:'disabled'});
    await button.evaluate(node=>(node.closest('.shared-card-body') as HTMLElement).style.background='rgb(30, 80, 180)');
    const cool=await button.screenshot({animations:'disabled'});
    expect(warm.equals(cool),'The painted button must transmit changes behind it').toBe(false);
    await button.evaluate(node=>(node.closest('.shared-card-body') as HTMLElement).style.removeProperty('background'));
    for(const action of await actions.all()){
      expect(await action.evaluate(node=>{const color=getComputedStyle(node).backgroundColor;return color.startsWith('rgba(') || color.includes('/ 0.65');})).toBe(true);
      expect(await action.evaluate(node=>getComputedStyle(node).backdropFilter)).toContain('blur(');
      expect(await action.evaluate(node=>getComputedStyle(node,'::before').content)).toBe('none');
      expect(await action.evaluate(node=>getComputedStyle(node,'::after').content)).toBe('none');
    }
  }
});

test('missing content artwork stays absent across cards and installed content, and Overview has no stale refresh action',async({page})=>{
  await fixture(page);
  await page.addInitScript(()=>{
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['instances','worlds','servers','explore']}));
    const w=window as any,invoke=w.__TAURI_INTERNALS__.invoke;
    w.__TAURI_INTERNALS__.invoke=async(name:string,args:any)=>{
      if(name==='get_instance_icons')return {};
      if(name==='get_world_icon'||name==='get_server_icon')return null;
      if(name==='search_catalog')return {total:1,projects:[{id:'missing',title:'No artwork',icon:null,background:null,author:'Author',description:'',downloads:1}]};
      return invoke(name,args);
    };
  });
  await page.goto('/');
  for(const selector of ['.world-list .launcher-card','.server-list .launcher-card','.catalog-card']){
    const card=page.locator(selector);await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.shared-card-art img,.shared-card-art svg,.card-backdrop img')).toHaveCount(0);
  }
  await page.getByRole('button',{name:'Adventure: Ready to play',exact:true}).click();
  await expect(page.getByRole('button',{name:'Refresh files',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'Contents',exact:true}).click();
  await expect(page.locator('.content-entry')).toHaveCount(1);
  await expect(page.locator('.content-entry .shared-card-art img,.content-entry .shared-card-art svg')).toHaveCount(0);
});

test('screenshot image requests are reused when returning to the same collection',async({page})=>{
  await fixture(page);
  await page.addInitScript(()=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['screenshots','instances']})));
  await page.goto('/');
  await expect(page.locator('.screenshot-card .shared-card-art img')).toHaveAttribute('src',png);
  const calls=()=>page.evaluate(()=>(window as any).__calls.filter((name:string)=>name==='get_screenshot_image').length);
  expect(await calls()).toBe(1);
  await page.getByRole('button',{name:'Adventure: Ready to play',exact:true}).click();
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await expect(page.locator('.screenshot-card .shared-card-art img')).toHaveAttribute('src',png);
  expect(await calls()).toBe(1);
});
