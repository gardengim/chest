import {expect,type Locator,type Page} from '@playwright/test';

export async function expectMessageButtons(page:Page,message:Locator){
  await expect(message).toBeVisible();
  const background=await message.evaluate(node=>getComputedStyle(node).backgroundColor);
  const text=await message.evaluate(node=>getComputedStyle(node).color);
  for(const button of await message.getByRole('button').all()){
    await expect(button).toHaveAttribute('data-shape','button');
    await expect(button).toHaveCSS('border-style','solid');
    await expect(button).toHaveCSS('background-color',background);
    await expect(button).toHaveCSS('color',text);
    const hover=await button.evaluate(node=>{
      const probe=document.createElement('span');probe.style.backgroundColor=getComputedStyle(node).getPropertyValue('--button-hover');
      document.body.append(probe);const color=getComputedStyle(probe).backgroundColor;probe.remove();return color;
    });
    await button.hover();await expect(button).toHaveCSS('background-color',hover);
    await page.mouse.move(0,0);await expect(button).toHaveCSS('background-color',background);
  }
}
