/**
 * Signed-in pages against the local database (PostgREST) with the stub Auth gateway.
 * Owner = firm admin. Client = client user of organisation "Client Org Test".
 * Run through supabase/tests/api/run.sh, which seeds the data and sets the environment.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const OWNER = '11111111-1111-4111-8111-111111111111';
const CLIENT = '33333333-3333-4333-8333-333333333333';
const PDF_FILE = '99999999-9999-4999-8999-999999999999';
const CAD_FILE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLASH = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const API = process.env.ARCHFLOW_API_URL ?? 'http://127.0.0.1:3401';
const SVC = process.env.ARCHFLOW_SERVICE_KEY ?? '';

function sessionCookieValue(userId: string, email: string): string {
  const session = {
    access_token: `stub.${userId}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'stub-refresh',
    user: { id: userId, email, aud: 'authenticated', role: 'authenticated' },
  };
  return `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
}

async function signIn(context: BrowserContext, userId: string, email: string) {
  const ref = new URL(API).hostname.split('.')[0];
  await context.addCookies([{ name: `sb-${ref}-auth-token`, value: sessionCookieValue(userId, email), domain: '127.0.0.1', path: '/' }]);
}

async function setOrgCadAllowed(allowed: boolean) {
  const res = await fetch(`${API}/rest/v1/client_orgs?id=eq.44444444-4444-4444-8444-444444444444`, {
    method: 'PATCH',
    headers: { apikey: SVC, authorization: `Bearer ${SVC}`, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ allow_aps_processing: allowed }),
  });
  if (!res.ok) throw new Error(`could not update client org: ${res.status}`);
}

async function openSignedIn(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test.describe('owner (firm admin)', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, OWNER, 'owner@test.local');
  });

  test('dashboard loads for the owner, not the login page', async ({ page }) => {
    await openSignedIn(page, '/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.screenshot({ path: 'artifacts/signed-in/owner-dashboard.png', fullPage: true });
  });

  test('sheet page shows the issued revision and the files', async ({ page }) => {
    await openSignedIn(page, '/projects/NRH-01/sheets/A-101');
    await expect(page.getByRole('heading', { name: /A-101/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'R1' })).toBeVisible();
    await expect(page.getByText('NRH-01_ARC_A-101_R01.pdf')).toBeVisible();
    await page.screenshot({ path: 'artifacts/signed-in/owner-sheet.png', fullPage: true });
  });

  test('clash detail shows the linked sheet drawing in the viewer', async ({ page }) => {
    await openSignedIn(page, `/projects/NRH-01/issues/${CLASH}`);
    await expect(page.getByRole('heading', { name: /CLS-001/ })).toBeVisible();
    await expect(page.getByText('Duct clashes with beam B2')).toBeVisible();
    const pdf = page.locator('iframe[title="PDF of NRH-01_ARC_A-101_R01.pdf"]');
    await expect(pdf).toHaveAttribute('src', /storage\/v1\/object\/sign\/drawings/);
    await page.screenshot({ path: 'artifacts/signed-in/owner-clash.png', fullPage: true });
  });

  test('workload page is available to the owner', async ({ page }) => {
    await openSignedIn(page, '/workload');
    await expect(page.getByRole('heading', { name: /Workload/ }).first()).toBeVisible();
  });
});

test.describe('client user', () => {
  test.beforeEach(async ({ context }) => {
    await setOrgCadAllowed(true);
    await signIn(context, CLIENT, 'client@test.local');
  });

  test('portal lists only issued drawings', async ({ page }) => {
    await openSignedIn(page, '/portal');
    await expect(page.getByRole('heading', { name: 'Your drawings' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /A-101/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: /A-102/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'View' }).first()).toHaveAttribute('href', `/portal/files/${PDF_FILE}`);
    await page.screenshot({ path: 'artifacts/signed-in/client-portal.png', fullPage: true });
  });

  test('client views the issued PDF in the portal and can download it', async ({ page }) => {
    await openSignedIn(page, `/portal/files/${PDF_FILE}`);
    await expect(page.locator('iframe[title="PDF of NRH-01_ARC_A-101_R01.pdf"]')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download' })).toBeVisible();
    await page.screenshot({ path: 'artifacts/signed-in/client-pdf.png', fullPage: true });
  });

  test('client sees the CAD viewer status while translation runs', async ({ page }) => {
    await openSignedIn(page, `/portal/files/${CAD_FILE}`);
    await expect(page.getByText('This file is not ready to view yet')).toBeVisible();
  });

  test('the organisation NDA flag blocks CAD viewing in the portal', async ({ page }) => {
    await setOrgCadAllowed(false);
    try {
      await openSignedIn(page, `/portal/files/${CAD_FILE}`);
      await expect(page.getByText('has not allowed CAD viewing')).toBeVisible();
      await expect(page.getByText('This file is not ready to view yet')).toHaveCount(0);
    } finally {
      await setOrgCadAllowed(true);
    }
  });

  test('client is sent to the portal from internal pages', async ({ page }) => {
    await openSignedIn(page, '/projects/NRH-01/sheets/A-101');
    await expect(page).toHaveURL(/\/portal$/);
    await expect(page.getByRole('heading', { name: 'Your drawings' })).toBeVisible();
    await openSignedIn(page, '/workload');
    await expect(page).toHaveURL(/\/portal$/);
  });
});
