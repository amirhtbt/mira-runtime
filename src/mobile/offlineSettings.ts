import type { BusinessSettings, PaymentSettings } from '../settings/types';

// Keep fresh-install defaults aligned with SettingsSchema::defaults().
export function defaultOfflineSettings(): BusinessSettings {
  const payment = (): PaymentSettings => ({
    accounts: [], cardNumber: '', accountNumber: '', sheba: '', bankName: '',
    accountHolder: '', instructions: '',
  });
  return {
    seller: {
      businessName: '', displayName: '', subtitle: '', sellerName: '', phone: '',
      telegramUsername: '', address: '', showAddress: false, customContactLine: '',
    },
    payment: payment(),
    officialSeller: { companyName: '', address: '', phone: '', nationalId: '' },
    officialPayment: payment(),
    document: {
      proformaLabel: 'پیش‌فاکتور', invoiceLabel: 'فاکتور فروش',
      numberingMode: 'auto', proformaPrefix: 'PF', invoicePrefix: 'INV',
      numberPadding: 5, issueDateMode: 'today', validityDays: 7, calendar: 'jalali', digits: 'persian',
    },
    presentation: {
      currencyUnit: 'rial', thousandsSeparator: true, decimalPolicy: 'none', roundTotal: 'none',
    },
    items: {
      rowNumber: true, sku: false, image: false, title: true, description: true, unit: false,
      quantity: true, unitPrice: true, lineDiscount: false, tax: false, lineTotal: true,
    },
    financial: {
      discount: { kind: 'none', amountBaseUnit: '0', percentBasisPoints: 0 },
      shippingAmountBaseUnit: '0', serviceFeeAmountBaseUnit: '0', taxEnabled: false,
      taxRateBasisPoints: 1000, customAdjustments: [],
    },
    text: { sellerNote: '', paymentTerms: '', shippingTerms: '', footer: '', validityNotice: '', thankYou: '' },
    visual: {
      templateId: 'minimal', accent: '#2f80ed', invoiceVariant: 'auto',
      logoPosition: 'start', density: 'comfortable', fontSize: 'medium',
    },
  };
}
