import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'android-narrow', width: 360, height: 640 },
  { name: 'android-normal', width: 412, height: 915 },
  { name: 'iphone-simulated', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 }
] as const;

for (const viewport of viewports) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${viewport.name} ${theme} visual`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/?g02-preview=1&theme=${theme}`);
      await expect(page.getByRole('heading', { name: 'اولین پیش‌فاکتورتان را بسازید' })).toBeVisible();
      await expect(page.locator('html')).toHaveScreenshot(`${viewport.name}-${theme}.png`, { fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    });
  }
}

test('keyboard navigation, safe-area variables and central CTA', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?g02-preview=1');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--tg-content-safe-area-inset-top', '28px');
    document.documentElement.style.setProperty('--tg-content-safe-area-inset-bottom', '24px');
  });
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toBeVisible();
  await page.getByRole('button', { name: 'ساخت پیش‌فاکتور' }).last().click();
  await expect(page.getByRole('heading', { name: 'پیش‌فاکتور جدید' })).toBeVisible();
  const target = await page.getByRole('button', { name: 'ساخت پیش‌فاکتور' }).last().boundingBox();
  expect(target?.width).toBeGreaterThanOrEqual(44);
  expect(target?.height).toBeGreaterThanOrEqual(44);
});
