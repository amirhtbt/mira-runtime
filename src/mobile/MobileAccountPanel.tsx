import { useRef, useState } from 'react';
import { normalizePhone } from '../format/phone';
import { mobileAccountApi } from './mobileAccountApi';

const errors: Record<string, string> = {
  mobile_offline: 'برای ورود به حساب اینترنت لازم است.',
  mobile_sms_disabled: 'ورود پیامکی در این نسخه فعال نیست.',
  mobile_sms_delivery_failed: 'ارسال کد انجام نشد. کمی بعد دوباره تلاش کنید.',
  mobile_sms_rate_limited: 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.',
  mobile_sms_code_invalid: 'کد اشتباه است یا اعتبارش تمام شده است.',
  mobile_sms_number_invalid: 'شمارهٔ همراه ایران را وارد کنید.',
  mobile_session_missing: 'نشست ورود برقرار نشد. دوباره تلاش کنید.',
};

export function MobileAccountPanel({ api = mobileAccountApi }: { api?: typeof mobileAccountApi }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<{ id: string; phone: string }>();
  const [code, setCode] = useState('');
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
        ? errors[error.message] : 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
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
          await api.verifyCode(challenge.phone, challenge.id, normalizedCode);
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
        {challenge && <label>کد چهاررقمی<input type="text" inputMode="numeric" dir="ltr" autoComplete="one-time-code"
          maxLength={4} disabled={busy} value={code} onChange={event => setCode(event.currentTarget.value)} /></label>}
        <button type="submit" className="primary-button" disabled={busy}>{challenge ? 'تأیید و ورود' : 'دریافت کد پیامکی'}</button>
        {challenge && <button type="button" className="secondary-button" disabled={busy} onClick={() => {
          setChallenge(undefined);
          setCode('');
          setMessage('');
        }}>تغییر شماره یا درخواست دوباره</button>}
      </form>}
    {signedIn && <p>حساب آنلاین فعال است.</p>}
    {(busy || message) && <p role="status">{busy ? 'در حال ارتباط با سرور…' : message}</p>}
  </section>;
}
