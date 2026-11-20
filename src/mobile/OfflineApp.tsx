import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { CustomerProfile, DraftInput } from '../api/client';
import { AppFrame, Home, type AppTab } from '../AppFrame';
import { DocumentsPage } from '../sales/DocumentsPage';
import { offlineHistorySource } from './offlineHistorySource';
import { SettingsPage } from '../settings/SettingsPage';
import { dispatchOfflineSync } from './dispatchOfflineSync';
import { mobileAccountApi } from './mobileAccountApi';
import { MobileAccountPanel } from './MobileAccountPanel';
import { TemplatesPage } from '../templates/TemplatesPage';
import { offlineSettingsSource } from './offlineSettingsSource';
import { calculateOfflineSale } from './offlineSale';
import { defaultOfflineSettings } from './offlineSettings';
import type { LocalDocument, LocalDraft, OfflineProfile, OfflineStore } from './offlineStore';

const OfflinePdfActions = lazy(() => import('./OfflinePdfActions')
  .then(module => ({ default: module.OfflinePdfActions })));

const OfflineBackupActions = lazy(() => import('./OfflineBackupActions')
  .then(module => ({ default: module.OfflineBackupActions })));

type Page = AppTab | 'editor' | 'document';
const statuses = { unpaid: 'تسویه‌نشده', partial: 'پرداخت بخشی', paid: 'تسویه‌شده' };
const emptyItem = () => ({ title: '', quantityMilli: '1000', unitPriceBaseUnit: '', discountBaseUnit: '' });
const amount = (value: string) => value.replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
  .replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
  .replace(/[٬,\s]/g, '').replace(/^0+(?=\d)/, '');
const rials = (value: string) => BigInt(value).toLocaleString('fa-IR') + ' ریال';

function newDraft(validityDays = 7): LocalDraft {
  return {
    id: crypto.randomUUID(),
    input: {
      documentType: 'proforma', customer: { displayName: '', phone: '' }, isOfficial: false,
      validityDays, items: [emptyItem()],
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
  const [page, setPage] = useState<Page>('home');
  const [draft, setDraft] = useState(() => newDraft());
  const [settingsRevision, setSettingsRevision] = useState(0);
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

  const refresh = useCallback(async () => {
    const [nextDocuments, nextDrafts, nextCustomers, nextProfile] = await Promise.all([
      store.listDocuments(), store.listDrafts(), store.listCustomers(), store.getProfile(),
    ]);
    setDocuments(nextDocuments);
    setDrafts(nextDrafts);
    setCustomers(nextCustomers);
    setProfile(nextProfile ?? { settings: defaultOfflineSettings() });
  }, [store]);
  const history = useMemo(() => offlineHistorySource(store, refresh), [store, refresh]);
  const settings = useMemo(() => offlineSettingsSource(store, refresh), [store, refresh]);
  useEffect(() => () => settings.dispose(), [settings]);

  useEffect(() => {
    void refresh().catch(() => setError('خواندن اطلاعات گوشی انجام نشد.'));
  }, [refresh]);

  useEffect(() => {
    if (!mobileAccountApi.enabled) return;
    const sync = () => {
      if (navigator.onLine !== false) void dispatchOfflineSync(store).catch(() => undefined);
    };
    sync();
    window.addEventListener('online', sync);
    const timer = window.setInterval(sync, 30_000);
    return () => {
      window.removeEventListener('online', sync);
      window.clearInterval(timer);
    };
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
  let totals: ReturnType<typeof calculateOfflineSale> | undefined;
  try {
    totals = calculateOfflineSale(prepared().items, input.isOfficial ? profile.settings.financial.taxRateBasisPoints : 0);
  } catch { /* Incomplete rows have no total yet. */ }

  const creating = page === 'editor' || page === 'document';
  const businessName = profile.settings.seller.displayName || profile.settings.seller.businessName;
  return <AppFrame theme="light" platform="android" tab={creating ? 'invoices' : page}
    creating={creating} contentKey={page} subtitle="فاکتورساز اندروید" badge="آفلاین"
    onTab={tab => { if (!busy) go(tab); }} onCreate={() => { if (!busy) edit(newDraft(profile.settings.document.validityDays)); }}>
    {error && <p role="alert" className="sales-message">{error}</p>}
    {notice && <p role="status" className="page">{notice}</p>}
    {page === 'home' && <Home data={{
      businessName, settingsComplete: Boolean(businessName), hasDocuments: documents.length > 0,
      recentInvoices: documents.filter(item => !item.archivedAt).slice(0, 3).map(item => ({
        id: item.documentNumber, documentId: item.id, documentType: item.documentType,
        customer: item.customerName, amount: rials(item.grandTotalBaseUnit),
        date: item.issueDate ?? '', status: 'final',
      })),
    }} onCreate={() => edit(newDraft(profile.settings.document.validityDays))} onOpen={item => {
      const selected = documents.find(doc => doc.id === item.documentId);
      if (selected) show(selected);
    }} />}
    {page === 'invoices' && <>
      <DocumentsPage source={history} onOpen={item => show(item as LocalDocument)}
        onCopy={item => edit(copyDocument(item as LocalDocument))} />
      {drafts.length > 0 && <div className="page">
        <section className="sales-card offline-section">
          <h2>پیش‌نویس‌ها</h2>
          {drafts.map(item => <button className="secondary-button" key={item.id} onClick={() => edit(item)}>
            ادامهٔ پیش‌نویس · {item.input.customer.displayName || 'بدون نام مشتری'}
          </button>)}
        </section>
      </div>}
    </>}

    {page === 'editor' && <form className="page sales-page builder-page" noValidate onSubmit={(event: FormEvent) => {
      event.preventDefault();
      void run(async () => {
        const issued = await store.issue(draft.id, prepared(), paid);
        show(issued);
        await refresh();
      });
    }}>
      <fieldset disabled={busy} className="sales-card builder-section offline-section">
        <div className="doc-type-switch" aria-label="نوع سند">
          {(['proforma', 'invoice'] as const).map(type => <button type="button" key={type}
            className={input.documentType === type ? 'active' : ''}
            aria-pressed={input.documentType === type} onClick={() => {
              patch({ documentType: type });
              setPaid(false);
            }}>{type === 'proforma' ? 'پیش‌فاکتور' : 'فاکتور فروش'}</button>)}
        </div>
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
        <label className="official-toggle"><span><strong>سند رسمی</strong><small>در سند رسمی مالیات اعمال می‌شود.</small></span>
          <input type="checkbox" checked={input.isOfficial} onChange={e => patch({ isOfficial: e.target.checked })} /></label>
        {input.isOfficial && <label>شناسهٔ ملی مشتری<input inputMode="numeric" value={input.customer.nationalId ?? ''}
          onChange={e => patch({ customer: { ...input.customer, nationalId: e.target.value } })} /></label>}
        <details><summary>آدرس (اختیاری)</summary><textarea aria-label="نشانی مشتری" rows={3}
          value={input.address ?? ''} onChange={e => patch({ address: e.target.value })} /></details>
        <details><summary>شیوه ارسال (اختیاری)</summary><select aria-label="شیوهٔ ارسال" value={input.shippingMethod ?? ''} onChange={e => patch({ shippingMethod: e.target.value })}>
          <option value="">انتخاب نشده</option><option value="pickup">تحویل حضوری</option>
          <option value="snapp_box">پیک اسنپ‌باکس</option><option value="snapp_car">ماشین اسنپ</option>
          <option value="snapp_van">وانت اسنپ</option><option value="post">پست</option><option value="tipax">تیپاکس</option>
        </select></details>
        {input.documentType === 'proforma' && <details><summary>مدت اعتبار (اختیاری)</summary><input aria-label="مدت اعتبار" type="number" min="0" max="365"
          value={input.validityDays ?? ''} onChange={e => patch({ validityDays: e.target.value === '' ? null : Number(e.target.value) })} /></details>}
        <details><summary>توضیحات (اختیاری)</summary><textarea aria-label="توضیحات"
          value={input.notes ?? ''} onChange={e => patch({ notes: e.target.value })} /></details>
      </fieldset>
      <fieldset disabled={busy} className="sales-card builder-section offline-section">
        <div className="builder-title"><h2>اقلام سند</h2><span>{input.items.length.toLocaleString('fa-IR')} قلم</span></div>
        {input.items.map((item, index) => <article className="item-editor" key={index}>
          <div className="item-toolbar"><b>ردیف {(index + 1).toLocaleString('fa-IR')}</b>
            {input.items.length > 1 && <span><button type="button" onClick={() => {
              setQuantities(current => current.filter((_, i) => index !== i));
              patch({ items: input.items.filter((_, i) => index !== i) });
            }}>حذف</button></span>}
          </div>
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
        </article>)}
        <button type="button" className="add-item" onClick={() => {
          setQuantities(current => [...current, '1']);
          patch({ items: [...input.items, emptyItem()] });
        }}>+ افزودن قلم جدید</button>
        <div className="builder-totals">
          <span>جمع اقلام <b>{rials(totals?.subtotal ?? '0')}</b></span>
          {totals && totals.discount !== '0' && <span>تخفیف ردیف‌ها <b>{rials(totals.discount)}</b></span>}
          <span>مالیات بر ارزش افزوده <b>{rials(totals?.tax ?? '0')}</b></span>
          <strong>مبلغ نهایی <b>{rials(totals?.total ?? '0')}</b></strong>
        </div>
      </fieldset>
      <fieldset disabled={busy} className="sales-card builder-section preview-section offline-section">
        <div className="auto-meta"><span>شماره سند: خودکار</span><span>تاریخ صدور: خودکار</span></div>
        <h2>پیش‌نمایش سند</h2>
        <div className="document-mini">
          <header><b>{input.documentType === 'invoice' ? 'فاکتور فروش' : 'پیش‌فاکتور'}</b><span>{input.customer.displayName || 'نام مشتری'}</span></header>
          <table><thead><tr><th>شرح</th><th>تعداد</th><th>مبلغ</th></tr></thead>
            <tbody>{input.items.map((item, index) => item.title && <tr key={index}><td>{item.title}</td>
              <td>{quantities[index]}</td><td>{rials(totals?.items[index]?.lineTotalBaseUnit ?? '0')}</td></tr>)}</tbody>
          </table>
          <footer>جمع نهایی: {rials(totals?.total ?? '0')}</footer>
        </div>
        {input.documentType === 'invoice' && <label className="offline-checkbox"><input type="checkbox"
          checked={paid} onChange={e => setPaid(e.target.checked)} /> کل مبلغ را دریافت کرده‌ام</label>}
        <div className="offline-actions">
          <button className="primary-button" type="submit">صدور {input.documentType === 'invoice' ? 'فاکتور' : 'پیش‌فاکتور'}</button>
          <button type="button" className="secondary-button" onClick={() => void run(async () => {
            await store.saveDraft(draft);
            await refresh();
            go('invoices');
            setNotice('پیش‌نویس روی گوشی ذخیره شد.');
          })}>ذخیرهٔ پیش‌نویس</button>
        </div>
      </fieldset>
    </form>}

    {page === 'document' && doc && <div className="page sales-page">
      <button className="sales-back" type="button" disabled={busy} onClick={() => go('invoices')}>بازگشت به آرشیو</button>
      <section className="sales-card document-summary offline-section">
      <h2>{doc.documentType === 'invoice' ? 'فاکتور فروش' : 'پیش‌فاکتور'} · {doc.customerName}</h2>
      <bdi>{doc.documentNumber}</bdi>
      <span>تاریخ صدور {doc.issueDate}{doc.validUntil && ' · معتبر تا ' + doc.validUntil}</span>
      <div className="money-row"><span>مبلغ کل</span><strong>{rials(doc.grandTotalBaseUnit)}</strong></div>
      <div className="document-badge">{statuses[doc.settlementStatus]}</div>
      {doc.items.map(item => <div className="money-row" key={item.position}>
        <span>{item.title} × {quantityText(String(item.quantityMilli))}</span>
        <b>{rials(String(item.lineTotalBaseUnit))}</b>
      </div>)}
      {doc.documentType === 'proforma' && <div className="balance-grid">
        <div><span>پرداخت‌شده</span><strong>{rials(doc.paidAmountBaseUnit)}</strong></div>
        <div><span>مانده</span><strong>{rials(doc.remainingAmountBaseUnit)}</strong></div>
      </div>}
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
    </section></div>}

    {page === 'templates' && <TemplatesPage source={settings.source} />}
    {page === 'settings' && <div className="page settings-shell">
      <header className="page-header"><span>شخصی‌سازی</span><h1>تنظیمات</h1>
        <p>اطلاعات کسب‌وکار و پیش‌فرض‌های سند را یک‌بار تنظیم کنید.</p>
      </header>
      <SettingsPage key={settingsRevision} source={settings.source} />
      <MobileAccountPanel store={store} />
      <Suspense fallback={null}>
        <OfflineBackupActions store={store} onRestore={async () => {
          await refresh();
          setSettingsRevision(revision => revision + 1);
        }} />
      </Suspense>
    </div>}
  </AppFrame>;
}
