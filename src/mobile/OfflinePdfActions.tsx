import { registerPlugin } from '@capacitor/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { documentPdfName, documentViewModel, paginateDocumentModel, renderDocumentPdf } from '../export/documentPdf';
import { InvoiceTemplate } from '../templates/InvoiceTemplate';
import type { LocalDocument } from './offlineStore';

interface PdfFile {
  name: string;
  base64: string;
}

const nativePdf = registerPlugin<{
  savePdf(file: PdfFile): Promise<{ saved: boolean }>;
  sharePdf(file: PdfFile): Promise<void>;
}>('OfflinePdf');

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function OfflinePdfActions({ doc }: { doc: LocalDocument }) {
  const [logoUrl, setLogoUrl] = useState<string>();
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    if (!doc.logoSnapshot) return;
    let active = true;
    void dataUrl(doc.logoSnapshot).then(url => {
      if (active) setLogoUrl(url);
    }).catch(() => {
      if (active) setLogoFailed(true);
    });
    return () => { active = false; };
  }, [doc.logoSnapshot]);
  const pages = useMemo(() => paginateDocumentModel(
    documentViewModel({ ...doc, logoPresent: false }, logoUrl),
  ), [doc, logoUrl]);
  const stage = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function exportPdf(action: 'save' | 'share') {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const nodes = Array.from(stage.current?.children ?? []) as HTMLElement[];
      await Promise.all(nodes.flatMap(node => Array.from(node.querySelectorAll('img'), img => img.decode())));
      const blob = await renderDocumentPdf(nodes);
      const file = { name: documentPdfName(doc), base64: (await dataUrl(blob)).split(',')[1] };
      if (action === 'save') {
        const { saved } = await nativePdf.savePdf(file);
        setMessage(saved ? 'فایل PDF ذخیره شد.' : 'ذخیرهٔ فایل لغو شد.');
      } else {
        await nativePdf.sharePdf(file);
        setMessage('منوی اشتراک‌گذاری باز شد.');
      }
    } catch {
      setMessage('خروجی PDF آماده یا تحویل داده نشد. دوباره تلاش کنید.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className="export-actions">
    <div className="export-buttons">
      <button type="button" disabled={busy || Boolean(doc.logoSnapshot && !logoUrl)} onClick={() => void exportPdf('save')}>ذخیره PDF</button>
      <button type="button" disabled={busy || Boolean(doc.logoSnapshot && !logoUrl)} onClick={() => void exportPdf('share')}>اشتراک‌گذاری PDF</button>
    </div>
    {logoFailed && <p role="alert">خواندن لوگوی ثبت‌شدهٔ سند انجام نشد.</p>}
    {(busy || message) && <p role="status">{busy ? 'در حال آماده‌سازی یا تحویل فایل…' : message}</p>}
    <div className="export-render-stage" ref={stage} aria-hidden="true">
      {pages.map((page, index) => <div key={index}><InvoiceTemplate model={page} /></div>)}
    </div>
  </div>;
}
