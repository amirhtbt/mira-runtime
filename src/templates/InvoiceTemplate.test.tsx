// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fixture } from './fixtures';
import { InvoiceTemplate } from './InvoiceTemplate';
import { templates } from './registry';

describe('G05 landscape template platform', () => {
  it('registers three structurally distinct landscape-only templates', () => {
    expect(templates.map(item => item.id)).toEqual(['minimal', 'modern-business', 'classic-business']);
    for (const template of templates) expect(template.orientations).toEqual(['landscape']);
    expect(new Set(templates.map(item => item.structure)).size).toBe(3);
  });
  it('renders every template with the same authoritative Rial total', () => {
    for (const template of templates) {
      const model = fixture(template.id, 20); const { container, unmount } = render(<InvoiceTemplate model={model}/>);
      expect(container.firstElementChild?.getAttribute('data-template')).toBe(`${template.id}@1`);
      expect(container.firstElementChild?.getAttribute('data-orientation')).toBe('landscape');
      expect(screen.getAllByText(/جمع نهایی \(ریال\)/).length).toBeGreaterThan(0); expect(container.textContent).not.toContain('تومان'); unmount();
    }
  });
  it('renders phone, document number and dates with Persian digits', () => {
    const model = fixture(); model.documentNumber='INV-1405-00123'; model.issueDate='1405/06/21'; model.validUntil='1405/06/28'; model.seller.phone='021-88881234'; model.customer.phone='09121234567';
    const { container } = render(<InvoiceTemplate model={model}/>);
    expect(container.textContent).toContain('INV-۱۴۰۵-۰۰۱۲۳');
    expect(container.textContent).toContain('۱۴۰۵/۰۶/۲۱');
    expect(container.textContent).toContain('۱۴۰۵/۰۶/۲۸');
    expect(container.textContent).toContain('۰۲۱-۸۸۸۸۱۲۳۴');
    expect(container.textContent).toContain('۰۹۱۲۱۲۳۴۵۶۷');
  });
  it('omits undefined optional fields', () => {
    const model = fixture(); model.seller = { name: 'فروشنده' }; model.customer = { name: 'خریدار' }; model.payment = undefined; model.sellerNote = undefined; model.paymentTerms = undefined; model.shippingTerms = undefined; model.validityNotice = undefined; model.footer = undefined; model.thankYou = undefined;
    const { container } = render(<InvoiceTemplate model={model}/>); expect(container.textContent).not.toContain('شناسه ملی'); expect(container.textContent).not.toContain('اطلاعات پرداخت'); expect(container.textContent).not.toContain('شرایط و توضیحات');
  });
  it('handles 100 classic rows', () => { render(<InvoiceTemplate model={fixture('classic-business', 100)}/>); expect(screen.getByText('کالای نمونه 100')).toBeTruthy(); });
});
