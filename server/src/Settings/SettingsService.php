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

        $normalized = $this->normalizeStored($stored['settings']);
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

    /**
     * Stored settings can outlive a schema revision. Keep every value that the
     * current schema still accepts and fall back only for the incompatible
     * field, instead of making the complete settings endpoint unavailable.
     *
     * @param array<string,mixed> $stored
     * @return array<string,mixed>
     */
    private function normalizeStored(array $stored): array
    {
        $next = SettingsSchema::defaults();
        foreach ($stored as $section => $values) {
            if (!array_key_exists($section, $next) || !is_array($values) || array_is_list($values)) continue;
            foreach ($values as $key => $value) {
                try {
                    $next = SettingsSchema::merge($next, [$section => [$key => $value]]);
                } catch (SettingsValidationException) {
                    $legacy = match (true) {
                        $section === 'visual' && $key === 'templateId' => match ($value) {
                            'mira-classic', 'luxury' => 'classic-business',
                            'bazaar' => 'modern-business',
                            default => 'minimal',
                        },
                        $section === 'presentation' && $key === 'currencyUnit' && $value === 'toman' => 'rial',
                        default => null,
                    };
                    if ($legacy !== null) $next = SettingsSchema::merge($next, [$section => [$key => $legacy]]);
                }
            }
        }
        return $next;
    }
}
