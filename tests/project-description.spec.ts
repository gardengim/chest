import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const markdown='# Features\n\n**Explore** with friends.\n\n- One\n- Two\n\n[Guide](https://example.com/guide)\n\n![Landscape](https://cdn.modrinth.com/test.png)\n\n'+Array.from({length:45},(_,i)=>`Paragraph ${i}: more adventures to discover.`).join('\n\n');
const html='<h1 style="color:red;width:5000px">Features</h1><p><strong>Explore</strong> with friends.</p><ul><li>One</li><li>Two</li></ul><a href="https://example.com/guide">Guide</a><img width="8000" src="https://cdn.modrinth.com/test.png" alt="Landscape">'+Array.from({length:45},(_,i)=>`<p>Paragraph ${i}: more adventures to discover.</p>`).join('');
async function fixture(page:Page,body:string,format:string){
  await page.route('https://cdn.modrinth.com/test.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ9kAAAAASUVORK5CYII=','base64')}));
  await page.addInitScript(({body,format})=>{
    const w=window as any;w.isTauri=true;w.__description={body,format};w.__descriptionCalls=0;w.__opened=[];
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='save_settings')return {instances:[],accounts:[],active_account:null,client_id:'',java_path:args.javaPath,memory_mb:args.memoryMb};
      if(name==='get_config')return {instances:w.__instances || [],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_instance_icons')return {};
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:true};
      if(name==='search_catalog')return {total:1,projects:[{id:'123',title:'Adventure pack',description:'Short summary',author:'Creator',icon:w.__projectIcon || null,downloads:100,url:args.query.source==='curseforge'?'https://www.curseforge.com/minecraft/modpacks/adventure':'https://modrinth.com/modpack/adventure'}]};
      if(name==='get_modpack_releases' || name==='get_catalog_releases')return [{id:'release',name:'Stable',published:'2026-01-01'}];
      if(name==='add_catalog_content'){w.__added=args;return ['content.jar'];}
      if(name==='get_catalog_description'){
        w.__descriptionCalls++;
        if(w.__pending)return new Promise(resolve=>w.__finishDescription=resolve);
        if(w.__fail)throw new Error('Unavailable');
        return w.__description;
      }
      if(name==='open_description_link'){w.__opened.push(args.url);return null;}
      return [];
    }};
  },{body,format});
}
async function open(page:Page){await page.getByRole('tab',{name:'Modpacks',exact:true}).click();await page.locator('.catalog-card').click();}
test('mods, resource packs and shaders keep target/release dropdowns together with Add',async({page})=>{
  await fixture(page,markdown,'markdown');
  await page.addInitScript(()=>(window as any).__instances=[{id:'world',name:'World',version:'1.21.4',loader:'fabric',loader_version:'0.16.10',artwork:'grass',memory_mb:4096,java_path:'',installed:true}]);
  await page.goto('/');
  for(const [tab,kind] of [['Mods','mod'],['Resource packs','resourcepack'],['Shaders','shader']]){
    await page.getByRole('tab',{name:tab,exact:true}).click();
    await page.getByLabel('Target instance',{exact:true}).selectOption('');
    await page.locator('.catalog-card').click();
    const dialog=page.locator('.project-dialog'),row=dialog.locator('.project-release-row');
    const add=row.getByRole('button',{name:'Add',exact:true});
    await expect(add).toBeDisabled();
    const target=row.getByLabel('Install into instance',{exact:true});
    expect(Math.abs((await target.boundingBox())!.y+(await target.boundingBox())!.height-((await add.boundingBox())!.y+(await add.boundingBox())!.height))).toBeLessThan(2);
    await target.selectOption('world');
    await expect(row.getByLabel('Compatible release',{exact:true})).toHaveValue('release');
    await expect(add).toBeEnabled();await add.click();
    expect(await page.evaluate(()=>(window as any).__added)).toMatchObject({id:'world',kind,version:'release'});
    await dialog.getByRole('button',{name:'Close project'}).click();
  }
});
test('project dialog has an elastic shell, neutral initial focus and aligned header/footer actions',async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});
  await fixture(page,markdown,'markdown');
  await page.addInitScript(()=>(window as any).__projectIcon='/minecraft.png');
  await page.goto('/');await open(page);
  const dialog=page.locator('.project-dialog'),title=dialog.locator('#project-title');
  await expect(title).toBeFocused();
  await expect(dialog.getByRole('button',{name:'Close project'})).not.toBeFocused();
  await expect(dialog.locator('.project-dialog-icon')).toHaveCSS('border-top-width','0px');
  await expect(title).toHaveCSS('margin-top','0px');
  const positions=await dialog.evaluate(node=>{
    const box=(selector:string)=>{const r=node.querySelector(selector)!.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom,width:r.width};};
    return {website:box('.project-header-actions button'),close:box('.dialog-close'),release:box('.project-release-row select'),action:box('.project-release-row>button')};
  });
  expect(positions.website.y).toBe(positions.close.y);
  expect(positions.website.x).toBeLessThan(positions.close.x);
  expect(Math.abs(positions.release.bottom-positions.action.bottom)).toBeLessThan(2);
  expect(positions.release.x+positions.release.width).toBeLessThan(positions.action.x);
  const large=(await dialog.boundingBox())!;expect(large.width).toBeGreaterThan(700);
  await expect(dialog.getByRole('region',{name:'Description'}).getByRole('heading',{name:'Features'})).toBeVisible();
  await page.screenshot({path:info.outputPath('refined-project-dialog.png')});
  await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Website',exact:true})).toBeFocused();
  await page.setViewportSize({width:720,height:600});
  const smaller=(await dialog.boundingBox())!;expect(smaller.width).toBeLessThan(large.width);expect(smaller.height).toBeLessThan(large.height);
  await page.keyboard.press('Escape');await expect(page.locator('.catalog-card')).toBeFocused();
});
for(const source of ['modrinth','curseforge'])test(`${source} descriptions share styling and scroll independently in both themes`,async({page},info)=>{
  await fixture(page,source==='modrinth'?markdown:html,source==='modrinth'?'markdown':'html');
  await page.goto('/');expect(await page.evaluate(()=>(window as any).__descriptionCalls)).toBe(0);
  if(source==='curseforge')await page.getByLabel('Content source').selectOption('curseforge');
  await open(page);
  const region=page.getByRole('region',{name:'Description',exact:true});
  await expect(region.getByRole('heading',{name:'Features',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Select',exact:true})).toBeVisible();
  expect(await region.evaluate(node=>node.scrollHeight>node.clientHeight)).toBe(true);
  expect(await page.locator('.project-dialog').evaluate(node=>node.scrollHeight<=node.clientHeight+1)).toBe(true);
  await expect(region.getByRole('heading',{name:'Features'})).not.toHaveCSS('color','rgb(255, 0, 0)');
  await expect(region.locator('[style],[width]')).toHaveCount(0);
  await region.getByRole('link',{name:'Guide',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__opened)).toEqual(['https://example.com/guide']);
  await region.focus();await page.keyboard.press('PageDown');
  await expect.poll(()=>region.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole('scrollbar',{name:'Scroll description',exact:true})).toHaveAttribute('data-placement','container');
  const findings=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(findings.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.screenshot({path:info.outputPath(`${source}-description.png`)});
  await page.getByRole('button',{name:'Close project',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByRole('radio',{name:'Light',exact:true}).check();
  await page.locator('.settings-actions button[type=submit]').click();
  await page.getByRole('button',{name:'Chest home',exact:true}).click();await open(page);
  await expect(page.getByRole('region',{name:'Description'}).getByRole('heading',{name:'Features'})).toBeVisible();
  await page.setViewportSize({width:320,height:640});await page.addStyleTag({content:'html{font-size:28px !important}'});
  const geometry=await page.locator('.project-dialog').evaluate(node=>{const r=node.getBoundingClientRect();return {right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:node.scrollWidth,client:node.clientWidth};});
  expect(geometry.right).toBeLessThanOrEqual(geometry.width);expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);expect(geometry.scroll).toBeLessThanOrEqual(geometry.client+1);
  expect((await page.locator('.description-panel').boundingBox())!.height).toBeGreaterThan(30);
});

test('description failure and late replies do not block releases or leak into reopened projects',async({page})=>{
  await fixture(page,markdown,'markdown');await page.goto('/');await page.evaluate(()=>(window as any).__fail=true);await open(page);
  await expect(page.getByRole('region',{name:'Description'})).toContainText('Could not load description.');
  await expect(page.getByRole('button',{name:'Select',exact:true})).toBeEnabled();
  await page.evaluate(()=>(window as any).__fail=false);await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Features',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await page.evaluate(()=>(window as any).__pending=true);await open(page);
  await expect(page.getByRole('region',{name:'Description'})).toContainText('Loading description');
  await page.keyboard.press('Escape');await page.evaluate(()=>{const w=window as any;w.__pending=false;w.__description={format:'html',body:'<h2>New description</h2>'};});await open(page);
  await expect(page.getByRole('heading',{name:'New description'})).toBeVisible();
  await page.evaluate(()=>(window as any).__finishDescription({format:'html',body:'<h2>Old description</h2>'}));
  await expect(page.getByRole('heading',{name:'Old description'})).toHaveCount(0);
});
