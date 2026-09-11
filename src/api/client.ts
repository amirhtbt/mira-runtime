import type { SettingsPatch, SettingsResponse } from '../settings/types';

export interface SessionUser {
  userId: string;
  businessId: string;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: ApiEnvelope<T> }> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Tinv-Request', 'miniapp');
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'include'
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`api_non_json_${response.status}`);
  }
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

function requireData<T>(response: { status: number; body: ApiEnvelope<T> }, fallback: string): T {
  if (!response.body.ok || !response.body.data) {
    throw new Error(response.body.error?.code ?? fallback);
  }
  return response.body.data;
}

export async function getSession(): Promise<SessionUser | null> {
  const response = await request<SessionUser>('/api/v1/session');
  if (response.status === 401) return null;
  return requireData(response, 'session_failed');
}

export async function authenticateWithTelegram(initData: string): Promise<SessionUser> {
  const response = await request<SessionUser>('/api/v1/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData })
  });
  return requireData(response, 'telegram_auth_failed');
}

export async function renewSession(): Promise<SessionUser> {
  return requireData(await request<SessionUser>('/api/v1/auth/renew', { method: 'POST' }), 'session_renew_failed');
}

export async function getBusinessSettings(): Promise<SettingsResponse> {
  return requireData(await request<SettingsResponse>('/api/v1/settings'), 'settings_load_failed');
}

export async function updateBusinessSettings(patch: SettingsPatch): Promise<SettingsResponse> {
  return requireData(await request<SettingsResponse>('/api/v1/settings', {
    method: 'PUT',
    body: JSON.stringify(patch)
  }), 'settings_save_failed');
}

export async function uploadBusinessLogo(file: File): Promise<SettingsResponse['logo']> {
  const form = new FormData();
  form.append('logo', file, file.name);
  const response = await request<{ logo: SettingsResponse['logo'] }>('/api/v1/settings/logo', {
    method: 'POST',
    body: form
  });
  return requireData(response, 'logo_upload_failed').logo;
}

export async function deleteBusinessLogo(): Promise<SettingsResponse['logo']> {
  const response = await request<{ logo: SettingsResponse['logo'] }>('/api/v1/settings/logo', { method: 'DELETE' });
  return requireData(response, 'logo_delete_failed').logo;
}

export function businessLogoUrl(updatedAt: string | null): string {
  return `/api/v1/settings/logo${updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : ''}`;
}

export type DocumentType = 'proforma' | 'invoice';
export interface SalesDocument {
  id: string; customerId: string; customerName: string; customerPhone?:string; documentType: DocumentType; lifecycleStatus: 'draft'|'issued'|'cancelled';
  settlementStatus: 'unpaid'|'partial'|'paid'; documentNumber: string|null; sourceDocumentId: string|null;
  currencyUnit: 'toman'|'rial'; subtotalBaseUnit: string; discountBaseUnit: string; surchargeBaseUnit: string;
  grandTotalBaseUnit: string; paidAmountBaseUnit: string; remainingAmountBaseUnit: string; version: number;
  isOfficial?:boolean;nationalId?:string;customerAddress?:string;shippingMethod?:string;validityDays?:number|null;notes?:string;issueDate?:string|null;validUntil?:string|null;taxRateBasisPoints?:number;taxTotalBaseUnit?:string;
  items: Array<{title:string;description:string;quantityMilli:string|number;unitPriceBaseUnit:string|number;discountBaseUnit?:string|number;taxBaseUnit?:string|number;lineTotalBaseUnit:string|number;position:number}>;
  payments?: Array<{id:string;amount_base_unit:string;paid_at:string;method:string;reference_text:string;note:string;status:string}>;
  canIssueFinalInvoice: boolean;
}
export interface CustomerProfile {id:string;displayName:string;phone:string;normalizedMobile:string;address:string;isOfficial:boolean;nationalId:string}
export interface DraftInput { documentType:DocumentType; customer:{id?:string;displayName:string;phone:string;nationalId?:string};isOfficial:boolean;address?:string;shippingMethod?:string;validityDays?:number|null;notes?:string; items:Array<{title:string;description?:string;quantityMilli:string;unitPriceBaseUnit:string;discountBaseUnit?:string}> }

export async function createSalesDraft(input:DraftInput):Promise<SalesDocument>{ return requireData(await request<SalesDocument>('/api/v1/documents',{method:'POST',body:JSON.stringify(input)}),'document_create_failed'); }
export async function getSalesDocument(id:string):Promise<SalesDocument>{ return requireData(await request<SalesDocument>(`/api/v1/documents/${encodeURIComponent(id)}`),'document_load_failed'); }
export async function updateSalesDraft(id:string,input:{version:number;items:DraftInput['items']}):Promise<SalesDocument>{ return requireData(await request<SalesDocument>(`/api/v1/documents/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(input)}),'document_update_failed'); }
export async function finalizeSalesDocument(id:string,paidConfirmed=false):Promise<SalesDocument>{ return requireData(await request<SalesDocument>(`/api/v1/documents/${encodeURIComponent(id)}/finalize`,{method:'POST',body:JSON.stringify({paidConfirmed})}),'document_finalize_failed'); }
export async function addProformaPayment(id:string,amountBaseUnit:string,idempotencyKey:string):Promise<SalesDocument>{ return requireData(await request<SalesDocument>(`/api/v1/documents/${encodeURIComponent(id)}/payments`,{method:'POST',body:JSON.stringify({amountBaseUnit,idempotencyKey})}),'payment_failed'); }
export async function issueFinalInvoice(id:string):Promise<SalesDocument>{ return requireData(await request<SalesDocument>(`/api/v1/documents/${encodeURIComponent(id)}/final-invoice`,{method:'POST',body:'{}'}),'conversion_failed'); }
export async function listSalesDocuments():Promise<SalesDocument[]>{ return requireData(await request<{documents:SalesDocument[]}>('/api/v1/documents'),'documents_load_failed').documents; }
export async function findCustomers(phone:string):Promise<CustomerProfile[]>{return requireData(await request<{customers:CustomerProfile[]}>(`/api/v1/customers?phone=${encodeURIComponent(phone)}`),'customer_search_failed').customers;}
export async function saveCustomer(input:Omit<CustomerProfile,'id'|'normalizedMobile'>):Promise<CustomerProfile>{return requireData(await request<CustomerProfile>('/api/v1/customers',{method:'POST',body:JSON.stringify(input)}),'customer_save_failed');}
export async function updateCustomer(id:string,input:Omit<CustomerProfile,'id'|'normalizedMobile'>):Promise<CustomerProfile>{return requireData(await request<CustomerProfile>(`/api/v1/customers/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(input)}),'customer_update_failed');}
