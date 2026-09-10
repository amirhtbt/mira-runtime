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
      await expect(page.getByRole('heading', { name: 'اولین سند فروشتان را بسازید' })).toBeVisible();
      await expect(page.locator('html')).toHaveScreenshot(`${viewport.name}-${theme}.png`, { fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    });
  }
}

test('keyboard navigation, safe-area variables and approved compact four-slot RTL navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?g02-preview=1');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--tg-content-safe-area-inset-top', '28px');
    document.documentElement.style.setProperty('--tg-content-safe-area-inset-bottom', '24px');
  });
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toBeVisible();

  const navigation = await page.locator('.bottom-nav').boundingBox();
  const home = await page.getByRole('button', { name: 'خانه' }).boundingBox();
  const create = await page.getByRole('button', { name: 'ساخت سند جدید' }).last().boundingBox();
  const invoices = await page.getByRole('button', { name: 'فاکتورها' }).boundingBox();
  const settings = await page.getByRole('button', { name: 'تنظیمات' }).boundingBox();
  const createBubble = await page.locator('.nav-create > span').boundingBox();
  expect(navigation && home && create && invoices && settings && createBubble).toBeTruthy();

  if (navigation && home && create && invoices && settings && createBubble) {
    const center = (box: { x: number; width: number }) => box.x + box.width / 2;
    expect(center(home)).toBeGreaterThan(center(create));
    expect(center(create)).toBeGreaterThan(center(invoices));
    expect(center(invoices)).toBeGreaterThan(center(settings));

    const widths = [home.width, create.width, invoices.width, settings.width];
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);

    const tops = [home.y, create.y, invoices.y, settings.y];
    const heights = [home.height, create.height, invoices.height, settings.height];
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    expect(home.height).toBeGreaterThanOrEqual(55);
    expect(home.height).toBeLessThanOrEqual(57);

    expect(navigation.height).toBeGreaterThanOrEqual(87);
    expect(navigation.height).toBeLessThanOrEqual(89);
    expect(createBubble.y).toBeGreaterThanOrEqual(navigation.y);
    expect(createBubble.y + createBubble.height).toBeLessThanOrEqual(navigation.y + navigation.height - 24);
  }

  const homeLabel = await page.locator('.bottom-nav > button:nth-child(1) > span').boundingBox();
  const invoiceLabel = await page.locator('.bottom-nav > button:nth-child(2) > span').boundingBox();
  const createLabel = await page.locator('.bottom-nav > button:nth-child(3) > b').boundingBox();
  const settingsLabel = await page.locator('.bottom-nav > button:nth-child(4) > span').boundingBox();
  expect(homeLabel && invoiceLabel && createLabel && settingsLabel).toBeTruthy();
  if (homeLabel && invoiceLabel && createLabel && settingsLabel) {
    const labelTops = [homeLabel.y, invoiceLabel.y, createLabel.y, settingsLabel.y];
    expect(Math.max(...labelTops) - Math.min(...labelTops)).toBeLessThanOrEqual(1);
  }

  await page.getByRole('button', { name: 'ساخت سند جدید' }).last().click();
  await expect(page.getByRole('heading', { name: 'چه سندی می‌سازید؟' })).toBeVisible();
  await expect(page.getByRole('button', { name: /پیش‌فاکتور/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /فاکتور فروش/ })).toBeVisible();
  const target = await page.getByRole('button', { name: 'ساخت سند جدید' }).last().boundingBox();
  expect(target?.width).toBeGreaterThanOrEqual(44);
  expect(target?.height).toBeGreaterThanOrEqual(44);
});

test('last home card clears the fixed navigation with Android bottom safe area', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('/?g02-preview=1');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--tg-content-safe-area-inset-bottom', '32px');
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  const card = await page.locator('.business-card').boundingBox();
  const navigation = await page.locator('.bottom-nav').boundingBox();
  expect(card && navigation && card.y + card.height <= navigation.y - 8).toBe(true);
});
