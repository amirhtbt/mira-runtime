<?php
declare(strict_types=1);

namespace Tinv\Settings;

use PDO;

final readonly class SettingsRepository
{
    public function __construct(private PDO $pdo) {}

    /** @return array{settings:array<string,mixed>,version:int,updatedAt:string}|null */
    public function find(string $businessId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT settings_json, version, updated_at FROM business_settings WHERE business_id = ? LIMIT 1');
        $stmt->execute([$businessId]);
        $row = $stmt->fetch();
        if (!$row) return null;

        $settings = json_decode((string) $row['settings_json'], true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($settings)) throw new \RuntimeException('settings_storage_invalid');

        return [
            'settings' => $settings,
            'version' => (int) $row['version'],
            'updatedAt' => (string) $row['updated_at'],
        ];
    }

    /** @param array<string,mixed> $settings @return array{settings:array<string,mixed>,version:int,updatedAt:string} */
    public function save(string $businessId, array $settings, ?int $now = null): array
    {
        $now ??= time();
        $timestamp = gmdate('Y-m-d H:i:s', $now);
        $json = json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

        $stmt = $this->pdo->prepare(
            'INSERT INTO business_settings (business_id, settings_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?) '
            . 'ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json), version = version + 1, updated_at = VALUES(updated_at)'
        );
        $stmt->execute([$businessId, $json, $timestamp, $timestamp]);

        $saved = $this->find($businessId);
        if ($saved === null) throw new \RuntimeException('settings_write_failed');
        return $saved;
    }
}
