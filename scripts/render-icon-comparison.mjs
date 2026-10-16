import {chromium} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({executablePath:process.env.CHEST_BROWSER_EXECUTABLE || undefined});
try{
  const page=await browser.newPage({viewport:{width:832,height:700},deviceScaleFactor:2});
  await page.goto(new URL('../docs/design/chest-icon-comparison.html',import.meta.url).href);
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  await page.screenshot({path:fileURLToPath(new URL('../docs/design/chest-icon-comparison.png',import.meta.url)),fullPage:true});
}finally{await browser.close();}
