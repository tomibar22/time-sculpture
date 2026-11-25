import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    // the bars open on all their actions and the newcomer's hint is put away, so the specs reach
    // every button directly; e2e/calm.spec.ts checks the plain defaults on fresh storage
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:4173',
          localStorage: [
            { name: 'time-sculpture/prefs', value: '{"barMore":true,"hintSeen":true}' },
          ],
        },
      ],
    },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 900 } },
    },
    { name: 'iphone', use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium' } },
    { name: 'ipad', use: { ...devices['iPad Pro 11'], defaultBrowserType: 'chromium' } },
  ],
});
