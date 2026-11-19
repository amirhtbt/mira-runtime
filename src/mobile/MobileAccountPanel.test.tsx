// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMobileAccountApi } from './mobileAccountApi';
import { MobileAccountPanel } from './MobileAccountPanel';

const request = vi.hoisted(() => vi.fn());
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { request } }));

afterEach(() => {
  cleanup();
  request.mockReset();
});

it('requests a four-digit SMS, verifies it, checks the resulting cookie session, and signs out', async () => {
  const id = '285427f4-92d8-4b90-b775-be841b6c9212';
  const session = { userId: 'user', businessId: 'business' };
  request
    .mockResolvedValueOnce({ status: 401 })
    .mockResolvedValueOnce({ status: 202, data: { ok: true, data: { challengeId: id } } })
    .mockResolvedValueOnce({ status: 200, data: { ok: true, data: session } })
    .mockResolvedValueOnce({ status: 200, data: { ok: true, data: session } })
    .mockResolvedValueOnce({ status: 200, data: { ok: true, data: [] } });
  render(<MobileAccountPanel api={createMobileAccountApi('https://example.test')} />);
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'ورود یا مشاهدهٔ حساب' }));
  fireEvent.change(await screen.findByLabelText('شمارهٔ همراه'), { target: { value: '+۹۸ ۹۱۲ ۱۲۳ ۴۵۶۷' } });
  fireEvent.click(screen.getByRole('button', { name: 'دریافت کد پیامکی' }));
  fireEvent.change(await screen.findByLabelText('کد چهاررقمی'), { target: { value: '۰۰۴۲' } });
  fireEvent.click(screen.getByRole('button', { name: 'تأیید و ورود' }));
  await screen.findByText('وارد حساب شدید.');
  expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({
    url: 'https://example.test/api/v1/auth/mobile/request', method: 'POST', data: { phone: '09121234567' },
  }));
  expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({
    url: 'https://example.test/api/v1/auth/mobile/verify', disableRedirects: true,
    data: { phone: '09121234567', challengeId: id, code: '0042' },
  }));
  expect(request).toHaveBeenNthCalledWith(4, expect.objectContaining({ url: 'https://example.test/api/v1/session' }));
  fireEvent.click(screen.getByRole('button', { name: 'خروج از حساب' }));
  await screen.findByText('از حساب خارج شدید.');
});

it('keeps local operation available when no HTTPS API origin is configured', () => {
  render(<MobileAccountPanel api={createMobileAccountApi('http://example.test')} />);
  expect(screen.getByText('ورود پیامکی در این نسخه فعال نیست.')).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});
