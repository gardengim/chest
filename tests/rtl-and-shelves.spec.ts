import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function fixture(page:Page,language='en'){
  await page.addInitScript(language=>{
    const w=window as any;w.isTauri=true;
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:language,reduceMotion:true,homeShelves:['instances','worlds','servers','news']}));
    const instance={id:'world',name:'My World 世界',version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true};
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string)=>{
      if(name==='get_config')return {instances:Array.from({length:12},(_,i)=>({...instance,id:i?'world'+i:'world'})),accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,graphics_api:'default',account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='get_versions')return [{id:'26.3',type:'release'}];
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_instance_folder')return '/tmp/My World/game';
      if(name==='get_instance_icons')return {};
      if(name==='get_instance_news')return {articles:[],unavailable:[]};
      if(name==='get_worlds')return {worlds:[{instance_id:'world',folder:'Survival',name:'Survival',version:'26.3',data_version:1,last_played:1}],unavailable:[]};
      if(name==='get_servers')return {servers:[{instance_id:'world',name:'Example server',address:'localhost:25565',icon:null}],unavailable:[]};
      if(name==='get_news')return [{title:'Minecraft news article',date:'2026-10-15',url:'https://www.minecraft.net/article/test'}];
      if(name==='take_instance_intent')return null;
      return [];
    }};
  },language);
  await page.goto('/');
}

test('world and server shelves have independent gallery/list controls',async({page})=>{
  await fixture(page);
  const worlds=page.locator('[data-home-section=worlds]'),servers=page.locator('[data-home-section=servers]');
  await worlds.scrollIntoViewIfNeeded();
  await worlds.getByRole('radiogroup',{name:'Worlds layout'}).getByRole('radio',{name:'List',exact:true}).check();
  await expect(worlds.locator('.card-grid')).toHaveAttribute('data-layout','list');
  await servers.scrollIntoViewIfNeeded();
  await expect(servers.locator('.card-grid')).toHaveAttribute('data-layout','gallery');
  await servers.getByRole('radio',{name:'List',exact:true}).check();
  await expect(servers.locator('.card-grid')).toHaveAttribute('data-layout','list');
  await worlds.scrollIntoViewIfNeeded();await worlds.getByRole('radio',{name:'Gallery',exact:true}).check();
  await expect(worlds.locator('.card-grid')).toHaveAttribute('data-layout','gallery');
  await expect(servers.locator('.card-grid')).toHaveAttribute('data-layout','list');
});

test('badges use matched surface colors, and shared text actions have horizontal hover space',async({page})=>{
  await fixture(page);
  const badge=page.locator('.count').first();
  for(const mode of ['dark','light']){
    await page.evaluate(mode=>{localStorage.setItem('chest-appearance-mode-v1',mode);},mode);await page.reload();
    await expect(badge).toBeVisible();
    const colors=await badge.evaluate(node=>{const style=getComputedStyle(node);return {actual:style.color,bg:style.backgroundColor,expected:style.getPropertyValue('--theme-surface-text').trim()};});
    expect(colors.actual).not.toBe(colors.bg);
    // A badge in a panel must not inherit that panel's independent text role.
    await badge.evaluate(node=>{(node as HTMLElement).style.setProperty('--text','rgb(0, 0, 0)');});
    expect(await badge.evaluate(node=>getComputedStyle(node).color)).toBe(colors.actual);
  }
  const news=page.locator('.news-item').first();await news.scrollIntoViewIfNeeded();
  expect(await news.evaluate(node=>parseFloat(getComputedStyle(node).paddingInlineStart))).toBeGreaterThan(0);
  await news.hover();await expect(news).not.toHaveCSS('background-color','rgba(0, 0, 0, 0)');
});

test('Arabic mirrors the rail, dropdowns, tabs and horizontal scrollbar without mirroring artwork',async({page},info)=>{
  await fixture(page,'ar');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.getByRole('heading',{name:'الرئيسية',exact:true})).toBeVisible();
  const rail=await page.locator('.rail').boundingBox(),main=await page.locator('main').boundingBox();
  expect(rail!.x).toBeGreaterThan(main!.x+main!.width-1);
  const shelf=page.locator('[data-home-section=instances]'),body=shelf.locator('.shelf-body');
  const bar=shelf.getByRole('scrollbar');await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuenow','0');
  const bounds=(await bar.boundingBox())!,thumb=(await bar.locator('.thumb').boundingBox())!;
  expect(Math.abs(thumb.x+thumb.width-bounds.x-bounds.width)).toBeLessThan(2);
  await shelf.getByRole('button',{name:'النسخ التالية',exact:true}).click();
  await expect.poll(()=>body.evaluate(node=>node.scrollLeft)).toBeLessThan(0);
  await bar.focus();await page.keyboard.press('End');
  await expect.poll(()=>body.evaluate(node=>Math.abs(-node.scrollLeft+node.clientWidth-node.scrollWidth))).toBeLessThan(2);
  await page.keyboard.press('Home');await expect.poll(()=>body.evaluate(node=>node.scrollLeft)).toBe(0);
  await page.mouse.click(bounds.x+bounds.width*.25,bounds.y+bounds.height/2);
  await expect.poll(()=>body.evaluate(node=>node.scrollLeft)).toBeLessThan(0);
  await page.screenshot({path:info.outputPath('arabic-home.png')});
  await page.locator('.rail [data-instance-id=world] button').click();
  await expect(page.locator('.instance-hero h1')).toHaveText('My World 世界');
  const overview=page.getByRole('tab',{name:'نظرة عامة',exact:true}),contents=page.getByRole('tab',{name:'المحتويات',exact:true});
  await overview.focus();await page.keyboard.press('ArrowLeft');await expect(contents).toBeFocused();
  await expect(contents).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'الإعدادات',exact:true}).click();
  const select=page.getByLabel('واجهة الرسوميات',{exact:true});
  expect(await select.evaluate(node=>parseFloat(getComputedStyle(node).paddingInlineEnd))).toBeGreaterThan(10);
  await select.click();await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:info.outputPath('arabic-settings.png')});
  await page.setViewportSize({width:360,height:800});
  await expect.poll(()=>page.locator('main').evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThan(2);
  await page.screenshot({path:info.outputPath('arabic-narrow.png')});
});

test('Arabic preview can be discarded, and saving retains language and direction',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByLabel('Language',{exact:true}).selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await page.locator('.settings-actions').getByRole('button',{name:'تجاهل التغييرات',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
  await page.getByLabel('Language',{exact:true}).selectOption('ar');await page.locator('.settings-actions button[type=submit]').click();
  await page.reload();await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.getByRole('heading',{name:'الرئيسية',exact:true})).toBeVisible();
});
