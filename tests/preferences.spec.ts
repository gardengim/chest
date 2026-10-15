import {test,expect} from '@playwright/test';

test('Korean preferences persist, translate navigation, and keep instance data unchanged',async({page})=>{
  await page.goto('/');await page.evaluate(()=>{localStorage.clear();localStorage.setItem('chest-ui-preferences-v1',JSON.stringify({theme:'light',locale:'en'}));});await page.reload();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Theme',{exact:true})).toHaveCount(0);
  expect(await page.locator('html').evaluate(node=>getComputedStyle(node).colorScheme)).toBe('dark');
  await page.getByLabel('Language',{exact:true}).selectOption('ko');
    await page.locator('.settings-actions button[type=submit]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','ko');
  await expect(page.getByRole('heading',{name:'설정',exact:true})).toBeVisible();
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
  await page.getByRole('button',{name:'설정',exact:true}).click();
  await page.getByRole('tab',{name:'설정',exact:true}).click();
  await page.getByLabel('언어',{exact:true}).selectOption('en');
    await page.locator('.settings-actions button[type=submit]').click();
  await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
  await page.emulateMedia({colorScheme:'light'});
  expect(await page.locator('html').evaluate(node=>getComputedStyle(node).colorScheme)).toBe('dark');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-ui-preferences-v1')!))).toEqual({locale:'en'});
});

test('Empty news keeps its heading outside the panel and hides unused pagination',async({page})=>{
  await page.goto('/');
  const section=page.locator('.news-section');
  await expect(section.locator(':scope > h2')).toHaveText('News');
  await expect(section.locator('.news-panel h2')).toHaveCount(0);
  await expect(section.getByRole('navigation',{name:'News pages'})).toHaveCount(0);
  await expect(page.locator('.catalog-card')).toHaveCount(6);
  await expect(page.locator('.catalog-card').getByText('Details',{exact:true})).toHaveCount(0);
});

for(const language of [
  {code:'es',settings:'Ajustes',language:'Idioma',create:'Crear instancia',newInstance:'Nueva instancia',name:'Nombre de la instancia',submit:'Crear',overview:'Resumen',log:'Registro',content:'Contenido',search:'Buscar contenido',empty:'Sin contenido'},
  {code:'ja',settings:'設定',language:'言語',create:'インスタンスを作成',newInstance:'新しいインスタンス',name:'インスタンス名',submit:'作成',overview:'概要',log:'ログ',content:'コンテンツ',search:'コンテンツを検索',empty:'コンテンツなし'},
  {code:'zh-Hans',settings:'设置',language:'语言',create:'创建实例',newInstance:'新建实例',name:'实例名称',submit:'创建',overview:'概览',log:'日志',content:'内容',search:'搜索内容',empty:'暂无内容'},
  {code:'zh-Hant',settings:'設定',language:'語言',create:'建立實例',newInstance:'新增實例',name:'實例名稱',submit:'建立',overview:'概覽',log:'記錄',content:'內容',search:'搜尋內容',empty:'沒有內容'}
]){
  test(`${language.code} translates creation and content, persists, and preserves user names`,async({page},testInfo)=>{
    await page.goto('/');
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.getByRole('tab',{name:'Settings',exact:true}).click();
    await page.getByLabel('Language',{exact:true}).selectOption(language.code);
    await page.locator('.settings-actions button[type=submit]').click();
    await expect(page.locator('html')).toHaveAttribute('lang',language.code);
    await expect(page.getByRole('heading',{name:language.settings,exact:true})).toBeVisible();
    await expect(page.getByLabel(language.language,{exact:true})).toHaveValue(language.code);
    await page.getByRole('button',{name:language.create,exact:true}).click();
    await expect(page.getByRole('heading',{name:language.newInstance,exact:true})).toBeVisible();
    await page.getByLabel(language.name,{exact:true}).fill('My World 世界');
    await page.getByRole('button',{name:language.submit,exact:true}).click();
    await expect(page.locator('.instance-hero h1')).toHaveText('My World 世界');
    await expect(page.getByRole('tab',{name:language.overview,exact:true})).toHaveAttribute('aria-selected','true');
    await expect(page.getByRole('tab',{name:language.log,exact:true})).toBeVisible();
    await page.getByRole('tab',{name:language.content,exact:true}).click();
    await expect(page.getByLabel(language.search,{exact:true})).toBeVisible();
    await expect(page.getByText(language.empty,{exact:true})).toBeVisible();
    await page.setViewportSize({width:600,height:800});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(600);
    await page.screenshot({path:testInfo.outputPath(`${language.code}-content.png`),fullPage:true});
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang',language.code);
    await page.getByRole('button',{name:language.settings,exact:true}).click();
    await page.getByRole('tab',{name:language.settings,exact:true}).click();
    await page.getByLabel(language.language,{exact:true}).selectOption('en');
    await page.locator('.settings-actions button[type=submit]').click();
    await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
    const config=await page.evaluate(()=>JSON.parse(localStorage.getItem('chest-preview-v1')!));
    expect(config.instances[0].name).toBe('My World 世界');
  });
}

test.describe('browser language detection',()=>{
  test.use({locale:'es-MX'});
  test('regional Spanish defaults to Spanish and an explicit English choice wins after reload',async({page})=>{
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang','es');
    await expect(page.getByRole('heading',{name:/^Instancias/})).toBeVisible();
    await page.getByRole('button',{name:'Ajustes',exact:true}).click();
    await page.getByRole('tab',{name:'Ajustes',exact:true}).click();
    await page.getByLabel('Idioma',{exact:true}).selectOption('en');
    await page.locator('.settings-actions button[type=submit]').click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    await expect(page.getByRole('heading',{name:/^Instances/})).toBeVisible();
  });
});

for(const variant of [{locale:'zh-CN',script:'zh-Hans',settings:'设置'},{locale:'zh-TW',script:'zh-Hant',settings:'設定'},{locale:'zh-HK',script:'zh-Hant',settings:'設定'}]){
  test.describe(`Chinese language detection: ${variant.locale}`,()=>{
    test.use({locale:variant.locale});
    test('detects the correct script and respects a saved override',async({page})=>{
      await page.goto('/');await expect(page.locator('html')).toHaveAttribute('lang',variant.script);
      await page.getByRole('button',{name:variant.settings,exact:true}).click();
      await page.getByRole('tab',{name:variant.settings,exact:true}).click();
      const alternate=variant.script==='zh-Hans'?'zh-Hant':'zh-Hans';
      await page.getByRole('combobox',{name:variant.script==='zh-Hans'?'语言':'語言',exact:true}).selectOption(alternate);
      await page.locator('.settings-actions button[type=submit]').click();await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang',alternate);
    });
  });
}
