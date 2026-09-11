<?php
declare(strict_types=1);

namespace Tinv\Http;

final class RateLimitExceeded extends \RuntimeException
{
    public function __construct(public readonly int $retryAfterSeconds)
    {
        parent::__construct('rate_limit_exceeded');
    }
}
