import type { CustomerProfile, DocumentType, DraftInput, SalesDocument } from '../api/client';
import { normalizePhone } from '../format/phone';
import type { BusinessSettings } from '../settings/types';
import { offlineDates } from './offlineDate';
import { calculateOfflineSale } from './offlineSale';
import { defaultOfflineSettings } from './offlineSettings';

export interface OfflineProfile {
  settings: BusinessSettings;
  logo?: Blob;
  officialLogo?: Blob;
}

export interface LocalDocument extends SalesDocument {
  documentNumber: string;
  lifecycleStatus: 'issued';
  currencyUnit: 'rial';
  settingsSnapshot: BusinessSettings;
  logoSnapshot?: Blob;
  issuedAt: string;
}

interface Numbering {
  series: string;
  last: Record<DocumentType, number>;
}

export interface LocalDraft {
  id: string;
  input: DraftInput;
}

export interface OfflineSnapshot {
  profile?: OfflineProfile;
  customers: CustomerProfile[];
  documents: LocalDocument[];
  drafts: LocalDraft[];
  payments: { id: string; documentId: string; amount: string }[];
}

const backupStores = ['profile', 'customers', 'documents', 'drafts', 'payments'];

export interface PendingSyncDocument {
  documentId: string;
  sequence: string;
  document: LocalDocument;
}

const schemaVersion = 3;
const shippingMethods = ['', 'pickup', 'snapp_box', 'snapp_car', 'snapp_van', 'post', 'tipax'];

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function text(value: string, max: number, field: string, required = false) {
  const clean = value.trim();
  if ((required && !clean) || Array.from(clean).length > max || clean.includes('<')) {
    throw new RangeError(field + '_invalid');
  }
  return clean;
}

function customerMobile(value: string) {
  const number = normalizePhone(value.replace(/[^0-9+۰-۹٠-٩]/g, ''));
  if (!/^09[0-9]{9}$/.test(number)) throw new RangeError('customer_mobile_invalid');
  return number;
}

export async function openOfflineStore(name = 'factorsaaz-offline') {
  const request = indexedDB.open(name, schemaVersion);
  request.onupgradeneeded = event => {
    const db = request.result;
    if (event.oldVersion < 3) {
      db.createObjectStore('syncAccount');
      db.createObjectStore('syncOutbox', { keyPath: 'documentId' });
    }
    if (event.oldVersion < 2) db.createObjectStore('drafts', { keyPath: 'id' });
    if (event.oldVersion !== 0) return;
    db.createObjectStore('profile');
    db.createObjectStore('customers', { keyPath: 'id' });
    db.createObjectStore('numbering');
    const documents = db.createObjectStore('documents', { keyPath: 'id' });
    documents.createIndex('documentNumber', 'documentNumber', { unique: true });
    documents.createIndex('sourceDocumentId', 'sourceDocumentId', { unique: true });
    db.createObjectStore('payments', { keyPath: 'id' });
  };
  const db = await result(request);
  db.onversionchange = () => db.close();
  return new OfflineStore(db);
}

export class OfflineStore {
  constructor(private readonly db: IDBDatabase) {}

  close() { this.db.close(); }

  private async transact<T>(
    stores: string[], mode: IDBTransactionMode, operation: (tx: IDBTransaction) => Promise<T>,
  ): Promise<T> {
    const tx = this.db.transaction(stores, mode, { durability: 'strict' });
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('offline_transaction_aborted'));
    });
    // A request can abort before its awaiting operation has returned.
    void done.catch(() => {});
    try {
      const value = await operation(tx);
      await done;
      return value;
    } catch (error) {
      try { tx.abort(); } catch { /* transaction already ended */ }
      await done.catch(() => {});
      throw error;
    }
  }

  async prepareSync(businessId: string): Promise<void> {
    if (!businessId.trim()) throw new RangeError('sync_account_required');
    await this.transact(['syncAccount', 'syncOutbox', 'documents'], 'readwrite', async tx => {
      const account = tx.objectStore('syncAccount');
      const current = await result<string | undefined>(account.get('business'));
      if (current === businessId) return;
      if (current) throw new RangeError('sync_account_conflict');
      await result(account.add(businessId, 'business'));
      const documents: LocalDocument[] = await result(tx.objectStore('documents').getAll());
      for (const document of documents) await this.queueDocument(tx, document, businessId);
    });
  }

  syncBusiness(): Promise<string | undefined> {
    return this.transact(['syncAccount'], 'readonly', tx => result(tx.objectStore('syncAccount').get('business')));
  }

  pendingSync(businessId: string): Promise<PendingSyncDocument[]> {
    return this.transact(['syncAccount', 'syncOutbox', 'documents'], 'readonly', async tx => {
      if (await result(tx.objectStore('syncAccount').get('business')) !== businessId) return [];
      const records: Array<Omit<PendingSyncDocument, 'document'>> = await result(tx.objectStore('syncOutbox').getAll());
      const pending = await Promise.all(records.map(async record => ({
        ...record, document: await result<LocalDocument>(tx.objectStore('documents').get(record.documentId)),
      })));
      // A converted invoice references a proforma, which must be accepted first.
      return pending.sort((a, b) => Number(Boolean(a.document.sourceDocumentId)) - Number(Boolean(b.document.sourceDocumentId))
        || a.document.issuedAt.localeCompare(b.document.issuedAt) || a.documentId.localeCompare(b.documentId));
    });
  }

  async acknowledgeSync(businessId: string, documentId: string, sequence: string): Promise<boolean> {
    return this.transact(['syncAccount', 'syncOutbox'], 'readwrite', async tx => {
      if (await result(tx.objectStore('syncAccount').get('business')) !== businessId) return false;
      const outbox = tx.objectStore('syncOutbox');
      const pending = await result<Omit<PendingSyncDocument, 'document'> | undefined>(outbox.get(documentId));
      if (pending?.sequence !== sequence) return false;
      await result(outbox.delete(documentId));
      return true;
    });
  }

  private async queueDocument(tx: IDBTransaction, document: LocalDocument, businessId?: string) {
    const target = businessId ?? await result<string | undefined>(tx.objectStore('syncAccount').get('business'));
    if (!target) return;
    await result(tx.objectStore('syncOutbox').put({ documentId: document.id, sequence: crypto.randomUUID() }));
  }

  getProfile(): Promise<OfflineProfile | undefined> {
    return this.transact(['profile'], 'readonly', tx => result(tx.objectStore('profile').get('current')));
  }

  async saveProfile(profile: OfflineProfile) {
    await this.transact(['profile'], 'readwrite', tx => result(tx.objectStore('profile').put(profile, 'current')));
  }

  listCustomers(): Promise<CustomerProfile[]> {
    return this.transact(['customers'], 'readonly', tx => result(tx.objectStore('customers').getAll()));
  }

  async saveCustomer(customer: CustomerProfile) {
    await this.transact(['customers'], 'readwrite', tx => result(tx.objectStore('customers').put(customer)));
  }

  listDocuments(): Promise<LocalDocument[]> {
    return this.transact(['documents'], 'readonly', async tx => {
      const documents: LocalDocument[] = await result(tx.objectStore('documents').getAll());
      return documents.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || a.id.localeCompare(b.id));
    });
  }

  async setArchived(id: string, archived: boolean): Promise<LocalDocument> {
    return this.transact(['documents', 'syncAccount', 'syncOutbox'], 'readwrite', async tx => {
      const store = tx.objectStore('documents');
      const document: LocalDocument | undefined = await result(store.get(id));
      if (!document) throw new RangeError('document_not_found');
      const updated = { ...document, version: document.version + 1, archivedAt: archived ? new Date().toISOString() : null };
      await result(store.put(updated));
      await this.queueDocument(tx, updated);
      return updated;
    });
  }

  listDrafts(): Promise<LocalDraft[]> {
    return this.transact(['drafts'], 'readonly', tx => result(tx.objectStore('drafts').getAll()));
  }

  async saveDraft(draft: LocalDraft) {
    await this.transact(['drafts', 'documents'], 'readwrite', async tx => {
      if (await result(tx.objectStore('documents').getKey(draft.id))) {
        throw new RangeError('finalized_document_immutable');
      }
      await result(tx.objectStore('drafts').put(draft));
    });
  }

  readSnapshot(): Promise<OfflineSnapshot> {
    return this.transact(backupStores, 'readonly', async tx => {
      const [profile, customers, documents, drafts, payments] = await Promise.all([
        result(tx.objectStore('profile').get('current')),
        result(tx.objectStore('customers').getAll()),
        result(tx.objectStore('documents').getAll()),
        result(tx.objectStore('drafts').getAll()),
        result(tx.objectStore('payments').getAll()),
      ]);
      return { profile, customers, documents, drafts, payments };
    });
  }

  async restoreSnapshot(snapshot: OfflineSnapshot) {
    await this.transact([...backupStores, 'numbering', 'syncAccount', 'syncOutbox'], 'readwrite', async tx => {
      const counts = await Promise.all([...backupStores, 'numbering'].map(name => result(tx.objectStore(name).count())));
      if (counts.some(count => count !== 0)) throw new RangeError('backup_target_not_empty');
      const { profile, ...records } = snapshot;
      if (profile) await result(tx.objectStore('profile').add(profile, 'current'));
      for (const name of ['customers', 'documents', 'drafts', 'payments'] as const) {
        const store = tx.objectStore(name);
        for (const record of records[name]) await result(store.add(record));
      }
      for (const document of records.documents) await this.queueDocument(tx, document);
    });
  }

  async issue(id: string, input: DraftInput, confirmPaid = false, now = new Date()): Promise<LocalDocument> {
    return this.transact(['documents', 'profile', 'customers', 'numbering', 'drafts', 'syncAccount', 'syncOutbox'], 'readwrite', async tx => {
      const documents = tx.objectStore('documents');
      const issued: LocalDocument | undefined = await result(documents.get(id));
      if (issued) return issued;
      const profile: OfflineProfile | undefined = await result(tx.objectStore('profile').get('current'));
      const settings = profile?.settings ?? defaultOfflineSettings();
      const { documentType, isOfficial } = input;
      if (documentType !== 'proforma' && documentType !== 'invoice') throw new RangeError('document_type_invalid');
      const displayName = text(input.customer.displayName, 160, 'customer_name', true);
      const phone = customerMobile(input.customer.phone);
      const customerId = input.customer.id ?? crypto.randomUUID();
      const saved: CustomerProfile | undefined = input.customer.id
        ? await result(tx.objectStore('customers').get(customerId)) : undefined;
      if (input.customer.id && !saved) throw new RangeError('customer_not_found');
      const address = text(input.address ?? '', 500, 'customer_address');
      const notes = text(input.notes ?? '', 2000, 'notes');
      const shippingMethod = input.shippingMethod ?? '';
      if (!shippingMethods.includes(shippingMethod)) throw new RangeError('shipping_method_invalid');
      const validity = input.validityDays ?? null;
      if (validity !== null && (!Number.isInteger(validity) || validity < 0 || validity > 365)) {
        throw new RangeError('validity_days_invalid');
      }
      const validityDays = documentType === 'proforma' ? validity : null;
      const nationalId = isOfficial
        ? (input.customer.nationalId ?? '').replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[^0-9]/g, '')
        : '';
      if (isOfficial && !/^[0-9]{10,11}$/.test(nationalId)) throw new RangeError('national_id_required');

      const items = input.items.map((item, index) => ({
        ...item, title: text(item.title, 240, 'item_title', true),
        description: (item.description ?? '').trim(), position: index + 1,
      }));
      const taxRateBasisPoints = isOfficial ? settings.financial.taxRateBasisPoints : 0;
      const totals = calculateOfflineSale(items, taxRateBasisPoints);
      if (totals.total === '0') throw new RangeError('document_total_required');
      const paid = documentType === 'invoice';
      if (paid && !confirmPaid) throw new RangeError('full_payment_confirmation_required');

      const logoSnapshot = isOfficial ? profile?.officialLogo : profile?.logo;
      if (isOfficial) {
        const seller = settings.officialSeller;
        const accounts = settings.officialPayment.accounts ?? [];
        const complete = [seller.companyName, seller.address, seller.phone, seller.nationalId].every(v => v.trim())
          && accounts.length > 0 && accounts.every(a => a.sheba.trim() && a.accountHolder.trim())
          && logoSnapshot;
        if (!complete) throw new RangeError('official_profile_incomplete');
      }

      const documentNumber = await this.nextNumber(tx, documentType, settings);
      const document: LocalDocument = {
        id, customerId, customerName: saved?.displayName ?? displayName, customerPhone: saved?.phone ?? phone,
        documentType, lifecycleStatus: 'issued', documentNumber, sourceDocumentId: null,
        settlementStatus: paid ? 'paid' : 'unpaid',
        currencyUnit: 'rial', subtotalBaseUnit: totals.subtotal, discountBaseUnit: totals.discount,
        surchargeBaseUnit: '0', grandTotalBaseUnit: totals.total,
        paidAmountBaseUnit: paid ? totals.total : '0', remainingAmountBaseUnit: paid ? '0' : totals.total,
        version: 1, isOfficial, nationalId, customerAddress: address, shippingMethod, validityDays, notes,
        ...offlineDates(now, validityDays), issuedAt: now.toISOString(), taxRateBasisPoints,
        taxTotalBaseUnit: totals.tax, items: items.map((item, index) => ({ ...item, ...totals.items[index] })),
        settingsSnapshot: settings, logoPresent: Boolean(logoSnapshot), logoSnapshot,
        canIssueFinalInvoice: false, ...(paid ? {} : { payments: [] }),
      };
      if (!saved) {
        await result(tx.objectStore('customers').add({
          id: customerId, displayName, phone, normalizedMobile: phone, address, isOfficial, nationalId,
        } satisfies CustomerProfile));
      }
      await result(documents.add(document));
      await this.queueDocument(tx, document);
      await result(tx.objectStore('drafts').delete(id));
      return document;
    });
  }

  async recordPayment(documentId: string, key: string, amount: string, now = new Date()): Promise<LocalDocument> {
    if (!/^[1-9][0-9]{0,14}$/.test(amount)) throw new RangeError('payment_amount_invalid');
    const idempotencyKey = key.trim();
    if (!idempotencyKey || new TextEncoder().encode(idempotencyKey).length > 100) {
      throw new RangeError('idempotency_key_invalid');
    }
    return this.transact(['documents', 'payments', 'syncAccount', 'syncOutbox'], 'readwrite', async tx => {
      const documents = tx.objectStore('documents');
      const document: LocalDocument | undefined = await result(documents.get(documentId));
      if (!document) throw new RangeError('document_not_found');
      const payments = tx.objectStore('payments');
      const previous: {documentId: string; amount: string} | undefined = await result(payments.get(idempotencyKey));
      if (previous) {
        if (previous.documentId !== documentId || previous.amount !== amount) {
          throw new RangeError('payment_idempotency_conflict');
        }
        return document;
      }
      if (document.documentType !== 'proforma') throw new RangeError('payment_requires_issued_proforma');
      const remaining = BigInt(document.remainingAmountBaseUnit) - BigInt(amount);
      if (remaining < 0n) throw new RangeError('overpayment_rejected');
      const payment = {
        id: crypto.randomUUID(), amount_base_unit: amount, paid_at: now.toISOString(),
        method: 'manual', reference_text: '', note: '', status: 'confirmed',
      };
      const updated: LocalDocument = {
        ...document,
        version: document.version + 1,
        settlementStatus: remaining === 0n ? 'paid' : 'partial',
        paidAmountBaseUnit: String(BigInt(document.paidAmountBaseUnit) + BigInt(amount)),
        remainingAmountBaseUnit: String(remaining),
        canIssueFinalInvoice: remaining === 0n,
        payments: [...(document.payments ?? []), payment],
      };
      await result(payments.add({ id: idempotencyKey, documentId, amount }));
      await result(documents.put(updated));
      await this.queueDocument(tx, updated);
      return updated;
    });
  }

  async convert(documentId: string, now = new Date()): Promise<LocalDocument> {
    return this.transact(['documents', 'numbering', 'syncAccount', 'syncOutbox'], 'readwrite', async tx => {
      const documents = tx.objectStore('documents');
      const invoice: LocalDocument | undefined = await result(documents.index('sourceDocumentId').get(documentId));
      if (invoice) return invoice;
      const source: LocalDocument | undefined = await result(documents.get(documentId));
      if (!source) throw new RangeError('document_not_found');
      if (source.documentType !== 'proforma' || source.settlementStatus !== 'paid'
        || source.paidAmountBaseUnit !== source.grandTotalBaseUnit) {
        throw new RangeError('proforma_not_fully_paid');
      }
      const { payments: _payments, ...snapshot } = source;
      const converted: LocalDocument = {
        ...snapshot,
        id: crypto.randomUUID(), documentType: 'invoice', sourceDocumentId: source.id,
        documentNumber: await this.nextNumber(tx, 'invoice', source.settingsSnapshot),
        version: 1, validityDays: null, ...offlineDates(now, null), issuedAt: now.toISOString(),
        canIssueFinalInvoice: false, archivedAt: null,
      };
      await result(documents.add(converted));
      await this.queueDocument(tx, converted);
      return converted;
    });
  }

  private async nextNumber(tx: IDBTransaction, type: DocumentType, settings: BusinessSettings) {
    const store = tx.objectStore('numbering');
    const current: Numbering = (await result(store.get('active'))) ?? {
      series: crypto.randomUUID(), last: { proforma: 0, invoice: 0 },
    };
    const number = current.last[type] + 1;
    if (!Number.isSafeInteger(number)) throw new RangeError('document_sequence_exhausted');
    current.last[type] = number;
    await result(store.put(current, 'active'));
    const { proformaPrefix, invoicePrefix, numberPadding } = settings.document;
    return [type === 'proforma' ? proformaPrefix : invoicePrefix, current.series,
      String(number).padStart(numberPadding, '0')].join('-');
  }
}
