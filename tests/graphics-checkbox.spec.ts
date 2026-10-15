import {test,expect,type Page} from '@playwright/test';
async function fixture(page:Page){
  await page.addInitScript(()=>{
    localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:'en'}));
    if(!localStorage.getItem('chest-preview-v1'))localStorage.setItem('chest-preview-v1',JSON.stringify({instances:[
      {id:'modern',name:'Modern',version:'26.2',loader:'fabric',loader_version:'0.19.5',memory_mb:4096,java_path:'',artwork:'grass',installed:true},
      {id:'legacy',name:'Legacy',version:'1.21.4',loader:'vanilla',loader_version:'',memory_mb:4096,java_path:'',artwork:'grass',installed:true},
    ],accounts:[],active_account:null,client_id:'',java_path:'',memory_mb:4096}));
  });
  await page.goto('/');
}
test('graphics API persists per instance, gates older versions and restores the default',async({page})=>{
  await fixture(page);await page.getByRole('button',{name:'Modern: Ready to play',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  const form=page.locator('.launch-settings'),select=form.getByLabel('Graphics API',{exact:true});
  await expect(select).toHaveValue('default');await select.selectOption('vulkan');
  await expect(form).toContainText('Iris shader packs require OpenGL');
  await form.getByRole('button',{name:'Save',exact:true}).click();
  await expect(form.getByRole('status')).toHaveText('Saved');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-preview-v1')!).launch_settings.modern.graphics_api)).toBe('vulkan');
  await page.getByRole('button',{name:'Legacy: Ready to play',exact:true}).click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(select).toHaveValue('default');await expect(select.locator('option[value=vulkan]')).toHaveJSProperty('disabled',true);await expect(select.locator('option[value=open_gl]')).toHaveJSProperty('disabled',true);
  await expect(form).toContainText('Graphics API selection requires Minecraft 26.2 or later.');
  await page.reload();await page.getByRole('button',{name:'Modern: Ready to play',exact:true}).click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(select).toHaveValue('vulkan');await select.selectOption('open_gl');await form.getByRole('button',{name:'Save',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-preview-v1')!).launch_settings.modern.graphics_api)).toBe('open_gl');
  await select.selectOption('default');await form.getByRole('button',{name:'Save',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-preview-v1')!).launch_settings.modern.graphics_api)).toBe('default');
});

test('pixel checkboxes share styling, respond to keyboard and scale with text',async({page},testInfo)=>{
  await fixture(page);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  const checkbox=page.getByRole('checkbox',{name:'Reduce motion',exact:true});
  await expect(checkbox).toHaveCSS('appearance','none');await expect(checkbox).toHaveCSS('border-radius','0px');
  await checkbox.focus();await page.keyboard.press('Space');await expect(checkbox).toBeChecked();
  await expect(checkbox).toHaveCSS('outline-style','solid');
  expect(await checkbox.evaluate(node=>getComputedStyle(node,'::after').opacity)).toBe('1');
  expect(await checkbox.evaluate(node=>getComputedStyle(node,'::after').maskImage)).toContain('data:image/svg+xml');
  const normal=(await checkbox.boundingBox())!.width;
  await page.addStyleTag({content:'html{font-size:28px !important}'});
  expect((await checkbox.boundingBox())!.width/normal).toBeCloseTo(2,1);
  await checkbox.evaluate(node=>{(node as HTMLInputElement).checked=false;(node as HTMLInputElement).indeterminate=true;});
  expect(await checkbox.evaluate(node=>getComputedStyle(node,'::after').maskImage)).toBe('none');
  expect(await checkbox.evaluate(node=>getComputedStyle(node,'::after').opacity)).toBe('1');
  await checkbox.evaluate(node=>{(node as HTMLInputElement).indeterminate=false;(node as HTMLInputElement).disabled=true;});await expect(checkbox).toBeDisabled();await expect(checkbox).toHaveCSS('opacity','0.5');
  await page.emulateMedia({forcedColors:'active'});await expect(checkbox).toHaveCSS('border-top-style','solid');
  await page.emulateMedia({forcedColors:'none'});await page.addStyleTag({content:'html{font-size:87.5% !important}'});
  await page.getByRole('button',{name:'Modern: Ready to play',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Discard',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  const fullscreen=page.getByRole('checkbox',{name:'Fullscreen',exact:true});await expect(fullscreen).toHaveCSS('appearance','none');await fullscreen.check();
  await page.locator('.launch-settings').getByRole('button',{name:'Save',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-preview-v1')!).launch_settings.modern.fullscreen)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('pixel-checkboxes.png')});
});
