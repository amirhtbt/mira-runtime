import { expect, test } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();

function collectBrowserErrors(page: import('@playwright/test').Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  return { pageErrors, consoleErrors };
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
}

test.describe('G09 phase 0 smoke', () => {
  test('local DEV preview renders five-slot navigation without browser errors or horizontal overflow', async ({ page }) => {
    test.skip(Boolean(externalBaseURL), 'The DEV preview harness is intentionally unavailable on a production-built external target.');
    const { pageErrors, consoleErrors } = collectBrowserErrors(page);

    await page.goto('/?g02-preview=1');

    await expect(page.getByRole('heading', { name: 'اولین سند فروشتان را بسازید' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'خانه' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ساخت سند جدید' }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'فاکتورها' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'تنظیمات' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'قالب‌ها' })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('external staging preserves the real Telegram auth boundary without browser errors or horizontal overflow', async ({ page }) => {
    test.skip(!externalBaseURL, 'Runs only against an explicitly selected external target.');
    const { pageErrors, consoleErrors } = collectBrowserErrors(page);

    const navigation = await page.goto('/');
    expect(navigation?.ok()).toBe(true);
    await expect(page.getByRole('heading', { name: 'اتصال برقرار نشد' })).toBeVisible();
    await expect(page.getByText('این صفحه را از دکمهٔ منوی ربات تلگرام باز کنید.')).toBeVisible();

    await expectNoHorizontalOverflow(page);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('staging health reports G09 when an external staging base URL is selected', async ({ request }) => {
    test.skip(!externalBaseURL, 'Live health assertion only runs against an explicitly selected external target.');

    const response = await request.get('/api/v1/health');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type'] ?? '').toMatch(/application\/json/i);
    expect(response.headers()['x-request-id'] ?? '').toMatch(/^[A-Za-z0-9._-]{8,64}$/);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      data: { service: 'telegram-invoice-api', gate: 'G09' }
    });
  });
});
