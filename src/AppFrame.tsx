import type { ReactNode } from 'react';
import type { DocumentType } from './api/client';
import { toFaDigits } from './format/faDigits';

export type AppTab = 'home' | 'invoices' | 'settings' | 'templates';
export interface RecentInvoice { id: string; documentId: string; documentType: DocumentType; customer: string; amount: string; date: string; status: 'draft' | 'final' }
export interface HomeData { recentInvoices: RecentInvoice[]; hasDocuments?: boolean; businessName?: string; settingsComplete: boolean }

export function Icon({ name }: { name: 'home' | 'invoice' | 'settings' | 'templates' | 'plus' | 'spark' | 'store' | 'arrow' | 'retry' }) {
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

export function EmptyInvoices({ compact = false }: { compact?: boolean }) {
  return <section className={`empty-card${compact ? ' compact' : ''}`}><div className="empty-visual" aria-hidden="true"><span/><span/><span/></div><div><h2>هنوز سندی ندارید</h2><p>اولین فاکتور یا پیش‌فاکتور شما از همین‌جا شروع می‌شود.</p></div></section>;
}

export function Home({ data, onCreate, onOpen, feedback }: { data: HomeData; onCreate: () => void; onOpen: (item:RecentInvoice) => void; feedback?:ReactNode }) {
  const hasInvoices = data.hasDocuments ?? data.recentInvoices.length > 0;
  return <div className="page page-home"><header className="hero"><div className="eyebrow"><Icon name="spark" />سریع، ساده، حرفه‌ای</div><h1>{hasInvoices ? 'دوباره آماده‌ایم' : 'اولین سند فروشتان را بسازید'}</h1><p>{hasInvoices ? 'کارهای اخیرتان همین‌جا در دسترس است.' : 'فاکتور یا پیش‌فاکتور؛ بدون تنظیمات پیچیده.'}</p><button className="primary-button hero-action" onClick={onCreate}><Icon name="plus" /><span>ساخت سند جدید</span><Icon name="arrow" /></button><div className="hero-orb" aria-hidden="true"><Icon name="invoice" /></div></header>
    {data.recentInvoices.length > 0 ? <section className="section-block" aria-labelledby="recent-heading"><div className="section-title"><h2 id="recent-heading">آخرین اسناد</h2><span>{data.recentInvoices.length.toLocaleString('fa-IR')} مورد</span></div><div className="invoice-list">{data.recentInvoices.slice(0, 3).map(item => <button type="button" className="invoice-row invoice-row-button" key={item.documentId} aria-label={`مشاهده سند ${item.id} برای ${item.customer}`} onClick={() => onOpen(item)}><span className="invoice-icon"><Icon name="invoice" /></span><span className="invoice-main"><strong>{item.customer}</strong><span><bdi>{toFaDigits(item.id)}</bdi> · <bdi>{toFaDigits(item.date)}</bdi></span></span><span className="invoice-amount"><bdi>{item.amount}</bdi><span>{item.status === 'draft' ? 'پیش‌نویس' : 'نهایی'}</span></span></button>)}</div></section> : data.hasDocuments === false || (data.hasDocuments === undefined && data.recentInvoices.length === 0) ? <EmptyInvoices compact /> : null}
    <section className="business-card" aria-label="وضعیت کسب‌وکار"><span className="business-icon"><Icon name="store" /></span><div><h2>{data.businessName || 'مشخصات کسب‌وکار'}</h2><p>{data.settingsComplete ? 'اطلاعات پایه آماده است' : 'بعداً نام و اطلاعات فروشگاه را تکمیل کنید'}</p></div><span className={`status-pill ${data.settingsComplete ? 'complete' : ''}`}>{data.settingsComplete ? 'آماده' : 'تکمیل نشده'}</span></section>{feedback}</div>;
}

export function AppFrame({
  theme, platform, tab, creating, contentKey, onTab, onCreate, children,
  subtitle = 'فاکتورساز تلگرام', badge = 'امن',
}: {
  theme: 'light' | 'dark'; platform: string; tab: AppTab; creating: boolean;
  contentKey: string; onTab: (tab: AppTab) => void; onCreate: () => void;
  children: ReactNode; subtitle?: string; badge?: string;
}) {
  return <main className="app-shell" data-theme={theme} data-platform={platform}><div className="app-frame"><div className="topbar"><div className="brand"><span className="brand-mark"><Icon name="spark" /></span><span><strong>فاکتورساز بهار</strong><small>{subtitle}</small></span></div><span className="secure-chip"><span/>{badge}</span></div><div className="content" key={contentKey}>{children}</div>
    <nav className="bottom-nav" aria-label="ناوبری اصلی"><button className={tab === 'home' && !creating ? 'active' : ''} aria-current={tab === 'home' && !creating ? 'page' : undefined} onClick={() => onTab('home')}><Icon name="home" /><span>خانه</span></button><button className={tab === 'invoices' && !creating ? 'active' : ''} aria-current={tab === 'invoices' && !creating ? 'page' : undefined} onClick={() => onTab('invoices')}><Icon name="invoice" /><span>فاکتورها</span></button><button className={`nav-create${creating ? ' active' : ''}`} aria-label="ساخت سند جدید" aria-current={creating ? 'page' : undefined} onClick={onCreate}><span><Icon name="plus" /></span><b>سند جدید</b></button><button className={tab === 'settings' && !creating ? 'active' : ''} aria-current={tab === 'settings' && !creating ? 'page' : undefined} onClick={() => onTab('settings')}><Icon name="settings" /><span>تنظیمات</span></button><button className={tab === 'templates' && !creating ? 'active' : ''} aria-current={tab === 'templates' && !creating ? 'page' : undefined} onClick={() => onTab('templates')}><Icon name="templates" /><span>قالب‌ها</span></button></nav></div></main>;
}
