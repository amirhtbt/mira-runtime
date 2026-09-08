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
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'include'
  });

  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

export async function getSession(): Promise<SessionUser | null> {
  const response = await request<SessionUser>('/api/v1/session');
  if (response.status === 401) return null;
  if (!response.body.ok || !response.body.data) throw new Error(response.body.error?.message ?? 'session_failed');
  return response.body.data;
}

export async function authenticateWithTelegram(initData: string): Promise<SessionUser> {
  const response = await request<SessionUser>('/api/v1/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData })
  });

  if (!response.body.ok || !response.body.data) {
    throw new Error(response.body.error?.code ?? 'telegram_auth_failed');
  }
  return response.body.data;
}

export async function renewSession(): Promise<SessionUser> {
  const response = await request<SessionUser>('/api/v1/auth/renew', { method: 'POST' });
  if (!response.body.ok || !response.body.data) throw new Error(response.body.error?.code ?? 'session_renew_failed');
  return response.body.data;
}
