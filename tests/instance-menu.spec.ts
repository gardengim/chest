import {test,expect} from '@playwright/test';

test('sidebar left click opens the instance and right click opens its menu, act on their instance, and dismiss by keyboard or outside click',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({instances:[
    {id:'survival',name:'Survival',version:'1.21.4',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:true},
    {id:'creative',name:'Creative',version:'1.21.4',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:false}
  ],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096})));
  await page.reload();
  const survival=page.getByRole('button',{name:'Survival: Ready to play',exact:true});
  const creative=page.getByRole('button',{name:'Creative: Not installed',exact:true});
  await survival.click();
  await expect(page.locator('.instance-hero')).toContainText('Survival');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('button',{name:'Chest home'}).click();
  await survival.click({button:'right'});
  await expect(page.getByRole('menu',{name:'Survival actions'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Instances 2'})).toBeVisible();
  await expect(page.getByRole('menuitem',{name:'Launch'})).toBeEnabled();
  await expect(page.getByRole('menuitem',{name:'Open folder'})).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);await expect(survival).toBeFocused();
  await creative.click({button:'right'});
  await expect(page.getByRole('menu',{name:'Creative actions'})).toBeVisible();
  await page.getByRole('menuitem',{name:'Duplicate',exact:true}).click();
  await expect(page.locator('.instance-hero')).toContainText('Creative copy');
  await survival.click({button:'right'});await page.getByRole('menuitem',{name:'Delete',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Delete Survival?');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await creative.focus();await creative.press('ArrowDown');
  await expect(page.getByRole('menuitem',{name:'Open',exact:true})).toBeFocused();
  await page.keyboard.press('End');await expect(page.getByRole('menuitem',{name:'Delete',exact:true})).toBeFocused();
  await page.keyboard.press('Home');await page.keyboard.press('Enter');
  await expect(page.locator('.instance-hero')).toContainText('Creative');
  await survival.click({button:'right'});await page.getByRole('button',{name:'Chest home'}).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.setViewportSize({width:700,height:650});await creative.click({button:'right'});
  const bounds=await page.getByRole('menu').boundingBox();expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(700);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(650);
});

test('library cards and their media areas open the instance menu in gallery and list layouts',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('chest-preview-v1',JSON.stringify({instances:[
    {id:'world',name:'World',version:'26.3',loader:'vanilla',loader_version:'',artwork:'grass',memory_mb:4096,java_path:'',installed:true}
  ],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096})));
  await page.reload();
  await page.evaluate(()=>document.addEventListener('contextmenu',event=>{(window as any).__contextPrevented=event.defaultPrevented;}));
  const card=page.locator('.instance-card');
  await card.locator('.shared-card-art').click({button:'right'});
  const menu=page.getByRole('menu',{name:'World actions'});
  await expect(menu).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__contextPrevented)).toBe(true);
  await expect(page.getByRole('heading',{name:'Instances 1',exact:true})).toBeVisible();
  await expect(card).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');
  await expect(card).toBeFocused();
  await card.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Settings',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await page.getByRole('radiogroup',{name:'Library layout'}).getByRole('radio',{name:'List',exact:true}).click();
  await card.click({button:'right'});
  await expect(menu).toBeVisible();
  await page.getByRole('menuitem',{name:'Delete',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Delete World?');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(card).toBeVisible();
});

test('native context menus are suppressed except in text fields',async({page})=>{
  await page.goto('/');
  const prevented=await page.evaluate(()=>{
    function check(node:Element){
      const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});
      node.dispatchEvent(event);return event.defaultPrevented;
    }
    const surfaces=['div','img','a','button'].map(tag=>{
      const node=document.createElement(tag);document.body.append(node);
      const result=check(node);node.remove();return result;
    });
    const fields=['text','search','email','url','tel','password','number','checkbox','file'].map(type=>{
      const node=document.createElement('input');node.type=type;document.body.append(node);
      const result=check(node);node.remove();return result;
    });
    const textarea=document.createElement('textarea');document.body.append(textarea);
    const multiline=check(textarea);textarea.remove();
    const readonly=document.createElement('input');readonly.readOnly=true;document.body.append(readonly);
    const path=check(readonly);readonly.remove();
    const editable=document.createElement('div');editable.contentEditable='true';
    const child=document.createElement('span');editable.append(child);document.body.append(editable);
    const richtext=check(child);editable.remove();
    return {surfaces,fields,multiline,path,richtext};
  });
  expect(prevented).toEqual({surfaces:[true,true,true,true],fields:[false,false,false,false,false,false,false,true,true],multiline:false,path:false,richtext:false});
});
