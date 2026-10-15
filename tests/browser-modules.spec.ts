import {test,expect} from '@playwright/test';
// Browser-only source-module contracts; end-to-end flows use the production server.
test.use({baseURL:'http://127.0.0.1:1422'});

test('symbol renderer caches conversions, preserves SVG sources and branded artwork',async({page})=>{
  await page.goto('/');
  await expect.poll(()=>page.locator('svg[data-symbol="user"] path').getAttribute('shape-rendering')).toBe('crispEdges');
  const result=await page.evaluate(async()=>{
    const {pixelIcon,iconResolution}=await import('/src/pixel-icons.ts');
    const {symbols}=await import('/src/symbols.ts');
    const first=pixelIcon('worlds'),second=pixelIcon('worlds');
    const path=await first;
    return {cached:first===second,resolution:iconResolution,source:symbols.worlds,path,more:await pixelIcon('more'),empty:(await Promise.all(Object.keys(symbols).map(async name=>({name,path:await pixelIcon(name)})))).filter(icon=>!icon.path).map(icon=>icon.name)};
  });
  expect(result.cached).toBe(true);expect(result.resolution).toBe(24);expect(result.source).toMatch(/[aA]10 10/);expect(result.empty).toEqual([]);expect(result.path).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);expect(result.more).not.toBe('');
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
