import { defaultOfflineSettings } from './offlineSettings';
import type { OfflineSnapshot } from './offlineStore';

const format = 'factorsaaz-offline';
export const backupMaxBytes = 32 * 1024 * 1024;

type ObjectRecord = Record<string, unknown>;
type EncodedImage = { type: string; base64: string };
type EncodedSnapshot = {
  profile?: Omit<NonNullable<OfflineSnapshot['profile']>, 'logo' | 'officialLogo'> & {
    logo?: EncodedImage; officialLogo?: EncodedImage;
  };
  documents: (Omit<OfflineSnapshot['documents'][number], 'logoSnapshot'> & { logoSnapshot?: EncodedImage })[];
} & Pick<OfflineSnapshot, 'customers' | 'drafts' | 'payments'>;

function assert(condition: unknown): asserts condition {
  if (!condition) throw new RangeError('backup_invalid');
}

function object(value: unknown): ObjectRecord {
  assert(value && typeof value === 'object' && !Array.isArray(value));
  return value as ObjectRecord;
}

function records(value: unknown): ObjectRecord[] {
  assert(Array.isArray(value));
  return value.map(object);
}

function string(value: unknown): asserts value is string {
  assert(typeof value === 'string');
}

function fields(record: ObjectRecord, keys: readonly string[]) {
  keys.forEach(key => string(record[key]));
}

function money(value: unknown): bigint {
  assert(typeof value === 'string' && /^(0|[1-9][0-9]{0,18})$/.test(value));
  return BigInt(value);
}

function shape(value: unknown, sample: unknown): void {
  if (Array.isArray(sample)) {
    assert(Array.isArray(value));
  } else if (typeof sample === 'object' && sample !== null) {
    const record = object(value);
    for (const [key, field] of Object.entries(sample)) shape(record[key], field);
  } else {
    assert(typeof value === typeof sample);
    if (typeof value === 'number') assert(Number.isSafeInteger(value));
  }
}

const defaults = defaultOfflineSettings();
function settings(value: unknown) {
  shape(value, defaults);
  const data = value as typeof defaults;
  assert(data.document.numberPadding >= 1 && data.document.numberPadding <= 32);
  assert(data.financial.taxRateBasisPoints >= 0 && data.financial.taxRateBasisPoints <= 10000);
  for (const payment of [data.payment, data.officialPayment]) {
    for (const account of records(payment.accounts)) fields(account, ['cardNumber', 'sheba', 'bankName', 'accountHolder']);
  }
  for (const adjustment of records(data.financial.customAdjustments)) {
    fields(adjustment, ['label', 'direction', 'amountBaseUnit']);
  }
}

async function encodeImage(blob?: Blob): Promise<EncodedImage | undefined> {
  if (!blob) return undefined;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { type: blob.type, base64: btoa(binary) };
}

function decodeImage(value: unknown): Blob | undefined {
  if (value === undefined) return undefined;
  const image = object(value);
  fields(image, ['type', 'base64']);
  const { type, base64 } = image as EncodedImage;
  assert(['', 'image/png', 'image/jpeg', 'image/webp'].includes(type));
  try {
    return new Blob([Uint8Array.from(atob(base64), char => char.charCodeAt(0))], { type });
  } catch {
    throw new RangeError('backup_invalid');
  }
}

export async function encodeOfflineBackup(snapshot: OfflineSnapshot): Promise<string> {
  const { profile, documents, ...data } = snapshot;
  const encoded: EncodedSnapshot = {
    ...data,
    profile: profile && { settings: profile.settings, logo: await encodeImage(profile.logo), officialLogo: await encodeImage(profile.officialLogo) },
    documents: [],
  };
  for (const doc of documents) encoded.documents.push({ ...doc, logoSnapshot: await encodeImage(doc.logoSnapshot) });
  const json = JSON.stringify({ format, version: 1, data: encoded });
  if (new TextEncoder().encode(json).length > backupMaxBytes) throw new RangeError('backup_too_large');
  return json;
}

export function decodeOfflineBackup(json: string): OfflineSnapshot {
  if (new TextEncoder().encode(json).length > backupMaxBytes) throw new RangeError('backup_too_large');
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new RangeError('backup_invalid'); }
  const envelope = object(parsed);
  assert(envelope.format === format);
  if (envelope.version !== 1) throw new RangeError('backup_version_unsupported');
  const data = object(envelope.data);

  let profile: OfflineSnapshot['profile'];
  if (data.profile !== undefined) {
    const item = object(data.profile);
    settings(item.settings);
    profile = {
      settings: item.settings as typeof defaults,
      logo: decodeImage(item.logo),
      officialLogo: decodeImage(item.officialLogo),
    };
  }

  const customers = records(data.customers);
  const customerIds = new Set<unknown>(customers.map(customer => {
    fields(customer, ['id', 'displayName', 'phone', 'normalizedMobile', 'address', 'nationalId']);
    assert(customer.id && typeof customer.isOfficial === 'boolean');
    return customer.id;
  }));
  assert(customerIds.size === customers.length);

  const archive = records(data.documents);
  const documentsById = new Map(archive.map(doc => [doc.id, doc]));
  assert(documentsById.size === archive.length);
  const documents = archive.map(doc => {
    fields(doc, ['id', 'customerId', 'customerName', 'documentNumber', 'issuedAt']);
    assert(doc.id && doc.documentNumber && customerIds.has(doc.customerId));
    assert(doc.documentType === 'proforma' || doc.documentType === 'invoice');
    assert(doc.lifecycleStatus === 'issued' && doc.currencyUnit === 'rial');
    assert(Number.isSafeInteger(doc.version) && Number.isFinite(Date.parse(String(doc.issuedAt))));
    assert(typeof doc.canIssueFinalInvoice === 'boolean');
    for (const key of ['issueDate', 'validUntil', 'customerPhone', 'customerAddress', 'shippingMethod', 'nationalId', 'notes']) {
      if (doc[key] != null) string(doc[key]);
    }
    const total = money(doc.grandTotalBaseUnit);
    const paid = money(doc.paidAmountBaseUnit);
    assert(total > 0n && paid + money(doc.remainingAmountBaseUnit) === total);
    assert(doc.settlementStatus === (paid === 0n ? 'unpaid' : paid === total ? 'paid' : 'partial'));
    money(doc.subtotalBaseUnit);
    money(doc.discountBaseUnit);
    money(doc.surchargeBaseUnit);
    if (doc.taxTotalBaseUnit !== undefined) money(doc.taxTotalBaseUnit);
    settings(doc.settingsSnapshot);
    const lines = records(doc.items);
    assert(lines.length > 0);
    for (const line of lines) {
      fields(line, ['title', 'description']);
      assert(Number.isSafeInteger(line.position));
      assert(money(line.quantityMilli) > 0n);
      money(line.unitPriceBaseUnit);
      money(line.lineTotalBaseUnit);
      if (line.discountBaseUnit !== undefined) money(line.discountBaseUnit);
      if (line.taxBaseUnit !== undefined) money(line.taxBaseUnit);
    }
    if (doc.sourceDocumentId !== null) {
      const source = documentsById.get(doc.sourceDocumentId);
      assert(doc.documentType === 'invoice' && source?.documentType === 'proforma' && source.settlementStatus === 'paid');
    }
    if (doc.documentType === 'proforma') {
      const payments = records(doc.payments);
      let sum = 0n;
      for (const payment of payments) {
        fields(payment, ['id', 'paid_at', 'method', 'reference_text', 'note', 'status']);
        sum += money(payment.amount_base_unit);
      }
      assert(sum === paid && doc.canIssueFinalInvoice === (paid === total));
    } else {
      assert(doc.payments === undefined && paid === total && !doc.canIssueFinalInvoice);
    }
    return { ...doc, logoSnapshot: decodeImage(doc.logoSnapshot) } as unknown as OfflineSnapshot['documents'][number];
  });

  const drafts = records(data.drafts);
  for (const draft of drafts) {
    assert(typeof draft.id === 'string' && draft.id && !documentsById.has(draft.id));
    const input = object(draft.input);
    assert(input.documentType === 'proforma' || input.documentType === 'invoice');
    assert(typeof input.isOfficial === 'boolean');
    const customer = object(input.customer);
    fields(customer, ['displayName', 'phone']);
    assert(customer.id === undefined || customerIds.has(customer.id));
    const lines = records(input.items);
    assert(lines.length > 0);
    for (const line of lines) {
      fields(line, ['title', 'quantityMilli', 'unitPriceBaseUnit']);
      if (line.discountBaseUnit !== undefined) string(line.discountBaseUnit);
    }
  }

  const payments = records(data.payments);
  const paymentAmounts = new Map<unknown, string[]>();
  for (const payment of payments) {
    fields(payment, ['id', 'documentId', 'amount']);
    assert(payment.id && money(payment.amount) > 0n);
    const doc = documentsById.get(payment.documentId);
    assert(doc?.documentType === 'proforma');
    const amounts = paymentAmounts.get(payment.documentId) ?? [];
    amounts.push(String(payment.amount));
    paymentAmounts.set(payment.documentId, amounts);
  }
  for (const doc of documents) {
    const expected = (doc.payments ?? []).map(payment => payment.amount_base_unit).sort();
    assert(JSON.stringify(expected) === JSON.stringify((paymentAmounts.get(doc.id) ?? []).sort()));
  }

  return {
    profile, documents,
    customers: customers as unknown as OfflineSnapshot['customers'],
    drafts: drafts as unknown as OfflineSnapshot['drafts'],
    payments: payments as unknown as OfflineSnapshot['payments'],
  };
}
