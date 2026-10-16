import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

const APP_SECRET = 'e2e-app-secret';
const VERIFY_TOKEN = 'e2e-verify-token';
const CRON_SECRET = 'e2e-cron-secret';

test('unauthenticated visit to the dashboard goes to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await page.screenshot({ path: 'test-results/login-redirect.png', fullPage: true });
});

test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await page.screenshot({ path: 'test-results/login.png', fullPage: true });
});

test('forgot password page renders', async ({ page }) => {
  await page.goto('/auth/forgot');
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await page.screenshot({ path: 'test-results/forgot.png', fullPage: true });
});

test('health endpoint reports service status without secret values', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBeLessThan(600);
  const body = await res.json();
  expect(body).toHaveProperty('whatsappCloud');
  expect(body).toHaveProperty('gemini');
  expect(JSON.stringify(body)).not.toContain(APP_SECRET);
  expect(JSON.stringify(body)).not.toContain(VERIFY_TOKEN);
});

test('webhook handshake succeeds with the right token', async ({ request }) => {
  const res = await request.get(
    `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345`,
  );
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe('12345');
});

test('webhook handshake is refused with a wrong token', async ({ request }) => {
  const res = await request.get('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345');
  expect(res.status()).toBe(403);
});

test('webhook POST with a bad signature is refused', async ({ request }) => {
  const res = await request.post('/api/whatsapp/webhook', {
    data: { object: 'whatsapp_business_account', entry: [] },
    headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
  });
  expect(res.status()).toBe(401);
});

test('webhook POST with a valid signature is accepted', async ({ request }) => {
  const raw = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  const sig = 'sha256=' + createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  const res = await request.post('/api/whatsapp/webhook', {
    data: raw,
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
  });
  expect(res.status()).toBe(200);
});

test('cron tick without the secret is refused', async ({ request }) => {
  const res = await request.get('/api/cron/tick');
  expect(res.status()).toBe(401);
});

test('cron tick with the wrong secret is refused', async ({ request }) => {
  const res = await request.get('/api/cron/tick', { headers: { authorization: 'Bearer nope' } });
  expect(res.status()).toBe(401);
  expect(CRON_SECRET).not.toBe('nope');
});
