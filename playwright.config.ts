import {defineConfig} from '@playwright/test';
const baseURL='http://127.0.0.1:1421';
export default defineConfig({
  workers:2,
  testDir:'tests',
  testMatch:'*.spec.ts',
  use:{
    baseURL,
    headless:true,
    trace:'retain-on-failure',
    viewport:{width:1150,height:800},
    launchOptions:process.env.CHEST_BROWSER_EXECUTABLE?{
      executablePath:process.env.CHEST_BROWSER_EXECUTABLE,
      args:['--no-sandbox','--disable-dev-shm-usage'],
    }:{},
  },
  webServer:[
    {
      command:'npm run build && npx vite preview --host 127.0.0.1 --port 1421 --strictPort',
      url:baseURL,
      reuseExistingServer:false,
    },
    // The isolated canvas-module contract imports source directly; UI flows
    // above use only built assets and cannot be invalidated by dev optimization.
    {
      command:'npm run dev -- --port 1422',
      url:'http://127.0.0.1:1422',
      reuseExistingServer:false,
    },
  ],
  reporter:'list',
});
