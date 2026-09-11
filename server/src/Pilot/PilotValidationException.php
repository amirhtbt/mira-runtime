<?php
declare(strict_types=1);

namespace Tinv\Pilot;

final class PilotValidationException extends \RuntimeException
{
    public function __construct(public readonly string $reason, public readonly int $httpStatus = 422)
    {
        parent::__construct('pilot_' . $reason);
    }
}
