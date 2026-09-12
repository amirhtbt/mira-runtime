import { useEffect, useState } from 'react';
import { getOwnerSummary, type OwnerSummary } from '../api/client';
import './owner-dashboard.css';

const number = (value: number) => value.toLocaleString('fa-IR');
const rial = (value: string) => `${BigInt(value).toLocaleString('fa-IR')} ریال`;

export function OwnerDashboard() {
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    getOwnerSummary().then(result => { if (alive) setSummary(result); }).catch(reason => {
      if (alive) setError(reason instanceof Error && reason.message === 'not_found' ? 'این حساب مجوز مشاهدهٔ گزارش مدیریت را ندارد.' : 'گزارش بارگذاری نشد. دوباره تلاش کنید.');
    });
    return () => { alive = false; };
  }, [retry]);
  const refresh = () => { setError(''); setSummary(null); setRetry(value => value + 1); };
  return <main className="owner-dashboard" dir="rtl">
    <header className="owner-head"><div><small>فاکتورساز بهار · فقط مدیر</small><h1>نمای کلی برنامه</h1><p>آمار تجمیعی و فقط‌خواندنی از داده‌های سرور</p></div><a href="/">بازگشت به برنامه</a></header>
    {error ? <section role="alert" className="owner-notice"><p>{error}</p><button type="button" onClick={refresh}>تلاش دوباره</button></section> : !summary ? <p role="status" className="owner-notice">در حال دریافت آمار…</p> : <>
      <div className="owner-grid">
        <article><span>حساب‌های ثبت‌شده</span><strong>{number(summary.users.registered)}</strong></article>
        <article><span>کاربران فعال ۳۰ روز اخیر</span><strong>{number(summary.users.active30)}</strong></article>
        <article><span>مشتریان ثبت‌شده</span><strong>{number(summary.customers)}</strong></article>
        <article><span>پیش‌فاکتورهای تبدیل‌شده</span><strong>{number(summary.convertedProformas)}</strong></article>
      </div>
      <section className="owner-documents"><h2>اسناد صادرشده</h2><div className="owner-grid">
        <article><span>فاکتور</span><strong>{number(summary.documents.invoice.count)}</strong><p>{rial(summary.documents.invoice.totalRial)}</p></article>
        <article><span>پیش‌فاکتور</span><strong>{number(summary.documents.proforma.count)}</strong><p>{rial(summary.documents.proforma.totalRial)}</p></article>
      </div></section>
      <section className="owner-documents"><h2>پرداخت‌های ثبت‌شده برای پیش‌فاکتورها</h2><strong>{rial(summary.recordedProformaPaymentsRial)}</strong></section>
      <p className="owner-footnote">مبالغ فاکتور و پیش‌فاکتور را با هم جمع نکنید؛ یک فروش ممکن است در هر دو ثبت شده باشد. مبلغ پرداخت‌ها فقط پرداخت‌هایی است که برای پیش‌فاکتور ثبت شده‌اند، نه کل درآمد.</p>
      <button type="button" className="owner-refresh" onClick={refresh}>به‌روزرسانی آمار</button>
    </>}
  </main>;
}
