// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OfflinePdfActions } from './OfflinePdfActions';
import { defaultOfflineSettings } from './offlineSettings';
import type { LocalDocument } from './offlineStore';

const native = vi.hoisted(() => ({
  savePdf: vi.fn(async (_file: { name: string; base64: string }) => ({ saved: false })),
  sharePdf: vi.fn(async (_file: { name: string; base64: string }) => {}),
}));

vi.mock('@capacitor/core', () => ({ registerPlugin: () => native }));
vi.mock('../export/documentPdf', async importOriginal => ({
  ...await importOriginal<typeof import('../export/documentPdf')>(),
  renderDocumentPdf: vi.fn(async () => new Blob(['%PDF-test'], { type: 'application/pdf' })),
}));

afterEach(cleanup);

it('saves or shares PDF bytes under the Persian name and reports only the native outcome', async () => {
  const doc: LocalDocument = {
    id: '1', issuedAt: '2026-11-19', documentType: 'proforma', documentNumber: 'PF-00001',
    customerId: '2', customerName: 'شرکت بهار', lifecycleStatus: 'issued', settlementStatus: 'unpaid',
    sourceDocumentId: null, currencyUnit: 'rial', version: 1, settingsSnapshot: defaultOfflineSettings(),
    subtotalBaseUnit: '100', discountBaseUnit: '0', surchargeBaseUnit: '0', grandTotalBaseUnit: '100',
    remainingAmountBaseUnit: '100', paidAmountBaseUnit: '0', items: [], canIssueFinalInvoice: false,
  };
  render(<OfflinePdfActions doc={doc} />);
  fireEvent.click(screen.getByRole('button', { name: 'ذخیره PDF' }));
  await screen.findByText('ذخیرهٔ فایل لغو شد.');
  const file = { name: 'پیش‌فاکتور - شرکت بهار.pdf', base64: btoa('%PDF-test') };
  expect(native.savePdf).toHaveBeenCalledWith(file);
  native.savePdf.mockResolvedValueOnce({ saved: true });
  fireEvent.click(screen.getByRole('button', { name: 'ذخیره PDF' }));
  await screen.findByText('فایل PDF ذخیره شد.');
  fireEvent.click(screen.getByRole('button', { name: 'اشتراک‌گذاری PDF' }));
  await screen.findByText('منوی اشتراک‌گذاری باز شد.');
  expect(native.sharePdf).toHaveBeenCalledWith(file);
});
