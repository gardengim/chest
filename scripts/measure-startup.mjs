// Offline production-browser workload; never opens the user's launcher profile.
import {chromium} from '@playwright/test';
import {parseArgs} from 'node:util';
import {writeFile} from 'node:fs/promises';
const {values}=parseArgs({options:{url:{type:'string'},samples:{type:'string',default:'7'},'ipc-delay':{type:'string',default:'0'},output:{type:'string'}}});
const url=new URL(values.url || 'http://127.0.0.1:1420');
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Use a local Vite preview server');
const samples=Number(values.samples),delay=Number(values['ipc-delay']);
if(!Number.isInteger(samples)||samples<1||samples>100||!Number.isFinite(delay)||delay<0||delay>5000)throw new Error('Invalid sample count or IPC delay');
const browser=await chromium.launch({headless:true,...(process.env.CHEST_BROWSER_EXECUTABLE?{executablePath:process.env.CHEST_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
const measurements=[];
try{
  for(let sample=0;sample<samples;sample++){
    const context=await browser.newContext({viewport:{width:1150,height:800}});
    try{
      const page=await context.newPage();
      await page.addInitScript(delay=>{
        const w=window;w.isTauri=true;
        const config={instances:Array.from({length:100},(_,n)=>({id:`world-${n}`,name:`World ${n}`,version:'1.21.4',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:false})),accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096};
        w.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async name=>{
          if(['get_config','get_debug_launch','get_instance_icons','get_activities','take_instance_intent'].includes(name))await new Promise(resolve=>setTimeout(resolve,delay));
          if(name==='get_config')return config;
          if(name==='get_debug_launch')return {available:false,enabled:false};
          if(name==='get_instance_icons')return {};
          if(['get_activities','get_instance_screenshots','get_news','get_instance_news'].includes(name))return [];
          if(name==='get_versions')return [{id:'1.21.4',type:'release'}];
          if(name==='get_catalog_sources')return {modrinth:true,curseforge:false};
          if(name==='search_catalog')return {projects:[],total:0};
          return null;
        }};
      },delay);
      // The load event can include deferred resources requested after the library
      // paints; begin observing at navigation commit instead.
      await page.goto(url.href,{waitUntil:'commit'});
      await page.waitForFunction(()=>document.querySelectorAll('.instance-card').length===100);
      const libraryReadyMs=await page.evaluate(()=>performance.now());
      await page.getByLabel('Search instances').fill('World 99');
      await page.waitForFunction(()=>document.querySelectorAll('.instance-card').length===1);
      const filteredMs=await page.evaluate(()=>performance.now());
      measurements.push({libraryReadyMs,filterMs:filteredMs-libraryReadyMs});
    }finally{await context.close();}
  }
}finally{await browser.close();}
const median=key=>measurements.map(sample=>sample[key]).sort((a,b)=>a-b)[Math.floor(samples/2)];
const result={url:url.href,samples,instances:100,injectedIpcDelayMs:delay,medianLibraryReadyMs:median('libraryReadyMs'),medianFilterMs:median('filterMs'),measurements};
if(values.output)await writeFile(values.output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
