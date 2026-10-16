import {readFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for(const colorScheme of ['light','dark'] as const)test(`callback page is readable and responsive in ${colorScheme}`,async({page},info)=>{
  await page.emulateMedia({colorScheme});await page.setViewportSize({width:320,height:640});
  // Core tests validate the exact close-script hash. Keep this visual check open.
  const html=(await readFile('core/src/auth-callback.html','utf8')).replace(/<script>.*?<\/script>/s,'');
  await page.setContent(html);
  await expect(page.getByRole('heading',{name:'Chest'})).toBeVisible();
  await expect(page.getByText('You can return to Chest and close this tab.')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:info.outputPath(`callback-${colorScheme}.png`)});
});
