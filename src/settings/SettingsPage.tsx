import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  businessLogoUrl,
  deleteBusinessLogo,
  getBusinessSettings,
  updateBusinessSettings,
  uploadBusinessLogo
} from '../api/client';
import type { BusinessSettings, CustomAdjustmentDefault, SettingsResponse } from './types';

interface Summary {
  businessName?: string;
  settingsComplete: boolean;
}

interface Props {
  onSummaryChange?: (summary: Summary) => void;
}

const itemLabels: Array<[keyof BusinessSettings['items'], string]> = [
  ['rowNumber', 'شماره ردیف'], ['sku', 'کد / SKU'], ['image', 'تصویر'], ['title', 'عنوان'],
  ['description', 'توضیحات'], ['unit', 'واحد'], ['quantity', 'تعداد'], ['unitPrice', 'قیمت واحد'],
  ['lineDiscount', 'تخفیف ردیف'], ['tax', 'مالیات'], ['lineTotal', 'جمع ردیف']
];

function Field({ label, value, onChange, placeholder, dir, maxLength = 120, multiline = false, inputMode }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; dir?: 'rtl' | 'ltr'; maxLength?: number; multiline?: boolean; inputMode?: 'text' | 'numeric' | 'tel';
}) {
  return <label className="settings-field"><span>{label}</span>{multiline
    ? <textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} dir={dir} maxLength={maxLength} rows={3} />
    : <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} dir={dir} maxLength={maxLength} inputMode={inputMode} />}</label>;
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="settings-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>;
}

function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (value: boolean) => void; description?: string }) {
  return <label className="toggle-row"><span><strong>{label}</strong>{description && <small>{description}</small>}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /></label>;
}

function cloneSettings(settings: BusinessSettings): BusinessSettings {
  return JSON.parse(JSON.stringify(settings)) as BusinessSettings;
}

export function SettingsPage({ onSummaryChange }: Props) {
  const [payload, setPayload] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<BusinessSettings | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState('loading'); setMessage('');
      try {
        const next = await getBusinessSettings();
        if (cancelled) return;
        setPayload(next); setDraft(cloneSettings(next.settings)); setState('ready');
        const name = next.settings.seller.displayName || next.settings.seller.businessName || undefined;
        onSummaryChange?.({ businessName: name, settingsComplete: Boolean(name) });
      } catch {
        if (!cancelled) { setState('error'); setMessage('تنظیمات بارگذاری نشد. دوباره تلاش کنید.'); }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [onSummaryChange]);

  const logoUrl = useMemo(() => payload?.logo.present ? businessLogoUrl(payload.logo.updatedAt) : null, [payload?.logo.present, payload?.logo.updatedAt]);

  function updateSection<K extends keyof BusinessSettings>(section: K, patch: Partial<BusinessSettings[K]>) {
    setDraft(current => current ? { ...current, [section]: { ...current[section], ...patch } } : current);
  }

  async function save() {
    if (!draft) return;
    setState('saving'); setMessage('');
    try {
      const saved = await updateBusinessSettings(draft);
      setPayload(saved); setDraft(cloneSettings(saved.settings)); setState('ready'); setMessage('تغییرات ذخیره شد.');
      const name = saved.settings.seller.displayName || saved.settings.seller.businessName || undefined;
      onSummaryChange?.({ businessName: name, settingsComplete: Boolean(name) });
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error && error.message === 'settings_invalid' ? 'یکی از مقادیر معتبر نیست. فیلدهای علامت‌خورده را بررسی کنید.' : 'ذخیره تنظیمات انجام نشد. دوباره تلاش کنید.');
    }
  }

  async function logoChanged(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1572864) {
      setMessage('لوگو باید PNG، JPEG یا WebP و حداکثر ۱٫۵ مگابایت باشد.');
      return;
    }
    setLogoBusy(true); setMessage('');
    try {
      const logo = await uploadBusinessLogo(file);
      setPayload(current => current ? { ...current, logo } : current);
      setMessage('لوگو ذخیره شد.');
    } catch {
      setMessage('لوگو معتبر نبود یا بارگذاری نشد.');
    } finally {
      setLogoBusy(false);
    }
  }

  async function removeLogo() {
    setLogoBusy(true); setMessage('');
    try {
      const logo = await deleteBusinessLogo();
      setPayload(current => current ? { ...current, logo } : current);
      setMessage('لوگو حذف شد.');
    } catch {
      setMessage('حذف لوگو انجام نشد.');
    } finally {
      setLogoBusy(false);
    }
  }

  if (state === 'loading' || !draft || !payload) return <section className="settings-loading" role="status"><span className="settings-spinner"/><p>در حال آماده‌کردن تنظیمات…</p></section>;
  if (state === 'error' && !draft) return <section className="settings-feedback error" role="alert"><p>{message}</p></section>;

  const percentValue = Math.round(draft.financial.discount.percentBasisPoints / 100);
  const taxPercent = Math.round(draft.financial.taxRateBasisPoints / 100);

  function updateAdjustment(index: number, patch: Partial<CustomAdjustmentDefault>) {
    const rows = draft.financial.customAdjustments.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row);
    updateSection('financial', { customAdjustments: rows });
  }

  return <div className="settings-page">
    <section className="settings-intro-card">
      <div><span className="settings-kicker">شروع سریع</span><h2>اطلاعاتی که روی سند دیده می‌شود</h2><p>برای شروع فقط نام و راه دریافت وجه کافی است. باقی گزینه‌ها اختیاری‌اند.</p></div>
      <div className="logo-control">
        <div className="logo-preview">{logoUrl ? <img src={logoUrl} alt="لوگوی کسب‌وکار" /> : <span aria-hidden="true">م</span>}</div>
        <div><label className="secondary-button file-button">{logoBusy ? 'در حال ذخیره…' : payload.logo.present ? 'تعویض لوگو' : 'افزودن لوگو'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={logoChanged} disabled={logoBusy} /></label>{payload.logo.present && <button type="button" className="text-button danger" onClick={removeLogo} disabled={logoBusy}>حذف</button>}<small>PNG / JPEG / WebP، حداکثر ۱٫۵MB</small></div>
      </div>
      <div className="settings-grid two">
        <Field label="نام کسب‌وکار" value={draft.seller.businessName} onChange={businessName => updateSection('seller', { businessName })} placeholder="مثلاً فروشگاه میرا" />
        <Field label="نام نمایشی روی سند" value={draft.seller.displayName} onChange={displayName => updateSection('seller', { displayName })} placeholder="اگر خالی باشد نام کسب‌وکار استفاده می‌شود" />
        <Field label="تلفن" value={draft.seller.phone} onChange={phone => updateSection('seller', { phone })} dir="ltr" inputMode="tel" placeholder="0912…" maxLength={32} />
        <Field label="نام صاحب حساب" value={draft.payment.accountHolder} onChange={accountHolder => updateSection('payment', { accountHolder })} />
      </div>
    </section>

    <section className="settings-card payment-card">
      <div className="settings-card-heading"><div><span className="settings-kicker">دریافت وجه</span><h2>اطلاعات پرداخت</h2></div><span className="status-pill complete">اختیاری</span></div>
      <div className="settings-grid two">
        <Field label="شماره کارت" value={draft.payment.cardNumber} onChange={cardNumber => updateSection('payment', { cardNumber })} dir="ltr" inputMode="numeric" placeholder="6037 …" maxLength={24} />
        <Field label="شماره شبا" value={draft.payment.sheba} onChange={sheba => updateSection('payment', { sheba })} dir="ltr" placeholder="IR…" maxLength={32} />
        <Field label="نام بانک" value={draft.payment.bankName} onChange={bankName => updateSection('payment', { bankName })} />
        <Field label="شماره حساب" value={draft.payment.accountNumber} onChange={accountNumber => updateSection('payment', { accountNumber })} dir="ltr" inputMode="numeric" maxLength={40} />
      </div>
      <Field label="توضیح پرداخت" value={draft.payment.instructions} onChange={instructions => updateSection('payment', { instructions })} multiline maxLength={800} placeholder="مثلاً بعد از واریز، رسید را ارسال کنید." />
    </section>

    <div className="advanced-heading"><div><span className="settings-kicker">پیشرفته</span><h2>تنظیمات بیشتر</h2></div><p>فقط وقتی لازم دارید بازشان کنید.</p></div>

    <details className="settings-section">
      <summary><span>اطلاعات تماس و نشانی</span><small>زیرعنوان، فروشنده، تلگرام و آدرس</small></summary>
      <div className="settings-section-body settings-grid two">
        <Field label="زیرعنوان / حوزه فعالیت" value={draft.seller.subtitle} onChange={subtitle => updateSection('seller', { subtitle })} />
        <Field label="نام فروشنده" value={draft.seller.sellerName} onChange={sellerName => updateSection('seller', { sellerName })} />
        <Field label="نام کاربری تلگرام" value={draft.seller.telegramUsername} onChange={telegramUsername => updateSection('seller', { telegramUsername })} dir="ltr" placeholder="username" maxLength={33} />
        <Field label="خط تماس سفارشی" value={draft.seller.customContactLine} onChange={customContactLine => updateSection('seller', { customContactLine })} maxLength={180} />
        <div className="span-two"><Field label="آدرس" value={draft.seller.address} onChange={address => updateSection('seller', { address })} multiline maxLength={500} /></div>
        <div className="span-two"><Toggle label="نمایش آدرس روی سند" checked={draft.seller.showAddress} onChange={showAddress => updateSection('seller', { showAddress })} description="اگر خاموش باشد آدرس ذخیره می‌ماند ولی روی سند نمایش داده نمی‌شود." /></div>
      </div>
    </details>

    <details className="settings-section">
      <summary><span>پیش‌فرض سند</span><small>عنوان، شماره، تاریخ و اعتبار</small></summary>
      <div className="settings-section-body settings-grid two">
        <Field label="عنوان پیش‌فاکتور" value={draft.document.proformaLabel} onChange={proformaLabel => updateSection('document', { proformaLabel })} maxLength={64} />
        <Field label="عنوان فاکتور فروش" value={draft.document.invoiceLabel} onChange={invoiceLabel => updateSection('document', { invoiceLabel })} maxLength={64} />
        <SelectField label="شماره‌گذاری" value={draft.document.numberingMode} onChange={numberingMode => updateSection('document', { numberingMode: numberingMode as BusinessSettings['document']['numberingMode'] })}><option value="auto">خودکار</option><option value="manual">دستی</option></SelectField>
        <label className="settings-field"><span>تعداد رقم شماره</span><input type="number" min={1} max={12} value={draft.document.numberPadding} onChange={event => updateSection('document', { numberPadding: Math.max(1, Math.min(12, Number(event.target.value) || 1)) })} /></label>
        <Field label="پیشوند پیش‌فاکتور" value={draft.document.proformaPrefix} onChange={proformaPrefix => updateSection('document', { proformaPrefix })} dir="ltr" maxLength={12} />
        <Field label="پیشوند فاکتور" value={draft.document.invoicePrefix} onChange={invoicePrefix => updateSection('document', { invoicePrefix })} dir="ltr" maxLength={12} />
        <SelectField label="تاریخ صدور پیش‌فرض" value={draft.document.issueDateMode} onChange={issueDateMode => updateSection('document', { issueDateMode: issueDateMode as BusinessSettings['document']['issueDateMode'] })}><option value="today">امروز</option><option value="manual">دستی</option></SelectField>
        <label className="settings-field"><span>اعتبار پیش‌فاکتور (روز)</span><input type="number" min={0} max={365} value={draft.document.validityDays} onChange={event => updateSection('document', { validityDays: Math.max(0, Math.min(365, Number(event.target.value) || 0)) })} /></label>
        <SelectField label="تقویم" value={draft.document.calendar} onChange={calendar => updateSection('document', { calendar: calendar as BusinessSettings['document']['calendar'] })}><option value="jalali">شمسی</option><option value="gregorian">میلادی</option></SelectField>
        <SelectField label="اعداد" value={draft.document.digits} onChange={digits => updateSection('document', { digits: digits as BusinessSettings['document']['digits'] })}><option value="persian">فارسی</option><option value="latin">لاتین</option></SelectField>
      </div>
    </details>

    <details className="settings-section">
      <summary><span>نمایش مبلغ و اعداد</span><small>تومان/ریال و قالب نمایش</small></summary>
      <div className="settings-section-body settings-grid two">
        <SelectField label="واحد نمایشی" value={draft.presentation.currencyUnit} onChange={currencyUnit => updateSection('presentation', { currencyUnit: currencyUnit as BusinessSettings['presentation']['currencyUnit'] })}><option value="toman">تومان</option><option value="rial">ریال</option></SelectField>
        <SelectField label="گرد کردن جمع" value={draft.presentation.roundTotal} onChange={roundTotal => updateSection('presentation', { roundTotal: roundTotal as BusinessSettings['presentation']['roundTotal'] })}><option value="none">بدون گرد کردن</option><option value="nearest10">نزدیک‌ترین ۱۰</option><option value="nearest100">نزدیک‌ترین ۱۰۰</option><option value="nearest1000">نزدیک‌ترین ۱۰۰۰</option></SelectField>
        <Toggle label="جداکننده هزارگان" checked={draft.presentation.thousandsSeparator} onChange={thousandsSeparator => updateSection('presentation', { thousandsSeparator })} />
        <SelectField label="اعشار" value={draft.presentation.decimalPolicy} onChange={decimalPolicy => updateSection('presentation', { decimalPolicy: decimalPolicy as BusinessSettings['presentation']['decimalPolicy'] })}><option value="none">بدون اعشار</option><option value="auto">در صورت نیاز</option></SelectField>
      </div>
    </details>

    <details className="settings-section">
      <summary><span>ستون‌های آیتم</span><small>فقط ستون‌های موردنیاز را نشان بده</small></summary>
      <div className="settings-section-body toggle-grid">{itemLabels.map(([key, label]) => <Toggle key={key} label={label} checked={draft.items[key]} onChange={value => updateSection('items', { [key]: value })} />)}</div>
    </details>

    <details className="settings-section">
      <summary><span>پیش‌فرض‌های مالی</span><small>تنظیمات اولیه؛ محاسبه نهایی در موتور G04</small></summary>
      <div className="settings-section-body">
        <div className="settings-grid two">
          <SelectField label="تخفیف پیش‌فرض" value={draft.financial.discount.kind} onChange={kind => updateSection('financial', { discount: { ...draft.financial.discount, kind: kind as BusinessSettings['financial']['discount']['kind'] } })}><option value="none">بدون تخفیف</option><option value="fixed">مبلغ ثابت</option><option value="percent">درصد</option></SelectField>
          {draft.financial.discount.kind === 'percent' ? <label className="settings-field"><span>درصد تخفیف</span><input type="number" min={0} max={100} value={percentValue} onChange={event => updateSection('financial', { discount: { ...draft.financial.discount, percentBasisPoints: Math.max(0, Math.min(100, Number(event.target.value) || 0)) * 100 } })} /></label> : <Field label="مبلغ تخفیف پایه (ریال)" value={draft.financial.discount.amountBaseUnit} onChange={amountBaseUnit => updateSection('financial', { discount: { ...draft.financial.discount, amountBaseUnit } })} dir="ltr" inputMode="numeric" maxLength={18} />}
          <Field label="هزینه ارسال پیش‌فرض (ریال)" value={draft.financial.shippingAmountBaseUnit} onChange={shippingAmountBaseUnit => updateSection('financial', { shippingAmountBaseUnit })} dir="ltr" inputMode="numeric" maxLength={18} />
          <Field label="هزینه خدمات پیش‌فرض (ریال)" value={draft.financial.serviceFeeAmountBaseUnit} onChange={serviceFeeAmountBaseUnit => updateSection('financial', { serviceFeeAmountBaseUnit })} dir="ltr" inputMode="numeric" maxLength={18} />
          <Toggle label="فعال بودن فیلد مالیات" checked={draft.financial.taxEnabled} onChange={taxEnabled => updateSection('financial', { taxEnabled })} description="به‌صورت پیش‌فرض خاموش است." />
          <label className="settings-field"><span>نرخ مالیات (%)</span><input type="number" min={0} max={100} value={taxPercent} disabled={!draft.financial.taxEnabled} onChange={event => updateSection('financial', { taxRateBasisPoints: Math.max(0, Math.min(100, Number(event.target.value) || 0)) * 100 })} /></label>
        </div>
        <div className="adjustment-list"><div className="settings-card-heading"><h3>ردیف‌های سفارشی پیش‌فرض</h3>{draft.financial.customAdjustments.length < 5 && <button type="button" className="text-button" onClick={() => updateSection('financial', { customAdjustments: [...draft.financial.customAdjustments, { label: 'هزینه دیگر', direction: 'surcharge', amountBaseUnit: '0' }] })}>+ افزودن</button>}</div>
          {draft.financial.customAdjustments.map((row, index) => <div className="adjustment-row" key={index}><Field label="عنوان" value={row.label} onChange={label => updateAdjustment(index, { label })} maxLength={60} /><SelectField label="نوع" value={row.direction} onChange={direction => updateAdjustment(index, { direction: direction as CustomAdjustmentDefault['direction'] })}><option value="surcharge">افزایش</option><option value="discount">کاهش</option></SelectField><Field label="مبلغ پایه (ریال)" value={row.amountBaseUnit} onChange={amountBaseUnit => updateAdjustment(index, { amountBaseUnit })} dir="ltr" inputMode="numeric" maxLength={18} /><button type="button" className="text-button danger adjustment-remove" onClick={() => updateSection('financial', { customAdjustments: draft.financial.customAdjustments.filter((_, rowIndex) => rowIndex !== index) })}>حذف</button></div>)}
          {draft.financial.customAdjustments.length === 0 && <p className="settings-muted">ردیف سفارشی پیش‌فرضی تعریف نشده است.</p>}
        </div>
      </div>
    </details>

    <details className="settings-section">
      <summary><span>متن‌ها و شرایط</span><small>یادداشت، شرایط پرداخت و footer</small></summary>
      <div className="settings-section-body settings-grid two">
        <Field label="یادداشت فروشنده" value={draft.text.sellerNote} onChange={sellerNote => updateSection('text', { sellerNote })} multiline maxLength={1200} />
        <Field label="شرایط پرداخت" value={draft.text.paymentTerms} onChange={paymentTerms => updateSection('text', { paymentTerms })} multiline maxLength={2000} />
        <Field label="شرایط ارسال" value={draft.text.shippingTerms} onChange={shippingTerms => updateSection('text', { shippingTerms })} multiline maxLength={2000} />
        <Field label="متن اعتبار" value={draft.text.validityNotice} onChange={validityNotice => updateSection('text', { validityNotice })} multiline maxLength={600} />
        <Field label="متن تشکر" value={draft.text.thankYou} onChange={thankYou => updateSection('text', { thankYou })} multiline maxLength={600} />
        <Field label="Footer" value={draft.text.footer} onChange={footer => updateSection('text', { footer })} multiline maxLength={600} />
      </div>
    </details>

    <details className="settings-section">
      <summary><span>ظاهر پیش‌فرض</span><small>قالب، رنگ و تراکم</small></summary>
      <div className="settings-section-body settings-grid two">
        <SelectField label="قالب پیش‌فرض" value={draft.visual.templateId} onChange={templateId => updateSection('visual', { templateId })}><option value="mira-classic">میرا کلاسیک</option></SelectField>
        <label className="settings-field"><span>رنگ تأکیدی</span><input type="color" value={draft.visual.accent} onChange={event => updateSection('visual', { accent: event.target.value })} /></label>
        <SelectField label="نسخه سند" value={draft.visual.invoiceVariant} onChange={invoiceVariant => updateSection('visual', { invoiceVariant: invoiceVariant as BusinessSettings['visual']['invoiceVariant'] })}><option value="auto">خودکار</option><option value="light">روشن</option><option value="dark">تیره</option></SelectField>
        <SelectField label="جای لوگو" value={draft.visual.logoPosition} onChange={logoPosition => updateSection('visual', { logoPosition: logoPosition as BusinessSettings['visual']['logoPosition'] })}><option value="start">ابتدا</option><option value="center">وسط</option><option value="end">انتها</option></SelectField>
        <SelectField label="تراکم" value={draft.visual.density} onChange={density => updateSection('visual', { density: density as BusinessSettings['visual']['density'] })}><option value="comfortable">راحت</option><option value="compact">فشرده</option></SelectField>
        <SelectField label="اندازه متن" value={draft.visual.fontSize} onChange={fontSize => updateSection('visual', { fontSize: fontSize as BusinessSettings['visual']['fontSize'] })}><option value="small">کوچک</option><option value="medium">معمولی</option><option value="large">بزرگ</option></SelectField>
      </div>
    </details>

    {message && <div className={`settings-feedback${state === 'error' ? ' error' : ''}`} role={state === 'error' ? 'alert' : 'status'}>{message}</div>}
    <div className="settings-save-bar"><div><strong>تنظیمات کسب‌وکار</strong><small>نسخه {payload.version.toLocaleString('fa-IR')}</small></div><button type="button" className="primary-button" onClick={save} disabled={state === 'saving'}>{state === 'saving' ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</button></div>
  </div>;
}
