import {test,expect} from '@playwright/test';

test('Korean preferences persist, translate navigation, and keep instance data unchanged',async({page})=>{
  await page.goto('/');await page.evaluate(()=>{localStorage.clear();localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({theme:'light',locale:'en'}));});await page.reload();
  await page.getByRole('button',{name:'Accounts and settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Theme',{exact:true})).toHaveCount(0);
  expect(await page.locator('html').evaluate(node=>getComputedStyle(node).colorScheme)).toBe('dark');
  await page.getByLabel('Language',{exact:true}).selectOption('ko');
  await expect(page.locator('html')).toHaveAttribute('lang','ko');
  await expect(page.getByRole('heading',{name:'계정 및 설정',exact:true})).toBeVisible();
  await expect(page.getByRole('tab',{name:'설정',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'인스턴스 만들기',exact:true}).click();
  await expect(page.getByRole('heading',{name:'새 인스턴스',exact:true})).toBeVisible();
  await expect(page.getByRole('tab',{name:'사용자 지정',exact:true})).toHaveAttribute('aria-controls','create-panel-Custom');
  await page.getByLabel('인스턴스 이름',{exact:true}).fill('Overview');
  await page.getByRole('button',{name:'만들기',exact:true}).click();
  await expect(page.locator('.instance-hero h1')).toHaveText('Overview');
  await expect(page.getByRole('tab',{name:'개요',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tab',{name:'로그',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','ko');
  await page.getByRole('button',{name:'계정 및 설정',exact:true}).click();
  await page.getByRole('tab',{name:'설정',exact:true}).click();
  await page.getByLabel('언어',{exact:true}).selectOption('en');
  await expect(page.getByRole('heading',{name:'Accounts & settings',exact:true})).toBeVisible();
  await page.emulateMedia({colorScheme:'light'});
  expect(await page.locator('html').evaluate(node=>getComputedStyle(node).colorScheme)).toBe('dark');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-ui-preferences-v1')!))).toEqual({locale:'en'});
});

test('News heading sits outside its panel, pagination follows the list, and cards omit Details',async({page})=>{
  await page.goto('/');
  const section=page.locator('.news-section');
  await expect(section.locator(':scope > h2')).toHaveText('News');
  await expect(section.locator('.news-panel h2')).toHaveCount(0);
  const panel=await section.locator('.news-panel').boundingBox();
  const more=await section.getByRole('navigation',{name:'News pages'}).boundingBox();
  expect(more!.y).toBeGreaterThanOrEqual(panel!.y+panel!.height);
  await expect(page.locator('.catalog-card')).toHaveCount(6);
  await expect(page.locator('.catalog-card').getByText('Details',{exact:true})).toHaveCount(0);
});
