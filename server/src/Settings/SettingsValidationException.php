<?php
declare(strict_types=1);

namespace Tinv\Settings;

final class SettingsValidationException extends \RuntimeException
{
    public function __construct(public readonly string $reason)
    {
        parent::__construct('settings_' . $reason);
    }
}
