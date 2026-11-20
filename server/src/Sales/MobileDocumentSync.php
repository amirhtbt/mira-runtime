<?php
declare(strict_types=1);

namespace Tinv\Sales;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Tinv\Settings\DocumentSettingsSnapshot;
use Tinv\Settings\SettingsSchema;
use Tinv\Support\Uuid;

final readonly class MobileDocumentSync
{
    public function __construct(private PDO $pdo) {}

    public function push(string $business, array $doc): string
    {
        $id = self::uuid($doc['id'] ?? null);
        $version = $doc['version'] ?? null;
        $type = $doc['documentType'] ?? null;
        if (!is_int($version) || $version < 1 || $version > 2147483647
            || !in_array($type, ['invoice', 'proforma'], true)
            || ($doc['currencyUnit'] ?? null) !== 'rial' || ($doc['lifecycleStatus'] ?? null) !== 'issued') {
            throw new SalesValidationException('mobile_document_invalid');
        }
        $number = self::text($doc['documentNumber'] ?? null, 64);
        if (!preg_match('/^.{0,12}-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}-[0-9]{1,16}$/Du', $number)) {
            throw new SalesValidationException('mobile_number_invalid');
        }
        $issued = self::date($doc['issuedAt'] ?? null);
        $archive = isset($doc['archivedAt']) ? self::date($doc['archivedAt'])->format('Y-m-d H:i:s') : null;
        $issueDate = $issued->setTimezone(new DateTimeZone('Asia/Tehran'))->format('Y-m-d');
        $at = $issued->format('Y-m-d H:i:s');
        $validity = $doc['validityDays'] ?? null;
        if ($validity !== null && ($type !== 'proforma' || !is_int($validity) || $validity < 0 || $validity > 365)) {
            throw new SalesValidationException('mobile_validity_invalid');
        }
        $settings = $doc['settingsSnapshot'] ?? null;
        $items = $doc['items'] ?? null;
        $official = $doc['isOfficial'] ?? null;
        $rate = $doc['taxRateBasisPoints'] ?? null;
        if (!is_array($settings) || !is_array($items) || !array_is_list($items) || count($items) > 500
            || !is_bool($official) || !is_int($rate) || (!$official && $rate !== 0)) {
            throw new SalesValidationException('mobile_snapshot_invalid');
        }
        $settings = DocumentSettingsSnapshot::toJson(SettingsSchema::merge(SettingsSchema::defaults(), $settings));
        foreach ($items as $item) {
            if (!is_array($item)) throw new SalesValidationException('item_invalid');
            self::text($item['title'] ?? null, 240);
            self::text($item['description'] ?? '', 1000);
        }
        $amounts = Money::calculate($items, 0, 0, $rate);
        foreach (['subtotal' => 'subtotal', 'discount' => 'discount', 'tax' => 'taxTotal', 'total' => 'grandTotal', 'surcharge' => 'surcharge'] as $key => $field) {
            if ((string)$amounts[$key] !== ($doc[$field . 'BaseUnit'] ?? null)) {
                throw new SalesValidationException('mobile_amount_mismatch');
            }
        }
        if ($amounts['total'] < 1) throw new SalesValidationException('document_total_required');
        $customer = [
            'displayName' => self::text($doc['customerName'] ?? null, 160, true),
            'phone' => CustomerDirectory::mobile(self::text($doc['customerPhone'] ?? null, 32, true)),
            'address' => self::text($doc['customerAddress'] ?? '', 500),
            'nationalId' => CustomerDirectory::nationalId(self::text($doc['nationalId'] ?? '', 20), $official),
            'isOfficial' => $official,
        ];
        $shipping = self::text($doc['shippingMethod'] ?? '', 32);
        $notes = self::text($doc['notes'] ?? '', 2000);
        $sourceId = isset($doc['sourceDocumentId']) ? self::uuid($doc['sourceDocumentId']) : null;
        if ($sourceId === $id || ($sourceId && $type !== 'invoice')) throw new SalesValidationException('mobile_source_invalid');
        $logo = self::logo($doc['logoBase64'] ?? null);
        if (($doc['logoPresent'] ?? false) !== ($logo !== null)) throw new SalesValidationException('mobile_logo_invalid');
        $paymentRows = $doc['payments'] ?? [];
        if (!is_array($paymentRows) || !array_is_list($paymentRows) || count($paymentRows) > 500
            || ($type === 'invoice' && $paymentRows !== [])) throw new SalesValidationException('mobile_payment_invalid');
        $payments = [];
        $paid = $type === 'invoice' ? $amounts['total'] : 0;
        foreach ($paymentRows as $payment) {
            if (!is_array($payment)) throw new SalesValidationException('mobile_payment_invalid');
            $key = self::uuid($payment['id'] ?? null);
            $amount = Money::amount($payment['amount_base_unit'] ?? null, 'payment_amount');
            if (isset($payments[$key]) || $amount < 1 || $amount > $amounts['total'] - $paid) {
                throw new SalesValidationException('mobile_payment_invalid');
            }
            $payments[$key] = ['amount' => $amount, 'at' => self::date($payment['paid_at'] ?? null)->format('Y-m-d H:i:s')];
            $paid += $amount;
        }
        if ((string)$paid !== ($doc['paidAmountBaseUnit'] ?? null)) throw new SalesValidationException('mobile_amount_mismatch');
        $immutable = hash('sha256', json_encode(
            [$type, $number, $at, $sourceId, $customer, $settings, $validity, $shipping, $notes, $rate, $amounts, $logo ? hash('sha256', $logo['bytes']) : null],
            JSON_THROW_ON_ERROR,
        ), true);
        $revision = hash('sha256', serialize([$archive, $payments]), true);

        $this->pdo->beginTransaction();
        try {
            // Serializes first imports even when the local ID has no mapping yet.
            $this->row('SELECT id FROM businesses WHERE id = ? FOR UPDATE', [$business]);
            $mapping = $this->row('SELECT * FROM mobile_document_sync WHERE business_id = ? AND local_id = ?', [$business, $id]);
            if ($mapping) {
                $serverId = $mapping['document_id'];
                $server = $this->row('SELECT version, lifecycle_status, archived_at FROM sales_documents WHERE id = ? AND business_id = ? FOR UPDATE', [$serverId, $business]);
                if (!hash_equals($mapping['immutable_hash'], $immutable) || !$server || $server['lifecycle_status'] !== 'issued'
                    || (int)$server['version'] !== (int)$mapping['server_version'] || $server['archived_at'] !== $mapping['server_archived_at']
                    || $version < (int)$mapping['local_version']) {
                    throw new SalesValidationException('mobile_sync_conflict', 409);
                }
                if ($version === (int)$mapping['local_version']) {
                    if (!hash_equals($mapping['revision_hash'], $revision)) throw new SalesValidationException('mobile_sync_conflict', 409);
                    $this->pdo->commit();
                    return $serverId;
                }
                $serverVersion = (int)$server['version'] + 1;
            } else {
                if ($this->row('SELECT id FROM sales_documents WHERE business_id = ? AND document_number = ?', [$business, $number])) {
                    throw new SalesValidationException('mobile_number_conflict', 409);
                }
                $serverId = Uuid::v4();
                $serverVersion = 1;
                $customerId = Uuid::v4();
                $source = null;
                if ($sourceId) {
                    $source = $this->row(
                        'SELECT d.* FROM mobile_document_sync m JOIN sales_documents d ON d.id = m.document_id
                         WHERE m.business_id = ? AND m.local_id = ? FOR UPDATE', [$business, $sourceId],
                    );
                    if (!$source || $source['document_type'] !== 'proforma' || $source['lifecycle_status'] !== 'issued'
                        || $source['settlement_status'] !== 'paid' || (int)$source['grand_total_base_unit'] !== $paid
                        || $this->row('SELECT id FROM sales_documents WHERE source_document_id = ?', [$source['id']])) {
                        throw new SalesValidationException('mobile_source_conflict', 409);
                    }
                    $customerId = $source['customer_id'];
                } else {
                    $this->insert('customers', [
                        'id' => $customerId, 'business_id' => $business, 'display_name' => $customer['displayName'],
                        'phone' => $customer['phone'], 'created_at' => $at, 'updated_at' => $at,
                    ]);
                }
                $this->insert('sales_documents', [
                    'id' => $serverId, 'business_id' => $business, 'customer_id' => $customerId,
                    'document_type' => $type, 'lifecycle_status' => 'issued', 'settlement_status' => 'unpaid',
                    'document_number' => $number, 'source_document_id' => $source['id'] ?? null,
                    'currency_unit' => 'rial', 'is_official' => $official ? 1 : 0, 'national_id' => $customer['nationalId'],
                    'customer_address' => $customer['address'], 'shipping_method' => $shipping, 'notes' => $notes,
                    'validity_days' => $validity, 'issue_date' => $issueDate,
                    'valid_until' => $validity === null ? null : JalaliDate::plusDays($issueDate, $validity)['date'],
                    'tax_rate_basis_points' => $rate, 'tax_total_base_unit' => $amounts['tax'],
                    'subtotal_base_unit' => $amounts['subtotal'], 'discount_base_unit' => $amounts['discount'],
                    'grand_total_base_unit' => $amounts['total'], 'settings_snapshot_json' => $settings,
                    'customer_snapshot_json' => json_encode($customer, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                    'created_at' => $at, 'issued_at' => $at, 'updated_at' => $at,
                ]);
                foreach ($amounts['items'] as $line) {
                    $this->insert('sales_document_items', [
                        'id' => Uuid::v4(), 'document_id' => $serverId, 'position' => $line['position'],
                        'title' => $line['title'], 'description' => $line['description'], 'quantity_milli' => $line['quantityMilli'],
                        'unit_price_base_unit' => $line['unitPriceBaseUnit'], 'discount_base_unit' => $line['discountBaseUnit'],
                        'tax_base_unit' => $line['taxBaseUnit'], 'line_total_base_unit' => $line['lineTotalBaseUnit'],
                        'created_at' => $at, 'updated_at' => $at,
                    ]);
                }
                if ($logo) $this->insert('sales_document_logo_snapshots', [
                    'document_id' => $serverId, 'business_id' => $business, 'mime_type' => $logo['mime'],
                    'byte_size' => strlen($logo['bytes']), 'image_bytes' => $logo['bytes'], 'created_at' => $at,
                ]);
            }
            $now = gmdate('Y-m-d H:i:s');
            if ($type === 'proforma') $this->applyPayments($business, $serverId, $payments, $paid, $now);
            $settlement = $paid === $amounts['total'] ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');
            $this->pdo->prepare(
                'UPDATE sales_documents SET paid_amount_base_unit = ?, settlement_status = ?, archived_at = ?, version = ?, updated_at = ? WHERE id = ?'
            )->execute([$paid, $settlement, $archive, $serverVersion, $now, $serverId]);
            if ($mapping) {
                $this->pdo->prepare(
                    'UPDATE mobile_document_sync SET revision_hash = ?, local_version = ?, server_version = ?, server_archived_at = ?
                     WHERE business_id = ? AND local_id = ?'
                )->execute([$revision, $version, $serverVersion, $archive, $business, $id]);
            } else {
                $this->insert('mobile_document_sync', [
                    'business_id' => $business, 'local_id' => $id, 'document_id' => $serverId,
                    'document_number' => $number, 'immutable_hash' => $immutable, 'revision_hash' => $revision,
                    'local_version' => $version, 'server_version' => $serverVersion, 'server_archived_at' => $archive,
                ]);
                $snapshot = $this->row('SELECT * FROM sales_documents WHERE id = ?', [$serverId]);
                $this->insert('sales_document_snapshots', [
                    'id' => Uuid::v4(), 'document_id' => $serverId, 'version' => 1,
                    'snapshot_json' => json_encode(['document' => $snapshot, 'items' => $amounts['items']], JSON_THROW_ON_ERROR),
                    'created_at' => $now,
                ]);
            }
            $this->pdo->commit();
            return $serverId;
        } catch (\Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }

    private function applyPayments(string $business, string $document, array $payments, int $paid, string $now): void
    {
        foreach ($payments as $id => $payment) {
            $key = 'mobile:' . $id;
            $existing = $this->row('SELECT proforma_id, amount_base_unit, paid_at FROM payments WHERE business_id = ? AND idempotency_key = ?', [$business, $key]);
            if ($existing) {
                if ($existing['proforma_id'] !== $document || (int)$existing['amount_base_unit'] !== $payment['amount']
                    || $existing['paid_at'] !== $payment['at']) throw new SalesValidationException('mobile_payment_conflict', 409);
                continue;
            }
            $paymentId = Uuid::v4();
            $this->insert('payments', [
                'id' => $paymentId, 'business_id' => $business, 'proforma_id' => $document,
                'amount_base_unit' => $payment['amount'], 'paid_at' => $payment['at'],
                'idempotency_key' => $key, 'created_at' => $now,
            ]);
            $this->insert('payment_allocations', [
                'payment_id' => $paymentId, 'document_id' => $document, 'amount_base_unit' => $payment['amount'], 'created_at' => $now,
            ]);
        }
        $totals = $this->row('SELECT COUNT(*) AS count, COALESCE(SUM(amount_base_unit), 0) AS paid FROM payments WHERE business_id = ? AND proforma_id = ?', [$business, $document]);
        if ((int)$totals['paid'] !== $paid || (int)$totals['count'] !== count($payments)) {
            throw new SalesValidationException('mobile_payment_conflict', 409);
        }
    }

    private function row(string $sql, array $values): array|false
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($values);
        return $statement->fetch();
    }

    /** Identifiers come exclusively from the static mappings in this class. */
    private function insert(string $table, array $columns): void
    {
        $fields = implode(', ', array_keys($columns));
        $values = implode(', ', array_fill(0, count($columns), '?'));
        $this->pdo->prepare("INSERT INTO $table ($fields) VALUES ($values)")->execute(array_values($columns));
    }

    private static function uuid(mixed $value): string
    {
        if (!is_string($value) || !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/D', $value)) {
            throw new SalesValidationException('mobile_id_invalid');
        }
        return $value;
    }

    private static function text(mixed $value, int $max, bool $required = false): string
    {
        if (!is_string($value) || mb_strlen($value) > $max || ($required && trim($value) === '')) {
            throw new SalesValidationException('mobile_text_invalid');
        }
        return $value;
    }

    private static function date(mixed $value): DateTimeImmutable
    {
        if (!is_string($value)) throw new SalesValidationException('mobile_date_invalid');
        $date = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s.v\Z', $value, new DateTimeZone('UTC'));
        if (!$date || $date->format('Y-m-d\TH:i:s.v\Z') !== $value || (int)$date->format('Y') < 1000) {
            throw new SalesValidationException('mobile_date_invalid');
        }
        return $date;
    }

    private static function logo(mixed $value): ?array
    {
        if ($value === null) return null;
        $bytes = is_string($value) && strlen($value) <= 2097152 ? base64_decode($value, true) : false;
        $image = $bytes ? @getimagesizefromstring($bytes) : false;
        if (!$image || !in_array($image['mime'], ['image/png', 'image/jpeg', 'image/webp'], true)) {
            throw new SalesValidationException('mobile_logo_invalid');
        }
        return ['bytes' => $bytes, 'mime' => $image['mime']];
    }
}
