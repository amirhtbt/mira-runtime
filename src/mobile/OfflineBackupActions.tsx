import { offlineNativeFiles } from './offlineNativeFiles';
import { useRef, useState } from 'react';
import { backupMaxBytes, decodeOfflineBackup, encodeOfflineBackup } from './offlineBackup';
import type { OfflineStore } from './offlineStore';

const errors: Record<string, string> = {
  backup_target_not_empty: 'بازیابی فقط روی نصب خالی انجام می‌شود. اطلاعات فعلی حفظ شد.',
  backup_invalid: 'فایل پشتیبان معتبر نیست.',
  backup_version_unsupported: 'نسخهٔ فایل پشتیبان در این نسخهٔ برنامه پشتیبانی نمی‌شود.',
  backup_too_large: 'حجم فایل پشتیبان از ۳۲ مگابایت بیشتر است.',
};

export function OfflineBackupActions({ store, onRestore }: { store: OfflineStore; onRestore: () => Promise<void> }) {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function run(operation: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      await operation();
    } catch (error) {
      setMessage(error instanceof Error && errors[error.message]
        ? errors[error.message] : 'عملیات فایل پشتیبان کامل نشد.');
    } finally {
      setBusy(false);
      running.current = false;
    }
  }

  return <fieldset className="sales-card offline-section" disabled={busy}>
    <legend>پشتیبان‌گیری و بازیابی</legend>
    <p>فایل پشتیبان شامل اطلاعات مشتریان و اسناد است. آن را در محل امن نگه دارید. بازیابی روی نصب خالی انجام می‌شود.</p>
    <button type="button" className="secondary-button" onClick={() => void run(async () => {
      const json = await encodeOfflineBackup(await store.readSnapshot());
      const { saved } = await offlineNativeFiles.saveBackup({ json });
      setMessage(saved ? 'فایل پشتیبان ذخیره شد.' : 'ذخیرهٔ فایل پشتیبان لغو شد.');
    })}>ذخیرهٔ فایل پشتیبان</button>
    <label>انتخاب فایل برای بازیابی<input type="file" accept=".json,application/json" onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (!file) return;
      void run(async () => {
        if (file.size > backupMaxBytes) throw new RangeError('backup_too_large');
        await store.restoreSnapshot(decodeOfflineBackup(await file.text()));
        setMessage('اطلاعات پشتیبان بازیابی شد.');
        await onRestore().catch(() => {
          setMessage('اطلاعات بازیابی شد. برای نمایش آرشیو، برنامه را دوباره باز کنید.');
        });
      });
    }} /></label>
    {(busy || message) && <p role="status">{busy ? 'در حال پردازش فایل پشتیبان…' : message}</p>}
  </fieldset>;
}
