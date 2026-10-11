import { downloadFile, shareMessage, openLink } from '@tma.js/sdk';

export function canUseTelegramDownload(): boolean {
  return downloadFile.isAvailable();
}

export function canUseTelegramShare(): boolean {
  return shareMessage.isAvailable();
}

export async function requestTelegramDownload(url: string, fileName: string): Promise<void> {
  await downloadFile(url, fileName);
}

export async function requestTelegramShare(preparedMessageId: string): Promise<void> {
  await shareMessage(preparedMessageId);
}

export function isDeliveryCancellation(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return /USER_DECLINED|denied the action|access denied|cancel/i.test(text);
}

export function openExportLink(url: string): boolean {
  if (!openLink.isAvailable()) return false;
  openLink(url);
  return true;
}
