// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import type { BusinessSettings, SettingsResponse } from './types';
import { getBusinessSettings, updateBusinessSettings, uploadBusinessLogo } from '../api/client';

vi.mock('../api/client', () => ({
  getBusinessSettings: vi.fn(),
  updateBusinessSettings: vi.fn(),
  uploadBusinessLogo: vi.fn(),
  deleteBusinessLogo: vi.fn(),
  businessLogoUrl: vi.fn(() => '/api/v1/settings/logo?v=test')
}));

const defaults: BusinessSettings = {
  seller: { businessName: '', displayName: '', subtitle: '', sellerName: '', phone: '', telegramUsername: '', address: '', showAddress: false, customContactLine: '' },
  payment: { cardNumber: '', accountNumber: '', sheba: '', bankName: '', accountHolder: '', instructions: '' },
  document: { proformaLabel: 'پیش‌فاکتور', invoiceLabel: 'فاکتور فروش', numberingMode: 'auto', proformaPrefix: 'PF', invoicePrefix: 'INV', numberPadding: 5, issueDateMode: 'today', validityDays: 7, calendar: 'jalali', digits: 'persian' },
  presentation: { currencyUnit: 'toman', thousandsSeparator: true, decimalPolicy: 'none', roundTotal: 'none' },
  items: { rowNumber: true, sku: false, image: false, title: true, description: true, unit: false, quantity: true, unitPrice: true, lineDiscount: false, tax: false, lineTotal: true },
  financial: { discount: { kind: 'none', amountBaseUnit: '0', percentBasisPoints: 0 }, shippingAmountBaseUnit: '0', serviceFeeAmountBaseUnit: '0', taxEnabled: false, taxRateBasisPoints: 0, customAdjustments: [] },
  text: { sellerNote: '', paymentTerms: '', shippingTerms: '', footer: '', validityNotice: '', thankYou: '' },
  visual: { templateId: 'mira-classic', accent: '#2f80ed', invoiceVariant: 'auto', logoPosition: 'start', density: 'comfortable', fontSize: 'medium' }
};

function payload(settings = defaults): SettingsResponse {
  return { schemaVersion: 1, settings: JSON.parse(JSON.stringify(settings)), version: 0, updatedAt: null, logo: { present: false, mimeType: null, byteSize: null, width: null, height: null, updatedAt: null } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBusinessSettings).mockResolvedValue(payload());
  vi.mocked(updateBusinessSettings).mockImplementation(async settings => ({ ...payload(settings as BusinessSettings), version: 1, updatedAt: '2026-09-10 08:00:00' }));
});

describe('G03 SettingsPage', () => {
  it('keeps advanced settings collapsed while exposing seller and payment quick setup', async () => {
    render(<SettingsPage />);
    expect(await screen.findByRole('heading', { name: 'اطلاعاتی که روی سند دیده می‌شود' })).toBeTruthy();
    expect(screen.getByLabelText('نام کسب‌وکار')).toBeTruthy();
    expect(screen.getByLabelText('شماره کارت')).toBeTruthy();
    const advanced = screen.getByText('پیش‌فرض سند').closest('details');
    expect(advanced?.hasAttribute('open')).toBe(false);
  });

  it('saves mixed Persian Latin values and presentation choices without calculating money', async () => {
    render(<SettingsPage />);
    const name = await screen.findByLabelText('نام کسب‌وکار');
    fireEvent.change(name, { target: { value: 'فروشگاه Mira 24' } });
    fireEvent.change(screen.getByLabelText('شماره کارت'), { target: { value: '1111222233334444' } });
    const details = screen.getByText('نمایش مبلغ و اعداد').closest('details');
    if (details) fireEvent.click(details.querySelector('summary')!);
    expect(screen.getByLabelText('واحد محاسبه و نمایش')).toHaveProperty('value', 'rial');
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }));
    await waitFor(() => expect(updateBusinessSettings).toHaveBeenCalledOnce());
    const saved = vi.mocked(updateBusinessSettings).mock.calls[0][0] as BusinessSettings;
    expect(saved.seller.businessName).toBe('فروشگاه Mira 24');
    expect(saved.payment.cardNumber).toBe('1111222233334444');
    expect(saved.presentation.currencyUnit).toBe('rial');
    expect(saved.financial.shippingAmountBaseUnit).toBe('0');
    expect(await screen.findByText('تغییرات ذخیره شد.')).toBeTruthy();
  });

  it('rejects unsupported or oversized logo files before API upload', async () => {
    render(<SettingsPage />);
    const input = await screen.findByLabelText(/افزودن لوگو/);
    const svg = new File(['<svg><script>alert(1)</script></svg>'], 'bad.svg', { type: 'image/svg+xml' });
    fireEvent.change(input, { target: { files: [svg] } });
    expect(await screen.findByText(/PNG، JPEG یا WebP/)).toBeTruthy();
    expect(uploadBusinessLogo).not.toHaveBeenCalled();
  });

  it('reports load failure instead of leaving an endless spinner', async () => {
    vi.mocked(getBusinessSettings).mockRejectedValueOnce(new Error('offline'));
    render(<SettingsPage />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('تنظیمات بارگذاری نشد');
  });
});
