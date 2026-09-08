import type { TelegramColorScheme, TelegramInsets, TelegramWebApp } from './types';

export interface TelegramRuntimeSnapshot {
  available: boolean;
  platform: string;
  version: string;
  colorScheme: TelegramColorScheme;
  viewportHeight: number;
  viewportStableHeight: number;
  safeArea: TelegramInsets;
  contentSafeArea: TelegramInsets;
}

const zeroInsets: TelegramInsets = { top: 0, bottom: 0, left: 0, right: 0 };

export class TelegramAdapter {
  private readonly app: TelegramWebApp | undefined;
  private backHandler: (() => void) | null = null;

  constructor(app?: TelegramWebApp) {
    this.app = app ?? (typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined);
  }

  isAvailable(): boolean {
    return Boolean(this.app);
  }

  getInitData(): string {
    return this.app?.initData ?? '';
  }

  ready(): void {
    this.app?.ready();
  }

  expand(): void {
    this.app?.expand();
  }

  supports(version: string): boolean {
    return this.app?.isVersionAtLeast?.(version) ?? false;
  }

  snapshot(): TelegramRuntimeSnapshot {
    return {
      available: this.isAvailable(),
      platform: this.app?.platform ?? 'browser',
      version: this.app?.version ?? '0.0',
      colorScheme: this.app?.colorScheme ?? 'light',
      viewportHeight: this.app?.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 0),
      viewportStableHeight: this.app?.viewportStableHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 0),
      safeArea: this.app?.safeAreaInset ?? zeroInsets,
      contentSafeArea: this.app?.contentSafeAreaInset ?? zeroInsets
    };
  }

  onRuntimeChange(handler: () => void): () => void {
    if (!this.app) return () => undefined;

    const events = ['themeChanged', 'viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged'];
    events.forEach((event) => this.app?.onEvent(event, handler));
    return () => events.forEach((event) => this.app?.offEvent(event, handler));
  }

  setBackHandler(handler: (() => void) | null): void {
    const button = this.app?.BackButton;
    if (!button) return;

    if (this.backHandler) {
      button.offClick(this.backHandler);
      this.backHandler = null;
    }

    if (!handler) {
      button.hide();
      return;
    }

    this.backHandler = handler;
    button.onClick(handler).show();
  }

  haptic(kind: 'selection' | 'success' | 'warning' | 'error' | 'light'): void {
    const haptic = this.app?.HapticFeedback;
    if (!haptic) return;

    if (kind === 'selection') haptic.selectionChanged();
    else if (kind === 'light') haptic.impactOccurred('light');
    else haptic.notificationOccurred(kind);
  }

  openExternal(url: string): void {
    if (url.startsWith('https://t.me/') && this.app?.openTelegramLink) {
      this.app.openTelegramLink(url);
      return;
    }
    if (this.app?.openLink) {
      this.app.openLink(url);
      return;
    }
    if (typeof window !== 'undefined') window.location.assign(url);
  }
}
