import { useEffect, useMemo, useState } from 'react';
import { authenticateWithTelegram, getSession, type SessionUser } from './api/client';
import { TelegramAdapter, type TelegramRuntimeSnapshot } from './telegram/adapter';

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

export default function App() {
  const telegram = useMemo(() => new TelegramAdapter(), []);
  const [runtime, setRuntime] = useState<TelegramRuntimeSnapshot>(() => telegram.snapshot());
  const [session, setSession] = useState<SessionUser | null>(null);
  const [state, setState] = useState<'booting' | 'ready' | 'error'>('booting');
  const [error, setError] = useState('');

  useEffect(() => {
    telegram.ready();
    telegram.expand();
    telegram.setBackHandler(null);

    const unsubscribe = telegram.onRuntimeChange(() => setRuntime(telegram.snapshot()));
    return unsubscribe;
  }, [telegram]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const existing = await getSession();
        if (cancelled) return;
        if (existing) {
          setSession(existing);
          setState('ready');
          return;
        }

        const initData = telegram.getInitData();
        if (!initData) throw new Error('این صفحه باید از داخل Telegram Mini App باز شود.');

        const authenticated = await authenticateWithTelegram(initData);
        if (cancelled) return;
        setSession(authenticated);
        setState('ready');
        telegram.haptic('success');
      } catch (reason) {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : 'خطای ناشناخته در احراز هویت');
        setState('error');
      }
    }

    void bootstrap();
    return () => { cancelled = true; };
  }, [telegram]);

  return (
    <main className="app-shell" data-theme={runtime.colorScheme}>
      <section className="foundation-card" aria-live="polite">
        <div className="status-row">
          <span className={`status-dot status-${state}`} />
          <span>{state === 'booting' ? 'در حال ایجاد نشست امن…' : state === 'ready' ? 'نشست امن فعال است' : 'احراز هویت ناموفق'}</span>
        </div>

        <h1>پیش‌فاکتور تلگرام</h1>
        <p className="subtitle">پایهٔ G01: Telegram runtime + احراز هویت قابل اعتماد</p>

        <dl className="runtime-grid">
          <div><dt>محیط</dt><dd>{runtime.available ? 'Telegram' : 'Browser'}</dd></div>
          <div><dt>پلتفرم</dt><dd dir="ltr">{runtime.platform}</dd></div>
          <div><dt>نسخه API</dt><dd dir="ltr">{runtime.version}</dd></div>
          <div><dt>تم</dt><dd>{runtime.colorScheme === 'dark' ? 'تیره' : 'روشن'}</dd></div>
        </dl>

        {session && (
          <div className="identity-box">
            <span>شناسه داخلی کاربر</span>
            <code dir="ltr">{shortId(session.userId)}</code>
            <span>شناسه کسب‌وکار</span>
            <code dir="ltr">{shortId(session.businessId)}</code>
          </div>
        )}

        {state === 'error' && <p className="error-box">{error}</p>}

        <p className="g01-note">این صفحه عمداً هنوز App Shell نهایی G02 نیست.</p>
      </section>
    </main>
  );
}
