import type { HistorySource } from '../sales/DocumentsPage';
import { normalizePhone } from '../format/phone';
import type { OfflineStore } from './offlineStore';

export function offlineHistorySource(store: OfflineStore, onChange: () => Promise<void>): HistorySource {
  return {
    async listSalesDocuments(query = {}) {
      const documents = await store.listDocuments();
      const needle = query.query?.trim().toLocaleLowerCase('fa-IR');
      const filtered = documents.filter(doc => {
        if (Boolean(doc.archivedAt) !== Boolean(query.archived)) return false;
        if (query.documentType && query.documentType !== doc.documentType) return false;
        if (query.lifecycleStatus && query.lifecycleStatus !== doc.lifecycleStatus) return false;
        if (query.settlementStatus && query.settlementStatus !== doc.settlementStatus) return false;
        if (!needle) return true;
        return [doc.customerName, doc.customerPhone ?? '', doc.documentNumber, ...doc.items.map(item => item.title)]
          .some(text => text.toLocaleLowerCase('fa-IR').includes(needle))
          || Boolean(doc.customerPhone?.includes(normalizePhone(needle)));
      });
      const offset = Number(query.cursor) || 0;
      const end = offset + (query.limit ?? 20);
      return { documents: filtered.slice(offset, end), nextCursor: end < filtered.length ? String(end) : null };
    },
    async setSalesDocumentArchived(id, archived) {
      const updated = await store.setArchived(id, archived);
      await onChange();
      return updated;
    },
  };
}
