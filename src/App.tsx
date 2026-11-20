import { useCallback, useEffect, useMemo, useState } from 'react';
import { authenticateWithTelegram, getBusinessSettings, getPilotStatus, listSalesDocuments, submitPilotFeedback, type PilotFeedbackStatus, type PilotMissingCategory, type SessionUser } from './api/client';
import { OwnerDashboard } from './admin/OwnerDashboard';
import { MobileTelegramLinkPanel } from './settings/MobileTelegramLinkPanel';
import { SettingsPage } from './settings/SettingsPage';
import { SalesDocumentPage } from './sales/SalesDocumentPage';
import { DocumentsPage } from './sales/DocumentsPage';
import { TemplatesPage } from './templates/TemplatesPage';
import type { DocumentType, SalesDocument } from './api/client';
import { applyRuntimeCssVariables, TelegramAdapter, type TelegramRuntimeSnapshot } from './telegram/adapter';
import { shouldReduceMotion } from './motion';
import { AppFrame, Icon, Home, type AppTab, type HomeData, type RecentInvoice } from './AppFrame';
export type { AppTab, HomeData, RecentInvoice } from './AppFrame';

export type ShellState = 'loading' | 'ready' | 'offline' | 'error';
const emptyHome: HomeData = { recentInvoices: [], settingsComplete: false };

export function StatusView({ state, message, onRetry }: { state: Exclude<ShellState, 'ready'>; message?: string; onRetry?: () => void }) {
  if (state === 'loading') return <div className="state-card loading-card" role="status" aria-label="در حال بارگذاری"><div className="skeleton badge"/><div className="skeleton title"/><div className="skeleton line"/><div className="skeleton button"/></div>;
  const offline = state === 'offline';
  return <div className="state-card state-message" role="alert"><span className="state-icon"><Icon name="retry" /></span><h1>{offline ? 'اینترنت در دسترس نیست' : 'اتصال برقرار نشد'}</h1><p>{message ?? (offline ? 'اتصال را بررسی کنید؛ اطلاعاتی از دستگاه شما حذف نشده است.' : 'لطفاً چند لحظه دیگر دوباره تلاش کنید.')}</p>{onRetry && <button className="secondary-button" onClick={onRetry}><Icon name="retry" />تلاش دوباره</button>}</div>;
}

function PilotFeedback({status,onSubmitted}:{status:PilotFeedbackStatus;onSubmitted:()=>void}) {
  const [score,setScore]=useState(0);const [category,setCategory]=useState<PilotMissingCategory|null>(null);const [text,setText]=useState('');const [state,setState]=useState<'idle'|'saving'|'error'>('idle');
  if(!status.eligible||status.submitted)return null;
  async function submit(){if(score<1)return;setState('saving');try{await submitPilotFeedback({score,missingCategory:category,text});onSubmitted();}catch{setState('error');}}
  return <section className="pilot-feedback" aria-labelledby="pilot-feedback-title"><h2 id="pilot-feedback-title">فاکتورساز بهار چقدر برایتان کاربردی بود؟</h2><p>بعد از چند سند از شما می‌پرسیم تا ساخت اولین فاکتور متوقف نشود.</p><div className="pilot-score" aria-label="امتیاز از یک تا پنج">{[1,2,3,4,5].map(value=><button type="button" className={score===value?'active':''} aria-pressed={score===value} onClick={()=>setScore(value)} key={value}>{value.toLocaleString('fa-IR')}</button>)}</div><label>چه چیزی بیشتر لازم دارید؟<select value={category??''} onChange={event=>setCategory((event.target.value||null) as PilotMissingCategory|null)}><option value="">انتخاب اختیاری</option><option value="templates">قالب‌های بیشتر</option><option value="export">خروجی و اشتراک‌گذاری</option><option value="history">تاریخچه و جست‌وجو</option><option value="settings">تنظیمات</option><option value="payments">پرداخت‌ها</option><option value="other">مورد دیگر</option></select></label><label>توضیح کوتاه (اختیاری)<textarea value={text} maxLength={1000} onChange={event=>setText(event.target.value)} placeholder="اطلاعات مشتری، شماره تماس یا مشخصات فاکتور را اینجا ننویسید."/></label>{state==='error'&&<p role="alert">ثبت نشد؛ دوباره تلاش کنید.</p>}<button className="secondary-button" type="button" disabled={score<1||state==='saving'} onClick={()=>void submit()}>{state==='saving'?'در حال ثبت…':'ثبت بازخورد'}</button></section>;
}

function Settings({ onSummaryChange, getInitData }: { getInitData?: () => string; onSummaryChange: (summary: { businessName?: string; settingsComplete: boolean }) => void }) {
  return <div className="page settings-shell"><header className="page-header"><span>شخصی‌سازی</span><h1>تنظیمات</h1><p>اطلاعات کسب‌وکار و پیش‌فرض‌های سند را یک‌بار تنظیم کنید.</p></header><SettingsPage onSummaryChange={onSummaryChange} />{getInitData && <MobileTelegramLinkPanel getInitData={getInitData} />}</div>;
}

export function AppShell({ telegram, runtime, data = emptyHome, preview = false, businessId = 'preview', pilotFeedback, onFeedbackSubmitted }: { telegram: TelegramAdapter; runtime: TelegramRuntimeSnapshot; data?: HomeData; preview?: boolean; businessId?: string;pilotFeedback?:PilotFeedbackStatus;onFeedbackSubmitted?:()=>void }) {
  const [tab, setTab] = useState<AppTab>('home');
  const draftKey = `mira:sales-draft:${businessId}`;
  const [newDocumentVersion, setNewDocumentVersion] = useState(0);
  const [createIntent, setCreateIntent] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentReturnTab, setDocumentReturnTab] = useState<'home'|'invoices'>('invoices');
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
  const [homeData, setHomeData] = useState<HomeData>(data);
  useEffect(() => setHomeData(data), [data]);
  useEffect(() => { if (preview || createIntent || tab !== 'home') return; let cancelled = false; async function refresh() { try { const current = await listSalesDocuments({limit:3}); const archived = current.documents.length ? null : await listSalesDocuments({archived:true,limit:1}); if (cancelled) return; setHomeData(previous => ({...previous,hasDocuments:current.documents.length > 0 || Boolean(archived?.documents.length),recentInvoices:current.documents.map(doc => ({id:doc.documentNumber || doc.id,documentId:doc.id,documentType:doc.documentType,customer:doc.customerName,amount:`${BigInt(doc.grandTotalBaseUnit).toLocaleString('fa-IR')} ریال`,date:doc.issueDate || 'پیش‌نویس',status:doc.lifecycleStatus === 'draft' ? 'draft' : 'final'}))})); } catch { if (!cancelled) setHomeData(previous => ({...previous,hasDocuments:true,recentInvoices:[]})); } } void refresh(); return () => { cancelled = true; }; }, [preview, createIntent, tab]);
  useEffect(() => { telegram.setBackHandler(tab !== 'home' || createIntent ? () => { if (documentPreviewOpen) { setDocumentPreviewOpen(false); return; } if (documentId) { setDocumentId(null); setDocumentType(null); setCreateIntent(false); setTab(documentReturnTab); } else { setCreateIntent(false); setDocumentType(null); setTab('home'); } } : null); return () => telegram.setBackHandler(null); }, [createIntent, documentId, documentPreviewOpen, documentReturnTab, tab, telegram]);
  const updateSettingsSummary = useCallback((summary: { businessName?: string; settingsComplete: boolean }) => {
    setHomeData(current => ({ ...current, ...summary }));
  }, []);
  function chooseTab(next: AppTab) { setDocumentPreviewOpen(false); setCreateIntent(false); setDocumentType(null); setDocumentId(null); setTab(next); telegram.haptic('selection'); }
  function startCreate() { try { localStorage.removeItem(draftKey); } catch { /* Storage may be disabled. */ } setNewDocumentVersion(version => version + 1); setDocumentPreviewOpen(false); setCreateIntent(true); setDocumentType('proforma'); setDocumentId(null); telegram.haptic('light'); }
  function openDocument(doc:SalesDocument){setDocumentReturnTab('invoices');setDocumentType(doc.documentType);setDocumentId(doc.id);setCreateIntent(true);telegram.haptic('selection');}
  function openRecentDocument(item:RecentInvoice){setDocumentReturnTab('home');setDocumentType(item.documentType);setDocumentId(item.documentId);setCreateIntent(true);telegram.haptic('selection');}
  const createContent = documentType ? <SalesDocumentPage key={documentId ?? newDocumentVersion} type={documentType} documentId={documentId} preview={preview} draftKey={draftKey} showPreview={documentPreviewOpen} onPreviewChange={setDocumentPreviewOpen} onTypeChange={setDocumentType} onBack={() => {setDocumentPreviewOpen(false);setDocumentType(null);setDocumentId(null);if(documentId){setCreateIntent(false);setTab(documentReturnTab);}}} /> : null;
  return <AppFrame theme={runtime.colorScheme} platform={runtime.platform} tab={tab} creating={createIntent}
    contentKey={createIntent ? `create-${documentId??'new'}` : tab} onTab={chooseTab} onCreate={startCreate}>
    {createIntent ? createContent : tab === 'home' ? <Home data={homeData} onCreate={startCreate} onOpen={openRecentDocument} feedback={pilotFeedback && onFeedbackSubmitted && <PilotFeedback status={pilotFeedback} onSubmitted={onFeedbackSubmitted} />} /> : tab === 'invoices' ? <DocumentsPage preview={preview} onOpen={openDocument} /> : tab === 'templates' ? <TemplatesPage preview={preview} /> : <Settings onSummaryChange={updateSettingsSummary} getInitData={preview ? undefined : () => telegram.getInitData() ?? ''} />}
  </AppFrame>;
}

export default function App() {
  const telegram = useMemo(() => new TelegramAdapter(), []);
  const [runtime, setRuntime] = useState<TelegramRuntimeSnapshot>(() => telegram.snapshot());
  const [session, setSession] = useState<SessionUser | null>(null);
  const [state, setState] = useState<ShellState>('loading');
  const [error, setError] = useState('');
  const [homeData,setHomeData]=useState<HomeData>(emptyHome);
  const [pilotFeedback,setPilotFeedback]=useState<PilotFeedbackStatus>();
  const [attempt, setAttempt] = useState(0);
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('g02-preview');
  useEffect(() => { document.documentElement.dataset.motion = shouldReduceMotion() ? 'reduced' : 'full'; telegram.ready(); telegram.expand(); const update = () => { const next = telegram.snapshot(); applyRuntimeCssVariables(next); setRuntime(next); }; update(); const unsubscribe = telegram.onRuntimeChange(update); return unsubscribe; }, [telegram]);
  useEffect(() => { let cancelled = false; async function bootstrap() { if (preview) return; setState('loading'); setError(''); if (!navigator.onLine) { setState('offline'); return; } try { const initData = telegram.getInitData(); if (!initData) throw new Error('این صفحه را از دکمهٔ منوی ربات تلگرام باز کنید.'); const authenticated = await authenticateWithTelegram(initData); const [settingsResult,pilotResult]=await Promise.allSettled([getBusinessSettings(),getPilotStatus()]); if (cancelled) return; if(settingsResult.status==='fulfilled'){const seller=settingsResult.value.settings.seller;const name=seller.displayName||seller.businessName||undefined;setHomeData({recentInvoices:[],hasDocuments:true,businessName:name,settingsComplete:Boolean(name)});}if(pilotResult.status==='fulfilled')setPilotFeedback(pilotResult.value.feedback);setSession(authenticated); setState('ready'); telegram.haptic('success'); } catch (reason) { if (cancelled) return; setError(reason instanceof Error ? reason.message : 'خطای ناشناخته در برقراری نشست امن'); setState('error'); } } void bootstrap(); return () => { cancelled = true; }; }, [attempt, preview, telegram]);
  useEffect(() => { const offline = () => setState('offline'); const online = () => setAttempt(value => value + 1); window.addEventListener('offline', offline); window.addEventListener('online', online); return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online); }; }, []);
  if (preview) return <AppShell telegram={telegram} preview runtime={{ ...runtime, colorScheme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light' }} />;
  if (state !== 'ready' || !session) return <main className="app-shell state-shell" data-theme={runtime.colorScheme}><StatusView state={state === 'ready' ? 'error' : state} message={error || undefined} onRetry={state === 'loading' ? undefined : () => setAttempt(value => value + 1)} /></main>;
  if (new URLSearchParams(window.location.search).get('owner') === '1') return <OwnerDashboard />;
  return <AppShell telegram={telegram} runtime={runtime} businessId={session.businessId} data={homeData} pilotFeedback={pilotFeedback} onFeedbackSubmitted={()=>setPilotFeedback(current=>current?{...current,eligible:false,submitted:true}:current)} />;
}
