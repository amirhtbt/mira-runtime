<?php
declare(strict_types=1);

namespace Tinv\Auth;

final class ValidationException extends \RuntimeException
{
    public function __construct(public readonly string $reason, string $message)
    {
        parent::__construct($message);
    }
}
