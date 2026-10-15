import {test,expect} from '@playwright/test';
// Browser budgets are deliberately broad enough for shared CI runners. Native I/O
// is measured separately by core/examples/measure_library.rs.
for(const count of [100,500,1000])test(`${count}-instance library loads and filters within interaction budgets`,async({page},info)=>{
  await page.addInitScript(count=>{
    const w=window as any;w.isTauri=true;
    const config={instances:Array.from({length:count},(_,n)=>({id:`world-${n}`,name:`World ${String(n).padStart(4,'0')}`,version:'1.21.4',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:false})),accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
    w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(name:string)=>{
      if(name==='get_instance_files')return {worlds:[],servers:[],screenshots:[]};
      if(name==='get_launch_settings')return {width:854,height:480,fullscreen:false,account_id:null,java_args:[],game_args:[],environment:{},before_launch:[],after_exit:[],open_log:false};
      if(name==='take_instance_intent')return null;
      if(name==='get_config')return config;
      if(name==='get_activities'||name==='get_logs'||name==='get_news'||name==='get_instance_news')return [];
      if(name==='get_instance_icons')return {};
      if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
      if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
      if(name==='search_catalog')return {projects:[],total:0};
      return null;
    }};
  },count);
  const started=Date.now();await page.goto('/');await expect(page.locator('.instance-card')).toHaveCount(count);
  const loadMs=Date.now()-started;expect(loadMs).toBeLessThan(5000);
  const filterStart=Date.now();await page.getByLabel('Search instances').fill('World 0000');await expect(page.locator('.instance-card')).toHaveCount(1);
  const filterMs=Date.now()-filterStart;expect(filterMs).toBeLessThan(2000);
  await info.attach('timings.json',{body:JSON.stringify({count,loadMs,filterMs}),contentType:'application/json'});
});
