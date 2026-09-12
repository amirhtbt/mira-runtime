import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  authenticate: vi.fn(),
  settings: vi.fn(),
  pilot: vi.fn(),
}));

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>();
  return {
    ...actual,
    authenticateWithTelegram: api.authenticate,
    getBusinessSettings: api.settings,
    getPilotStatus: api.pilot,
  };
});

vi.mock('./motion', () => ({ shouldReduceMotion: () => false }));

vi.mock('./telegram/adapter', () => {
  class FakeTelegramAdapter {
    snapshot() { return { platform: 'tdesktop', version: '8.0', colorScheme: 'light', viewportHeight: 700, viewportStableHeight: 700, safeArea: { top: 0, bottom: 0, left: 0, right: 0 }, contentSafeArea: { top: 0, bottom: 0, left: 0, right: 0 } }; }
    ready() {}
    expand() {}
    onRuntimeChange() { return () => undefined; }
    getInitData() { return 'signed-init-data'; }
    haptic() {}
    setBackHandler() {}
  }
  return { TelegramAdapter: FakeTelegramAdapter, applyRuntimeCssVariables: () => undefined };
});

import App from './App';

describe('fresh Telegram client bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.authenticate.mockResolvedValue({ userId: 'user-a', businessId: 'business-a' });
    api.settings.mockResolvedValue({
      settings: { seller: { businessName: 'دانشگاه تهران', displayName: '' } },
      logo: { present: false, mimeType: null, byteSize: 0, updatedAt: null },
      officialLogo: { present: false, mimeType: null, byteSize: 0, updatedAt: null },
    });
    api.pilot.mockResolvedValue({ feedback: { eligible: false, submitted: false, issuedDocuments: 0, activeDays: 1 } });
  });

  it('hydrates Home from authoritative server settings without visiting Settings', async () => {
    render(<App />);
    expect(await screen.findByText('دانشگاه تهران')).toBeTruthy();
    expect(screen.getByText('اطلاعات پایه آماده است')).toBeTruthy();
    expect(screen.getByText('آماده')).toBeTruthy();
    expect(api.settings).toHaveBeenCalledTimes(1);
  });
});
