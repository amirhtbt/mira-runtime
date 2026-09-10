<?php
declare(strict_types=1);

namespace Tinv\Settings;

final readonly class SettingsService
{
    public function __construct(private SettingsRepository $repository) {}

    /** @return array{schemaVersion:int,settings:array<string,mixed>,version:int,updatedAt:?string} */
    public function get(string $businessId): array
    {
        $stored = $this->repository->find($businessId);
        if ($stored === null) {
            return [
                'schemaVersion' => SettingsSchema::SCHEMA_VERSION,
                'settings' => SettingsSchema::defaults(),
                'version' => 0,
                'updatedAt' => null,
            ];
        }

        $normalized = SettingsSchema::merge(SettingsSchema::defaults(), $stored['settings']);
        return [
            'schemaVersion' => SettingsSchema::SCHEMA_VERSION,
            'settings' => $normalized,
            'version' => $stored['version'],
            'updatedAt' => $stored['updatedAt'],
        ];
    }

    /** @param array<string,mixed> $patch @return array{schemaVersion:int,settings:array<string,mixed>,version:int,updatedAt:string} */
    public function update(string $businessId, array $patch, ?int $now = null): array
    {
        $current = $this->get($businessId)['settings'];
        $next = SettingsSchema::merge($current, $patch);
        $saved = $this->repository->save($businessId, $next, $now);
        return [
            'schemaVersion' => SettingsSchema::SCHEMA_VERSION,
            'settings' => $saved['settings'],
            'version' => $saved['version'],
            'updatedAt' => $saved['updatedAt'],
        ];
    }
}
