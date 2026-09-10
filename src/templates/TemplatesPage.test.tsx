// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatesPage } from './TemplatesPage';
import { getBusinessSettings, updateBusinessSettings } from '../api/client';

vi.mock('../api/client', () => ({ getBusinessSettings: vi.fn(), updateBusinessSettings: vi.fn() }));
const payload = { schemaVersion: 1, version: 1, updatedAt: null, logo: { present: false, mimeType: null, byteSize: null, width: null, height: null, updatedAt: null }, settings: { visual: { templateId: 'minimal', accent: '#214f7b' } } };

describe('TemplatesPage persistence', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getBusinessSettings).mockResolvedValue(payload as never); vi.mocked(updateBusinessSettings).mockResolvedValue(payload as never); });
  it('persists the selected structure and theme as the future issuance default', async () => {
    render(<TemplatesPage/>); await screen.findByRole('heading', { name: 'قالب‌ها' });
    fireEvent.click(screen.getByRole('button', { name: /تجاری کلاسیک/ })); fireEvent.click(screen.getByRole('button', { name: 'سبز تیره' })); fireEvent.click(screen.getByRole('button', { name: 'فعال‌کردن قالب' }));
    await waitFor(() => expect(updateBusinessSettings).toHaveBeenCalledWith({ visual: { templateId: 'classic-business', accent: '#1f6850' } }));
  });
  it('allows a colour-only change to be saved', async () => {
    render(<TemplatesPage/>); await screen.findByRole('heading', { name: 'قالب‌ها' }); fireEvent.click(screen.getByRole('button', { name: 'طلایی' }));
    expect(screen.getByRole('button', { name: 'فعال‌کردن قالب' })).toHaveProperty('disabled', false);
  });
});
