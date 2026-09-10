<?php
declare(strict_types=1);
namespace Tinv\Sales;

final class SalesValidationException extends \RuntimeException
{
    public function __construct(public readonly string $reason, public readonly int $httpStatus = 422)
    {
        parent::__construct($reason);
    }
}
