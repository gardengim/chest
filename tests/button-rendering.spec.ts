import {test,expect,type Locator} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en'}));
    localStorage.setItem('chest-appearance-mode-v1','dark');
    localStorage.setItem('chest-preview-v1',JSON.stringify({instances:[{id:'world',name:'World',version:'1.21.4',loader:'fabric',loader_version:'0.19.5',artwork:'grass',memory_mb:4096,java_path:'',installed:true}],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096}));
  });
  await page.goto('/');
});

test('layout glyphs keep their intended size on Home and inside content tabs',async({page})=>{
  for(const name of ['Library layout','Project layout']){
    const control=page.getByRole('radiogroup',{name,exact:true});
    for(const icon of await control.locator('svg').all()){
      await expect(icon).toHaveCSS('width','24px');
      await expect(icon).toHaveCSS('height','24px');
    }
  }
  await page.getByRole('button',{name:'World: Ready to play',exact:true}).click();
  await page.getByRole('tab',{name:'Content',exact:true}).click();
  const control=page.getByRole('radiogroup',{name:'Content view',exact:true});
  await expect(control.locator('svg').first()).toHaveCSS('width','24px');
  await expect(page.locator('.content-tabs')).toHaveCSS('filter','none');
});

async function offsets(control:Locator){
  return control.evaluate(async node=>{
    const frames=[];
    for(let i=0;i<12;i++){
      await new Promise(requestAnimationFrame);
      const css=getComputedStyle(node);
      frames.push((parseFloat(css.top)||0)+(css.transform==='none'?0:new DOMMatrix(css.transform).m42));
    }
    return frames;
  });
}

test('button, radio and checkbox feedback never moves icons through fractional pixels',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  const check=async(control:Locator)=>{
    await page.mouse.move(0,0);
    await control.scrollIntoViewIfNeeded();
    const box=(await control.boundingBox())!;
    const sampling=offsets(control);
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    const hover=await sampling;
    expect(hover.every(value=>Number.isInteger(value))).toBe(true);
    expect(hover.at(-1)).toBe(-1);
    const pressing=offsets(control);await page.mouse.down();
    const pressed=await pressing;
    expect(pressed.every(value=>Number.isInteger(value))).toBe(true);
    expect(pressed.at(-1)).toBe(1);
    await page.mouse.move(0,0);await page.mouse.up();
  };
  await check(page.getByRole('button',{name:'Add',exact:true}));
  await check(page.getByRole('radiogroup',{name:'Library layout',exact:true}).getByRole('radio',{name:'List',exact:true}).locator('..'));
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await check(page.getByRole('checkbox',{name:'Double-click to launch',exact:true}));
});

test('hover and press preserve glyph pixels and the content panel shadow',async({page},info)=>{
  const ink=async(icon:Locator)=>{
    await expect(icon.locator('path').first()).toHaveAttribute('shape-rendering','crispEdges');
    const png=await icon.screenshot();
    return page.evaluate(async data=>{
      const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const context=canvas.getContext('2d')!;context.drawImage(image,0,0);
      const pixels=context.getImageData(0,0,image.width,image.height).data;
      return Array.from({length:image.width*image.height},(_,i)=>pixels[i*4]>180&&pixels[i*4+1]>180&&pixels[i*4+2]>180?1:0);
    },png.toString('base64'));
  };
  const check=async(control:Locator,name:string)=>{
    await page.mouse.move(0,0);await control.scrollIntoViewIfNeeded();
    const icon=control.locator('svg').first(),normal=await ink(icon);
    expect(normal.some(Boolean)).toBe(true);
    await control.hover();expect(await ink(icon)).toEqual(normal);
    await control.screenshot({path:info.outputPath(`${name}-hover.png`)});
    await page.mouse.down();expect(await ink(icon)).toEqual(normal);
    await page.mouse.move(0,0);await page.mouse.up();
  };
  await check(page.getByRole('button',{name:'Add',exact:true}),'add');
  await check(page.getByRole('radiogroup',{name:'Library layout',exact:true}).getByRole('radio',{name:'List',exact:true}).locator('..'),'home-switch');
  await check(page.getByRole('radiogroup',{name:'Project layout',exact:true}).getByRole('radio',{name:'List',exact:true}).locator('..'),'explore-switch');
  await page.getByRole('button',{name:'World: Ready to play',exact:true}).click();
  await page.getByRole('tab',{name:'Content',exact:true}).click();
  const panel=page.locator('.collection-panel');
  const shadow=await panel.evaluate(node=>getComputedStyle(node).boxShadow);
  await check(page.getByRole('radiogroup',{name:'Content view',exact:true}).getByRole('radio',{name:'Gallery',exact:true}).locator('..'),'content-switch');
  await expect(panel).toHaveCSS('box-shadow',shadow);
  await expect(page.locator('.content-tabs')).toHaveCSS('filter','none');
});
