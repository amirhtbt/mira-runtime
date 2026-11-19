import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import type { DraftInput } from '../api/client';
import { decodeOfflineBackup, encodeOfflineBackup } from './offlineBackup';
import { defaultOfflineSettings } from './offlineSettings';
import { openOfflineStore } from './offlineStore';

const input: DraftInput = {
  documentType: 'proforma',
  customer: { displayName: 'شرکت بهار', phone: '09121234567' },
  isOfficial: false,
  items: [{ title: 'خدمت', quantityMilli: '1000', unitPriceBaseUnit: '1000' }],
};

async function fresh() {
  return openOfflineStore(crypto.randomUUID());
}

it('restores customers, drafts, payment keys, numbers, and logo bytes while starting a fresh issuing series', async () => {
  const source = await fresh();
  const target = await fresh();
  try {
    const settings = defaultOfflineSettings();
    settings.seller.businessName = 'فروشنده';
    await source.saveProfile({ settings, logo: new Blob(['logo'], { type: 'image/png' }) });
    const issued = await source.issue('issued', input, false);
    await source.recordPayment(issued.id, 'deposit', '400');
    await source.saveDraft({ id: 'draft', input: { ...input, customer: { ...input.customer, id: issued.customerId } } });
    const json = await encodeOfflineBackup(await source.readSnapshot());
    expect(JSON.parse(json).data.numbering).toBeUndefined();
    await target.restoreSnapshot(decodeOfflineBackup(json));

    const [restored] = await target.listDocuments();
    expect(restored.documentNumber).toBe(issued.documentNumber);
    expect(restored.remainingAmountBaseUnit).toBe('600');
    expect(restored.payments).toHaveLength(1);
    expect(await restored.logoSnapshot?.text()).toBe('logo');
    expect((await target.getProfile())?.settings.seller.businessName).toBe('فروشنده');
    expect(await (await target.getProfile())?.logo?.text()).toBe('logo');
    expect((await target.listCustomers())[0].id).toBe(issued.customerId);
    expect((await target.listDrafts())[0].id).toBe('draft');
    expect((await target.recordPayment(issued.id, 'deposit', '400')).remainingAmountBaseUnit).toBe('600');

    const next = await target.issue('next', input, false);
    expect(next.documentNumber).toMatch(/-00001$/);
    expect(next.documentNumber).not.toBe(issued.documentNumber);
    await expect(target.restoreSnapshot(decodeOfflineBackup(json))).rejects.toThrow('backup_target_not_empty');
    expect(await target.listDocuments()).toHaveLength(2);
  } finally {
    source.close();
    target.close();
  }
});

it('rejects invalid references and rolls back all writes when the archive contains conflicting numbers', async () => {
  const source = await fresh();
  const target = await fresh();
  try {
    await source.issue('issued', input, false);
    const json = JSON.parse(await encodeOfflineBackup(await source.readSnapshot()));
    json.data.documents[0].customerId = 'missing';
    expect(() => decodeOfflineBackup(JSON.stringify(json))).toThrow('backup_invalid');
    json.data.documents[0].customerId = json.data.customers[0].id;
    json.data.documents.push({ ...json.data.documents[0], id: 'duplicate-number' });
    await expect(target.restoreSnapshot(decodeOfflineBackup(JSON.stringify(json)))).rejects.toThrow();
    expect(await target.listCustomers()).toEqual([]);
    expect(await target.listDocuments()).toEqual([]);
    json.data.documents.pop();
    await target.restoreSnapshot(decodeOfflineBackup(JSON.stringify(json)));
    expect(await target.listDocuments()).toHaveLength(1);
  } finally {
    source.close();
    target.close();
  }
});
