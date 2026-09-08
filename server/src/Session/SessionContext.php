<?php
declare(strict_types=1);

namespace Tinv\Session;

final readonly class SessionContext
{
    public function __construct(public string $userId, public string $businessId) {}
}
