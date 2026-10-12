import {test,expect} from '@playwright/test';

test('Explore cards fill with gallery backgrounds and gradients in gallery and list layouts',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/gallery.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#789fb3"/><path d="M0 240L200 80L400 230L640 130V360H0Z" fill="#4b6a38"/></svg>'}));
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string)=>{
      if(name==='get_config')return {instances:[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_instance_icons')return {};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[
        {id:'pack',title:'Gallery pack',description:'A scenic pack',author:'Creator',icon:'/chest.svg',background:'/gallery.svg',downloads:1000,url:'https://modrinth.com/modpack/pack'},
        {id:'empty',title:'No gallery',description:'A plain pack',author:'Creator',icon:null,background:null,downloads:10,url:'https://modrinth.com/modpack/empty'},
      ],total:2};
      return [];
    }};
  });
  await page.goto('/');
  await page.getByRole('tab',{name:'Modpacks',exact:true}).click();
  const card=page.locator('.catalog-card').first();
  const background=card.locator('.card-backdrop img');
  await expect(background).toHaveAttribute('src','/gallery.svg');
  await expect.poll(()=>background.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(640);
  async function check(){
    const geometry=await card.evaluate(node=>{
      const rect=node.getBoundingClientRect(),bg=node.querySelector('.card-backdrop')!.getBoundingClientRect();
      const art=getComputedStyle(node.querySelector('.catalog-art')!);
      return {width:rect.width,height:rect.height,bgWidth:bg.width,bgHeight:bg.height,bottom:art.borderBottomWidth,right:art.borderRightWidth,gradient:getComputedStyle(node.querySelector('.card-backdrop')!,'::after').backgroundImage};
    });
    expect(geometry.bgWidth).toBe(geometry.width-4);
    expect(geometry.bgHeight).toBe(geometry.height-4);
    expect(geometry.bottom).toBe('0px');expect(geometry.right).toBe('0px');
    expect(geometry.gradient).toContain('linear-gradient');
  }
  await check();
  await expect(card.locator('.catalog-art img')).toHaveAttribute('src','/chest.svg');
  await expect(page.locator('.catalog-card').last().locator('.card-backdrop img')).toHaveCount(0);
  await page.screenshot({path:'/tmp/chest-catalog-background-gallery.png',fullPage:true});
  await page.getByRole('group',{name:'Project layout'}).getByRole('button',{name:'List',exact:true}).click();
  await check();
  await page.screenshot({path:'/tmp/chest-catalog-background-list.png',fullPage:true});
});
