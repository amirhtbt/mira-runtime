// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { OfflineApp } from './OfflineApp';
import { toFaDigits } from '../format/faDigits';
import { openOfflineStore } from './offlineStore';

it('opens a fresh editor, resumes a draft, and recovers the issued document from the archive', async () => {
  const name = crypto.randomUUID();
  const first = await openOfflineStore(name);
  const app = render(<OfflineApp store={first} />);
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'ساخت سند جدید' }));
  expect(screen.getByLabelText('نام مشتری یا شرکت')).toHaveProperty('value', '');
  expect(screen.getByLabelText('تعداد')).toHaveProperty('value', '1');
  expect(screen.getByLabelText('مبلغ واحد (ریال)')).toHaveProperty('value', '');
  fireEvent.change(screen.getByLabelText('نام مشتری یا شرکت'), { target: { value: 'شرکت بهار' } });
  fireEvent.change(screen.getByLabelText('شماره همراه'), { target: { value: '09121234567' } });
  fireEvent.change(screen.getByLabelText('شرح کالا یا خدمت'), { target: { value: 'خدمت نمونه' } });
  fireEvent.change(screen.getByLabelText('مبلغ واحد (ریال)'), { target: { value: '۲۵۰۰۰۰' } });
  fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ پیش‌نویس' }));
  fireEvent.click(await screen.findByRole('button', { name: /ادامهٔ پیش‌نویس/ }));
  expect(screen.getByLabelText('شرح کالا یا خدمت')).toHaveProperty('value', 'خدمت نمونه');
  fireEvent.click(screen.getByRole('button', { name: 'صدور پیش‌فاکتور' }));
  await screen.findByRole('heading', { name: 'پیش‌فاکتور · شرکت بهار' });
  const [issued] = await first.listDocuments();
  expect(await first.listDrafts()).toEqual([]);
  app.unmount();
  first.close();

  const reopened = await openOfflineStore(name);
  const mounted = render(<OfflineApp store={reopened} />);
  try {
    fireEvent.click(screen.getByRole('button', { name: 'فاکتورها' }));
    const entry = await screen.findByRole('button', { name: /PF-/ });
    expect(within(entry).getByText(toFaDigits(issued.documentNumber))).toBeTruthy();
    expect(within(entry).getByText(/۲۵۰٬۰۰۰ ریال/)).toBeTruthy();
    fireEvent.click(entry);
    fireEvent.click(screen.getByRole('button', { name: 'کپی سند قبلی' }));
    expect(screen.getByLabelText('شرح کالا یا خدمت')).toHaveProperty('value', 'خدمت نمونه');
    fireEvent.click(screen.getByRole('button', { name: 'فاکتورها' }));
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'ساخت سند جدید' }));
    fireEvent.change(screen.getByLabelText('انتخاب از مشتریان ذخیره‌شده'), { target: { value: issued.customerId } });
    expect(screen.getByLabelText('نام مشتری یا شرکت')).toHaveProperty('value', 'شرکت بهار');
    expect(screen.getByLabelText('شرح کالا یا خدمت')).toHaveProperty('value', '');
    expect(screen.getByLabelText('مبلغ واحد (ریال)')).toHaveProperty('value', '');
  } finally {
    mounted.unmount();
    reopened.close();
  }
});

it('uses the shared settings and template pages with the local profile', async () => {
  const store = await openOfflineStore(crypto.randomUUID());
  const app = render(<OfflineApp store={store} />);
  try {
    const navigation = within(screen.getByRole('navigation'));
    fireEvent.click(navigation.getByRole('button', { name: 'تنظیمات' }));
    const name = await screen.findByLabelText('نام کسب‌وکار');
    fireEvent.change(name, { target: { value: 'فروشگاه بهار' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }));
    await screen.findByText('تغییرات ذخیره شد.');
    fireEvent.click(navigation.getByRole('button', { name: 'قالب‌ها' }));
    fireEvent.click(await screen.findByRole('button', { name: /تجاری کلاسیک/ }));
    fireEvent.click(screen.getByRole('button', { name: 'سبز تیره' }));
    fireEvent.click(screen.getByRole('button', { name: 'فعال‌کردن قالب' }));
    await screen.findByText(/قالب فعال ذخیره شد/);
    expect((await store.getProfile())?.settings).toMatchObject({
      seller: { businessName: 'فروشگاه بهار' },
      visual: { templateId: 'classic-business', accent: '#1f6850' },
    });
  } finally {
    app.unmount();
    store.close();
  }
});
