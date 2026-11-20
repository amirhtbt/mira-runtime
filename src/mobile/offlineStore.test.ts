import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { DraftInput } from '../api/client';
import { defaultOfflineSettings } from './offlineSettings';
import { openOfflineStore, type OfflineStore } from './offlineStore';

const connections: OfflineStore[] = [];
async function open(name = crypto.randomUUID()) {
  const store = await openOfflineStore(name);
  connections.push(store);
  return store;
}

afterEach(() => connections.splice(0).forEach(store => store.close()));

const input: DraftInput = {
  documentType: 'proforma',
  customer: { displayName: 'شرکت بهار', phone: '+۹۸ ۹۱۲ ۱۲۳ ۴۵۶۷' },
  isOfficial: false,
  validityDays: 1,
  items: [{ title: 'سفارش نمونه', quantityMilli: '1000', unitPriceBaseUnit: '10000000' }],
};
const now = new Date('2026-03-19T21:00:00Z'); // Already March 20 in Tehran.

describe('offline sales database', () => {
  it('issues on a fresh database and reads the same document after reopening it', async () => {
    const name = crypto.randomUUID();
    const db = await open(name);
    const issued = await db.issue('draft-1', input, false, now);
    expect(issued).toMatchObject({
      customerName: 'شرکت بهار', customerPhone: '09121234567',
      grandTotalBaseUnit: '10000000', issueDate: '1404/12/29', validUntil: '1405/01/01',
      settlementStatus: 'unpaid',
    });
    expect(issued.documentNumber).toMatch(/^PF-[0-9a-f-]{36}-00001$/);
    db.close();
    const reopened = await open(name);
    expect(await reopened.listDocuments()).toEqual([issued]);
    expect(await reopened.issue('draft-1', input)).toEqual(issued);
    expect(await reopened.listCustomers()).toHaveLength(1);
  });

  it('rolls back allocation after a failed write path and serializes concurrent issuers', async () => {
    const name = crypto.randomUUID();
    const left = await open(name);
    const right = await open(name);
    await expect(left.issue('bad-date', input, false, new Date(NaN))).rejects.toThrow();
    expect(await left.listDocuments()).toEqual([]);
    expect(await left.listCustomers()).toEqual([]);
    const [first, second, retried] = await Promise.all([
      left.issue('first', input), right.issue('second', input), right.issue('first', input),
    ]);
    expect(first.documentNumber).toMatch(/-00001$/);
    expect(second.documentNumber).toBe(first.documentNumber.replace(/00001$/, '00002'));
    expect(retried.id).toBe(first.id);
    const independent = await (await open()).issue('first', input);
    expect(independent.documentNumber).not.toBe(first.documentNumber);
  });

  it('preserves issued customer, seller and logo when live records change', async () => {
    const db = await open();
    const settings = defaultOfflineSettings();
    settings.seller.businessName = 'فروشنده اول';
    await db.saveProfile({ settings, logo: new Blob(['original']) });
    const issued = await db.issue('snapshot', input);
    const [customer] = await db.listCustomers();
    await db.saveCustomer({ ...customer, displayName: 'نام جدید' });
    settings.seller.businessName = 'فروشنده جدید';
    await db.saveProfile({ settings, logo: new Blob(['updated']) });
    const [archived] = await db.listDocuments();
    expect(archived.customerName).toBe(issued.customerName);
    expect(archived.settingsSnapshot.seller.businessName).toBe('فروشنده اول');
    expect(await archived.logoSnapshot?.text()).toBe('original');
    expect(await (await db.getProfile())?.logo?.text()).toBe('updated');
  });

  it('records installments idempotently and converts a fully settled proforma only once', async () => {
    const db = await open();
    await db.issue('source', input, false, now);
    const partial = await db.recordPayment('source', 'deposit', '3000000', now);
    expect(partial).toMatchObject({ remainingAmountBaseUnit: '7000000', settlementStatus: 'partial' });
    await expect(db.convert('source', now)).rejects.toThrow('proforma_not_fully_paid');
    await expect(db.recordPayment('source', 'too-much', '7000001')).rejects.toThrow('overpayment_rejected');
    const settled = await db.recordPayment('source', 'balance', '7000000', now);
    expect(await db.recordPayment('source', 'balance', '7000000')).toEqual(settled);
    expect(settled.payments).toHaveLength(2);
    expect(settled.payments?.every(payment => payment.status === 'confirmed')).toBe(true);
    await expect(db.recordPayment('source', 'balance', '1')).rejects.toThrow('payment_idempotency_conflict');
    const [invoice, retry] = await Promise.all([db.convert('source', now), db.convert('source', now)]);
    expect(retry).toEqual(invoice);
    expect(invoice).toMatchObject({
      documentType: 'invoice', settlementStatus: 'paid', sourceDocumentId: 'source',
      grandTotalBaseUnit: '10000000', validUntil: null,
    });
    expect(invoice.payments).toBeUndefined();
    expect(await db.listDocuments()).toHaveLength(2);
  });

  it('requires direct invoice confirmation and an official profile for official issuance', async () => {
    const db = await open();
    const invoice: DraftInput = { ...input, documentType: 'invoice' };
    await expect(db.issue('invoice', invoice)).rejects.toThrow('full_payment_confirmation_required');
    await expect(db.issue('official', {
      ...input, isOfficial: true, customer: { ...input.customer, nationalId: '۱۲۳۴۵۶۷۸۹۰' },
    })).rejects.toThrow('official_profile_incomplete');
    expect(await db.issue('invoice', invoice, true)).toMatchObject({
      settlementStatus: 'paid', remainingAmountBaseUnit: '0', validityDays: null,
    });
  });
});
