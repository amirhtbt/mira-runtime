// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell, StatusView, type HomeData } from './App';
import { TelegramAdapter, type TelegramRuntimeSnapshot } from './telegram/adapter';

const runtime: TelegramRuntimeSnapshot = { available: true, platform: 'android', version: '9.6', colorScheme: 'light', viewportHeight: 720, viewportStableHeight: 700, safeArea: { top: 20, right: 0, bottom: 12, left: 0 }, contentSafeArea: { top: 28, right: 0, bottom: 16, left: 0 } };

function adapter() {
  const telegram = new TelegramAdapter({
    initData: 'signed', platform: 'android', version: '9.6', colorScheme: 'light', viewportHeight: 720, viewportStableHeight: 700,
    ready: vi.fn(), expand: vi.fn(), onEvent: vi.fn(), offEvent: vi.fn()
  });
  vi.spyOn(telegram, 'haptic'); vi.spyOn(telegram, 'setBackHandler');
  return telegram;
}

describe('G02 app shell', () => {
  it('offers the real empty home and keyboard-accessible navigation', () => {
    render(<AppShell telegram={adapter()} runtime={runtime} />);
    expect(screen.getByText('فاکتورساز بهار')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'اولین سند فروشتان را بسازید' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /فاکتورها/ }));
    expect(screen.getByRole('heading', { name: 'اسناد مشتریان' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /تنظیمات/ }));
    expect(screen.getByRole('heading', { name: 'تنظیمات' })).toBeTruthy();
  });

  it('isolates mixed invoice identifiers and amounts in returning-user data', () => {
    const data: HomeData = { settingsComplete: true, businessName: 'فروشگاه بهار', recentInvoices: [{ id: 'INV-A12-۱۴۰۵', documentId: 'document-uuid', documentType: 'proforma', customer: 'شرکت Box4U', amount: '۱۲٬۴۵۰٬۰۰۰ تومان', date: '18 شهریور 1405', status: 'draft' }] };
    const { container } = render(<AppShell telegram={adapter()} runtime={{ ...runtime, colorScheme: 'dark' }} data={data} />);
    expect(screen.getByText('INV-A۱۲-۱۴۰۵')).toBeTruthy();
    expect(screen.getByText('۱۸ شهریور ۱۴۰۵')).toBeTruthy();
    expect(screen.getByText('۱۲٬۴۵۰٬۰۰۰ تومان').tagName).toBe('BDI');
    expect(container.querySelector('[data-theme="dark"]')).toBeTruthy();
  });

  it('opens a home document by its internal ID and returns to Home with Telegram Back', () => {
    const telegram = adapter();
    const data: HomeData = {settingsComplete:true,recentInvoices:[{id:'PF-0007',documentId:'doc-uuid-7',documentType:'proforma',customer:'مشتری نمونه',amount:'۱۰۰ ریال',date:'۱۴۰۵/۶/۱',status:'final'}]};
    render(<AppShell telegram={telegram} runtime={runtime} preview data={data}/>);
    fireEvent.click(screen.getByRole('button',{name:'مشاهده سند PF-0007 برای مشتری نمونه'}));
    expect(screen.getByLabelText('نام مشتری یا شرکت')).toBeTruthy();
    const handler=vi.mocked(telegram.setBackHandler).mock.calls.at(-1)?.[0];
    expect(handler).toBeTypeOf('function');
    act(()=>handler?.());
    expect(screen.getByRole('button',{name:'مشاهده سند PF-0007 برای مشتری نمونه'})).toBeTruthy();
  });

  it('only shows the empty-document card when the account really has no documents', () => {
    const { rerender } = render(<AppShell telegram={adapter()} runtime={runtime} preview data={{recentInvoices:[],hasDocuments:true,settingsComplete:true}} />);
    expect(screen.queryByText('هنوز سندی ندارید')).toBeNull();
    rerender(<AppShell telegram={adapter()} runtime={runtime} preview data={{recentInvoices:[],hasDocuments:false,settingsComplete:true}} />);
    expect(screen.getByText('هنوز سندی ندارید')).toBeTruthy();
  });

  it('turns the central CTA into a back-button-aware create intent', () => {
    const telegram = adapter(); render(<AppShell telegram={telegram} runtime={runtime} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'ساخت سند جدید' })[0]);
    expect(screen.getByLabelText('نام مشتری یا شرکت')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'چه سندی می‌سازید؟' })).toBeNull();
    expect(screen.getByRole('button', { name: 'پیش‌فاکتور' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'فاکتور فروش' }));
    expect(screen.getByRole('button', { name: 'فاکتور فروش' }).getAttribute('aria-pressed')).toBe('true');
    expect(telegram.haptic).toHaveBeenCalledWith('light');
    expect(telegram.setBackHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it('Telegram Back closes preview first and keeps the auto-saved form', async () => {
    localStorage.clear(); const telegram = adapter();
    render(<AppShell telegram={telegram} runtime={runtime} businessId="tenant-a" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'ساخت سند جدید' })[0]);
    fireEvent.change(screen.getByLabelText('نام مشتری یا شرکت'), { target: { value: 'مشتری محفوظ' } });
    fireEvent.click(screen.getByText('سند رسمی', { exact: true }));
    fireEvent.change(screen.getByLabelText('شناسه ملی'), { target: { value: '1234567890' } });
    fireEvent.click(screen.getByRole('button', { name: 'پیش‌نمایش کامل' }));
    expect(screen.getByRole('dialog', { name: 'پیش‌نمایش کامل سند' })).toBeTruthy();
    const calls=vi.mocked(telegram.setBackHandler).mock.calls;const back=calls.at(-1)?.[0];
    await act(async()=>back?.());
    expect(screen.queryByRole('dialog', { name: 'پیش‌نمایش کامل سند' })).toBeNull();
    expect((screen.getByLabelText('نام مشتری یا شرکت') as HTMLInputElement).value).toBe('مشتری محفوظ');
    expect((screen.getByLabelText('شناسه ملی') as HTMLInputElement).value).toBe('1234567890');
    expect(JSON.parse(localStorage.getItem('mira:sales-draft:tenant-a')||'{}').nationalId).toBe('1234567890');
  });

  it('renders designed offline and retry states', () => {
    const retry = vi.fn(); render(<StatusView state="offline" onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: /تلاش دوباره/ }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows pilot feedback only after server-side eligibility without trial wording', () => {
    const {rerender}=render(<AppShell telegram={adapter()} runtime={runtime} pilotFeedback={{eligible:false,submitted:false,issuedDocuments:1,activeDays:1}} onFeedbackSubmitted={vi.fn()}/>);
    expect(screen.queryByRole('heading',{name:'فاکتورساز بهار چقدر برایتان کاربردی بود؟'})).toBeNull();
    rerender(<AppShell telegram={adapter()} runtime={runtime} pilotFeedback={{eligible:true,submitted:false,issuedDocuments:3,activeDays:1}} onFeedbackSubmitted={vi.fn()}/>);
    expect(screen.getByRole('heading',{name:'فاکتورساز بهار چقدر برایتان کاربردی بود؟'})).toBeTruthy();
    expect(screen.queryByText('نسخه آزمایشی رایگان')).toBeNull();
    expect(screen.getByPlaceholderText(/اطلاعات مشتری/)).toBeTruthy();
  });
});
