import {test,expect,type Page} from '@playwright/test';
import {openHomeTool} from './home-helpers';
async function fixture(page:Page){
  await page.addInitScript(()=>{
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['instances','news','explore','worlds','servers','screenshots']}));
    const instance={id:'world',name:'Adventure with a very long instance name',version:'1.21.4',loader:'fabric',loader_version:'0.16.9',memory_mb:4096,java_path:'',artwork:'grass',installed:true};
    const world={instance_id:'world',folder:'Survival',name:'Survival with a long world name',version:'1.21.4',data_version:null,last_played:null};
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ9kAAAAASUVORK5CYII=';
    (window as any).isTauri=true;
    (window as any).__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string)=>{
      if(name==='get_config')return {instances:[instance],accounts:[{id:'user',name:'Player with a long nickname'}],active_account:'user',client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_instance_icons')return {};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='get_instance_files')return {worlds:['Survival'],servers:[{name:'Friends with a long server name',ip:'friends.example.com:25565'}],screenshots:['2026-10-11-long-screenshot-name.png']};
      if(name==='get_instance_worlds')return [world];
      if(name==='get_worlds')return {worlds:[world],unavailable:[]};
      if(name==='get_servers')return {servers:[{instance_id:'world',name:'Friends with a long server name',address:'friends.example.com:25565',icon:null}],unavailable:[]};
      if(name==='get_screenshots')return {screenshots:[],unavailable:[]};
      if(name==='get_screenshot_image')return png;
      if(name==='get_content')return [{name:'very-long-resource-pack-name.zip',kind:'resourcepacks',enabled:true}];
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_fabric_versions')return ['0.16.9'];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[{id:'pack',title:'A long project title for a responsive card',author:'Author',description:'Example content',icon:null,downloads:100,url:'https://modrinth.com/mod/pack'}],total:1};
      if(name==='get_instance_news')return {articles:[],unavailable:[]};
      if(name==='get_account_skin'||name==='take_instance_intent')return null;
      return [];
    }};
  });
}
async function fits(page:Page,label:string){
  await expect.soft.poll(()=>page.evaluate(()=>Array.from(document.querySelectorAll<HTMLElement>('main,dialog[open]')).filter(node=>node.getBoundingClientRect().width>0).map(node=>({element:node.tagName,overflow:node.scrollWidth-node.clientWidth})).filter(item=>item.overflow>1)),{message:label}).toEqual([]);
  const clipped=await page.locator('button,h1,h2,h3').evaluateAll(nodes=>nodes.filter(node=>node.getBoundingClientRect().width>0 && getComputedStyle(node).visibility!=='hidden' && (node.scrollWidth>node.clientWidth+2 || node.getAttribute('data-shape')!=='tab' && node.scrollHeight>node.clientHeight+2)).map(node=>({label:node.textContent?.trim().slice(0,60),aria:node.getAttribute('aria-label'),class:node.className,width:node.scrollWidth-node.clientWidth,height:node.scrollHeight-node.clientHeight})));
  expect.soft(clipped,label+' clipped labels').toEqual([]);
}
for(const [width,height,scale] of [[320,640,1],[600,480,1],[1150,800,1],[1920,1080,1],[800,600,2],[320,640,2]] as const){
  test(`pages and dialogs reflow at ${width}×${height}, text scale ${scale}`,async({page},testInfo)=>{
    await fixture(page);await page.setViewportSize({width,height});await page.goto('/');
    if(scale!==1)await page.addStyleTag({content:`html{font-size:${14*scale}px !important}`});
    await fits(page,'Home');
    for(const name of ['Worlds','Servers','Screenshots','Explore','News']){await openHomeTool(page,name);await fits(page,`Home ${name}`);}
    await page.getByRole('button',{name:'Adventure with a very long instance name: Ready to play',exact:true}).click();
    for(const name of ['Overview','Content','Versions','Worlds','Servers','Screenshots','Settings','Log']){
      await page.getByRole('tab',{name,exact:true}).click();await fits(page,`Instance ${name}`);
      if(name==='Screenshots'){
        await page.locator('.screenshot-tile').first().click();await fits(page,'Screenshot preview');await page.keyboard.press('Escape');
      }
    }
    await page.getByRole('button',{name:'Settings',exact:true}).click();await fits(page,'Accounts');
    await page.getByRole('tab',{name:'Settings',exact:true}).click();await fits(page,'App settings');
    await page.getByRole('tab',{name:'About',exact:true}).click();await fits(page,'About');
    await page.getByRole('button',{name:'Create instance',exact:true}).click();await fits(page,'Create');
    await page.getByRole('tab',{name:'Modpacks',exact:true}).click();await page.getByRole('button',{name:'Choose',exact:true}).click();await fits(page,'Modpack browser');
    await page.locator('.catalog-card').first().click();await fits(page,'Project dialog');
    if(width===320){
      const dialog=page.locator('.project-dialog'),title=dialog.locator('#project-title');
      expect((await title.boundingBox())!.width).toBeGreaterThan((await dialog.boundingBox())!.width*.75);
      expect((await dialog.getByRole('button',{name:'Close project',exact:true}).boundingBox())!.y).toBeLessThan(height/2);
    }
    await page.screenshot({path:testInfo.outputPath('responsive-dialog.png')});
  });
}
