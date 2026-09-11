<?php
declare(strict_types=1);

namespace Tinv\Sales;

use PDO;

final readonly class DocumentHistoryService
{
    public function __construct(private PDO $pdo, private SalesDocumentService $documents) {}

    /** @return array{documents:array<int,array<string,mixed>>,nextCursor:?string} */
    public function list(string $businessId, array $filters): array
    {
        $allowed = ['query', 'documentType', 'lifecycleStatus', 'settlementStatus', 'customerId', 'archived', 'cursor', 'limit'];
        foreach (array_keys($filters) as $key) if (!in_array($key, $allowed, true)) throw new SalesValidationException('history_filter_invalid');
        $query = trim((string) ($filters['query'] ?? ''));
        if (mb_strlen($query) > 120) throw new SalesValidationException('history_query_invalid');
        $type = (string) ($filters['documentType'] ?? '');
        $life = (string) ($filters['lifecycleStatus'] ?? '');
        $settlement = (string) ($filters['settlementStatus'] ?? '');
        if ($type !== '' && !in_array($type, ['proforma', 'invoice'], true)) throw new SalesValidationException('history_type_invalid');
        if ($life !== '' && !in_array($life, ['draft', 'issued', 'cancelled'], true)) throw new SalesValidationException('history_lifecycle_invalid');
        if ($settlement !== '' && !in_array($settlement, ['unpaid', 'partial', 'paid'], true)) throw new SalesValidationException('history_settlement_invalid');
        $limit = max(1, min(50, (int) ($filters['limit'] ?? 20)));
        $where = ['d.business_id = ?'];
        $args = [$businessId];
        $where[] = ($filters['archived'] ?? false) === true ? 'd.archived_at IS NOT NULL' : 'd.archived_at IS NULL';
        foreach ([['d.document_type', $type], ['d.lifecycle_status', $life], ['d.settlement_status', $settlement], ['d.customer_id', (string) ($filters['customerId'] ?? '')]] as [$column, $value]) {
            if ($value !== '') { $where[] = $column . ' = ?'; $args[] = $value; }
        }
        if ($query !== '') {
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $query) . '%';
            $where[] = "(d.document_number LIKE ? ESCAPE '\\\\' OR c.display_name LIKE ? ESCAPE '\\\\' OR c.phone LIKE ? ESCAPE '\\\\' OR EXISTS (SELECT 1 FROM sales_document_items i WHERE i.document_id = d.id AND (i.title LIKE ? ESCAPE '\\\\' OR i.description LIKE ? ESCAPE '\\\\')))";
            array_push($args, $like, $like, $like, $like, $like);
        }
        $cursor = (string) ($filters['cursor'] ?? '');
        if ($cursor !== '') {
            $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
            if ($decoded === false || !str_contains($decoded, '|')) throw new SalesValidationException('history_cursor_invalid');
            [$createdAt, $id] = explode('|', $decoded, 2);
            if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $createdAt) || !preg_match('/^[0-9a-f-]{36}$/', $id)) throw new SalesValidationException('history_cursor_invalid');
            $where[] = '(d.created_at < ? OR (d.created_at = ? AND d.id < ?))';
            array_push($args, $createdAt, $createdAt, $id);
        }
        $sql = 'SELECT d.id,d.created_at FROM sales_documents d INNER JOIN customers c ON c.id=d.customer_id AND c.business_id=d.business_id WHERE ' . implode(' AND ', $where) . ' ORDER BY d.created_at DESC,d.id DESC LIMIT ' . ($limit + 1);
        $statement = $this->pdo->prepare($sql);
        $statement->execute($args);
        $rows = $statement->fetchAll();
        $hasMore = count($rows) > $limit;
        if ($hasMore) array_pop($rows);
        $documents = array_map(fn(array $row): array => $this->documents->get($businessId, (string) $row['id'], false), $rows);
        $nextCursor = null;
        if ($hasMore && $rows !== []) {
            $last = $rows[count($rows) - 1];
            $nextCursor = rtrim(strtr(base64_encode($last['created_at'] . '|' . $last['id']), '+/', '-_'), '=');
        }
        return ['documents' => $documents, 'nextCursor' => $nextCursor];
    }

    public function setArchived(string $businessId, string $documentId, bool $archived): array
    {
        $this->documents->get($businessId, $documentId, false);
        $now = gmdate('Y-m-d H:i:s');
        $statement = $this->pdo->prepare('UPDATE sales_documents SET archived_at=?,updated_at=? WHERE id=? AND business_id=?');
        $statement->execute([$archived ? $now : null, $now, $documentId, $businessId]);
        return $this->documents->get($businessId, $documentId, false);
    }

    public function duplicate(string $businessId, string $documentId): array
    {
        $source = $this->documents->get($businessId, $documentId);
        $overrideKeys = ['document', 'presentation', 'items', 'financial', 'text', 'visual'];
        $overrides = array_intersect_key($source['settingsSnapshot'] ?? [], array_flip($overrideKeys));
        $items = array_map(static fn(array $item): array => [
            'title' => $item['title'], 'description' => $item['description'],
            'quantityMilli' => (string) $item['quantityMilli'], 'unitPriceBaseUnit' => (string) $item['unitPriceBaseUnit'],
            'discountBaseUnit' => (string) ($item['discountBaseUnit'] ?? '0'),
        ], $source['items']);
        $copy = $this->documents->createDraft($businessId, [
            'documentType' => $source['documentType'],
            'customer' => ['id' => $source['customerId'], 'displayName' => $source['customerName'], 'phone' => $source['customerPhone'] ?? '', 'nationalId' => $source['nationalId'] ?? ''],
            'isOfficial' => $source['isOfficial'] ?? false, 'address' => $source['customerAddress'] ?? '',
            'shippingMethod' => $source['shippingMethod'] ?? '', 'validityDays' => $source['validityDays'] ?? null,
            'notes' => $source['notes'] ?? '', 'items' => $items, 'settingsOverrides' => $overrides,
        ]);
        $sourceSettings = $source['settingsSnapshot'] ?? null;
        $statement = $this->pdo->prepare('UPDATE sales_documents SET duplicated_from_document_id=?,draft_settings_json=? WHERE id=? AND business_id=?');
        $statement->execute([$documentId, $sourceSettings === null ? null : json_encode($sourceSettings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), $copy['id'], $businessId]);
        return $this->documents->get($businessId, $copy['id']);
    }
}
