import AxeBuilder from '@axe-core/playwright';
import {test,expect} from '@playwright/test';

for(const mode of ['dark','light'])test(`focused skip link uses readable ${mode} panel colors`,async({page,browserName})=>{
  await page.addInitScript(mode=>localStorage.setItem('chest-appearance-mode-v1',mode),mode);
  await page.goto('/');
  const link=page.getByRole('link',{name:'Skip to content'});
  await link.waitFor({state:'attached'});
  // WebKit's default macOS keyboard policy skips links; test their focused paint directly.
  if(browserName==='webkit')await link.focus();else await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  const violations=await new AxeBuilder({page}).include('.skip-link').withRules(['color-contrast']).analyze();
  expect(violations.violations).toEqual([]);
  await page.keyboard.press('Enter');await expect(page.locator('main')).toBeFocused();
});

for(const dir of ['ltr','rtl'])test(`sidebar focus ring is painted completely above adjacent tabs (${dir})`,async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({
    instances:Array.from({length:20},(_,i)=>({id:`i${i}`,name:`Instance ${i}`,version:'26.3',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true})),
    sidebar_groups:[{name:'Group',ids:['i1','i2'],collapsed:false}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096,
  })));
  await page.goto('/');await page.locator('.rail-item').first().waitFor();
  await page.evaluate(dir=>document.documentElement.dir=dir,dir);
  await page.keyboard.press('Tab');
  for(const index of [0,1,2,19]){
    const button=page.getByRole('button',{name:`Instance ${index}: Ready to play`,exact:true});
    if(index===2){await button.click();await page.keyboard.press('Tab');}
    await button.focus();await expect(button).toBeFocused();
    await button.scrollIntoViewIfNeeded();
    const box=(await button.boundingBox())!;
    const distance=await button.evaluate(n=>{const css=getComputedStyle(n);return parseFloat(css.outlineOffset)+parseFloat(css.outlineWidth)/2;});
    const screenshot=await page.screenshot({path:info.outputPath(`focus-${index}.png`)});
    const pixels=await page.evaluate(async({png,box,distance})=>{
      const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const context=canvas.getContext('2d')!;context.drawImage(image,0,0);
      const scale=image.width/innerWidth;
      return [[box.x-distance,box.y+box.height/2],[box.x+box.width+distance,box.y+box.height/2],[box.x+box.width/2,box.y-distance],[box.x+box.width/2,box.y+box.height+distance]].map(([x,y])=>Array.from(context.getImageData(Math.floor(x*scale),Math.floor(y*scale),1,1).data).slice(0,3));
    },{png:screenshot.toString('base64'),box,distance});
    const focus=await button.evaluate(node=>{
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!;
      ctx.fillStyle=getComputedStyle(node).outlineColor;ctx.fillRect(0,0,1,1);
      return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3);
    });
    expect(pixels,`Complete ring around instance ${index}`).toEqual([focus,focus,focus,focus]);
  }
});
