<?php
declare(strict_types=1);

namespace Tinv\Pilot;

use PDO;
use Tinv\Support\Uuid;

final readonly class PilotService
{
    private const CLIENT_EVENTS = ['app_open', 'template_selected', 'settings_section_used', 'export_failed'];
    private const EVENT_PROPERTIES = [
        'app_open' => [], 'settings_updated' => [], 'proforma_converted' => [],
        'document_started' => ['document_type'], 'invoice_completed' => ['document_type', 'is_official'],
        'invoice_duplicated' => ['document_type'], 'image_exported' => ['format'],
        'pdf_exported' => ['format'], 'share_started' => ['format'],
        'template_selected' => ['template_id'], 'settings_section_used' => ['section'],
        'export_failed' => ['format', 'stage'], 'feedback_submitted' => ['score_band'],
    ];
    private const VALUES = [
        'document_type' => ['proforma', 'invoice'], 'is_official' => ['0', '1'],
        'format' => ['png', 'pdf', 'share'], 'stage' => ['render', 'download', 'share', 'record'],
        'section' => ['profile', 'payment', 'document', 'items', 'financial', 'text', 'visual'],
        'score_band' => ['low', 'neutral', 'high'],
    ];

    public function __construct(private PDO $pdo, private string $pepper) {}

    public function recordClient(string $userId, string $businessId, array $input, ?int $now = null): void
    {
        $this->onlyKeys($input, ['event', 'properties']);
        $event = (string) ($input['event'] ?? '');
        if (!in_array($event, self::CLIENT_EVENTS, true)) throw new PilotValidationException('event_not_allowed');
        $properties = $input['properties'] ?? [];
        if (!is_array($properties)) throw new PilotValidationException('properties_invalid');
        $this->record($userId, $businessId, $event, $properties, $event === 'app_open' ? 'daily:' . gmdate('Y-m-d', $now ?? time()) : null, $now);
    }

    public function record(string $userId, string $businessId, string $event, array $properties = [], ?string $dedupeSeed = null, ?int $now = null): void
    {
        $normalized = $this->properties($event, $properties);
        $timestamp = $now ?? time();
        $dedupe = $dedupeSeed === null ? null : hash_hmac('sha256', $businessId . '|' . $event . '|' . $dedupeSeed, $this->pepper, true);
        $statement = $this->pdo->prepare('INSERT IGNORE INTO app_events (user_id,business_id,event_name,properties_json,dedupe_hash,occurred_at,event_day) VALUES (?,?,?,?,?,?,?)');
        $statement->execute([$userId, $businessId, $event, json_encode($normalized, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), $dedupe, gmdate('Y-m-d H:i:s', $timestamp), gmdate('Y-m-d', $timestamp)]);
    }

    public function recordBestEffort(string $userId, string $businessId, string $event, array $properties = [], ?string $dedupeSeed = null, ?int $now = null): bool
    {
        try {
            $this->record($userId, $businessId, $event, $properties, $dedupeSeed, $now);
            return true;
        } catch (\Throwable) {
            error_log(json_encode(['event' => 'pilot_event_write_failed'], JSON_UNESCAPED_SLASHES));
            return false;
        }
    }

    /** @return array{eligible:bool,submitted:bool,issuedDocuments:int,activeDays:int} */
    public function feedbackStatus(string $userId, string $businessId): array
    {
        $issued = $this->scalar("SELECT COUNT(*) FROM sales_documents WHERE business_id=? AND lifecycle_status='issued'", [$businessId]);
        $days = $this->scalar('SELECT COUNT(DISTINCT event_day) FROM app_events WHERE user_id=? AND business_id=?', [$userId, $businessId]);
        $submitted = $this->scalar('SELECT COUNT(*) FROM pilot_feedback WHERE user_id=? AND business_id=?', [$userId, $businessId]) > 0;
        return ['eligible' => !$submitted && ($issued >= 3 || $days >= 2), 'submitted' => $submitted, 'issuedDocuments' => $issued, 'activeDays' => $days];
    }

    /** @return array{id:string,submitted:bool} */
    public function submitFeedback(string $userId, string $businessId, array $input, ?int $now = null): array
    {
        $this->onlyKeys($input, ['score', 'missingCategory', 'text']);
        $status = $this->feedbackStatus($userId, $businessId);
        if (!$status['eligible']) throw new PilotValidationException($status['submitted'] ? 'already_submitted' : 'not_eligible', 409);
        $score = filter_var($input['score'] ?? null, FILTER_VALIDATE_INT);
        if (!is_int($score) || $score < 1 || $score > 5) throw new PilotValidationException('score_invalid');
        $category = $input['missingCategory'] ?? null;
        $categories = ['templates', 'export', 'history', 'settings', 'payments', 'other'];
        if ($category !== null && (!is_string($category) || !in_array($category, $categories, true))) throw new PilotValidationException('category_invalid');
        $text = trim((string) ($input['text'] ?? ''));
        if (mb_strlen($text) > 1000 || str_contains($text, '<')) throw new PilotValidationException('text_invalid');
        $id = Uuid::v4(); $timestamp = $now ?? time(); $date = gmdate('Y-m-d H:i:s', $timestamp);
        $statement = $this->pdo->prepare('INSERT INTO pilot_feedback (id,user_id,business_id,value_score,missing_category,feedback_text,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)');
        $statement->execute([$id, $userId, $businessId, $score, $category, $text, $date, $date]);
        $band = $score <= 2 ? 'low' : ($score === 3 ? 'neutral' : 'high');
        $this->recordBestEffort($userId, $businessId, 'feedback_submitted', ['score_band' => $band], 'feedback:' . $id, $timestamp);
        return ['id' => $id, 'submitted' => true];
    }

    /** @return array<string,int|float|null> */
    public function metrics(string $businessId, ?int $now = null): array
    {
        $timestamp = $now ?? time(); $since = gmdate('Y-m-d H:i:s', $timestamp - 30 * 86400); $week = gmdate('Y-m-d H:i:s', $timestamp - 7 * 86400);
        $firstOpen = $this->dateValue('SELECT MIN(occurred_at) FROM app_events WHERE business_id=?', [$businessId]);
        $firstInvoice = $this->dateValue("SELECT MIN(issued_at) FROM sales_documents WHERE business_id=? AND lifecycle_status='issued'", [$businessId]);
        $issued30 = $this->scalar("SELECT COUNT(*) FROM sales_documents WHERE business_id=? AND lifecycle_status='issued' AND issued_at>=?", [$businessId, $since]);
        $exported30 = $this->scalar("SELECT COUNT(DISTINCT e.document_id) FROM document_exports e INNER JOIN sales_documents d ON d.id=e.document_id AND d.business_id=e.business_id WHERE e.business_id=? AND d.lifecycle_status='issued' AND e.created_at>=?", [$businessId, $since]);
        $eligible = $this->scalar("SELECT COUNT(*) FROM sales_documents WHERE business_id=? AND document_type='proforma' AND lifecycle_status='issued' AND issued_at>=?", [$businessId, $since]);
        $converted = $this->scalar("SELECT COUNT(*) FROM sales_documents i INNER JOIN sales_documents p ON p.id=i.source_document_id AND p.business_id=i.business_id WHERE i.business_id=? AND i.document_type='invoice' AND i.lifecycle_status='issued' AND p.document_type='proforma' AND p.lifecycle_status='issued' AND p.issued_at>=?", [$businessId, $since]);
        $successExports = $this->scalar('SELECT COUNT(*) FROM document_exports WHERE business_id=? AND created_at>=?', [$businessId, $since]);
        $failedExports = $this->scalar("SELECT COUNT(*) FROM app_events WHERE business_id=? AND event_name='export_failed' AND occurred_at>=?", [$businessId, $since]);
        $retained = function (int $offset) use ($businessId, $firstOpen, $timestamp): ?int {
            if ($firstOpen === null) return null;
            $target = strtotime(substr($firstOpen, 0, 10) . ' UTC') + $offset * 86400;
            if ($timestamp < $target) return null;
            return $this->scalar('SELECT COUNT(*) FROM app_events WHERE business_id=? AND event_day=?', [$businessId, gmdate('Y-m-d', $target)]) > 0 ? 1 : 0;
        };
        $issued7 = $this->scalar("SELECT COUNT(*) FROM sales_documents WHERE business_id=? AND lifecycle_status='issued' AND issued_at>=?", [$businessId, $week]);
        return [
            'observationWindowDays' => 30,
            'activated' => $firstInvoice === null ? 0 : 1,
            'secondsToFirstInvoice' => $firstOpen !== null && $firstInvoice !== null ? max(0, strtotime($firstInvoice) - strtotime($firstOpen)) : null,
            'activeDays30' => $this->scalar('SELECT COUNT(DISTINCT event_day) FROM app_events WHERE business_id=? AND occurred_at>=?', [$businessId, $since]),
            'retainedD1' => $retained(1), 'retainedD7' => $retained(7), 'retainedD30' => $retained(30),
            'issuedDocuments7' => $issued7, 'invoicesPerActiveSeller7' => $issued7,
            'issuedDocuments30' => $issued30,
            'exportShareRate' => $issued30 > 0 ? round($exported30 / $issued30, 4) : 0.0,
            'eligibleProformas30' => $eligible,
            'explicitConversions30' => $converted,
            'conversionRate' => $eligible > 0 ? round($converted / $eligible, 4) : 0.0,
            'exportFailureRate' => $successExports + $failedExports > 0 ? round($failedExports / ($successExports + $failedExports), 4) : 0.0,
        ];
    }

    private function properties(string $event, array $properties): array
    {
        if (!array_key_exists($event, self::EVENT_PROPERTIES)) throw new PilotValidationException('event_not_allowed');
        $allowed = self::EVENT_PROPERTIES[$event]; $this->onlyKeys($properties, $allowed); $normalized = [];
        foreach ($properties as $key => $value) {
            if ($key === 'template_id') {
                $value = (string) $value;
                if (!preg_match('/^[a-z0-9-]{1,48}$/', $value)) throw new PilotValidationException('property_invalid');
            } else {
                $value = is_bool($value) ? ($value ? '1' : '0') : (string) $value;
                if (!in_array($value, self::VALUES[$key] ?? [], true)) throw new PilotValidationException('property_invalid');
            }
            $normalized[$key] = $value;
        }
        return $normalized;
    }

    private function onlyKeys(array $input, array $allowed): void
    {
        foreach (array_keys($input) as $key) if (!is_string($key) || !in_array($key, $allowed, true)) throw new PilotValidationException('unknown_field');
    }

    private function scalar(string $sql, array $arguments): int
    {
        $statement = $this->pdo->prepare($sql); $statement->execute($arguments); return (int) $statement->fetchColumn();
    }

    private function dateValue(string $sql, array $arguments): ?string
    {
        $statement = $this->pdo->prepare($sql); $statement->execute($arguments); $value = $statement->fetchColumn(); return is_string($value) && $value !== '' ? $value : null;
    }
}
