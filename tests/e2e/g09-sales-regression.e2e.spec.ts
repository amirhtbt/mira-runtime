import { expect, test } from '@playwright/test';

async function openBuilder(page: import('@playwright/test').Page) {
  await page.goto('/?g02-preview=1');
  await page.getByRole('button', { name: 'ساخت سند جدید' }).first().click();
}

async function fillBaseProforma(page: import('@playwright/test').Page, amount = '10000000') {
  await page.getByLabel('نام مشتری یا شرکت').fill('مشتری تست خودکار');
  await page.getByLabel('شماره تماس').fill('09121111111');
  await page.getByLabel('شرح کالا یا خدمت').fill('قلم تست خودکار');
  await page.getByLabel('تعداد *').fill('1');
  await page.getByLabel('مبلغ واحد (ریال) *').fill(amount);
}

test.describe('G09 phases 4–6 browser regression', () => {
  test('draft survives reload and repeated preview without losing entered data', async ({ page }) => {
    await openBuilder(page);
    await fillBaseProforma(page);
    await page.getByLabel('تخفیف ردیف (اختیاری)').fill('500000');

    await page.getByRole('button', { name: 'پیش‌نمایش کامل' }).click();
    const dialog = page.getByRole('dialog', { name: 'پیش‌نمایش کامل سند' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('۹٬۵۰۰٬۰۰۰ ریال');
    await page.getByRole('button', { name: 'بستن ×' }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole('button', { name: 'پیش‌نمایش کامل' }).click();
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'بستن ×' }).click();

    await page.reload();
    await page.getByRole('button', { name: 'ساخت سند جدید' }).first().click();
    await expect(page.getByLabel('نام مشتری یا شرکت')).toHaveValue('مشتری تست خودکار');
    await expect(page.getByLabel('شماره تماس')).toHaveValue('09121111111');
    await expect(page.getByLabel('شرح کالا یا خدمت')).toHaveValue('قلم تست خودکار');
    await expect(page.getByLabel('تخفیف ردیف (اختیاری)')).toHaveValue('500000');
    await expect(page.getByText('۹٬۵۰۰٬۰۰۰ ریال').first()).toBeVisible();
  });

  test('invalid quantity and missing official identity are rejected; official tax remains integer Rial', async ({ page }) => {
    await openBuilder(page);
    await fillBaseProforma(page);

    await page.getByLabel('تعداد *').fill('0');
    await page.getByRole('button', { name: 'ذخیره و ادامه برای صدور' }).click();
    await expect(page.getByRole('alert')).toContainText('شرح، تعداد و مبلغ همه اقلام را کامل کنید.');

    await page.getByLabel('تعداد *').fill('1');
    await page.getByText('سند رسمی', { exact: true }).click();
    await expect(page.getByLabel('شناسه ملی')).toBeVisible();
    await page.getByRole('button', { name: 'ذخیره و ادامه برای صدور' }).click();
    await expect(page.getByRole('alert')).toContainText('برای سند رسمی، شناسه ملی الزامی است.');

    await page.getByLabel('شناسه ملی').fill('1010101010');
    await expect(page.getByText(/مالیات بر ارزش افزوده 10٪/)).toBeVisible();
    await expect(page.getByText('۱۱٬۰۰۰٬۰۰۰ ریال').first()).toBeVisible();
  });

  test('10m pro-forma rejects overpayment, settles 3m + 7m and converts once to final invoice', async ({ page }) => {
    await openBuilder(page);
    await fillBaseProforma(page, '10000000');

    await page.getByRole('button', { name: 'ذخیره و ادامه برای صدور' }).click();
    await expect(page.getByText(/پیش‌فاکتور · پیش‌نویس/)).toBeVisible();
    await page.getByRole('button', { name: 'صدور پیش‌فاکتور' }).click();
    await expect(page.getByText(/پیش‌فاکتور · صادرشده/)).toBeVisible();

    await page.getByLabel('مبلغ پرداخت').fill('3000000');
    await page.getByRole('button', { name: 'ثبت پرداخت', exact: true }).click();
    await expect(page.getByText('۳٬۰۰۰٬۰۰۰')).toBeVisible();
    await expect(page.getByText('۷٬۰۰۰٬۰۰۰')).toBeVisible();

    await page.getByLabel('مبلغ پرداخت').fill('8000000');
    await page.getByRole('button', { name: 'ثبت پرداخت', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('مبلغ بیشتر از مانده است.');
    await expect(page.getByText('۷٬۰۰۰٬۰۰۰')).toBeVisible();

    await page.getByLabel('مبلغ پرداخت').fill('7000000');
    await page.getByRole('button', { name: 'ثبت پرداخت', exact: true }).click();
    await expect(page.getByText('۱۰٬۰۰۰٬۰۰۰').first()).toBeVisible();
    await expect(page.getByText('۰').first()).toBeVisible();
    const convert = page.getByRole('button', { name: 'صدور فاکتور نهایی' });
    await expect(convert).toBeVisible();
    await convert.click();

    await expect(page.getByText(/فاکتور فروش · صادرشده/)).toBeVisible();
    await expect(page.getByText('۱۰٬۰۰۰٬۰۰۰ ریال')).toBeVisible();
    await expect(page.getByText(/جزئیات اقساط در این فاکتور نمایش داده نمی‌شود/)).toBeVisible();
    await expect(page.getByText(/بیعانه/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'صدور فاکتور نهایی' })).toHaveCount(0);
  });
});
