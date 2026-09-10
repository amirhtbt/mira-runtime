import type { InvoiceViewModel, TemplateId } from './types';

export function fixture(templateId: TemplateId = 'minimal', count = 2): InvoiceViewModel {
  return {
    schemaVersion: 1, documentType: 'invoice', documentNumber: 'INV-1405012-000123', issueDate: '۱۴۰۵/۰۵/۱۲', orderNumber: 'CB-14050510-00123',
    seller: { name: 'فروشگاه نمونه میرا', subtitle: 'تولید و فروش کالا و خدمات', legalId: '۱۴۰۰۵۸۹۳۰۱۰', economicId: '۴۱۱۵۳۸۱۹۸۱۳۵', phone: '۰۲۱-۸۸۸۸۸۸۸۸', address: 'تهران، خیابان نمونه، پلاک ۱۲', email: 'info@example.ir' },
    customer: { name: 'شرکت مشتری نمونه', legalId: '۱۴۰۰۷۵۱۱۹۹', postalCode: '۳۱۷۴۸۲۶۴۱۱', phone: '۰۲۶-۹۱۰۰۹۰۴', address: 'البرز، شهرک صنعتی، خیابان نمونه' },
    items: Array.from({ length: count }, (_, i) => ({ row: i + 1, sku: `SKU-${String(i + 1).padStart(3, '0')}`, title: `کالای نمونه ${i + 1}${i === 0 ? ' با عنوان طولانی فارسی برای آزمون شکست صحیح سطر' : ''}`, description: i === 0 ? 'مشخصات تکمیلی کالا در صورت تعریف نمایش داده می‌شود.' : undefined, unit: 'عدد', quantity: String((i % 4) + 1), unitPriceRial: String(48000000 + i * 100000), discountRial: i === 0 ? '400000' : '0', taxRial: '14460000', totalRial: String(160100000 + i * 100000) })),
    subtotalRial: String(count * 160100000), discountRial: '400000', taxRial: '14460000', shippingRial: '1000000', serviceFeeRial: '250000', adjustments: [{ label: 'بسته‌بندی', amountRial: '150000', direction: 'surcharge' }], grandTotalRial: String(count * 160100000 + 15460000),
    sellerNote: 'اطلاعات تکمیلی فروشنده در صورت ثبت.', paymentTerms: 'پرداخت طبق توافق طرفین انجام می‌شود.', shippingTerms: 'ارسال پس از تأیید سفارش.', footer: 'این سند به صورت الکترونیکی صادر شده است.', thankYou: 'از اعتماد شما سپاسگزاریم.',
    payment: { cardNumber: '۶۲۱۹-۸۶۱۰-۰۰۰۰-۰۰۰۰', sheba: 'IR۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰۰', bankName: 'بانک نمونه', accountHolder: 'فروشگاه میرا' },
    signature: { sellerLabel: 'مهر و امضای فروشنده', customerLabel: 'مهر و امضای خریدار', showStampArea: true },
    templateId, templateVersion: 1, orientation: 'landscape'
  };
}
