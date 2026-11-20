import { useState } from 'react';
import { createMobileTelegramLink } from '../api/client';
import { normalizePhone } from '../format/phone';

export function MobileTelegramLinkPanel({ getInitData }: { getInitData: () => string }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <form className="settings-card" onSubmit={event => {
    event.preventDefault();
    const number = normalizePhone(phone);
    if (busy || !/^09[0-9]{9}$/.test(number)) return;
    setBusy(true);
    setCode('');
    setMessage('');
    void createMobileTelegramLink(getInitData(), number).then(result => {
      setCode(result.linkCode);
    }).catch(() => {
      setMessage('کد اتصال صادر نشد. اگر ورود پیامکی فعال است، برنامه را از ربات دوباره باز کنید.');
    }).finally(() => setBusy(false));
  }}>
    <h2>اتصال به اندروید</h2>
    <p>پیش از ساخت حساب مستقل، شمارهٔ خودت را اینجا وارد کن. کد اتصال را همراه کد پیامکی در اندروید وارد کن.</p>
    <label className="settings-field"><span>شمارهٔ همراه برای اتصال</span>
      <input type="tel" dir="ltr" value={phone} maxLength={24} disabled={busy}
        onChange={event => { setPhone(event.currentTarget.value); setCode(''); }} />
    </label>
    <button type="submit" className="secondary-button" disabled={busy || !/^09[0-9]{9}$/.test(normalizePhone(phone))}>ساخت کد اتصال</button>
    {code && <label className="settings-field"><span>کد یک‌بارمصرف اتصال، معتبر تا ۱۰ دقیقه</span>
      <input value={code} readOnly dir="ltr" onFocus={event => event.currentTarget.select()} />
    </label>}
    {message && <p role="status">{message}</p>}
  </form>;
}
