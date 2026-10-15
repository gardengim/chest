import {test,expect} from '@playwright/test';
import {finishCreation} from './creation-helpers';

for (const [loader,label,version] of [['forge','Forge','54.1.0'],['neoforge','NeoForge','21.4.100']]) {
  test(`${label} creation persists the loader and switching loader invalidates installation`,async({page})=>{
    await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();
    await page.getByRole('button',{name:'Create instance',exact:true}).click();
    await page.locator('.custom-instance').getByLabel('Minecraft version').selectOption('1.21.4');
    await page.getByRole('combobox',{name:'Mod loader',exact:true}).selectOption(loader);
    await expect(page.getByRole('combobox',{name:new RegExp(`^${label} loader version`)})).toHaveValue(version);
    await finishCreation(page);
    await expect(page.locator('.instance-hero')).toContainText(`${label} ${version}`);
    await page.reload();
    await page.getByRole('button',{name:new RegExp(`${label} 1.21.4: Not installed`)}).click();
    await expect(page.locator('.instance-hero')).toContainText(`${label} ${version}`);
    await page.getByRole('tab',{name:'Versions',exact:true}).click();
    await page.getByRole('combobox',{name:'Mod loader',exact:true}).selectOption('fabric');
    await page.getByRole('button',{name:'Save',exact:true}).click();
    const instances=await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-preview-v1')!).instances);
    expect(instances[0]).toMatchObject({loader:'fabric',loader_version:'0.16.10',installed:false});
  });
}
