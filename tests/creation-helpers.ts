import type {Page} from '@playwright/test';
export async function finishCreation(page:Page){
  await page.getByRole('button',{name:'Create',exact:true}).last().click();
}
