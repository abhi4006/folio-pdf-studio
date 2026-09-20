import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:5178', browserName: 'chromium' },
  webServer: { command: 'npm run dev -- --port 5178', url: 'http://127.0.0.1:5178', reuseExistingServer: !process.env.CI },
});
