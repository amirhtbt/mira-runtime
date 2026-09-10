<?php
declare(strict_types=1);

namespace Tinv\Settings;

final class DocumentSettingsSnapshot
{
    /** @param array<string,mixed> $global @param array<string,mixed> $overrides @return array<string,mixed> */
    public static function make(array $global, array $overrides = []): array
    {
        return [
            'settingsSchemaVersion' => SettingsSchema::SCHEMA_VERSION,
            'settings' => SettingsSchema::mergeForDocument($global, $overrides),
        ];
    }

    /** @param array<string,mixed> $global @param array<string,mixed> $overrides */
    public static function toJson(array $global, array $overrides = []): string
    {
        return json_encode(self::make($global, $overrides), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
}
