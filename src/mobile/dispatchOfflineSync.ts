import { mobileAccountApi } from './mobileAccountApi';
import type { OfflineStore } from './offlineStore';

const active = new WeakMap<OfflineStore, Promise<number>>();

async function binaryBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let data = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    data += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(data);
}

export async function dispatchOfflineSync(store: OfflineStore, api = mobileAccountApi): Promise<number> {
  const pending = active.get(store);
  if (pending) return pending;
  const task = (async () => {
    const business = await store.syncBusiness();
    if (!business || !api.enabled) return 0;
    const queue = await store.pendingSync(business);
    if (queue.length === 0) return 0;
    const session = await api.session();
    if (session?.businessId !== business) throw new Error('mobile_sync_account_conflict');
    let sent = 0;
    let firstFailure: unknown;
    const blocked = new Set<string>();
    for (const item of queue) {
      if (item.document.sourceDocumentId && blocked.has(item.document.sourceDocumentId)) continue;
      try {
        const { logoSnapshot, ...document } = item.document;
        const logoBase64 = logoSnapshot ? await binaryBase64(logoSnapshot) : null;
        await api.pushDocument(business, { ...document, logoBase64 });
        await store.acknowledgeSync(business, item.documentId, item.sequence);
        sent++;
      } catch (error) {
        blocked.add(item.documentId);
        firstFailure ??= error;
        if (!(error instanceof Error) || ['mobile_network_error', 'mobile_offline', 'mobile_sync_account_conflict',
          'mobile_sms_rate_limited', 'unauthenticated', 'mobile_sms_disabled'].includes(error.message)) break;
      }
    }
    if (firstFailure) throw firstFailure;
    return sent;
  })();
  active.set(store, task);
  try {
    return await task;
  } finally {
    active.delete(store);
  }
}
