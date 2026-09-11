import { useEffect, useMemo, useRef, useState } from 'react';
import { getBusinessSettings, recordPilotEvent, updateBusinessSettings } from '../api/client';
import { fixture } from './fixtures';
import { InvoiceTemplate } from './InvoiceTemplate';
import { getTemplate, isTemplateId, templates } from './registry';
import type { TemplateId } from './types';

const themes = [
  { name: 'سرمه‌ای', value: '#214f7b' },
  { name: 'طلایی', value: '#a36f16' },
  { name: 'سبز تیره', value: '#1f6850' },
  { name: 'خاکستری', value: '#4e5963' }
] as const;

const normalizeTemplate = (value: string): TemplateId => isTemplateId(value) ? value : value === 'luxury' ? 'classic-business' : value === 'bazaar' ? 'modern-business' : 'minimal';

export function TemplatesPage({ preview = false }: { preview?: boolean }) {
  const [saved, setSaved] = useState<TemplateId>('minimal');
  const [selected, setSelected] = useState<TemplateId>('minimal');
  const [accent, setAccent] = useState('#214f7b');
  const [savedAccent, setSavedAccent] = useState('#214f7b');
  const [zoom, setZoom] = useState(0.52);
  const [status, setStatus] = useState<'loading'|'ready'|'saving'|'error'>('loading');
  const [message, setMessage] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => { let cancelled = false; setStatus('loading'); setMessage(''); void (async () => { try {
    const payload = preview ? null : await getBusinessSettings();
    if (cancelled) return;
    const id = normalizeTemplate(payload?.settings.visual.templateId ?? 'minimal');
    const activeAccent = payload?.settings.visual.accent ?? '#214f7b';
    setSaved(id); setSelected(id); setAccent(activeAccent); setSavedAccent(activeAccent); setStatus('ready');
  } catch { if (!cancelled) { setStatus('error'); setMessage('تنظیمات قالب از سرور دریافت نشد. پیش‌نمایش‌ها در دسترس‌اند؛ برای بازیابی قالب فعال دوباره تلاش کنید.'); } } })(); return () => { cancelled = true; }; }, [preview, loadAttempt]);

  const definition = getTemplate(selected);
  const model = useMemo(() => fixture(selected), [selected]);
  async function save() { setStatus('saving'); setMessage(''); try {
    if (!preview) { await updateBusinessSettings({ visual: { templateId: selected, accent } }); void recordPilotEvent('template_selected',{template_id:selected}).catch(()=>undefined); }
    setSaved(selected); setSavedAccent(accent); setStatus('ready'); setMessage('قالب فعال ذخیره شد؛ اسناد بعدی با همین قالب صادر می‌شوند.');
  } catch { setStatus('error'); setMessage('ذخیره قالب انجام نشد. دوباره تلاش کنید.'); } }

  const previewSheet = <div className="template-sheet-scale" style={{ '--preview-zoom': zoom, '--chosen-accent': accent } as React.CSSProperties}><InvoiceTemplate model={model} /></div>;
  return <div className="page templates-page">
    <header className="page-header"><span>ظاهر سند</span><h1>قالب‌ها</h1><p>یک ساختار و رنگ انتخاب کنید؛ اسناد جدید با انتخاب فعال صادر می‌شوند.</p></header>
    {status === 'loading' ? <div className="settings-loading" role="status">در حال بارگذاری قالب‌ها…</div> : <>
      <section className="template-catalog" aria-label="انتخاب قالب">{templates.map(template => <button type="button" className={`template-card${selected === template.id ? ' selected' : ''}`} aria-pressed={selected === template.id} onClick={() => setSelected(template.id)} key={template.id}>
        <div className="template-thumbnail" aria-hidden="true"><div><InvoiceTemplate model={fixture(template.id, 2)} compact /></div></div>
        <span><strong>{template.name}</strong>{saved === template.id && <em>فعال</em>}</span><small>{template.description}</small>
      </button>)}</section>
      <section className="theme-panel"><div><h2>رنگ قالب</h2><p>رنگ فقط ظاهر را تغییر می‌دهد و روی اطلاعات و مبالغ اثری ندارد.</p></div><div className="theme-swatches">{themes.map(theme => <button type="button" title={theme.name} aria-label={theme.name} aria-pressed={accent === theme.value} className={accent === theme.value ? 'active' : ''} style={{ background: theme.value }} onClick={() => setAccent(theme.value)} key={theme.value}/>)}</div><label>رنگ سفارشی<input aria-label="رنگ سفارشی" type="color" value={accent} onChange={event => setAccent(event.target.value)}/></label></section>
      <section className="template-preview-panel"><div className="template-preview-copy"><span className="settings-kicker">پیش‌نمایش A4 افقی</span><h2>{definition.name}</h2><p>{definition.structure}</p><dl><div><dt>مناسب برای</dt><dd>{definition.bestFor}</dd></div><div><dt>ابعاد خروجی</dt><dd>A4 افقی، ۲۹۷ × ۲۱۰ میلی‌متر</dd></div></dl><div className="zoom-controls" aria-label="کنترل بزرگ‌نمایی"><button onClick={() => setZoom(value => Math.max(.32, value - .1))} aria-label="کوچک‌نمایی">−</button><output>{Math.round(zoom * 100).toLocaleString('fa-IR')}٪</output><button onClick={() => setZoom(value => Math.min(1, value + .1))} aria-label="بزرگ‌نمایی">+</button><button onClick={() => setZoom(.52)}>اندازه مناسب</button></div><button className="secondary-button full-preview-button" onClick={() => dialog.current?.showModal()}>پیش‌نمایش کامل</button></div><div className="landscape-preview-viewport">{previewSheet}</div></section>
      {message && <div className={`template-message${status === 'error' ? ' error' : ''}`} role={status === 'error' ? 'alert' : 'status'}><span>{message}</span>{status === 'error' && <button type="button" onClick={() => setLoadAttempt(value => value + 1)}>تلاش دوباره</button>}</div>}
      <div className="template-save"><div><strong>{definition.name}</strong><small>{selected === saved && accent === savedAccent ? 'قالب فعال' : 'تغییر ذخیره‌نشده'}</small></div><button className="primary-button" disabled={status === 'saving' || (selected === saved && accent === savedAccent)} onClick={save}>{status === 'saving' ? 'در حال ذخیره…' : 'فعال‌کردن قالب'}</button></div>
      <dialog className="template-dialog" ref={dialog}><button className="dialog-close" aria-label="بستن پیش‌نمایش" onClick={() => dialog.current?.close()}>×</button><div className="dialog-layout"><aside><h2>{definition.name}</h2><p>{definition.structure}</p><div className="zoom-controls"><button onClick={() => setZoom(value => Math.max(.32, value - .1))}>−</button><output>{Math.round(zoom * 100).toLocaleString('fa-IR')}٪</output><button onClick={() => setZoom(value => Math.min(1, value + .1))}>+</button></div></aside><div className="dialog-sheet">{previewSheet}</div></div></dialog>
    </>}
  </div>;
}
