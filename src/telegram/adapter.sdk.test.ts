import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const available = Object.assign(vi.fn(), { ifAvailable: vi.fn(), isAvailable: vi.fn(() => true) });
  return {
    init: vi.fn(), retrieveLaunchParams: vi.fn(), retrieveRawInitData: vi.fn(), on: vi.fn(), off: vi.fn(),
    miniApp: { mount: vi.fn(), ready: available, isDark: vi.fn(() => true) },
    themeParams: { mount: vi.fn(), bindCssVars: vi.fn(), isDark: vi.fn(() => true) },
    viewport: {
      mount: Object.assign(vi.fn(() => Promise.resolve()), { isAvailable: vi.fn(() => true) }),
      expand: available, isMounted: vi.fn(() => false), height: vi.fn(() => 700), stableHeight: vi.fn(() => 680),
      safeAreaInsets: vi.fn(), contentSafeAreaInsets: vi.fn()
    },
    backButton: { mount: available, onClick: available, offClick: available, show: available, hide: available },
    hapticFeedback: { selectionChanged: available, impactOccurred: available, notificationOccurred: available },
    openLink: available, openTelegramLink: available
  };
});

vi.mock('@tma.js/sdk', () => sdk);

describe('bundled Telegram SDK bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { innerHeight: 720, location: { assign: vi.fn() } });
  });

  it('boots Telegram from local SDK launch data without window.Telegram or telegram.org', async () => {
    sdk.retrieveLaunchParams.mockReturnValue({
      tgWebAppPlatform: 'tdesktop', tgWebAppVersion: '9.6', tgWebAppThemeParams: {}
    });
    sdk.retrieveRawInitData.mockReturnValue('query_id=signed-runtime-data');
    const { TelegramAdapter } = await import('./adapter');
    const adapter = new TelegramAdapter();
    expect(adapter.isAvailable()).toBe(true);
    expect(adapter.getInitData()).toBe('query_id=signed-runtime-data');
    expect(adapter.snapshot()).toMatchObject({ platform: 'tdesktop', version: '9.6', colorScheme: 'dark' });
    expect(sdk.init).toHaveBeenCalledOnce();
    expect(sdk.themeParams.bindCssVars).toHaveBeenCalledOnce();
  });

  it('does not invent Telegram authentication in a direct browser', async () => {
    sdk.retrieveLaunchParams.mockImplementation(() => { throw new Error('no launch parameters'); });
    sdk.retrieveRawInitData.mockReturnValue(undefined);
    const { TelegramAdapter } = await import('./adapter');
    const adapter = new TelegramAdapter();
    expect(adapter.isAvailable()).toBe(false);
    expect(adapter.getInitData()).toBe('');
    expect(adapter.snapshot()).toMatchObject({ platform: 'browser', version: '0.0' });
  });
});
