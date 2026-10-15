import {settleFiniteAnimations} from './animation-helpers';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const language of [{code:'zh-Hans',settings:'设置',language:'语言',general:'常规',light:'浅色',cancel:'取消',discard:'放弃更改',save:'保存',title:'保存设置更改？'},{code:'zh-Hant',settings:'設定',language:'語言',general:'一般',light:'淺色',cancel:'取消',discard:'捨棄變更',save:'儲存',title:'儲存設定變更？'}]){
  test(`${language.code} settings and unsaved dialog remain accessible with enlarged text`,async({page},info)=>{
    await page.addInitScript(code=>localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({locale:code})),language.code);
    await page.goto('/');await page.getByRole('button',{name:language.settings,exact:true}).click();
    await page.getByRole('tab',{name:language.settings,exact:true}).click();
    await expect(page.getByRole('heading',{name:language.general,exact:true})).toBeVisible();
    await expect(page.getByRole('combobox',{name:language.language,exact:true})).toHaveValue(language.code);
    await page.getByRole('radio',{name:language.light,exact:true}).check();
    await settleFiniteAnimations(page);
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    await page.setViewportSize({width:320,height:640});await page.addStyleTag({content:'html{font-size:28px!important}'});
    expect(await page.locator('#main-content').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    await page.locator('.settings-actions').scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`${language.code}-settings.png`)});
    await page.getByRole('tab').first().click();
    const dialog=page.getByRole('dialog',{name:language.title,exact:true});
    await expect(dialog.getByRole('button')).toHaveText([language.cancel,language.discard,language.save]);
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    await dialog.screenshot({path:info.outputPath(`${language.code}-dialog.png`)});
  });
}
