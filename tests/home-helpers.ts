import {expect,type Page} from '@playwright/test';
export async function openHomeTool(page:Page,name:string){
  const dock=page.getByRole('navigation',{name:'Home sections',exact:true});
  if(!await dock.count())await page.getByRole('button',{name:'Chest home',exact:true}).click();
  await expect(dock).toBeVisible();
  const button=dock.getByRole('button',{name,exact:true});
  if(!await button.isVisible())await dock.getByRole('button',{name:'More',exact:true}).click();
  await button.click();
}
