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
    await page.getByRole('button',{name:/پیشنهاد قیمت/}).click();
    await page.getByLabel('نام مشتری').fill('مشتری نمونه');
    await page.getByLabel('شرح کالا یا خدمت').fill('سفارش کامل');
    await page.getByLabel('مبلغ کل').fill('10000000');
    await expect(page.getByText('۱۰٬۰۰۰٬۰۰۰ تومان')).toBeVisible();
    await expect(page).toHaveScreenshot(`g04-${scenario.name}-draft.png`,{fullPage:true});
    await page.getByRole('button',{name:'ذخیره پیش‌نویس'}).click();
    await page.getByRole('button',{name:'صدور پیش‌فاکتور'}).click();
    await page.getByLabel('مبلغ پرداخت').fill('3000000');
    await page.getByRole('button',{name:'ثبت پرداخت',exact:true}).click();
    await expect(page.getByText('۷٬۰۰۰٬۰۰۰')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
  });
}

test('G04 final invoice presents full settlement without installment breakdown',async({page})=>{
  await page.setViewportSize({width:390,height:844}); await page.goto('/?g02-preview=1');
  await page.getByRole('button',{name:'ساخت سند جدید'}).first().click(); await page.getByRole('button',{name:/کامل پرداخت شده/}).click();
  await page.getByLabel('نام مشتری').fill('خریدار نقدی'); await page.getByLabel('شرح کالا یا خدمت').fill('فروش کامل'); await page.getByLabel('مبلغ کل').fill('10000000');
  await page.getByRole('button',{name:'ذخیره پیش‌نویس'}).click(); await page.getByRole('button',{name:/تأیید پرداخت کامل/}).click();
  await expect(page.getByText(/جزئیات اقساط در این فاکتور نمایش داده نمی‌شود/)).toBeVisible();
  await expect(page.getByText(/بیعانه/)).toHaveCount(0);
});
