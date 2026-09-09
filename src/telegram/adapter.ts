import {
  backButton, hapticFeedback, init, miniApp, off, on, openLink, openTelegramLink,
  retrieveLaunchParams, retrieveRawInitData, themeParams, viewport
} from '@tma.js/sdk';
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

export function applyRuntimeCssVariables(runtime: TelegramRuntimeSnapshot, target: CSSStyleDeclaration = document.documentElement.style): void {
  target.setProperty('--tg-viewport-height', `${runtime.viewportHeight}px`);
  target.setProperty('--tg-viewport-stable-height', `${runtime.viewportStableHeight}px`);
  for (const [edge, value] of Object.entries(runtime.safeArea)) target.setProperty(`--tg-safe-area-inset-${edge}`, `${value}px`);
  for (const [edge, value] of Object.entries(runtime.contentSafeArea)) target.setProperty(`--tg-content-safe-area-inset-${edge}`, `${value}px`);
  target.colorScheme = runtime.colorScheme;
}

const zeroInsets: TelegramInsets = { top: 0, bottom: 0, left: 0, right: 0 };
let sdkStarted = false;
let viewportMount: Promise<void> | undefined;

function startLocalSdk(): boolean {
  try {
    const launch = retrieveLaunchParams();
    if (!launch.tgWebAppPlatform || !launch.tgWebAppVersion || !retrieveRawInitData()) return false;
    if (sdkStarted) return true;
    init();
    themeParams.mount();
    miniApp.mount();
    backButton.mount.ifAvailable();
    viewportMount = viewport.mount.isAvailable() ? viewport.mount() : undefined;
    sdkStarted = true;
    return true;
  } catch {
    return false;
  }
}

function versionAtLeast(actual: string, required: string): boolean {
  const current = actual.split('.').map(Number);
  const target = required.split('.').map(Number);
  const length = Math.max(current.length, target.length);
  for (let index = 0; index < length; index += 1) {
    const left = Number.isFinite(current[index]) ? current[index] : 0;
    const right = Number.isFinite(target[index]) ? target[index] : 0;
    if (left !== right) return left > right;
  }
  return true;
}

export class TelegramAdapter {
  private readonly injected: TelegramWebApp | undefined;
  private readonly localSdk: boolean;
  private backHandler: (() => void) | null = null;

  constructor(app?: TelegramWebApp) {
    this.injected = app;
    this.localSdk = !app && typeof window !== 'undefined' ? startLocalSdk() : false;
  }

  isAvailable(): boolean { return Boolean(this.injected) || this.localSdk; }

  getInitData(): string {
    if (this.injected) return this.injected.initData;
    if (!this.localSdk) return '';
    try { return retrieveRawInitData() ?? ''; } catch { return ''; }
  }

  ready(): void {
    if (this.injected) this.injected.ready();
    else if (this.localSdk) miniApp.ready.ifAvailable();
  }

  expand(): void {
    if (this.injected) this.injected.expand();
    else if (this.localSdk) void viewportMount?.then(() => viewport.expand.ifAvailable());
  }

  supports(version: string): boolean { return versionAtLeast(this.snapshot().version, version); }

  snapshot(): TelegramRuntimeSnapshot {
    if (this.injected) return {
      available: true,
      platform: this.injected.platform,
      version: this.injected.version,
      colorScheme: this.injected.colorScheme,
      viewportHeight: this.injected.viewportHeight,
      viewportStableHeight: this.injected.viewportStableHeight,
      safeArea: this.injected.safeAreaInset ?? zeroInsets,
      contentSafeArea: this.injected.contentSafeAreaInset ?? zeroInsets
    };

    if (this.localSdk) {
      const launch = retrieveLaunchParams();
      return {
        available: true,
        platform: launch.tgWebAppPlatform,
        version: launch.tgWebAppVersion,
        colorScheme: themeParams.isDark() ? 'dark' : 'light',
        viewportHeight: viewport.isMounted() ? viewport.height() : window.innerHeight,
        viewportStableHeight: viewport.isMounted() ? viewport.stableHeight() : window.innerHeight,
        safeArea: viewport.isMounted() ? viewport.safeAreaInsets() : zeroInsets,
        contentSafeArea: viewport.isMounted() ? viewport.contentSafeAreaInsets() : zeroInsets
      };
    }

    const height = typeof window !== 'undefined' ? window.innerHeight : 0;
    return { available: false, platform: 'browser', version: '0.0', colorScheme: 'light',
      viewportHeight: height, viewportStableHeight: height, safeArea: zeroInsets, contentSafeArea: zeroInsets };
  }

  onRuntimeChange(handler: () => void): () => void {
    if (this.injected) {
      const events = ['themeChanged', 'viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged'];
      events.forEach((event) => this.injected?.onEvent(event, handler));
      return () => events.forEach((event) => this.injected?.offEvent(event, handler));
    }
    if (!this.localSdk) return () => undefined;
    const events = ['theme_changed', 'viewport_changed', 'safe_area_changed', 'content_safe_area_changed'] as const;
    events.forEach((event) => on(event, handler));
    return () => events.forEach((event) => off(event, handler));
  }

  setBackHandler(handler: (() => void) | null): void {
    if (this.injected) {
      const button = this.injected.BackButton;
      if (!button) return;
      if (this.backHandler) button.offClick(this.backHandler);
      this.backHandler = handler;
      if (handler) button.onClick(handler).show(); else button.hide();
      return;
    }
    if (!this.localSdk) return;
    if (this.backHandler) backButton.offClick.ifAvailable(this.backHandler);
    this.backHandler = handler;
    if (handler) { backButton.onClick.ifAvailable(handler); backButton.show.ifAvailable(); }
    else backButton.hide.ifAvailable();
  }

  haptic(kind: 'selection' | 'success' | 'warning' | 'error' | 'light'): void {
    if (this.injected?.HapticFeedback) {
      if (kind === 'selection') this.injected.HapticFeedback.selectionChanged();
      else if (kind === 'light') this.injected.HapticFeedback.impactOccurred('light');
      else this.injected.HapticFeedback.notificationOccurred(kind);
      return;
    }
    if (!this.localSdk) return;
    if (kind === 'selection') hapticFeedback.selectionChanged.ifAvailable();
    else if (kind === 'light') hapticFeedback.impactOccurred.ifAvailable('light');
    else hapticFeedback.notificationOccurred.ifAvailable(kind);
  }

  openExternal(url: string): void {
    if (this.injected) {
      if (url.startsWith('https://t.me/') && this.injected.openTelegramLink) this.injected.openTelegramLink(url);
      else if (this.injected.openLink) this.injected.openLink(url);
      else window.location.assign(url);
      return;
    }
    if (this.localSdk) {
      if (url.startsWith('https://t.me/')) openTelegramLink.ifAvailable(url); else openLink.ifAvailable(url);
      return;
    }
    if (typeof window !== 'undefined') window.location.assign(url);
  }
}
