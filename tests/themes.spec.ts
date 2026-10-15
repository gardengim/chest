import {settleFiniteAnimations} from './animation-helpers';
import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const storage='chest-color-scheme-v1';
const light={version:1,name:'Paper',mode:'light',colors:{
  page:'#f3f5fb','page-text':'#14203a','page-muted':'#40516a',
  panel:'#e2e7f1','panel-text':'#132033','panel-muted':'#40516a','panel-link':'#123f92',
  surface:'#ffffff','surface-text':'#14203a','surface-muted':'#40516a',
  control:'#e2e7f1','control-text':'#14203a',input:'#ffffff','input-text':'#14203a','input-muted':'#40516a',
  card:'#edf1f8','card-text':'#14203a','card-muted':'#40516a',
  accent:'#164eaa','accent-text':'#ffffff',link:'#164eaa',selected:'#c5d5ed','selected-text':'#14203a',focus:'#164eaa',
  success:'#24522a','success-text':'#ffffff',warning:'#68501d','warning-text':'#ffffff',danger:'#7b2929','danger-text':'#ffffff',
  console:'#ffffff','console-text':'#14203a','scroll-track':'#d5deed','scroll-thumb':'#40516a',
}};
async function settings(page:Page){
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
}
async function importScheme(page:Page,scheme:unknown,name='scheme.json'){
  await page.getByLabel('Import color scheme file').setInputFiles({name,mimeType:name.endsWith('.css')?'text/css':'application/json',buffer:Buffer.from(typeof scheme==='string'?scheme:JSON.stringify(scheme))});
}
async function effects(page:Page){return page.evaluate(()=>{
  const css=getComputedStyle(document.documentElement);
  return Object.fromEntries(['--pixel','--stroke','--frame','--edge','--bevel-highlight','--bevel-shadow','--bevel-raised','--shadow-overlay','--card-min','--card-gap'].map(key=>[key,css.getPropertyValue(key)]));
});}
async function settlePalette(page:Page){
  await settleFiniteAnimations(page);
}

test('mode radios and scheme dropdown are independent, persist and export both palettes without a preference',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto('/');await settings(page);const protectedEffects=await effects(page);
  const homePreferences=await page.evaluate(()=>localStorage.getItem('chest-ui-preferences-v1'));
  await page.getByRole('radio',{name:'System',exact:true}).check();
  const paired={version:2,name:'Forest',palettes:{light:{page:'#f0f5ed'},dark:{page:'#182118'}}};
  await importScheme(page,paired);
  await expect(page.getByRole('combobox',{name:'Color scheme',exact:true})).toHaveValue('1');
  await expect(page.locator('html')).toHaveCSS('background-color','rgb(24, 33, 24)');
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveCSS('background-color','rgb(240, 245, 237)');
  await page.getByRole('radio',{name:'Dark',exact:true}).check();
  await expect(page.locator('html')).toHaveCSS('color-scheme','dark');
  await page.emulateMedia({colorScheme:'dark'});await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveCSS('color-scheme','dark');
  expect(await effects(page)).toEqual(protectedEffects);
  expect(await page.evaluate(()=>localStorage.getItem('chest-color-scheme-v1'))).toBeNull();
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export scheme',exact:true}).click();
  const exported=JSON.parse(await readFile((await (await downloaded).path())!,'utf8'));
  expect(exported).toMatchObject(paired);expect(exported).not.toHaveProperty('mode');
  expect(exported.palettes.light['page-text']).toBe('#252825');
  expect(exported.palettes.dark['page-text']).toBe('#ececed');
  await page.locator('.settings-actions').getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('combobox',{name:'Color scheme',exact:true}).selectOption('0');
  await expect(page.getByRole('radio',{name:'Dark',exact:true})).toBeChecked();
  await page.locator('.settings-actions').getByRole('button',{name:'Save',exact:true}).click();
  await page.reload();await settings(page);
  await page.getByRole('combobox',{name:'Color scheme',exact:true}).selectOption({label:'Forest'});
  await expect(page.locator('html')).toHaveCSS('background-color','rgb(24, 33, 24)');
  await page.getByRole('radio',{name:'Light',exact:true}).check();
  await page.locator('.settings-actions').getByRole('button',{name:'Discard',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Chest');
  await expect(page.getByRole('radio',{name:'Dark',exact:true})).toBeChecked();
  await page.getByRole('combobox',{name:'Color scheme',exact:true}).selectOption({label:'Forest'});
  await page.locator('.settings-actions').getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('radio',{name:'System',exact:true}).check();
  await page.locator('.settings-actions').getByRole('button',{name:'Save',exact:true}).click();
  await page.reload();await expect(page.locator('html')).toHaveCSS('background-color','rgb(240, 245, 237)');
  await page.emulateMedia({colorScheme:'dark'});
  await expect(page.locator('html')).toHaveCSS('background-color','rgb(24, 33, 24)');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-color-scheme-v1')!))).toMatchObject(paired);
  expect(await page.evaluate(()=>localStorage.getItem('chest-ui-preferences-v1'))).toBe(homePreferences);
});

test('built-in Chest has accessible light and dark radio controls and responsive dropdown',async({page},info)=>{
  await page.goto('/');await settings(page);
  const picker=page.getByRole('combobox',{name:'Color scheme',exact:true});
  const mode=page.getByRole('radiogroup',{name:'Appearance mode',exact:true});
  await expect(mode.getByRole('radio')).toHaveCount(3);
  const [dropdown,selector]=await Promise.all([picker.boundingBox(),mode.boundingBox()]);
  expect(selector!.x).toBeGreaterThanOrEqual(dropdown!.x+dropdown!.width);
  expect(Math.abs(selector!.y+selector!.height-dropdown!.y-dropdown!.height)).toBeLessThan(1);
  await expect(picker.locator('option')).toHaveCount(1);
  for(const mode of ['Light','Dark']){
    await page.getByRole('radio',{name:mode,exact:true}).check();await settlePalette(page);
    const findings=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(findings.violations.map(({id,nodes})=>({id,targets:nodes.map(node=>node.target)}))).toEqual([]);
  }
  await page.getByRole('radio',{name:'Light',exact:true}).check();await settlePalette(page);
  await page.screenshot({path:info.outputPath('appearance-controls.png')});
  await picker.click();await expect(page.getByRole('listbox',{name:'Available choices'}).getByRole('option',{name:'Chest',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:320,height:640});
  await page.addStyleTag({content:'html {font-size:28px !important}'});
  expect(await page.locator('#main-content').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  await page.locator('.settings-actions').getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await expect(page.locator('html')).toHaveCSS('color-scheme','light');
});

test('paired schemes reject missing palettes, invalid legacy modes and protected or unknown fields',async({page})=>{
  await page.goto('/');await settings(page);
  const paired={version:2,name:'Forest',palettes:{light:{},dark:{}}};
  for(const bad of [
    {...paired,palettes:{light:{}}},
    {...paired,palettes:{...paired.palettes,sepia:{}}},
    {...paired,palettes:{light:{frame:'#ffffff'},dark:{}}},
    {...paired,palettes:{light:{},dark:{page:'var(--theme-page)'}}},
    {...paired,mode:'auto'},
    {...paired,colors:{}},
  ]){
    await importScheme(page,bad);
    await expect(page.locator('.color-scheme-settings [role=alert]')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Chest');
  }
});

test('older saved paired schemes migrate mode once and imports cannot overwrite it',async({page})=>{
  await page.addInitScript(()=>{
    if(!localStorage.getItem('chest-color-scheme-v1'))localStorage.setItem('chest-color-scheme-v1',JSON.stringify({version:2,name:'Old',mode:'light',palettes:{light:{},dark:{}}}));
  });
  await page.goto('/');await settings(page);
  await expect(page.getByRole('radio',{name:'Light',exact:true})).toBeChecked();
  expect(await page.evaluate(()=>localStorage.getItem('chest-appearance-mode-v1'))).toBe('light');
  await importScheme(page,{version:2,name:'New',mode:'dark',palettes:{light:{},dark:{}}});
  await expect(page.getByRole('radio',{name:'Light',exact:true})).toBeChecked();
  await page.locator('.settings-actions').getByRole('button',{name:'Save',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-color-scheme-v1')!))).not.toHaveProperty('mode');
  await page.getByRole('radio',{name:'Dark',exact:true}).check();
  await page.locator('.settings-actions').getByRole('button',{name:'Save',exact:true}).click();
  await page.reload();await expect(page.locator('html')).toHaveCSS('color-scheme','dark');
});

test('JSON scheme preview is reversible, persists only on Save, exports and resets',async({page})=>{
  await page.goto('/');await settings(page);const protectedEffects=await effects(page);
  await page.getByRole('radio',{name:'Light',exact:true}).check();
  await importScheme(page,light);
  await expect(page.getByRole('status')).toContainText('Previewing Paper');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Paper');
  expect(await page.evaluate(()=>localStorage.getItem('chest-color-scheme-v1'))).toBeNull();
  await expect(page.locator('.instance-content')).toHaveCSS('background-color','rgb(226, 231, 241)');
  await expect(page.getByRole('scrollbar',{name:'Scroll page',exact:true})).toHaveCSS('background-color','rgb(213, 222, 237)');
  expect(await effects(page)).toEqual(protectedEffects);
  await page.locator('.settings-actions').getByRole('button',{name:'Discard',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Chest');
  await importScheme(page,light);await page.locator('.settings-actions').getByRole('button',{name:'Save',exact:true}).click();
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Paper');
  await settings(page);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export scheme',exact:true}).click();
  const download=await downloaded;const exported=JSON.parse(await readFile((await download.path())!,'utf8'));
  expect(exported.version).toBe(2);expect(exported.name).toBe('Paper');expect(exported.palettes.light.page).toBe(light.colors.page);
  expect(exported).not.toHaveProperty('mode');expect(exported.palettes.light).not.toHaveProperty('frame');
  await page.getByRole('button',{name:'Restore defaults',exact:true}).click();
  await page.locator('.settings-actions').getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Chest');
  expect(await page.evaluate(()=>localStorage.getItem('chest-color-scheme-v1'))).toBeNull();
});

test('CSS imports use palette declarations only, and leaving an unapplied preview cancels it',async({page})=>{
  await page.goto('/');await settings(page);
  await importScheme(page,':root { /* palette */ --theme-mode: dark; --theme-page: #210f38; --theme-page-text: rgb(244, 235, 255); --theme-accent: hsl(275 65% 40%); }','Violet.css');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Violet');
  await expect(page.locator('html')).toHaveCSS('background-color','rgb(33, 15, 56)');
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Discard',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Chest');
  await settings(page);await page.getByText('Paste a color scheme',{exact:true}).click();
  await page.getByLabel('Scheme contents',{exact:true}).fill('--theme-page: #102030;');
  await page.getByRole('button',{name:'Preview scheme',exact:true}).click();
  await expect(page.locator('html')).toHaveCSS('background-color','rgb(16, 32, 48)');
});

test('invalid or protected imports cannot modify styling, storage or active preview',async({page})=>{
  await page.goto('/');await settings(page);const before=await effects(page);
  const bad=[
    {version:2,name:'Unsupported',mode:'dark',colors:{}},
    {...light,colors:{'bevel-highlight':'red'}},
    {...light,colors:{page:'var(--bevel-shadow)'}},
    {...light,colors:{page:'url(https://invalid.test/image.png)'}},
    ':root { --frame: red; }',
    ':root { --theme-page: red; } button { display: none; }',
    '@import url(https://invalid.test/style.css);',
    ':root { --theme-page: red !important; }',
    '{malformed',
    'x'.repeat(65537),
  ];
  for(const scheme of bad){
    await importScheme(page,scheme,typeof scheme==='string' && !scheme.startsWith('{')?'bad.css':'bad.json');
    await expect(page.locator('.color-scheme-settings [role=alert]')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Chest');
    expect(await effects(page)).toEqual(before);
  }
  expect(await page.evaluate(()=>localStorage.getItem('chest-color-scheme-v1'))).toBeNull();
  await importScheme(page,light);await importScheme(page,':root { --theme-page: invalid-color; }','bad.css');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Paper');
});

test('corrupt stored schemes fall back safely and valid schemes apply before application mount',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-color-scheme-v1',JSON.stringify({version:1,name:'Unsafe',mode:'dark',colors:{'bevel-shadow':'red'}})));
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Chest');
  await page.evaluate(scheme=>localStorage.setItem('chest-color-scheme-v1',JSON.stringify(scheme)),light);
  await page.addInitScript(()=>{
    const observer=new MutationObserver(()=>{
      if(document.getElementById('app')?.firstElementChild){
        (window as any).__schemeAtMount=getComputedStyle(document.documentElement).backgroundColor;
        observer.disconnect();
      }
    });
    observer.observe(document,{childList:true,subtree:true});
  });
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Paper');
  await expect(page.locator('html')).toHaveCSS('color-scheme','light');
  expect(await page.evaluate(()=>(window as any).__schemeAtMount)).toBe('rgb(243, 245, 251)');
});

for(const [name,scheme] of [['light',light],['saturated',{...light,name:'Plum',mode:'dark',colors:{...light.colors,page:'#210f38','page-text':'#f4ebff',surface:'#32164a','surface-text':'#f4ebff','surface-muted':'#dbc5ef',control:'#542875','control-text':'#ffffff',panel:'#43205c','panel-text':'#ffffff','panel-muted':'#dbc5ef','panel-link':'#dbc5ef',input:'#210f38','input-text':'#ffffff','input-muted':'#dbc5ef',link:'#dbc5ef'}}]] as const){
  test(`${name} scheme preserves pixel geometry and supports narrow settings and dialogs`,async({page},info)=>{
    await page.addInitScript(scheme=>localStorage.setItem('chest-color-scheme-v1',JSON.stringify(scheme)),scheme);
    await page.goto('/');await settings(page);
    const initialEffects=await effects(page);
    const findings=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(findings.violations.map(({id,nodes})=>({id,targets:nodes.map(node=>node.target)}))).toEqual([]);
    await page.setViewportSize({width:320,height:640});
    await page.addStyleTag({content:'html {font-size:28px !important}'});
    expect(await page.locator('#main-content').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    expect((await effects(page))['--pixel']).toBe(initialEffects['--pixel']);
    await page.screenshot({path:info.outputPath(`${name}-settings.png`)});
  });
}

test('media, icons, resource tabs and dialogs retain their protected styling under a light scheme',async({page},info)=>{
  await page.addInitScript(scheme=>{
    const w=window as any;w.isTauri=true;
    localStorage.setItem('chest-color-scheme-v1',JSON.stringify(scheme));
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en',homeShelves:['instances','screenshots','worlds','servers','explore']}));
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ9kAAAAASUVORK5CYII=';
    const instance={id:'theme-world',name:'Theme world',version:'1.21.4',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true};
    const world={instance_id:instance.id,folder:'Survival',name:'Survival',version:'1.21.4',data_version:null,last_played:null};
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string)=>{
      if(name==='get_config')return {instances:[instance],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_instance_icons')return {[instance.id]:'/chest.svg'};
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_instance_backgrounds')return [{kind:'provider',url:'/minecraft.png'}];
      if(name==='get_instance_files')return {worlds:['Survival'],servers:[{name:'Friends',ip:'example.test',icon:'/chest.svg'}],screenshots:['image.png']};
      if(name==='get_instance_worlds')return [world];
      if(name==='get_worlds')return {worlds:[world],unavailable:[]};
      if(name==='get_servers')return {servers:[{instance_id:instance.id,name:'Friends',address:'example.test',icon:'/chest.svg'}],unavailable:[]};
      if(name==='get_world_icon')return '/minecraft.png';
      if(name==='get_screenshots')return {screenshots:[{instance_id:instance.id,name:'image.png',modified:1}],unavailable:[]};
      if(name==='get_screenshot_image')return png;
      if(name==='get_content')return [{name:'example.jar',kind:'mods',enabled:true}];
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[{id:'example',title:'Theme example',author:'Author',description:'A project',icon:'/chest.svg',background:'/minecraft.png',downloads:1,url:'https://modrinth.com/mod/example'}],total:1};
      if(name==='get_instance_news')return {articles:[],unavailable:[]};
      return [];
    }};
  },light);
  await page.goto('/');
  const card=page.locator('.instance-card');
  await expect(card.locator('.shared-card-art img')).toHaveAttribute('src','/chest.svg');
  await expect(card.locator('.card-backdrop img.visible')).toHaveAttribute('src','/minecraft.png');
  const addIcon=page.getByRole('button',{name:'Create instance',exact:true}).locator('svg');
  await expect(addIcon.locator('path')).toHaveAttribute('shape-rendering','crispEdges');
  const geometry=await addIcon.evaluate(node=>({box:node.getAttribute('viewBox'),path:node.querySelector('path')!.getAttribute('d')}));
  expect(geometry.box).toBe('0 0 24 24');
  expect(await addIcon.evaluate(node=>getComputedStyle(node).color)).not.toBe('rgb(22, 78, 170)');
  await page.getByRole('button',{name:'Theme world: Ready to play',exact:true}).click();
  for(const tab of ['Overview','Contents','Worlds','Servers','Screenshots','Settings','Log']){
    await page.getByRole('tab',{name:tab,exact:true}).click();
    await expect(page.locator('.instance-content')).toHaveCSS('background-color','rgb(226, 231, 241)');
    expect(await page.locator('#main-content').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    if(tab==='Contents'){
      await expect(page.locator('.content-entry h3')).toHaveCSS('color','rgb(20, 32, 58)');
      const findings=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      expect(findings.violations.map(({id,nodes})=>({id,targets:nodes.map(node=>node.target)}))).toEqual([]);
    }
    if(tab==='Worlds'){
      await expect(page.locator('.world-card .shared-card-art img')).toHaveAttribute('src','/minecraft.png');
      const button=page.getByRole('button',{name:'Back up',exact:true});
      await expect(button).toHaveCSS('background-color','rgba(0, 0, 0, 0.8)');
      await page.locator('.world-card').screenshot({path:info.outputPath('light-world-card.png')});
    }
    if(tab==='Screenshots'){
      await page.locator('.screenshot-card').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCSS('background-color','rgb(255, 255, 255)');
      await page.keyboard.press('Escape');
    }
  }
  await settings(page);await importScheme(page,{version:1,name:'Pink text',mode:'light',colors:{...light.colors,'page-text':'#ff00ff'}});
  expect(await addIcon.evaluate(node=>({box:node.getAttribute('viewBox'),path:node.querySelector('path')!.getAttribute('d')}))).toEqual(geometry);
  expect(await addIcon.evaluate(node=>getComputedStyle(node).color)).not.toBe('rgb(255, 0, 255)');
  await page.locator('.settings-actions').getByRole('button',{name:'Discard',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Paper');
});

test('desktop import and export use native dialogs, preserve cancellation and export normalized JSON',async({page})=>{
  await page.addInitScript(scheme=>{
    const w=window as any;w.isTauri=true;w.__schemeFile={name:'chosen',source:JSON.stringify(scheme)};w.__exported=null;
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_config')return {instances:[],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_instance_icons')return {};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='import_color_scheme')return w.__schemeFile;
      if(name==='export_color_scheme'){w.__exported=args.source;return false;}
      return [];
    }};
  },light);
  await page.goto('/');await settings(page);
  await page.getByRole('button',{name:'Import scheme',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Paper');
  await page.getByRole('button',{name:'Export scheme',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse((window as any).__exported))).toMatchObject({version:2,name:'Paper',palettes:{light:{page:'#f3f5fb'}}});
  expect(await page.evaluate(()=>localStorage.getItem('chest-color-scheme-v1'))).toBeNull();
  await page.locator('.settings-actions').getByRole('button',{name:'Discard',exact:true}).click();
  await page.evaluate(()=>(window as any).__schemeFile=null);
  await page.getByRole('button',{name:'Import scheme',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme','Chest');
});
