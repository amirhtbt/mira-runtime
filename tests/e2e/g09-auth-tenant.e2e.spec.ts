import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext } from '@playwright/test';

const botToken = process.env.TINV_E2E_BOT_TOKEN ?? '';
const appOrigin = process.env.TINV_E2E_APP_ORIGIN ?? 'http://127.0.0.1:4173';
const enabled = Boolean(botToken && process.env.TINV_E2E_AUTH === '1');

function signedInitData(telegramId: string, firstName: string): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `AAE-e2e-${randomUUID()}`,
    user: JSON.stringify({ id: telegramId, first_name: firstName, language_code: 'fa' })
  };
  const check = Object.keys(fields).sort().map((key) => `${key}=${fields[key]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  fields.hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams(Object.keys(fields).sort().map((key) => [key, fields[key]])).toString();
}

async function write(context: BrowserContext, path: string, method: 'post' | 'put', data: unknown) {
  return context.request[method](path, {
    data,
    headers: { Origin: appOrigin, 'X-Tinv-Request': 'miniapp' }
  });
}

async function authenticate(context: BrowserContext, telegramId: string, firstName: string) {
  const response = await write(context, '/api/v1/auth/telegram', 'post', { initData: signedInitData(telegramId, firstName) });
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.ok).toBe(true);
  return body.data as { userId: string; businessId: string };
}

async function logout(context: BrowserContext) {
  const response = await write(context, '/api/v1/auth/logout', 'post', {});
  expect(response.status()).toBe(200);
}

test.describe('G09 phase 1 authenticated tenant isolation', () => {
  test.skip(!enabled, 'Runs only in the disposable APP_ENV=test authenticated E2E job.');

  test('synthetic A and B never share settings, customers or documents', async ({ context, page }) => {
    const accountA = await authenticate(context, '990000001', 'Synthetic A');

    let response = await write(context, '/api/v1/settings', 'put', {
      seller: { businessName: 'کسب‌وکار ساختگی A', phone: '09121110001' }
    });
    expect(response.ok()).toBe(true);

    response = await write(context, '/api/v1/customers', 'post', {
      displayName: 'مشتری ساختگی A', phone: '09121110011', address: 'آدرس تست A', isOfficial: false
    });
    expect(response.status()).toBe(201);
    const customerA = (await response.json()).data as { id: string };

    response = await write(context, '/api/v1/documents', 'post', {
      documentType: 'proforma',
      customer: { id: customerA.id, displayName: 'مشتری ساختگی A', phone: '09121110011' },
      isOfficial: false,
      items: [{ title: 'قلم ساختگی A', quantityMilli: '1000', unitPriceBaseUnit: '1000000', discountBaseUnit: '0' }]
    });
    expect(response.status()).toBe(201);
    const documentA = (await response.json()).data as { id: string };

    await page.goto('/');
    await page.getByRole('button', { name: 'تنظیمات' }).click();
    await expect(page.getByLabel('نام کسب‌وکار')).toHaveValue('کسب‌وکار ساختگی A');

    await logout(context);
    const accountB = await authenticate(context, '990000002', 'Synthetic B');
    expect(accountB.businessId).not.toBe(accountA.businessId);
    expect(accountB.userId).not.toBe(accountA.userId);

    response = await context.request.get('/api/v1/settings');
    expect(response.ok()).toBe(true);
    const settingsB = (await response.json()).data.settings;
    expect(settingsB.seller.businessName).not.toBe('کسب‌وکار ساختگی A');

    response = await context.request.get('/api/v1/customers?query=' + encodeURIComponent('مشتری ساختگی A'));
    expect(response.ok()).toBe(true);
    expect((await response.json()).data.customers).toEqual([]);

    response = await context.request.get(`/api/v1/documents/${documentA.id}`);
    expect(response.status()).toBe(404);

    response = await write(context, `/api/v1/customers/${customerA.id}`, 'put', {
      displayName: 'tamper', phone: '09121110022', address: '', isOfficial: false
    });
    expect([404, 422]).toContain(response.status());

    response = await write(context, '/api/v1/settings', 'put', {
      seller: { businessName: 'کسب‌وکار ساختگی B', phone: '09121110002' }
    });
    expect(response.ok()).toBe(true);

    await logout(context);
    const accountAReturn = await authenticate(context, '990000001', 'Synthetic A');
    expect(accountAReturn.businessId).toBe(accountA.businessId);

    response = await context.request.get('/api/v1/settings');
    expect((await response.json()).data.settings.seller.businessName).toBe('کسب‌وکار ساختگی A');

    response = await context.request.get('/api/v1/customers?query=' + encodeURIComponent('مشتری ساختگی A'));
    expect((await response.json()).data.customers).toHaveLength(1);

    response = await context.request.get(`/api/v1/documents/${documentA.id}`);
    expect(response.ok()).toBe(true);
    expect((await response.json()).data.id).toBe(documentA.id);
  });
});
