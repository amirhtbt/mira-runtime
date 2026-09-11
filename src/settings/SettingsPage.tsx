import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { businessLogoUrl, deleteBusinessLogo, getBusinessSettings, updateBusinessSettings, uploadBusinessLogo } from '../api/client';
import type { BusinessSettings, CustomAdjustmentDefault, SettingsResponse } from './types';

interface Summary { businessName?: string; settingsComplete: boolean }
interface Props { onSummaryChange?: (summary: Summary) => void }

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

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  if (label === 'واحد نمایشی') return <label className="settings-field"><span>واحد محاسبه و نمایش</span><select value="rial" disabled><option value="rial">ریال</option></select></label>;
  return <label className="settings-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>;
}

function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (value: boolean) => void; description?: string }) {
  return <label className="toggle-row"><span><strong>{label}</strong>{description && <small>{description}</small>}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /></label>;
}

function clone(settings: BusinessSettings): BusinessSettings { return JSON.parse(JSON.stringify(settings)) as BusinessSettings; }

export function SettingsPage({ onSummaryChange }: Props) {
  const [payload, setPayload] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<BusinessSettings | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'load-error' | 'save-error'>('loading');
  const [message, setMessage] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setState('loading'); setMessage('');
      try {
        const next = await getBusinessSettings();
        if (cancelled) return;
        const normalized = clone(next.settings); normalized.presentation.currencyUnit = 'rial';
        setPayload(next); setDraft(normalized); setState('ready');
        const name = next.settings.seller.displayName || next.settings.seller.businessName || undefined;
        onSummaryChange?.({ businessName: name, settingsComplete: Boolean(name) });
      } catch {
        if (!cancelled) { setState('load-error'); setMessage('تنظیمات بارگذاری نشد. دوباره وارد این بخش شوید.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [onSummaryChange, loadAttempt]);

  const logoUrl = useMemo(() => payload?.logo.present ? businessLogoUrl(payload.logo.updatedAt) : null, [payload?.logo.present, payload?.logo.updatedAt]);
  function patch<K extends keyof BusinessSettings>(section: K, value: Partial<BusinessSettings[K]>) {
    setDraft(current => current ? { ...current, [section]: { ...current[section], ...value } } : current);
  }
  async function save() {
    if (!draft) return;
    setState('saving'); setMessage('');
    try {
      const saved = await updateBusinessSettings(draft);
      setPayload(saved); setDraft(clone(saved.settings)); setState('ready'); setMessage('تغییرات ذخیره شد.');
      const name = saved.settings.seller.displayName || saved.settings.seller.businessName || undefined;
      onSummaryChange?.({ businessName: name, settingsComplete: Boolean(name) });
    } catch {
      setState('save-error'); setMessage('یکی از مقادیر معتبر نیست یا ذخیره انجام نشد. دوباره بررسی کنید.');
    }
  }
  async function logoChanged(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1572864) { setMessage('لوگو باید PNG، JPEG یا WebP و حداکثر ۱٫۵ مگابایت باشد.'); return; }
    setLogoBusy(true); setMessage('');
    try { const logo = await uploadBusinessLogo(file); setPayload(current => current ? { ...current, logo } : current); setMessage('لوگو ذخیره شد.'); }
    catch { setMessage('لوگو معتبر نبود یا بارگذاری نشد.'); }
    finally { setLogoBusy(false); }
  }
  async function removeLogo() {
    setLogoBusy(true); setMessage('');
    try { const logo = await deleteBusinessLogo(); setPayload(current => current ? { ...current, logo } : current); setMessage('لوگو حذف شد.'); }
    catch { setMessage('حذف لوگو انجام نشد.'); }
    finally { setLogoBusy(false); }
  }

  if (state === 'load-error') return <section className="settings-feedback error" role="alert"><p>{message}</p><button type="button" className="secondary-button" onClick={() => setLoadAttempt(value => value + 1)}>تلاش دوباره</button></section>;
  if (state === 'loading' || !draft || !payload) return <section className="settings-loading" role="status"><span className="settings-spinner"/><p>در حال آماده‌کردن تنظیمات…</p></section>;

  const s = draft;
  const percent = Math.round(s.financial.discount.percentBasisPoints / 100);
  const taxPercent = Math.round(s.financial.taxRateBasisPoints / 100);
  function adjustment(index: number, value: Partial<CustomAdjustmentDefault>) {
    patch('financial', { customAdjustments: s.financial.customAdjustments.map((row, i) => i === index ? { ...row, ...value } : row) });
  }
  const accounts=s.payment.accounts??[];
  function account(index:number,value:Partial<(typeof accounts)[number]>){patch('payment',{accounts:accounts.map((row,i)=>i===index?{...row,...value}:row)});}

  return <div className="settings-page">
    <section className="settings-intro-card"><div><span className="settings-kicker">شروع سریع</span><h2>اطلاعاتی که روی سند دیده می‌شود</h2><p>برای شروع فقط نام و راه دریافت وجه کافی است. باقی گزینه‌ها اختیاری‌اند.</p></div>
      <div className="logo-control"><div className="logo-preview">{logoUrl ? <img src={logoUrl} alt="لوگوی کسب‌وکار" /> : <span aria-hidden="true">م</span>}</div><div><label className="secondary-button file-button">{logoBusy ? 'در حال ذخیره…' : payload.logo.present ? 'تعویض لوگو' : 'افزودن لوگو'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={logoChanged} disabled={logoBusy} /></label>{payload.logo.present && <button type="button" className="text-button danger" onClick={removeLogo} disabled={logoBusy}>حذف</button>}<small>PNG / JPEG / WebP، حداکثر ۱٫۵MB</small></div></div>
      <div className="settings-grid two"><Field label="نام کسب‌وکار" value={s.seller.businessName} onChange={businessName => patch('seller', { businessName })} placeholder="مثلاً فروشگاه میرا"/><Field label="نام نمایشی روی سند" value={s.seller.displayName} onChange={displayName => patch('seller', { displayName })}/><Field label="تلفن" value={s.seller.phone} onChange={phone => patch('seller', { phone })} dir="ltr" inputMode="tel" placeholder="0912…" maxLength={32}/><Field label="نام صاحب حساب" value={s.payment.accountHolder} onChange={accountHolder => patch('payment', { accountHolder })}/></div>
    </section>

    <section className="settings-card payment-card"><div className="settings-card-heading"><div><span className="settings-kicker">دریافت وجه</span><h2>حساب‌های واریزی</h2></div><button type="button" className="text-button" onClick={()=>patch('payment',{accounts:[...accounts,{cardNumber:'',sheba:'',bankName:'',accountHolder:s.payment.accountHolder}]})}>+ افزودن حساب</button></div>{accounts.map((row,index)=><div className="adjustment-row" key={index}><Field label="شماره کارت" value={row.cardNumber} onChange={cardNumber=>account(index,{cardNumber})} dir="ltr" inputMode="numeric" maxLength={24}/><Field label="شماره شبا" value={row.sheba} onChange={sheba=>account(index,{sheba})} dir="ltr" maxLength={32}/><Field label="نام بانک" value={row.bankName} onChange={bankName=>account(index,{bankName})}/><Field label="نام صاحب حساب" value={row.accountHolder} onChange={accountHolder=>account(index,{accountHolder})}/><button type="button" className="text-button danger" onClick={()=>patch('payment',{accounts:accounts.filter((_,i)=>i!==index)})}>حذف</button></div>)}{accounts.length===0&&<p className="settings-muted">هنوز حسابی در فهرست جدید ثبت نشده است؛ اطلاعات قدیمی زیر همچنان روی اسناد نمایش داده می‌شود.</p>}<div className="settings-grid two"><Field label="شماره کارت" value={s.payment.cardNumber} onChange={cardNumber => patch('payment', { cardNumber })} dir="ltr" inputMode="numeric" placeholder="6037 …" maxLength={24}/><Field label="شماره شبا" value={s.payment.sheba} onChange={sheba => patch('payment', { sheba })} dir="ltr" placeholder="IR…" maxLength={32}/><Field label="نام بانک" value={s.payment.bankName} onChange={bankName => patch('payment', { bankName })}/><Field label="شماره حساب" value={s.payment.accountNumber} onChange={accountNumber => patch('payment', { accountNumber })} dir="ltr" inputMode="numeric" maxLength={40}/></div><Field label="توضیح پرداخت" value={s.payment.instructions} onChange={instructions => patch('payment', { instructions })} multiline maxLength={800}/></section>

    <div className="advanced-heading"><div><span className="settings-kicker">پیشرفته</span><h2>تنظیمات بیشتر</h2></div><p>فقط وقتی لازم دارید بازشان کنید.</p></div>

    <details className="settings-section"><summary><span>اطلاعات تماس و نشانی</span><small>زیرعنوان، فروشنده، تلگرام و آدرس</small></summary><div className="settings-section-body settings-grid two"><Field label="زیرعنوان / حوزه فعالیت" value={s.seller.subtitle} onChange={subtitle => patch('seller', { subtitle })}/><Field label="نام فروشنده" value={s.seller.sellerName} onChange={sellerName => patch('seller', { sellerName })}/><Field label="نام کاربری تلگرام" value={s.seller.telegramUsername} onChange={telegramUsername => patch('seller', { telegramUsername })} dir="ltr" maxLength={33}/><Field label="خط تماس سفارشی" value={s.seller.customContactLine} onChange={customContactLine => patch('seller', { customContactLine })} maxLength={180}/><div className="span-two"><Field label="آدرس" value={s.seller.address} onChange={address => patch('seller', { address })} multiline maxLength={500}/></div><div className="span-two"><Toggle label="نمایش آدرس روی سند" checked={s.seller.showAddress} onChange={showAddress => patch('seller', { showAddress })} description="اگر خاموش باشد، آدرس ذخیره می‌ماند ولی روی سند نمی‌آید."/></div></div></details>

    <details className="settings-section"><summary><span>پیش‌فرض سند</span><small>عنوان، شماره، تاریخ و اعتبار</small></summary><div className="settings-section-body settings-grid two"><Field label="عنوان پیش‌فاکتور" value={s.document.proformaLabel} onChange={proformaLabel => patch('document', { proformaLabel })} maxLength={64}/><Field label="عنوان فاکتور فروش" value={s.document.invoiceLabel} onChange={invoiceLabel => patch('document', { invoiceLabel })} maxLength={64}/><SelectField label="شماره‌گذاری" value={s.document.numberingMode} onChange={value => patch('document', { numberingMode: value as BusinessSettings['document']['numberingMode'] })}><option value="auto">خودکار</option><option value="manual">دستی</option></SelectField><label className="settings-field"><span>تعداد رقم شماره</span><input type="number" min={1} max={12} value={s.document.numberPadding} onChange={event => patch('document', { numberPadding: Math.max(1, Math.min(12, Number(event.target.value) || 1)) })}/></label><Field label="پیشوند پیش‌فاکتور" value={s.document.proformaPrefix} onChange={proformaPrefix => patch('document', { proformaPrefix })} dir="ltr" maxLength={12}/><Field label="پیشوند فاکتور" value={s.document.invoicePrefix} onChange={invoicePrefix => patch('document', { invoicePrefix })} dir="ltr" maxLength={12}/><SelectField label="تاریخ صدور پیش‌فرض" value={s.document.issueDateMode} onChange={value => patch('document', { issueDateMode: value as BusinessSettings['document']['issueDateMode'] })}><option value="today">امروز</option><option value="manual">دستی</option></SelectField><label className="settings-field"><span>اعتبار پیش‌فاکتور (روز)</span><input type="number" min={0} max={365} value={s.document.validityDays} onChange={event => patch('document', { validityDays: Math.max(0, Math.min(365, Number(event.target.value) || 0)) })}/></label><SelectField label="تقویم" value={s.document.calendar} onChange={value => patch('document', { calendar: value as BusinessSettings['document']['calendar'] })}><option value="jalali">شمسی</option><option value="gregorian">میلادی</option></SelectField><SelectField label="اعداد" value={s.document.digits} onChange={value => patch('document', { digits: value as BusinessSettings['document']['digits'] })}><option value="persian">فارسی</option><option value="latin">لاتین</option></SelectField></div></details>

    <details className="settings-section"><summary><span>نمایش مبلغ و اعداد</span><small>تومان/ریال و قالب نمایش</small></summary><div className="settings-section-body settings-grid two"><SelectField label="واحد نمایشی" value={s.presentation.currencyUnit} onChange={value => patch('presentation', { currencyUnit: value as BusinessSettings['presentation']['currencyUnit'] })}><option value="toman">تومان</option><option value="rial">ریال</option></SelectField><SelectField label="گرد کردن جمع" value={s.presentation.roundTotal} onChange={value => patch('presentation', { roundTotal: value as BusinessSettings['presentation']['roundTotal'] })}><option value="none">بدون گرد کردن</option><option value="nearest10">نزدیک‌ترین ۱۰</option><option value="nearest100">نزدیک‌ترین ۱۰۰</option><option value="nearest1000">نزدیک‌ترین ۱۰۰۰</option></SelectField><Toggle label="جداکننده هزارگان" checked={s.presentation.thousandsSeparator} onChange={thousandsSeparator => patch('presentation', { thousandsSeparator })}/><SelectField label="اعشار" value={s.presentation.decimalPolicy} onChange={value => patch('presentation', { decimalPolicy: value as BusinessSettings['presentation']['decimalPolicy'] })}><option value="none">بدون اعشار</option><option value="auto">در صورت نیاز</option></SelectField></div></details>

    <details className="settings-section"><summary><span>ستون‌های آیتم</span><small>فقط ستون‌های موردنیاز را نشان بده</small></summary><div className="settings-section-body toggle-grid">{itemLabels.map(([key, label]) => <Toggle key={key} label={label} checked={s.items[key]} onChange={value => patch('items', { [key]: value })}/>)}</div></details>

    <details className="settings-section"><summary><span>پیش‌فرض‌های مالی</span><small>فقط default؛ محاسبه نهایی در G04</small></summary><div className="settings-section-body"><div className="settings-grid two"><SelectField label="تخفیف پیش‌فرض" value={s.financial.discount.kind} onChange={value => patch('financial', { discount: { ...s.financial.discount, kind: value as BusinessSettings['financial']['discount']['kind'] } })}><option value="none">بدون تخفیف</option><option value="fixed">مبلغ ثابت</option><option value="percent">درصد</option></SelectField>{s.financial.discount.kind === 'percent' ? <label className="settings-field"><span>درصد تخفیف</span><input type="number" min={0} max={100} value={percent} onChange={event => patch('financial', { discount: { ...s.financial.discount, percentBasisPoints: Math.max(0, Math.min(100, Number(event.target.value) || 0)) * 100 } })}/></label> : <Field label="مبلغ تخفیف پایه (ریال)" value={s.financial.discount.amountBaseUnit} onChange={amountBaseUnit => patch('financial', { discount: { ...s.financial.discount, amountBaseUnit } })} dir="ltr" inputMode="numeric" maxLength={18}/>}<Field label="هزینه ارسال پیش‌فرض (ریال)" value={s.financial.shippingAmountBaseUnit} onChange={shippingAmountBaseUnit => patch('financial', { shippingAmountBaseUnit })} dir="ltr" inputMode="numeric" maxLength={18}/><Field label="هزینه خدمات پیش‌فرض (ریال)" value={s.financial.serviceFeeAmountBaseUnit} onChange={serviceFeeAmountBaseUnit => patch('financial', { serviceFeeAmountBaseUnit })} dir="ltr" inputMode="numeric" maxLength={18}/><Toggle label="فعال بودن فیلد مالیات" checked={s.financial.taxEnabled} onChange={taxEnabled => patch('financial', { taxEnabled })}/><label className="settings-field"><span>نرخ مالیات (%)</span><input type="number" min={0} max={100} value={taxPercent} disabled={!s.financial.taxEnabled} onChange={event => patch('financial', { taxRateBasisPoints: Math.max(0, Math.min(100, Number(event.target.value) || 0)) * 100 })}/></label></div><div className="adjustment-list"><div className="settings-card-heading"><h3>ردیف‌های سفارشی پیش‌فرض</h3>{s.financial.customAdjustments.length < 5 && <button type="button" className="text-button" onClick={() => patch('financial', { customAdjustments: [...s.financial.customAdjustments, { label: 'هزینه دیگر', direction: 'surcharge', amountBaseUnit: '0' }] })}>+ افزودن</button>}</div>{s.financial.customAdjustments.map((row, index) => <div className="adjustment-row" key={index}><Field label="عنوان" value={row.label} onChange={label => adjustment(index, { label })} maxLength={60}/><SelectField label="نوع" value={row.direction} onChange={value => adjustment(index, { direction: value as CustomAdjustmentDefault['direction'] })}><option value="surcharge">افزایش</option><option value="discount">کاهش</option></SelectField><Field label="مبلغ پایه (ریال)" value={row.amountBaseUnit} onChange={amountBaseUnit => adjustment(index, { amountBaseUnit })} dir="ltr" inputMode="numeric" maxLength={18}/><button type="button" className="text-button danger adjustment-remove" onClick={() => patch('financial', { customAdjustments: s.financial.customAdjustments.filter((_, i) => i !== index) })}>حذف</button></div>)}{s.financial.customAdjustments.length === 0 && <p className="settings-muted">ردیف سفارشی پیش‌فرضی تعریف نشده است.</p>}</div></div></details>

    <details className="settings-section"><summary><span>متن‌ها و شرایط</span><small>یادداشت، شرایط پرداخت و footer</small></summary><div className="settings-section-body settings-grid two"><Field label="یادداشت فروشنده" value={s.text.sellerNote} onChange={sellerNote => patch('text', { sellerNote })} multiline maxLength={1200}/><Field label="شرایط پرداخت" value={s.text.paymentTerms} onChange={paymentTerms => patch('text', { paymentTerms })} multiline maxLength={2000}/><Field label="شرایط ارسال" value={s.text.shippingTerms} onChange={shippingTerms => patch('text', { shippingTerms })} multiline maxLength={2000}/><Field label="متن اعتبار" value={s.text.validityNotice} onChange={validityNotice => patch('text', { validityNotice })} multiline maxLength={600}/><Field label="متن تشکر" value={s.text.thankYou} onChange={thankYou => patch('text', { thankYou })} multiline maxLength={600}/><Field label="Footer" value={s.text.footer} onChange={footer => patch('text', { footer })} multiline maxLength={600}/></div></details>

    <details className="settings-section"><summary><span>ظاهر پیش‌فرض</span><small>قالب، رنگ و تراکم</small></summary><div className="settings-section-body settings-grid two"><SelectField label="قالب پیش‌فرض" value={s.visual.templateId} onChange={templateId => patch('visual', { templateId })}><option value="mira-classic">میرا کلاسیک</option></SelectField><label className="settings-field"><span>رنگ تأکیدی</span><input type="color" value={s.visual.accent} onChange={event => patch('visual', { accent: event.target.value })}/></label><SelectField label="نسخه سند" value={s.visual.invoiceVariant} onChange={value => patch('visual', { invoiceVariant: value as BusinessSettings['visual']['invoiceVariant'] })}><option value="auto">خودکار</option><option value="light">روشن</option><option value="dark">تیره</option></SelectField><SelectField label="جای لوگو" value={s.visual.logoPosition} onChange={value => patch('visual', { logoPosition: value as BusinessSettings['visual']['logoPosition'] })}><option value="start">ابتدا</option><option value="center">وسط</option><option value="end">انتها</option></SelectField><SelectField label="تراکم" value={s.visual.density} onChange={value => patch('visual', { density: value as BusinessSettings['visual']['density'] })}><option value="comfortable">راحت</option><option value="compact">فشرده</option></SelectField><SelectField label="اندازه متن" value={s.visual.fontSize} onChange={value => patch('visual', { fontSize: value as BusinessSettings['visual']['fontSize'] })}><option value="small">کوچک</option><option value="medium">معمولی</option><option value="large">بزرگ</option></SelectField></div></details>

    {message && <div className={`settings-feedback${state === 'save-error' ? ' error' : ''}`} role={state === 'save-error' ? 'alert' : 'status'}>{message}</div>}
    <div className="settings-save-bar"><div><strong>تنظیمات کسب‌وکار</strong><small>نسخه {payload.version.toLocaleString('fa-IR')}</small></div><button type="button" className="primary-button" onClick={save} disabled={state === 'saving'}>{state === 'saving' ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</button></div>
  </div>;
}
