import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
// Use the preinstalled Chromium when present; otherwise Playwright's own browser.
const CHROMIUM = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './e2e',
  testIgnore: /signed-in\.spec\.ts/,
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    screenshot: 'on',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CI ? undefined : CHROMIUM },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      MESSAGING_TRANSPORT: 'web',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service',
      APP_URL: BASE_URL,
      CRON_SECRET: 'e2e-cron-secret',
      WHATSAPP_VERIFY_TOKEN: 'e2e-verify-token',
      WHATSAPP_APP_SECRET: 'e2e-app-secret',
      WHATSAPP_PHONE_NUMBER_ID: 'e2e-phone',
      WHATSAPP_ACCESS_TOKEN: 'e2e-token',
    },
  },
});
