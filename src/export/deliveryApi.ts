export type ExportDeliveryPurpose = 'download' | 'share';
export type ExportDeliveryFormat = 'pdf' | 'png';

export interface ExportDelivery {
  url: string;
  fileName: string;
  byteSize: number;
  expiresAt: number;
  preparedMessageId: string | null;
}

export async function stageExportFile(input: {
  documentId: string;
  purpose: ExportDeliveryPurpose;
  format: ExportDeliveryFormat;
  blob: Blob;
  fileName: string;
  title: string;
}): Promise<ExportDelivery> {
  const form = new FormData();
  form.append('documentId', input.documentId);
  form.append('purpose', input.purpose);
  form.append('format', input.format);
  form.append('title', input.title);
  form.append('file', input.blob, input.fileName);
  const response = await fetch('/export-bridge.php', {
    method: 'POST',
    headers: { 'X-Tinv-Request': 'miniapp' },
    credentials: 'include',
    body: form,
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`export_delivery_non_json_${response.status}`);
  }
  const body = await response.json() as {
    ok: boolean;
    data?: ExportDelivery;
    error?: { code?: string };
  };
  if (!response.ok || !body.ok || !body.data) {
    throw new Error(body.error?.code ?? `export_delivery_failed_${response.status}`);
  }
  return body.data;
}
