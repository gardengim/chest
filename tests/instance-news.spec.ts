import {test,expect} from '@playwright/test';

test('news combines sources, scopes updates to installed instances, and retries partial failures',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;w.__checks=[];let failed=true;
    const instances=['A','B','Draft'].map(id=>({id,name:id,version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:id!=='Draft'}));
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string,args:any)=>{
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      if(name==='get_config')return {instances,accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_versions')return [{id:'26.3',type:'release'}];
      if(name==='get_instance_icons')return {};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='get_news')return [{title:'Minecraft article',date:'2026-10-01',url:'https://www.minecraft.net/article/news'}];
      if(name==='get_instance_news'){
        w.__checks.push(args.id);
        const problem=args.id==='B' && failed;failed=problem?false:failed;
        return {articles:[{title:args.id==='A'?'Pack 2.0':'Fabric 0.19.5',date:args.id==='A'?'2026-10-02':'',url:args.id==='A'?'https://modrinth.com/modpack/pack/version/new':'https://fabricmc.net/use/installer/',source:args.id==='A'?'Modrinth':'Fabric',instance_id:args.id}],unavailable:problem?['Modpack']:[]};
      }
      if(name==='open_news'){w.__opened=args.url;return;}
      return [];
    }};
  });
  await page.goto('/');
  await expect(page.locator('.news-item')).toHaveCount(3);
  await expect(page.locator('.news-panel')).toContainText('A · Pack 2.0');
  await expect(page.locator('.news-panel')).toContainText('B · Fabric 0.19.5');
  await expect(page.locator('.news-source').filter({hasText:'Modrinth'})).toHaveCount(1);
  await expect(page.locator('.news-source').filter({hasText:'Fabric'})).toHaveCount(1);
  await expect(page.locator('.news-panel')).toContainText('Updates unavailable for B');
  expect(await page.evaluate(()=>(window as any).__checks)).not.toContain('Draft');
  await page.locator('.news-panel').getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.locator('.news-panel')).not.toContainText('Updates unavailable');
  await page.getByRole('button',{name:/A · Pack 2.0/}).click();
  expect(await page.evaluate(()=>(window as any).__opened)).toBe('https://modrinth.com/modpack/pack/version/new');
  await page.getByRole('button',{name:'A: Ready to play',exact:true}).click();
  await expect(page.locator('.news-item')).toHaveCount(2);
  await expect(page.locator('.news-panel')).toContainText('A · Pack 2.0');
  await expect(page.locator('.news-panel')).not.toContainText('B · Fabric');
  await page.getByRole('button',{name:'B: Ready to play',exact:true}).click();
  await expect(page.locator('.news-panel')).toContainText('B · Fabric');
  await expect(page.locator('.news-panel')).not.toContainText('A · Pack');
  expect(await page.locator('.news-panel').textContent()).not.toMatch(/1970|Invalid Date/);
});

test('instance updates survive a failed official news feed',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.isTauri=true;
    const instance={id:'A',name:'A',version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true};
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string)=>{
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      if(name==='get_config')return {instances:[instance],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
      if(name==='get_versions')return [{id:'26.3',type:'release'}];
      if(name==='get_instance_icons')return {};
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      if(name==='get_news')throw new Error('offline');
      if(name==='get_instance_news')return {articles:[{title:'Pack 2.0',date:'2026-10-02',url:'https://modrinth.com/modpack/pack/version/new',source:'Modrinth',instance_id:'A'}],unavailable:[]};
      return [];
    }};
  });
  await page.goto('/');
  await expect(page.locator('.news-panel')).toContainText('News unavailable');
  await expect(page.locator('.news-item')).toHaveCount(1);
  await expect(page.locator('.news-item')).toContainText('Pack 2.0');
});
