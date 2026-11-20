import { dispatchOfflineSync } from './dispatchOfflineSync';
import type { OfflineStore } from './offlineStore';
import type { SalesDocument } from '../api/client';
import { useRef, useState } from 'react';
import { normalizePhone } from '../format/phone';
import { mobileAccountApi } from './mobileAccountApi';

const errors: Record<string, string> = {
  mobile_sync_conflict: 'نسخهٔ سند روی سرور تغییر کرده است. نسخهٔ گوشی در صف باقی ماند.',
  mobile_number_conflict: 'این شمارهٔ سند قبلاً در سرور ثبت شده است. سند در صف باقی ماند.',
  mobile_source_conflict: 'پیش‌فاکتور مبدأ روی سرور قابل تبدیل نیست یا قبلاً تبدیل شده است.',
  mobile_payment_conflict: 'اطلاعات پرداخت با نسخهٔ سرور متفاوت است. سند در صف باقی ماند.',
  sales_invalid: 'یک سند در سرور پذیرفته نشد. دادهٔ محلی برای بررسی در صف باقی ماند.',
  mobile_sync_account_conflict: 'برای ارسال با حسابی وارد شوید که صف به آن اختصاص دارد.',
  sync_account_conflict: 'صف این آرشیو به حساب آنلاین دیگری اختصاص دارد.',
  mobile_link_invalid: 'کد اتصال معتبر نیست، منقضی شده یا برای این شماره صادر نشده است. کد تازه بگیر و دوباره درخواست پیامک بده.',
  mobile_link_conflict: 'شماره یا حساب تلگرام قبلاً به حساب دیگری متصل است. حساب‌ها جدا می‌مانند.',
  unauthenticated: 'نشست حساب پایان یافته است. دوباره وارد شوید.',
  mobile_offline: 'برای ورود به حساب اینترنت لازم است.',
  mobile_sms_disabled: 'ورود پیامکی در این نسخه فعال نیست.',
  mobile_sms_delivery_failed: 'ارسال کد انجام نشد. کمی بعد دوباره تلاش کنید.',
  mobile_sms_rate_limited: 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.',
  mobile_sms_code_invalid: 'کد اشتباه است یا اعتبارش تمام شده است.',
  mobile_sms_number_invalid: 'شمارهٔ همراه ایران را وارد کنید.',
  mobile_session_missing: 'نشست ورود برقرار نشد. دوباره تلاش کنید.',
};

export function MobileAccountPanel({ api = mobileAccountApi, store }: { api?: typeof mobileAccountApi; store?: OfflineStore }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>();
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<{ id: string; phone: string }>();
  const [code, setCode] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [onlineArchive, setOnlineArchive] = useState<{ archived: boolean; documents: SalesDocument[]; cursor: string | null }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const normalized = normalizePhone(phone);
  const normalizedCode = code.replace(/[۰-۹٠-٩]/g, digit => String('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'.indexOf(digit) % 10)).trim();

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error && errors[error.message]
        ? errors[error.message] : 'عملیات کامل نشد. اتصال یا وضعیت سند را بررسی کنید.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function loadArchive(archived: boolean, cursor?: string) {
    void run(async () => {
      const page = await api.documents(archived, cursor);
      setOnlineArchive(previous => ({
        archived, cursor: page.nextCursor,
        documents: cursor && previous ? [...previous.documents, ...page.documents] : page.documents,
      }));
    });
  }

  return <section className="settings-card offline-section" aria-labelledby="mobile-account-heading">
    <h2 id="mobile-account-heading">حساب کاربری</h2>
    <p>ورود اختیاری است. صدور سند و آرشیو روی گوشی بدون حساب در دسترس‌اند.</p>
    {!api.enabled ? <p>ورود پیامکی در این نسخه فعال نیست.</p> : !accountOpen ?
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void run(async () => {
        setSignedIn(Boolean(await api.session()));
        setAccountOpen(true);
      })}>ورود یا مشاهدهٔ حساب</button> : signedIn ?
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void run(async () => {
        await api.logout();
        setSignedIn(false);
        setOnlineArchive(undefined);
        setPendingCount(undefined);
        setMessage('از حساب خارج شدید.');
      })}>خروج از حساب</button> :
      <form className="offline-section" onSubmit={event => {
        event.preventDefault();
        void run(async () => {
          if (!challenge) {
            if (!/^09[0-9]{9}$/.test(normalized)) throw new Error('mobile_sms_number_invalid');
            setChallenge({ id: await api.requestCode(normalized), phone: normalized });
            setMessage('درخواست ارسال کد ثبت شد.');
            return;
          }
          if (!/^[0-9]{4}$/.test(normalizedCode)) {
            setMessage('کد چهاررقمی را وارد کنید.');
            return;
          }
          const link = linkCode.trim().toLowerCase();
          if (link && !/^[a-f0-9]{24}$/.test(link)) {
            setMessage('کد اتصال را کامل از تنظیمات ربات کپی کنید.');
            return;
          }
          try {
            await api.verifyCode(challenge.phone, challenge.id, normalizedCode, link || undefined);
          } catch (error) {
            if (link && error instanceof Error && ['mobile_link_invalid', 'mobile_link_conflict'].includes(error.message)) {
              setChallenge(undefined);
              setCode('');
            }
            throw error;
          }
          setLinkCode('');
          setChallenge(undefined);
          setCode('');
          setAccountOpen(false);
          if (!await api.session()) throw new Error('mobile_session_missing');
          setSignedIn(true);
          setAccountOpen(true);
          setPhone('');
          setMessage('وارد حساب شدید.');
        });
      }}>
        <label>شمارهٔ همراه<input type="tel" dir="ltr" autoComplete="tel" maxLength={24}
          disabled={busy || Boolean(challenge)} value={phone} onChange={event => setPhone(event.currentTarget.value)} /></label>
        <label>کد اتصال تلگرام (اختیاری)<input type="text" dir="ltr" autoComplete="off"
          maxLength={24} disabled={busy} value={linkCode} onChange={event => setLinkCode(event.currentTarget.value)} /></label>
        {challenge && <label>کد چهاررقمی<input type="text" inputMode="numeric" dir="ltr" autoComplete="one-time-code"
          maxLength={4} disabled={busy} value={code} onChange={event => setCode(event.currentTarget.value)} /></label>}
        <button type="submit" className="primary-button" disabled={busy}>{challenge ? 'تأیید و ورود' : 'دریافت کد پیامکی'}</button>
        {challenge && <button type="button" className="secondary-button" disabled={busy} onClick={() => {
          setChallenge(undefined);
          setCode('');
          setMessage('');
        }}>تغییر شماره یا درخواست دوباره</button>}
      </form>}
    {signedIn && <>
      <p>حساب آنلاین فعال است.</p>
      {store && <div className="offline-section">
        <p>ارسال را برای این حساب فعال کنید تا اسناد صادرشده و پرداخت‌های بعدی هنگام اتصال به سرور ارسال شوند.</p>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void run(async () => {
          const session = await api.session();
          if (!session) throw new Error('unauthenticated');
          await store.prepareSync(session.businessId);
          try {
            const sent = await dispatchOfflineSync(store, api);
            setMessage(sent ? 'ارسال اسناد انجام شد.' : 'صف ارسال خالی است.');
          } finally {
            setPendingCount((await store.pendingSync(session.businessId)).length);
          }
        })}>همگام‌سازی اسناد</button>
        {pendingCount !== undefined && <p role="status">{pendingCount.toLocaleString('fa-IR')} سند در صف ارسال</p>}
      </div>}

      <div className="offline-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => loadArchive(false)}>اسناد آنلاین</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => loadArchive(true)}>بایگانی آنلاین</button>
      </div>
      {onlineArchive && <section aria-label={onlineArchive.archived ? 'بایگانی آنلاین' : 'اسناد آنلاین'}>
        {onlineArchive.documents.length === 0 && <p>سندی در این فهرست نیست.</p>}
        {onlineArchive.documents.map(doc => <article className="document-row" key={doc.id}>
          <strong>{doc.customerName}</strong>
          <span><bdi>{doc.documentNumber ?? 'پیش‌نویس'}</bdi> · {doc.issueDate ?? ''}</span>
          <span>{BigInt(doc.grandTotalBaseUnit).toLocaleString('fa-IR')} ریال</span>
        </article>)}
        {onlineArchive.cursor && <button type="button" className="secondary-button" disabled={busy}
          onClick={() => loadArchive(onlineArchive.archived, onlineArchive.cursor ?? undefined)}>نمایش اسناد بیشتر</button>}
      </section>}
    </>}
    {(busy || message) && <p role="status">{busy ? 'در حال ارتباط با سرور…' : message}</p>}
  </section>;
}
