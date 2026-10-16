import { defineConfig, devices } from '@playwright/test';

// Signed-in tests. The harness (supabase/tests/api/run.sh) builds the app against the local API
// and starts it; this config only runs the browser tests against that running server.
const CHROMIUM = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './e2e',
  testMatch: /signed-in\.spec\.ts/,
  timeout: 45_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/signed-in',
  use: {
    baseURL: process.env.ARCHFLOW_APP_URL ?? 'http://127.0.0.1:3500',
    screenshot: 'on',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CI ? undefined : CHROMIUM },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
