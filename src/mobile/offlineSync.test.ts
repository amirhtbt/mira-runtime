import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import type { DraftInput } from '../api/client';
import { openOfflineStore } from './offlineStore';

const input: DraftInput = {
  documentType: 'proforma',
  customer: { displayName: 'بهار', phone: '09121234567' },
  isOfficial: false,
  items: [{ title: 'خدمت', quantityMilli: '1000', unitPriceBaseUnit: '1000' }],
};

it('persists account-scoped pending documents and rejects stale receipts after payment', async () => {
  const name = crypto.randomUUID();
  const store = await openOfflineStore(name);
  const issued = await store.issue('local-id', input);
  expect(await store.pendingSync('account')).toEqual([]);
  await store.prepareSync('account');
  const [first] = await store.pendingSync('account');
  await store.prepareSync('account');
  expect((await store.pendingSync('account'))[0].sequence).toBe(first.sequence);
  store.close();

  const restored = await openOfflineStore(name);
  try {
    expect((await restored.pendingSync('account'))[0].document.documentNumber).toBe(issued.documentNumber);
    expect(await restored.pendingSync('other')).toEqual([]);
    await expect(restored.prepareSync('other')).rejects.toThrow('sync_account_conflict');
    expect(await restored.acknowledgeSync('other', issued.id, first.sequence)).toBe(false);
    await restored.recordPayment(issued.id, 'payment-key', '1000');
    const converted = await restored.convert(issued.id);
    const [pending, invoice] = await restored.pendingSync('account');
    expect(invoice.documentId).toBe(converted.id);
    expect(pending.documentId).toBe(issued.id);
    expect(pending.document.paidAmountBaseUnit).toBe('1000');
    expect(pending.sequence).not.toBe(first.sequence);
    expect(await restored.acknowledgeSync('account', issued.id, first.sequence)).toBe(false);
    expect(await restored.acknowledgeSync('account', issued.id, pending.sequence)).toBe(true);
    expect(await restored.pendingSync('account')).toHaveLength(1);
  } finally {
    restored.close();
  }
});
