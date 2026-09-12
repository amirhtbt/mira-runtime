import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const download = vi.fn(async () => undefined);
  const share = vi.fn(async () => undefined);
  return {
    download,
    share,
    downloadAvailable: vi.fn(() => false),
    shareAvailable: vi.fn(() => false),
  };
});

vi.mock('@tma.js/sdk', () => ({
  downloadFile: Object.assign(sdk.download, { isAvailable: sdk.downloadAvailable }),
  shareMessage: Object.assign(sdk.share, { isAvailable: sdk.shareAvailable }),
}));

import { canUseTelegramDownload, canUseTelegramShare, isDeliveryCancellation, requestTelegramDownload, requestTelegramShare } from './telegramNativeDelivery';

describe('Telegram native export delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.downloadAvailable.mockReturnValue(false);
    sdk.shareAvailable.mockReturnValue(false);
  });

  it('uses capability checks instead of assuming WebView support', () => {
    expect(canUseTelegramDownload()).toBe(false);
    expect(canUseTelegramShare()).toBe(false);
    sdk.downloadAvailable.mockReturnValue(true);
    sdk.shareAvailable.mockReturnValue(true);
    expect(canUseTelegramDownload()).toBe(true);
    expect(canUseTelegramShare()).toBe(true);
  });

  it('passes HTTPS delivery data to Telegram native download and prepared sharing', async () => {
    await requestTelegramDownload('https://example.test/export-file/token/invoice.pdf', 'invoice.pdf');
    await requestTelegramShare('prepared-message-id');
    expect(sdk.download).toHaveBeenCalledWith('https://example.test/export-file/token/invoice.pdf', 'invoice.pdf');
    expect(sdk.share).toHaveBeenCalledWith('prepared-message-id');
  });

  it('recognizes native user cancellation without treating it as document loss', () => {
    expect(isDeliveryCancellation(new DOMException('cancelled', 'AbortError'))).toBe(true);
    expect(isDeliveryCancellation(new Error('USER_DECLINED'))).toBe(true);
    expect(isDeliveryCancellation(new Error('User denied the action'))).toBe(true);
    expect(isDeliveryCancellation(new Error('network failed'))).toBe(false);
  });
});
