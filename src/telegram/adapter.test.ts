import { describe, expect, it, vi } from 'vitest';
import { applyRuntimeCssVariables, TelegramAdapter } from './adapter';
import type { TelegramWebApp } from './types';

function mockApp(): TelegramWebApp {
  const back = {
    show: vi.fn(function () { return back; }),
    hide: vi.fn(function () { return back; }),
    onClick: vi.fn(function () { return back; }),
    offClick: vi.fn(function () { return back; })
  };

  return {
    initData: 'signed-data',
    version: '9.6',
    platform: 'android',
    colorScheme: 'dark',
    viewportHeight: 700,
    viewportStableHeight: 680,
    safeAreaInset: { top: 10, bottom: 20, left: 0, right: 0 },
    contentSafeAreaInset: { top: 42, bottom: 20, left: 0, right: 0 },
    BackButton: back,
    HapticFeedback: {
      impactOccurred: vi.fn(),
      notificationOccurred: vi.fn(),
      selectionChanged: vi.fn()
    },
    ready: vi.fn(),
    expand: vi.fn(),
    isVersionAtLeast: vi.fn(() => true),
    onEvent: vi.fn(),
    offEvent: vi.fn(),
    openLink: vi.fn(),
    openTelegramLink: vi.fn()
  };
}

describe('TelegramAdapter', () => {
  it('exposes a safe fallback outside Telegram', () => {
    const adapter = new TelegramAdapter(undefined);
    expect(adapter.isAvailable()).toBe(false);
    expect(adapter.getInitData()).toBe('');
    expect(adapter.snapshot().platform).toBe('browser');
  });

  it('reads only raw initData for authentication bootstrap', () => {
    const app = mockApp();
    const adapter = new TelegramAdapter(app);
    expect(adapter.getInitData()).toBe('signed-data');
    expect(adapter.snapshot().colorScheme).toBe('dark');
    expect(adapter.snapshot()).toMatchObject({
      platform: 'android', version: '9.6', viewportHeight: 700, viewportStableHeight: 680,
      safeArea: { top: 10, bottom: 20, left: 0, right: 0 },
      contentSafeArea: { top: 42, bottom: 20, left: 0, right: 0 }
    });
  });

  it('subscribes to and removes theme, viewport and safe-area events', () => {
    const app = mockApp();
    const adapter = new TelegramAdapter(app);
    const handler = vi.fn();
    const unsubscribe = adapter.onRuntimeChange(handler);
    expect(app.onEvent).toHaveBeenCalledTimes(4);
    unsubscribe();
    expect(app.offEvent).toHaveBeenCalledTimes(4);
  });

  it('cleans up Telegram back-button handlers', () => {
    const app = mockApp();
    const adapter = new TelegramAdapter(app);
    const first = vi.fn();
    const second = vi.fn();

    adapter.setBackHandler(first);
    adapter.setBackHandler(second);
    adapter.setBackHandler(null);

    expect(app.BackButton?.onClick).toHaveBeenCalledTimes(2);
    expect(app.BackButton?.offClick).toHaveBeenCalledTimes(2);
    expect(app.BackButton?.hide).toHaveBeenCalledTimes(1);
  });

  it('projects viewport, safe-area and theme state into CSS variables', () => {
    const values = new Map<string, string>();
    const target = { setProperty: (key: string, value: string) => values.set(key, value), colorScheme: '' } as unknown as CSSStyleDeclaration;
    applyRuntimeCssVariables(new TelegramAdapter(mockApp()).snapshot(), target);
    expect(values.get('--tg-viewport-stable-height')).toBe('680px');
    expect(values.get('--tg-content-safe-area-inset-top')).toBe('42px');
    expect(target.colorScheme).toBe('dark');
  });
});
