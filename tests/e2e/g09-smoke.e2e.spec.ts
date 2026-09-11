import { expect, test } from '@playwright/test';

test.describe('G09 phase 0 smoke', () => {
  test('shell renders with five-slot navigation, no uncaught page errors and no horizontal overflow', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/?g02-preview=1');

    await expect(page.getByRole('heading', { name: 'اولین سند فروشتان را بسازید' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'خانه' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ساخت سند جدید' }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'فاکتورها' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'تنظیمات' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'قالب‌ها' })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );

    expect(hasHorizontalOverflow).toBe(false);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('staging health reports G09 when an external staging base URL is selected', async ({ request }) => {
    test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'Live health assertion only runs against an explicitly selected external target.');

    const response = await request.get('/api/v1/health');
    expect(response.ok()).toBe(true);
    await expect(response).toHaveHeader('content-type', /application\/json/i);
    const body = await response.json();
    expect(body).toMatchObject({ service: 'telegram-invoice-api', gate: 'G09' });
  });
});
