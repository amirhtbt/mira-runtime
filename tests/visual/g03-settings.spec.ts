import { expect, test } from '@playwright/test';

const settings = {
  seller: { businessName: '', displayName: '', subtitle: '', sellerName: '', phone: '', telegramUsername: '', address: '', showAddress: false, customContactLine: '' },
  payment: { cardNumber: '', accountNumber: '', sheba: '', bankName: '', accountHolder: '', instructions: '' },
  document: { proformaLabel: 'پیش‌فاکتور', invoiceLabel: 'فاکتور فروش', numberingMode: 'auto', proformaPrefix: 'PF', invoicePrefix: 'INV', numberPadding: 5, issueDateMode: 'today', validityDays: 7, calendar: 'jalali', digits: 'persian' },
  presentation: { currencyUnit: 'toman', thousandsSeparator: true, decimalPolicy: 'none', roundTotal: 'none' },
  items: { rowNumber: true, sku: false, image: false, title: true, description: true, unit: false, quantity: true, unitPrice: true, lineDiscount: false, tax: false, lineTotal: true },
  financial: { discount: { kind: 'none', amountBaseUnit: '0', percentBasisPoints: 0 }, shippingAmountBaseUnit: '0', serviceFeeAmountBaseUnit: '0', taxEnabled: false, taxRateBasisPoints: 0, customAdjustments: [] },
  text: { sellerNote: '', paymentTerms: '', shippingTerms: '', footer: '', validityNotice: '', thankYou: '' },
  visual: { templateId: 'mira-classic', accent: '#2f80ed', invoiceVariant: 'auto', logoPosition: 'start', density: 'comfortable', fontSize: 'medium' }
};

async function mockSettings(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/settings', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { schemaVersion: 1, settings, version: 0, updatedAt: null, logo: { present: false, mimeType: null, byteSize: null, width: null, height: null, updatedAt: null } } }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { schemaVersion: 1, settings, version: 1, updatedAt: '2026-09-10 08:00:00', logo: { present: false, mimeType: null, byteSize: null, width: null, height: null, updatedAt: null } } }) });
  });
}

for (const scenario of [
  { name: 'android-light', width: 360, height: 640, theme: 'light' },
  { name: 'android-dark', width: 412, height: 915, theme: 'dark' },
  { name: 'desktop-light', width: 1280, height: 800, theme: 'light' }
] as const) {
  test(`G03 ${scenario.name} settings stays usable and progressive`, async ({ page }) => {
    await mockSettings(page);
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto(`/?g02-preview=1&theme=${scenario.theme}`);
    await page.getByRole('button', { name: 'تنظیمات' }).click();
    await expect(page.getByRole('heading', { name: 'تنظیمات' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'اطلاعاتی که روی سند دیده می‌شود' })).toBeVisible();
    await expect(page.getByLabel('نام کسب‌وکار')).toBeVisible();
    await expect(page.getByLabel('شماره کارت')).toBeVisible();
    expect(await page.locator('.settings-section[open]').count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

    const field = await page.getByLabel('نام کسب‌وکار').boundingBox();
    expect(field?.height).toBeGreaterThanOrEqual(44);
    const settingsButton = await page.getByRole('button', { name: 'تنظیمات' }).boundingBox();
    expect(settingsButton?.width).toBeGreaterThanOrEqual(44);
    expect(settingsButton?.height).toBeGreaterThanOrEqual(44);

    await page.getByText('پیش‌فرض سند').click();
    await expect(page.getByLabel('عنوان پیش‌فاکتور')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
}

test('G03 settings bottom content clears fixed navigation with safe area', async ({ page }) => {
  await mockSettings(page);
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('/?g02-preview=1');
  await page.evaluate(() => document.documentElement.style.setProperty('--tg-content-safe-area-inset-bottom', '32px'));
  await page.getByRole('button', { name: 'تنظیمات' }).click();
  await page.getByText('ظاهر پیش‌فرض').click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const save = await page.locator('.settings-save-bar').boundingBox();
  const nav = await page.locator('.bottom-nav').boundingBox();
  expect(save && nav).toBeTruthy();
  if (save && nav) expect(save.y + save.height).toBeLessThanOrEqual(nav.y + 1);
});
