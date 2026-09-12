<?php
declare(strict_types=1);

namespace Tinv\Admin;

use PDO;

/** Read-only, cross-tenant aggregate data; never return names, phone numbers or document bodies. */
final readonly class OwnerAnalytics
{
    public function __construct(private PDO $pdo) {}

    public function allowed(string $userId, string $configuredTelegramId): bool
    {
        if (!preg_match('/^[1-9][0-9]{0,19}$/D', $configuredTelegramId)) return false;
        $statement = $this->pdo->prepare('SELECT 1 FROM telegram_identities WHERE user_id = ? AND telegram_user_id = ? LIMIT 1');
        $statement->execute([$userId, $configuredTelegramId]);
        return $statement->fetchColumn() !== false;
    }

    /** @return array<string,mixed> */
    public function summary(): array
    {
        $users = $this->pdo->query('SELECT COUNT(*) registered, (SELECT COUNT(DISTINCT user_id) FROM app_events WHERE event_name = \'app_open\' AND occurred_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY) active30 FROM users')->fetch(PDO::FETCH_ASSOC);
        $documents = $this->pdo->query("SELECT document_type, COUNT(*) issued,
            COALESCE(SUM(CASE WHEN currency_unit = 'toman' THEN grand_total_base_unit * 10 ELSE grand_total_base_unit END),0) total_rial
            FROM sales_documents WHERE lifecycle_status = 'issued' GROUP BY document_type")->fetchAll(PDO::FETCH_ASSOC);
        $byType = ['invoice' => ['count' => 0, 'totalRial' => '0'], 'proforma' => ['count' => 0, 'totalRial' => '0']];
        foreach ($documents as $row) {
            if (isset($byType[$row['document_type']])) {
                $byType[$row['document_type']] = ['count' => (int) $row['issued'], 'totalRial' => (string) $row['total_rial']];
            }
        }
        $conversion = $this->pdo->query("SELECT COUNT(*) FROM sales_documents WHERE document_type='invoice' AND lifecycle_status='issued' AND source_document_id IS NOT NULL")->fetchColumn();
        $customers = $this->pdo->query('SELECT COUNT(*) FROM customers')->fetchColumn();
        $payment = $this->pdo->query("SELECT COALESCE(SUM(CASE WHEN d.currency_unit = 'toman' THEN p.amount_base_unit * 10 ELSE p.amount_base_unit END),0)
            FROM payments p JOIN sales_documents d ON d.id=p.proforma_id AND d.business_id=p.business_id
            WHERE p.status='confirmed'")->fetchColumn();
        return [
            'users' => ['registered' => (int) $users['registered'], 'active30' => (int) $users['active30']],
            'documents' => $byType,
            'customers' => (int) $customers,
            'convertedProformas' => (int) $conversion,
            'recordedProformaPaymentsRial' => (string) $payment,
            'note' => 'Document totals are separate gross issued amounts; do not add invoice and proforma totals together. Payments are recorded proforma payments, not total revenue.',
        ];
    }
}
