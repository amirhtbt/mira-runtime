import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import type { CustomerProfile, DraftInput } from '../api/client';
import { calculateOfflineSale } from './offlineSale';
import { defaultOfflineSettings } from './offlineSettings';
import type { LocalDocument, LocalDraft, OfflineProfile, OfflineStore } from './offlineStore';

const OfflinePdfActions = lazy(() => import('./OfflinePdfActions')
  .then(module => ({ default: module.OfflinePdfActions })));

type Page = 'archive' | 'editor' | 'document' | 'settings';
const statuses = { unpaid: 'تسویه‌نشده', partial: 'پرداخت بخشی', paid: 'تسویه‌شده' };
const emptyItem = () => ({ title: '', quantityMilli: '1000', unitPriceBaseUnit: '', discountBaseUnit: '' });
const amount = (value: string) => value.replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
  .replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
  .replace(/[٬,\s]/g, '').replace(/^0+(?=\d)/, '');
const rials = (value: string) => BigInt(value).toLocaleString('fa-IR') + ' ریال';

function newDraft(): LocalDraft {
  return {
    id: crypto.randomUUID(),
    input: {
      documentType: 'proforma', customer: { displayName: '', phone: '' }, isOfficial: false,
      validityDays: 7, items: [emptyItem()],
    },
  };
}

function copyDocument(doc: LocalDocument): LocalDraft {
  return {
    id: crypto.randomUUID(),
    input: {
      documentType: doc.documentType, isOfficial: Boolean(doc.isOfficial),
      customer: { displayName: doc.customerName, phone: doc.customerPhone ?? '', nationalId: doc.nationalId },
      address: doc.customerAddress, shippingMethod: doc.shippingMethod, validityDays: doc.validityDays,
      notes: doc.notes,
      items: doc.items.map(item => ({
        title: item.title, description: item.description, quantityMilli: String(item.quantityMilli),
        unitPriceBaseUnit: String(item.unitPriceBaseUnit), discountBaseUnit: String(item.discountBaseUnit ?? ''),
      })),
    },
  };
}

function quantityText(milli: string) {
  return /^\d+$/.test(milli) ? String(Number(milli) / 1000) : milli;
}

const messages: Record<string, string> = {
  customer_name_invalid: 'نام مشتری را کامل کنید.',
  customer_mobile_invalid: 'شماره همراه ایران را وارد کنید.',
  item_title_invalid: 'شرح همهٔ اقلام را وارد کنید.',
  invalid_amount: 'تعداد، مبلغ و تخفیف ردیف‌ها را بررسی کنید.',
  quantity_invalid: 'تعداد باید بیشتر از صفر باشد.',
  document_total_required: 'مبلغ نهایی سند باید بیشتر از صفر باشد.',
  line_discount_exceeds_total: 'تخفیف از مبلغ ردیف بیشتر است.',
  full_payment_confirmation_required: 'برای صدور فاکتور، دریافت کامل مبلغ را تأیید کنید.',
  overpayment_rejected: 'مبلغ پرداخت از مانده بیشتر است.',
  payment_amount_invalid: 'مبلغ پرداخت معتبر وارد کنید.',
  validity_days_invalid: 'اعتبار را بین صفر تا ۳۶۵ روز وارد کنید.',
  official_profile_incomplete: 'پروفایل فروشندهٔ رسمی، حساب و لوگوی رسمی باید کامل باشند.',
  national_id_required: 'شناسهٔ ملی ۱۰ یا ۱۱ رقمی مشتری را وارد کنید.',
};

export function OfflineApp({ store }: { store: OfflineStore }) {
  const [page, setPage] = useState<Page>('archive');
  const [draft, setDraft] = useState(newDraft);
  const [quantities, setQuantities] = useState(['1']);
  const [doc, setDoc] = useState<LocalDocument>();
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [profile, setProfile] = useState<OfflineProfile>({ settings: defaultOfflineSettings() });
  const [paid, setPaid] = useState(false);
  const [payment, setPayment] = useState('');
  const paymentKey = useRef<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const [nextDocuments, nextDrafts, nextCustomers, nextProfile] = await Promise.all([
      store.listDocuments(), store.listDrafts(), store.listCustomers(), store.getProfile(),
    ]);
    setDocuments(nextDocuments);
    setDrafts(nextDrafts);
    setCustomers(nextCustomers);
    if (nextProfile) setProfile(nextProfile);
  }

  useEffect(() => {
    void refresh().catch(() => setError('خواندن اطلاعات گوشی انجام نشد.'));
  }, [store]);

  async function run(operation: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
    } catch (failure) {
      setError(failure instanceof Error && messages[failure.message]
        ? messages[failure.message] : 'عملیات انجام نشد. اطلاعات را بررسی کنید و دوباره تلاش کنید.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function go(next: Page) {
    setError('');
    setNotice('');
    setPage(next);
  }

  function edit(next: LocalDraft) {
    setDraft(next);
    setQuantities(next.input.items.map(item => quantityText(item.quantityMilli)));
    setPaid(false);
    go('editor');
  }

  function show(next: LocalDocument) {
    setDoc(next);
    setPayment('');
    paymentKey.current = undefined;
    go('document');
  }

  const { input } = draft;
  const patch = (value: Partial<DraftInput>) => setDraft(current => ({
    ...current, input: { ...current.input, ...value },
  }));
  const updateItem = (index: number, value: Partial<DraftInput['items'][number]>) => {
    patch({ items: input.items.map((item, i) => i === index ? { ...item, ...value } : item) });
  };
  const prepared = (): DraftInput => ({
    ...input,
    items: input.items.map(item => ({ ...item, discountBaseUnit: item.discountBaseUnit || '0' })),
  });
  let total: string | undefined;
  try {
    total = calculateOfflineSale(prepared().items, input.isOfficial ? profile.settings.financial.taxRateBasisPoints : 0).total;
  } catch { /* Incomplete rows have no total yet. */ }

  return <main className="page sales-page offline-app" dir="rtl">
    <header className="offline-header">
      <h1>فاکتورساز بهار</h1>
      {page !== 'archive' && <button className="secondary-button" type="button" disabled={busy}
        onClick={() => go('archive')}>بازگشت به آرشیو</button>}
    </header>
    {error && <p role="alert" className="sales-message">{error}</p>}
    {notice && <p role="status">{notice}</p>}

    {page === 'archive' && <>
      <div className="offline-actions">
        <button className="primary-button" onClick={() => edit(newDraft())}>سند جدید</button>
        <button className="secondary-button" onClick={() => go('settings')}>تنظیمات فروشنده</button>
      </div>
      {drafts.length > 0 && <section className="sales-card offline-section">
        <h2>پیش‌نویس‌ها</h2>
        {drafts.map(item => <button className="secondary-button" key={item.id} onClick={() => edit(item)}>
          ادامهٔ پیش‌نویس · {item.input.customer.displayName || 'بدون نام مشتری'}
        </button>)}
      </section>}
      <section className="sales-card offline-section">
        <h2>آرشیو روی گوشی</h2>
        {documents.length === 0 && <p>هنوز سندی صادر نشده است.</p>}
        {documents.map(item => <button className="secondary-button offline-archive-entry" key={item.id} onClick={() => show(item)}>
          <strong>{item.customerName}</strong>
          <bdi>{item.documentNumber}</bdi>
          <span>{rials(item.grandTotalBaseUnit)} · {statuses[item.settlementStatus]}</span>
        </button>)}
      </section>
    </>}

    {page === 'editor' && <form noValidate onSubmit={(event: FormEvent) => {
      event.preventDefault();
      void run(async () => {
        const issued = await store.issue(draft.id, prepared(), paid);
        show(issued);
        await refresh();
      });
    }}>
      <fieldset disabled={busy} className="sales-card offline-section">
        <legend>مشخصات سند</legend>
        <label>نوع سند<select value={input.documentType} onChange={e => {
          patch({ documentType: e.target.value === 'invoice' ? 'invoice' : 'proforma' });
          setPaid(false);
        }}>
          <option value="proforma">پیش‌فاکتور</option><option value="invoice">فاکتور فروش</option>
        </select></label>
        {customers.length > 0 && <label>انتخاب از مشتریان ذخیره‌شده<select value={input.customer.id ?? ''}
          onChange={e => {
            const customer = customers.find(item => item.id === e.target.value);
            if (customer) patch({ customer, address: customer.address, isOfficial: customer.isOfficial });
            else patch({ customer: { displayName: '', phone: '' }, address: '', isOfficial: false });
          }}>
          <option value="">انتخاب مشتری</option>
          {customers.map(item => <option key={item.id} value={item.id}>{item.displayName} · {item.phone}</option>)}
        </select></label>}
        <label>نام مشتری یا شرکت<input value={input.customer.displayName} onChange={e => patch({
          customer: { ...input.customer, id: undefined, displayName: e.target.value },
        })} /></label>
        <label>شماره همراه<input dir="ltr" inputMode="tel" value={input.customer.phone} onChange={e => patch({
          customer: { ...input.customer, id: undefined, phone: e.target.value },
        })} /></label>
        <label className="offline-checkbox"><input type="checkbox" checked={input.isOfficial}
          onChange={e => patch({ isOfficial: e.target.checked })} /> سند رسمی</label>
        {input.isOfficial && <label>شناسهٔ ملی مشتری<input inputMode="numeric" value={input.customer.nationalId ?? ''}
          onChange={e => patch({ customer: { ...input.customer, nationalId: e.target.value } })} /></label>}
        <label>نشانی مشتری<input value={input.address ?? ''} onChange={e => patch({ address: e.target.value })} /></label>
        <label>شیوهٔ ارسال<select value={input.shippingMethod ?? ''} onChange={e => patch({ shippingMethod: e.target.value })}>
          <option value="">انتخاب نشده</option><option value="pickup">تحویل حضوری</option>
          <option value="snapp_box">پیک اسنپ‌باکس</option><option value="snapp_car">ماشین اسنپ</option>
          <option value="snapp_van">وانت اسنپ</option><option value="post">پست</option><option value="tipax">تیپاکس</option>
        </select></label>
        {input.documentType === 'proforma' && <label>اعتبار (روز)<input type="number" min="0" max="365"
          value={input.validityDays ?? ''} onChange={e => patch({ validityDays: e.target.value === '' ? null : Number(e.target.value) })} /></label>}
        <label>توضیحات<textarea value={input.notes ?? ''} onChange={e => patch({ notes: e.target.value })} /></label>
      </fieldset>
      <fieldset disabled={busy} className="sales-card offline-section">
        <legend>اقلام سند</legend>
        {input.items.map((item, index) => <div className="item-editor offline-section" key={index}>
          <label>شرح کالا یا خدمت<input value={item.title} onChange={e => updateItem(index, { title: e.target.value })} /></label>
          <div className="item-numbers">
            <label>تعداد<input inputMode="decimal" value={quantities[index] ?? ''}
              onChange={e => {
                const raw = e.target.value;
                setQuantities(current => current.map((quantity, i) => i === index ? raw : quantity));
                const value = amount(raw).replace('٫', '.');
                const match = /^(\d+)(?:\.(\d{0,3}))?$/.exec(value);
                updateItem(index, { quantityMilli: match
                  ? String(BigInt(match[1]) * 1000n + BigInt((match[2] ?? '').padEnd(3, '0'))) : '' });
              }} /></label>
            <label>مبلغ واحد (ریال)<input inputMode="numeric" value={item.unitPriceBaseUnit}
              onChange={e => updateItem(index, { unitPriceBaseUnit: amount(e.target.value) })} /></label>
          </div>
          <label>تخفیف ردیف (ریال)<input inputMode="numeric" value={item.discountBaseUnit ?? ''}
            onChange={e => updateItem(index, { discountBaseUnit: amount(e.target.value) })} /></label>
          {input.items.length > 1 && <button type="button" className="secondary-button"
            onClick={() => {
              setQuantities(current => current.filter((_, i) => index !== i));
              patch({ items: input.items.filter((_, i) => index !== i) });
            }}>حذف ردیف</button>}
        </div>)}
        <button type="button" className="secondary-button" onClick={() => {
          setQuantities(current => [...current, '1']);
          patch({ items: [...input.items, emptyItem()] });
        }}>افزودن ردیف</button>
        {total !== undefined && <output>مبلغ نهایی {rials(total)}</output>}
        {input.documentType === 'invoice' && <label className="offline-checkbox"><input type="checkbox"
          checked={paid} onChange={e => setPaid(e.target.checked)} /> کل مبلغ را دریافت کرده‌ام</label>}
        <div className="offline-actions">
          <button className="primary-button" type="submit">صدور {input.documentType === 'invoice' ? 'فاکتور' : 'پیش‌فاکتور'}</button>
          <button type="button" className="secondary-button" onClick={() => void run(async () => {
            await store.saveDraft(draft);
            await refresh();
            go('archive');
            setNotice('پیش‌نویس روی گوشی ذخیره شد.');
          })}>ذخیرهٔ پیش‌نویس</button>
        </div>
      </fieldset>
    </form>}

    {page === 'document' && doc && <section className="sales-card offline-section">
      <h2>{doc.documentType === 'invoice' ? 'فاکتور فروش' : 'پیش‌فاکتور'} · {doc.customerName}</h2>
      <bdi>{doc.documentNumber}</bdi>
      <span>تاریخ صدور {doc.issueDate}{doc.validUntil && ' · معتبر تا ' + doc.validUntil}</span>
      <strong>{rials(doc.grandTotalBaseUnit)} · {statuses[doc.settlementStatus]}</strong>
      {doc.items.map(item => <div className="money-row" key={item.position}>
        <span>{item.title} × {quantityText(String(item.quantityMilli))}</span>
        <b>{rials(String(item.lineTotalBaseUnit))}</b>
      </div>)}
      {doc.documentType === 'proforma' && <p>مانده {rials(doc.remainingAmountBaseUnit)}</p>}
      {doc.documentType === 'proforma' && !doc.canIssueFinalInvoice && <div className="offline-actions">
        <label>مبلغ پرداخت (ریال)<input inputMode="numeric" value={payment} disabled={busy} onChange={e => {
          setPayment(amount(e.target.value));
          paymentKey.current = undefined;
        }} /></label>
        <button className="primary-button" disabled={busy} onClick={() => void run(async () => {
          paymentKey.current ??= crypto.randomUUID();
          const updated = await store.recordPayment(doc.id, paymentKey.current, payment);
          show(updated);
          await refresh();
        })}>ثبت پرداخت</button>
      </div>}
      {doc.canIssueFinalInvoice && <button className="primary-button" disabled={busy} onClick={() => void run(async () => {
        show(await store.convert(doc.id));
        await refresh();
      })}>صدور فاکتور نهایی</button>}
      <Suspense fallback={<p role="status">در حال آماده‌سازی ابزار PDF…</p>}>
        <OfflinePdfActions key={doc.id} doc={doc} />
      </Suspense>
      <button className="secondary-button" disabled={busy} onClick={() => edit(copyDocument(doc))}>کپی سند قبلی</button>
    </section>}

    {page === 'settings' && <form noValidate onSubmit={e => {
      e.preventDefault();
      void run(async () => {
        await store.saveProfile(profile);
        setNotice('تنظیمات روی گوشی ذخیره شدند.');
      });
    }}>
      <fieldset disabled={busy} className="sales-card offline-section">
        <legend>تنظیمات فروشنده</legend>
        <label>نام کسب‌وکار<input value={profile.settings.seller.businessName} onChange={e => {
          const businessName = e.target.value;
          setProfile(current => ({ ...current, settings: {
            ...current.settings, seller: { ...current.settings.seller, businessName },
          } }));
        }} /></label>
        <label>لوگو<input type="file" accept="image/png,image/jpeg,image/webp"
          onChange={e => { const logo = e.target.files?.[0]; if (logo) setProfile(current => ({ ...current, logo })); }} />
        </label>
        {profile.logo && <button type="button" className="secondary-button"
          onClick={() => setProfile(current => ({ ...current, logo: undefined }))}>حذف لوگو</button>}
        <button className="primary-button">ذخیرهٔ تنظیمات</button>
      </fieldset>
    </form>}
  </main>;
}
