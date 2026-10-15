import {finishCreation} from './creation-helpers';
import {test,expect} from '@playwright/test';

test('shared dropdown supports pointer choice, keyboard navigation, typeahead, and dismissal',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Create instance',exact:true}).click();
  const loader=page.getByRole('combobox',{name:'Mod loader',exact:true});
  await loader.click();
  const menu=page.getByRole('listbox',{name:'Available choices',exact:true});
  await expect(menu).toBeVisible();
  await menu.getByRole('option',{name:'Fabric',exact:true}).click();
  await expect(loader).toHaveValue('fabric');
  await expect(menu).not.toBeVisible();
  await expect(loader).toBeFocused();
  await loader.press('ArrowDown');
  await loader.press('End');
  await loader.press('Enter');
  await expect(loader).toHaveValue('neoforge');
  await loader.press('Space');
  await loader.press('v');
  await loader.press('Enter');
  await expect(loader).toHaveValue('vanilla');
  await loader.click();
  await loader.press('Escape');
  await expect(menu).not.toBeVisible();
  await expect(loader).toBeFocused();
  await loader.click();
  await page.getByRole('heading',{name:'Game and mod loader'}).click();
  await expect(menu).not.toBeVisible();
  // Required native form controls still validate and callers still receive changes.
  await page.getByLabel('Instance name',{exact:true}).fill('Dropdown world');
  await finishCreation(page);
  await expect(page.getByRole('heading',{name:'Dropdown world',exact:true})).toBeVisible();
});
