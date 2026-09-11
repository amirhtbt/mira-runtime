import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext } from '@playwright/test';

const botToken = process.env.TINV_E2E_BOT_TOKEN ?? '';
const appOrigin = process.env.TINV_E2E_APP_ORIGIN ?? 'https://app.example.test';
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
  const session = await context.request.get('/api/v1/session');
  expect(session.status()).toBe(200);
  return body.data as { userId: string; businessId: string };
}

async function logout(context: BrowserContext) {
  const response = await write(context, '/api/v1/auth/logout', 'post', {});
  expect(response.status()).toBe(200);
  expect((await context.request.get('/api/v1/session')).status()).toBe(401);
}

test.describe('G09 phase 1 authenticated tenant isolation', () => {
  test.skip(!enabled, 'Runs only in the disposable APP_ENV=test authenticated E2E job.');

  test('synthetic A and B never share settings, customers or documents', async ({ context }, testInfo) => {
    // Retries share the disposable database. Give each attempt a new synthetic
    // identity and phone namespace so retry evidence never collides with data
    // intentionally written by the previous failed attempt.
    const namespace = testInfo.retry + 1;
    const telegramA = String(990000100 + namespace * 10 + 1);
    const telegramB = String(990000100 + namespace * 10 + 2);
    const phoneA = `0912111${String(namespace).padStart(2, '0')}01`;
    const phoneB = `0912111${String(namespace).padStart(2, '0')}02`;
    const customerPhoneA = `0912112${String(namespace).padStart(2, '0')}11`;
    const tamperPhone = `0912112${String(namespace).padStart(2, '0')}22`;
    const businessA = `کسب‌وکار ساختگی A-${namespace}`;
    const businessB = `کسب‌وکار ساختگی B-${namespace}`;
    const customerNameA = `مشتری ساختگی A-${namespace}`;

    const accountA = await authenticate(context, telegramA, `Synthetic A ${namespace}`);

    let response = await write(context, '/api/v1/settings', 'put', {
      seller: { businessName: businessA, phone: phoneA }
    });
    expect(response.ok()).toBe(true);

    response = await write(context, '/api/v1/customers', 'post', {
      displayName: customerNameA, phone: customerPhoneA, address: `آدرس تست A-${namespace}`, isOfficial: false
    });
    expect(response.status()).toBe(201);
    const customerA = (await response.json()).data as { id: string };

    response = await write(context, '/api/v1/documents', 'post', {
      documentType: 'proforma',
      customer: { id: customerA.id, displayName: customerNameA, phone: customerPhoneA },
      isOfficial: false,
      items: [{ title: `قلم ساختگی A-${namespace}`, quantityMilli: '1000', unitPriceBaseUnit: '1000000', discountBaseUnit: '0' }]
    });
    expect(response.status()).toBe(201);
    const documentA = (await response.json()).data as { id: string };

    response = await context.request.get('/api/v1/settings');
    expect(response.ok()).toBe(true);
    expect((await response.json()).data.settings.seller.businessName).toBe(businessA);

    await logout(context);
    const accountB = await authenticate(context, telegramB, `Synthetic B ${namespace}`);
    expect(accountB.businessId).not.toBe(accountA.businessId);
    expect(accountB.userId).not.toBe(accountA.userId);

    response = await context.request.get('/api/v1/settings');
    expect(response.ok()).toBe(true);
    const settingsB = (await response.json()).data.settings;
    expect(settingsB.seller.businessName).not.toBe(businessA);

    response = await context.request.get('/api/v1/customers?query=' + encodeURIComponent(customerNameA));
    expect(response.ok()).toBe(true);
    expect((await response.json()).data.customers).toEqual([]);

    response = await context.request.get(`/api/v1/documents/${documentA.id}`);
    expect(response.status()).toBe(404);

    response = await write(context, `/api/v1/customers/${customerA.id}`, 'put', {
      displayName: 'tamper', phone: tamperPhone, address: '', isOfficial: false
    });
    expect([404, 422]).toContain(response.status());

    response = await write(context, '/api/v1/settings', 'put', {
      seller: { businessName: businessB, phone: phoneB }
    });
    expect(response.ok()).toBe(true);

    await logout(context);
    const accountAReturn = await authenticate(context, telegramA, `Synthetic A ${namespace}`);
    expect(accountAReturn.businessId).toBe(accountA.businessId);

    response = await context.request.get('/api/v1/settings');
    expect((await response.json()).data.settings.seller.businessName).toBe(businessA);

    response = await context.request.get('/api/v1/customers?query=' + encodeURIComponent(customerNameA));
    expect((await response.json()).data.customers).toHaveLength(1);

    response = await context.request.get(`/api/v1/documents/${documentA.id}`);
    expect(response.ok()).toBe(true);
    expect((await response.json()).data.id).toBe(documentA.id);
  });
});