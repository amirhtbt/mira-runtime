import { expect, test } from '@playwright/test';

for (const scenario of [
  {name:'android-light',width:390,height:844,theme:'light'},
  {name:'android-dark',width:412,height:915,theme:'dark'},
  {name:'desktop-light',width:1280,height:800,theme:'light'}
] as const) {
  test(`G04 ${scenario.name} shared sales flow remains RTL and usable`,async({page})=>{
    await page.setViewportSize({width:scenario.width,height:scenario.height});
    await page.goto(`/?g02-preview=1&theme=${scenario.theme}`);
    await page.getByRole('button',{name:'ساخت سند جدید'}).first().click();
    await page.getByLabel('نام مشتری یا شرکت').fill('مشتری نمونه');
    await page.getByLabel('شماره تماس').fill('09120000000');
    await page.getByLabel('شرح کالا یا خدمت').fill('سفارش کامل');
    await page.getByLabel('مبلغ واحد (ریال) *').fill('10000000');
    await expect(page.getByText('۱۰٬۰۰۰٬۰۰۰ ریال').first()).toBeVisible();
    await expect(page).toHaveScreenshot(`g04-${scenario.name}-draft.png`,{fullPage:true});
    await page.getByRole('button',{name:'ذخیره و ادامه برای صدور'}).click();
    await page.getByRole('button',{name:'صدور پیش‌فاکتور'}).click();
    await page.getByLabel('مبلغ پرداخت').fill('3000000');
    await page.getByRole('button',{name:'ثبت پرداخت',exact:true}).click();
    await expect(page.getByText('۷٬۰۰۰٬۰۰۰')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
  });
}

test('G04 final invoice presents full settlement without installment breakdown',async({page})=>{
  await page.setViewportSize({width:390,height:844}); await page.goto('/?g02-preview=1');
  await page.getByRole('button',{name:'ساخت سند جدید'}).first().click(); await page.getByRole('button',{name:'فاکتور فروش'}).click();
  await page.getByLabel('نام مشتری یا شرکت').fill('خریدار نقدی'); await page.getByLabel('شماره تماس').fill('09120000001'); await page.getByLabel('شرح کالا یا خدمت').fill('فروش کامل'); await page.getByLabel('مبلغ واحد (ریال) *').fill('10000000');
  await page.getByRole('button',{name:'ذخیره و ادامه برای صدور'}).click(); await page.getByRole('button',{name:/تأیید پرداخت کامل/}).click();
  await expect(page.getByText(/جزئیات اقساط در این فاکتور نمایش داده نمی‌شود/)).toBeVisible();
  await expect(page.getByText(/بیعانه/)).toHaveCount(0);
});

test('G04.1 uses one scroll page, unlimited rows and conditional official identity',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/?g02-preview=1');
  await page.getByRole('button',{name:'ساخت سند جدید'}).first().click();
  await expect(page.getByText('فرم یک‌صفحه‌ای',{exact:true})).toHaveCount(0);
  await expect(page.getByText('ساخت سند جدید',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('شناسه ملی')).toHaveCount(0);
  await page.getByText('سند رسمی',{exact:true}).click();await expect(page.getByLabel('شناسه ملی')).toBeVisible();
  await page.getByRole('button',{name:'افزودن قلم جدید'}).click();
  await expect(page.locator('.item-editor')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'اشتراک‌گذاری'})).toBeDisabled();
  await page.getByRole('button',{name:'پیش‌نمایش کامل'}).click();
  await expect(page.getByRole('dialog',{name:'پیش‌نمایش کامل سند'})).toBeVisible();
  await page.getByRole('button',{name:'بستن ×'}).click();
  await expect(page.getByRole('dialog',{name:'پیش‌نمایش کامل سند'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
});
