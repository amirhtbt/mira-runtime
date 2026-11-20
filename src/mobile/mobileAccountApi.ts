import type { DocumentHistoryPage } from '../api/client';
import { CapacitorHttp } from '@capacitor/core';

function configuredOrigin(value: string | undefined): string | null {
  try {
    const url = new URL(value?.trim() ?? '');
    if (url.protocol === 'https:' && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash) {
      return url.origin;
    }
  } catch { /* A local-only build can omit the API origin. */ }
  return null;
}

export interface MobileSession {
  userId: string;
  businessId: string;
}

export function createMobileAccountApi(value: string | undefined) {
  const origin = configuredOrigin(value);
  async function request(route: string, data?: Record<string, unknown>): Promise<unknown> {
    if (!origin) throw new Error('mobile_sms_disabled');
    if (navigator.onLine === false) throw new Error('mobile_offline');
    let response;
    try {
      response = await CapacitorHttp.request({
        url: origin + route,
        method: data ? 'POST' : 'GET',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Origin: origin, 'X-Tinv-Request': 'miniapp' },
        ...(data ? { data } : {}),
        connectTimeout: 8000, readTimeout: 12000, disableRedirects: true,
      });
    } catch {
      throw new Error('mobile_network_error');
    }
    const body = response.data;
    if (response.status === 401 && route === '/api/v1/session') return null;
    if (response.status === 404) throw new Error('mobile_sms_disabled');
    if (response.status === 429) throw new Error('mobile_sms_rate_limited');
    if (response.status < 200 || response.status >= 300 || body?.ok !== true) {
      throw new Error(typeof body?.error?.code === 'string' ? body.error.code : 'mobile_network_error');
    }
    return body.data;
  }

  return {
    enabled: Boolean(origin),
    async session(): Promise<MobileSession | null> {
      const data = await request('/api/v1/session') as Partial<MobileSession> | null;
      if (data === null) return null;
      if (typeof data?.userId !== 'string' || typeof data.businessId !== 'string') throw new Error('mobile_network_error');
      return { userId: data.userId, businessId: data.businessId };
    },
    async requestCode(phone: string): Promise<string> {
      const data = await request('/api/v1/auth/mobile/request', { phone }) as { challengeId?: unknown } | null;
      if (typeof data?.challengeId !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.challengeId)) {
        throw new Error('mobile_network_error');
      }
      return data.challengeId;
    },
    async verifyCode(phone: string, challengeId: string, code: string, linkCode?: string): Promise<void> {
      await request('/api/v1/auth/mobile/verify', { phone, challengeId, code, ...(linkCode ? { linkCode } : {}) });
    },
    async documents(archived: boolean, cursor?: string): Promise<DocumentHistoryPage> {
      const query = new URLSearchParams({ limit: '20' });
      if (archived) query.set('archived', '1');
      if (cursor) query.set('cursor', cursor);
      const page = await request('/api/v1/documents?' + query) as DocumentHistoryPage | null;
      if (!page || !Array.isArray(page.documents) || (page.nextCursor !== null && typeof page.nextCursor !== 'string')) {
        throw new Error('mobile_network_error');
      }
      return page;
    },
    async pushDocument(businessId: string, document: Record<string, unknown>): Promise<void> {
      const receipt = await request('/api/v1/mobile/documents/sync', { businessId, document }) as { documentId?: unknown } | null;
      if (typeof receipt?.documentId !== 'string' || !receipt.documentId) throw new Error('mobile_network_error');
    },
    async logout(): Promise<void> {
      await request('/api/v1/auth/logout', {});
    },
  };
}

export const mobileAccountApi = createMobileAccountApi(import.meta.env.VITE_MOBILE_API_ORIGIN);
