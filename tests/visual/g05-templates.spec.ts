import { expect, test } from '@playwright/test';

test('G05 has a dedicated leftmost Templates tab and three landscape layouts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?g02-preview=1');
  const tabs = page.locator('.bottom-nav > button');
  await expect(tabs).toHaveCount(5);
  await expect(tabs.nth(4)).toContainText('قالب‌ها');
  await tabs.nth(4).click();
  await expect(page.getByRole('heading', { name: 'قالب‌ها' })).toBeVisible();
  for (const name of ['مینیمال', 'تجاری مدرن', 'تجاری کلاسیک']) await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByText('عمودی', { exact: true })).toHaveCount(0);
  await expect(page.locator('.invoice-template').last()).toHaveAttribute('data-orientation', 'landscape');
  await expect(page.locator('.invoice-template').last()).toContainText('ریال');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('G05 selection, colour, zoom and full preview are usable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?g02-preview=1');
  await page.getByRole('button', { name: 'قالب‌ها' }).click();
  await page.getByRole('button', { name: /تجاری کلاسیک/ }).click();
  await page.getByRole('button', { name: 'سبز تیره' }).click();
  await page.getByRole('button', { name: 'بزرگ‌نمایی' }).click();
  await page.getByRole('button', { name: 'پیش‌نمایش کامل' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'تجاری کلاسیک' })).toBeVisible();
  await page.getByRole('button', { name: 'بستن پیش‌نمایش' }).click();
  await page.getByRole('button', { name: 'فعال‌کردن قالب' }).click();
  await expect(page.getByText(/اسناد بعدی با همین قالب/)).toBeVisible();
  await page.getByRole('button', { name: 'تنظیمات' }).click();
  await expect(page.getByText('قالب پیش‌فرض')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'انتخاب و پیش‌نمایش' })).toHaveCount(0);
});
