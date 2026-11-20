import { registerPlugin } from '@capacitor/core';

interface PdfFile {
  name: string;
  base64: string;
}

export const offlineNativeFiles = registerPlugin<{
  savePdf(file: PdfFile): Promise<{ saved: boolean }>;
  sharePdf(file: PdfFile): Promise<void>;
  saveBackup(input: { json: string }): Promise<{ saved: boolean }>;
}>('OfflinePdf');
