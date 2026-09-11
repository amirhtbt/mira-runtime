import { useCallback, useEffect, useMemo, useState } from 'react';
import { authenticateWithTelegram, type SessionUser } from './api/client';
import { SettingsPage } from './settings/SettingsPage';
import { SalesDocumentPage } from './sales/SalesDocumentPage';
import { DocumentsPage } from './sales/DocumentsPage';
import { TemplatesPage } from './templates/TemplatesPage';
import type { DocumentType, SalesDocument } from './api/client';
import { applyRuntimeCssVariables, TelegramAdapter, type TelegramRuntimeSnapshot } from './telegram/adapter';
import { shouldReduceMotion } from './motion';

export type AppTab = 'home' | 'invoices' | 'settings' | 'templates';
export type ShellState = 'loading' | 'ready' | 'offline' | 'error';
export interface RecentInvoice { id: string; customer: string; amount: string; date: string; status: 'draft' | 'final' }
export interface HomeData { recentInvoices: RecentInvoice[]; businessName?: string; settingsComplete: boolean }
const emptyHome: HomeData = { recentInvoices: [], settingsComplete: false };

function Icon({ name }: { name: 'home' | 'invoice' | 'settings' | 'templates' | 'plus' | 'spark' | 'store' | 'arrow' | 'retry' }) {
  const paths = {
    home: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6"/></>,
    invoice: <><path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 15a2 2 0 0 0 .4 2l-2.5 2.5a2 2 0 0 0-2-.4 2 2 0 0 0-1.3 1.6h-3.4A2 2 0 0 0 9 19a2 2 0 0 0-2 .4L4.6 17a2 2 0 0 0 .4-2 2 2 0 0 0-1.7-1.3v-3.4A2 2 0 0 0 5 9a2 2 0 0 0-.4-2L7 4.6A2 2 0 0 0 9 5a2 2 0 0 0 1.3-1.7h3.4A2 2 0 0 0 15 5a2 2 0 0 0 2-.4L19.4 7a2 2 0 0 0-.4 2 2 2 0 0 0 1.7 1.3v3.4A2 2 0 0 0 19 15z"/></>,
    templates: <><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9h17M9 9v11"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    spark: <><path d="m12 2 1.4 5.2L18 10l-4.6 2.8L12 18l-1.4-5.2L6 10l4.6-2.8z"/><path d="m19 16 .6 2.1 1.9 1.1-1.9 1.1L19 22l-.6-1.7-1.9-1.1 1.9-1.1z"/></>,
    store: <><path d="M4 9h16l-1.5-5h-13zM5 9v11h14V9"/><path d="M9 20v-6h6v6"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>, retry: <><path d="M20 7v5h-5"/><path d="M18.5 16a8 8 0 1 1 .6-7.1L20 12"/></>
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function StatusView({ state, message, onRetry }: { state: Exclude<ShellState, 'ready'>; message?: string; onRetry?: () => void }) {
  if (state === 'loading') return <div className="state-card loading-card" role="status" aria-label="در حال بارگذاری"><div className="skeleton badge"/><div className="skeleton title"/><div className="skeleton line"/><div className="skeleton button"/></div>;
  const offline = state === 'offline';
  return <div className="state-card state-message" role="alert"><span className="state-icon"><Icon name="retry" /></span><h1>{offline ? 'اینترنت در دسترس نیست' : 'اتصال برقرار نشد'}</h1><p>{message ?? (offline ? 'اتصال را بررسی کنید؛ اطلاعاتی از دستگاه شما حذف نشده است.' : 'لطفاً چند لحظه دیگر دوباره تلاش کنید.')}</p>{onRetry && <button className="secondary-button" onClick={onRetry}><Icon name="retry" />تلاش دوباره</button>}</div>;
}

function EmptyInvoices({ compact = false }: { compact?: boolean }) {
  return <section className={`empty-card${compact ? ' compact' : ''}`}><div className="empty-visual" aria-hidden="true"><span/><span/><span/></div><div><h2>هنوز سندی ندارید</h2><p>اولین فاکتور یا پیش‌فاکتور شما از همین‌جا شروع می‌شود.</p></div></section>;
}

function Home({ data, onCreate }: { data: HomeData; onCreate: () => void }) {
  const hasInvoices = data.recentInvoices.length > 0;
  return <div className="page page-home"><header className="hero"><div className="eyebrow"><Icon name="spark" />سریع، ساده، حرفه‌ای</div><h1>{hasInvoices ? 'دوباره آماده‌ایم' : 'اولین سند فروشتان را بسازید'}</h1><p>{hasInvoices ? 'کارهای اخیرتان همین‌جا در دسترس است.' : 'فاکتور یا پیش‌فاکتور؛ بدون تنظیمات پیچیده.'}</p><button className="primary-button hero-action" onClick={onCreate}><Icon name="plus" /><span>ساخت سند جدید</span><Icon name="arrow" /></button><div className="hero-orb" aria-hidden="true"><Icon name="invoice" /></div></header>
    {hasInvoices ? <section className="section-block" aria-labelledby="recent-heading"><div className="section-title"><h2 id="recent-heading">آخرین اسناد</h2><span>{data.recentInvoices.length.toLocaleString('fa-IR')} مورد</span></div><div className="invoice-list">{data.recentInvoices.slice(0, 3).map(item => <article className="invoice-row" key={item.id}><span className="invoice-icon"><Icon name="invoice" /></span><div><strong>{item.customer}</strong><span><bdi dir="ltr">{item.id}</bdi> · <bdi>{item.date}</bdi></span></div><div className="invoice-amount"><bdi>{item.amount}</bdi><span>{item.status === 'draft' ? 'پیش‌نویس' : 'نهایی'}</span></div></article>)}</div></section> : <EmptyInvoices compact />}
    <section className="business-card" aria-label="وضعیت کسب‌وکار"><span className="business-icon"><Icon name="store" /></span><div><h2>{data.businessName || 'مشخصات کسب‌وکار'}</h2><p>{data.settingsComplete ? 'اطلاعات پایه آماده است' : 'بعداً نام و اطلاعات فروشگاه را تکمیل کنید'}</p></div><span className={`status-pill ${data.settingsComplete ? 'complete' : ''}`}>{data.settingsComplete ? 'آماده' : 'تکمیل نشده'}</span></section></div>;
}

function Settings({ onSummaryChange }: { onSummaryChange: (summary: { businessName?: string; settingsComplete: boolean }) => void }) {
  return <div className="page settings-shell"><header className="page-header"><span>شخصی‌سازی</span><h1>تنظیمات</h1><p>اطلاعات کسب‌وکار و پیش‌فرض‌های سند را یک‌بار تنظیم کنید.</p></header><SettingsPage onSummaryChange={onSummaryChange} /></div>;
}

export function AppShell({ telegram, runtime, data = emptyHome, preview = false, businessId = 'preview' }: { telegram: TelegramAdapter; runtime: TelegramRuntimeSnapshot; data?: HomeData; preview?: boolean; businessId?: string }) {
  const [tab, setTab] = useState<AppTab>('home');
  const [createIntent, setCreateIntent] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
  const [homeData, setHomeData] = useState<HomeData>(data);
  useEffect(() => setHomeData(data), [data]);
  useEffect(() => { telegram.setBackHandler(tab !== 'home' || createIntent ? () => { if (documentPreviewOpen) { setDocumentPreviewOpen(false); return; } if (documentId) { setDocumentId(null); setDocumentType(null); setCreateIntent(false); setTab('invoices'); } else { setCreateIntent(false); setDocumentType(null); setTab('home'); } } : null); return () => telegram.setBackHandler(null); }, [createIntent, documentId, documentPreviewOpen, tab, telegram]);
  const updateSettingsSummary = useCallback((summary: { businessName?: string; settingsComplete: boolean }) => {
    setHomeData(current => ({ ...current, ...summary }));
  }, []);
  function chooseTab(next: AppTab) { setDocumentPreviewOpen(false); setCreateIntent(false); setDocumentType(null); setDocumentId(null); setTab(next); telegram.haptic('selection'); }
  function startCreate() { setDocumentPreviewOpen(false); setCreateIntent(true); setDocumentType('proforma'); setDocumentId(null); telegram.haptic('light'); }
  function openDocument(doc:SalesDocument){setDocumentType(doc.documentType);setDocumentId(doc.id);setCreateIntent(true);telegram.haptic('selection');}
  const createContent = documentType ? <SalesDocumentPage type={documentType} documentId={documentId} preview={preview} draftKey={`mira:sales-draft:${businessId}`} showPreview={documentPreviewOpen} onPreviewChange={setDocumentPreviewOpen} onTypeChange={setDocumentType} onBack={() => {setDocumentPreviewOpen(false);setDocumentType(null);setDocumentId(null);if(documentId){setCreateIntent(false);setTab('invoices');}}} /> : null;
  return <main className="app-shell" data-theme={runtime.colorScheme} data-platform={runtime.platform}><div className="app-frame"><div className="topbar"><div className="brand"><span className="brand-mark"><Icon name="spark" /></span><span><strong>میرا</strong><small>فاکتورساز تلگرام</small></span></div><span className="secure-chip"><span/>امن</span></div><div className="content" key={createIntent ? `create-${documentId??'new'}` : tab}>{createIntent ? createContent : tab === 'home' ? <Home data={homeData} onCreate={startCreate} /> : tab === 'invoices' ? <DocumentsPage preview={preview} onOpen={openDocument} /> : tab === 'templates' ? <TemplatesPage preview={preview} /> : <Settings onSummaryChange={updateSettingsSummary} />}</div>
    <nav className="bottom-nav" aria-label="ناوبری اصلی"><button className={tab === 'home' && !createIntent ? 'active' : ''} aria-current={tab === 'home' && !createIntent ? 'page' : undefined} onClick={() => chooseTab('home')}><Icon name="home" /><span>خانه</span></button><button className={tab === 'invoices' && !createIntent ? 'active' : ''} aria-current={tab === 'invoices' && !createIntent ? 'page' : undefined} onClick={() => chooseTab('invoices')}><Icon name="invoice" /><span>فاکتورها</span></button><button className={`nav-create${createIntent ? ' active' : ''}`} aria-label="ساخت سند جدید" aria-current={createIntent ? 'page' : undefined} onClick={startCreate}><span><Icon name="plus" /></span><b>سند جدید</b></button><button className={tab === 'settings' && !createIntent ? 'active' : ''} aria-current={tab === 'settings' && !createIntent ? 'page' : undefined} onClick={() => chooseTab('settings')}><Icon name="settings" /><span>تنظیمات</span></button><button className={tab === 'templates' && !createIntent ? 'active' : ''} aria-current={tab === 'templates' && !createIntent ? 'page' : undefined} onClick={() => chooseTab('templates')}><Icon name="templates" /><span>قالب‌ها</span></button></nav></div></main>;
}

export default function App() {
  const telegram = useMemo(() => new TelegramAdapter(), []);
  const [runtime, setRuntime] = useState<TelegramRuntimeSnapshot>(() => telegram.snapshot());
  const [session, setSession] = useState<SessionUser | null>(null);
  const [state, setState] = useState<ShellState>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('g02-preview');
  useEffect(() => { document.documentElement.dataset.motion = shouldReduceMotion() ? 'reduced' : 'full'; telegram.ready(); telegram.expand(); const update = () => { const next = telegram.snapshot(); applyRuntimeCssVariables(next); setRuntime(next); }; update(); const unsubscribe = telegram.onRuntimeChange(update); return unsubscribe; }, [telegram]);
  useEffect(() => { let cancelled = false; async function bootstrap() { if (preview) return; setState('loading'); setError(''); if (!navigator.onLine) { setState('offline'); return; } try { const initData = telegram.getInitData(); if (!initData) throw new Error('این صفحه را از دکمهٔ منوی ربات تلگرام باز کنید.'); const authenticated = await authenticateWithTelegram(initData); if (cancelled) return; setSession(authenticated); setState('ready'); telegram.haptic('success'); } catch (reason) { if (cancelled) return; setError(reason instanceof Error ? reason.message : 'خطای ناشناخته در برقراری نشست امن'); setState('error'); } } void bootstrap(); return () => { cancelled = true; }; }, [attempt, preview, telegram]);
  useEffect(() => { const offline = () => setState('offline'); const online = () => setAttempt(value => value + 1); window.addEventListener('offline', offline); window.addEventListener('online', online); return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online); }; }, []);
  if (preview) return <AppShell telegram={telegram} preview runtime={{ ...runtime, colorScheme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light' }} />;
  if (state !== 'ready' || !session) return <main className="app-shell state-shell" data-theme={runtime.colorScheme}><StatusView state={state === 'ready' ? 'error' : state} message={error || undefined} onRetry={state === 'loading' ? undefined : () => setAttempt(value => value + 1)} /></main>;
  return <AppShell telegram={telegram} runtime={runtime} businessId={session.businessId} />;
}
