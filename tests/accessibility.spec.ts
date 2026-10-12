import AxeBuilder from '@axe-core/playwright';
import {test, expect, type Page} from '@playwright/test';
import {finishCreation} from './creation-helpers';
async function audit(page:Page){
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
}
test('core pages and creation discard dialog meet automated accessibility rules',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();
  await expect(page.getByRole('heading',{name:/^Library/})).toBeVisible();await audit(page);
  await page.getByRole('button',{name:'Create instance',exact:true}).click();await audit(page);
  await page.getByLabel('Instance name').fill('Accessible world');
  await page.getByRole('button',{name:'Chest home'}).click();await expect(page.getByRole('dialog')).toBeVisible();await audit(page);
  await page.getByRole('button',{name:'Stay',exact:true}).click();await finishCreation(page);
  for(const name of ['Overview','Content','Versions','Settings','Log']){
    await page.getByRole('tab',{name,exact:true}).click();await audit(page);
  }
  await page.getByRole('button',{name:'Accounts and settings'}).click();await audit(page);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();await audit(page);
  await page.getByLabel('Language',{exact:true}).selectOption('ko');await audit(page);
});
test('skip link provides a keyboard route into the page',async({page})=>{
  await page.goto('/');await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.locator('main')).toBeFocused();
});
