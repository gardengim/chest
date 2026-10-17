import {test,expect} from '@playwright/test';
// Browser-only source-module contracts; end-to-end flows use the production server.
test.use({baseURL:'http://127.0.0.1:1422'});

test('symbol renderer uses native pixel SVGs and preserves branded artwork',async({page})=>{
  await page.goto('/');
  await expect(page.locator('svg[data-symbol="person"]').first()).toHaveAttribute('shape-rendering','crispEdges');
  const result=await page.evaluate(async()=>{
    const {symbols,symbolBody}=await import('/src/symbols.ts');
    return {empty:Object.keys(symbols).filter(name=>!/<(?:path|rect)\b/.test(symbolBody(name))),fallback:symbolBody('unknown')==='',goto:symbolBody('arrow-bend-right'),sources:Object.values(symbols)};
  });
  expect(result.empty).toEqual([]);expect(result.fallback).toBe(true);expect(result.goto).toContain('currentColor');
  for(const source of result.sources){expect(source).toContain('crispEdges');expect(source).not.toContain('stroke=');}
  await expect(page.locator('.chest img')).toHaveAttribute('src','/chest.svg');
});

test('artwork cache shares pending work, retries failures and evicts by byte budget',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const path='/src/card-artwork.ts';const {loadCardArtwork}=await import(path);
    let calls=0;
    const small=()=>{calls++;return Promise.resolve('/chest.svg');};
    const shared=await Promise.all([loadCardArtwork('audit:shared',small),loadCardArtwork('audit:shared',small)]);
    const sharedCalls=calls;
    await loadCardArtwork('audit:failed',()=>{calls++;return Promise.reject(new Error('Transient'));});
    await loadCardArtwork('audit:failed',small);
    const retryCalls=calls-sharedCalls;
    let largeCalls=0;
    const large=()=>{largeCalls++;return Promise.resolve('x'.repeat(5*1024*1024));};
    await loadCardArtwork('audit:large-a',large);
    await loadCardArtwork('audit:large-b',large);
    await loadCardArtwork('audit:large-a',large);
    return {shared,sharedCalls,retryCalls,largeCalls};
  });
  expect(result).toEqual({shared:['/chest.svg','/chest.svg'],sharedCalls:1,retryCalls:2,largeCalls:3});
});

test('rich renderer removes active markup, unsafe URLs and provider styles while preserving useful structure',async({page})=>{
  await page.goto('/');
  const clean=await page.evaluate(async()=>{
    const path='/src/rich-description.ts';const {renderDescription}=await import(path);
    const body='<script>window.__unsafe=true</script><style>body{display:none}</style><svg onload="alert(1)"></svg><form><input></form><p id="main-content" class="modal" style="color:red">Safe</p><a href="javascript:alert(1)">Bad</a><img src="data:image/svg+xml,x" onerror="alert(1)" alt="Blocked"><iframe src="https://www.youtube.com/embed/test"></iframe><iframe src="javascript:alert(1)"></iframe><pre>'+('long'.repeat(500))+'</pre><table><tr><td>Cell</td></tr></table>';
    const output=renderDescription({format:'html',body},'https://modrinth.com/mod/test','Open video');
    const node=document.createElement('div');node.innerHTML=output;
    return {unsafe:node.querySelectorAll('script,style,svg,form,input,iframe,[style],[id],[class="modal"],[onerror]').length,links:Array.from(node.querySelectorAll('a')).map((a:any)=>a.getAttribute('href')),embed:node.textContent?.includes('Open video'),table:node.querySelectorAll('.rich-table-scroll table').length};
  });
  expect(clean.unsafe).toBe(0);expect(clean.links).toEqual([null,'https://www.youtube.com/embed/test']);expect(clean.embed).toBe(true);expect(clean.table).toBe(1);
});


test('canonical Minecraft artwork is inlined in development as well as production',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {minecraftArtwork}=await import('/src/builtin-artwork.ts');
    const image=new Image();image.src=minecraftArtwork;await image.decode();
    return {inline:minecraftArtwork.startsWith('data:image/png;base64,'),width:image.naturalWidth};
  });
  expect(result).toEqual({inline:true,width:256});
});


test('relative world times handle plural units, invalid timestamps, clock skew and every locale',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {relativeTime}=await import('/src/relative-time.ts');const now=1800000000000;
    return {hours:[1,2].map(hours=>relativeTime(now-hours*3600000,'en',now)),day:relativeTime(now-86400000,'en',now),invalid:relativeTime(NaN,'en',now),future:relativeTime(now+60000,'en',now),localized:['ko','es','ja','zh-Hans','zh-Hant','ar'].map(locale=>({locale,text:relativeTime(now-86400000,locale,now),expected:new Intl.RelativeTimeFormat(locale,{numeric:'always'}).format(-1,'day')}))};
  });
  expect(result.hours).toEqual(['1 hour ago','2 hours ago']);expect(result.day).toBe('1 day ago');expect(result.invalid).toBe('');expect(result.future).toBe('now');
  for(const entry of result.localized)expect(entry.text).toBe(entry.expected);
});
