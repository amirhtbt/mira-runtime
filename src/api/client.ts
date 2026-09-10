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
