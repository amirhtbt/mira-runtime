<?php
declare(strict_types=1);

namespace Tinv\Settings;

final class LogoValidationException extends \RuntimeException
{
    public function __construct(public readonly string $reason)
    {
        parent::__construct('logo_' . $reason);
    }
}
