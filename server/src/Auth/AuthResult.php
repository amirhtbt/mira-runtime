<?php
declare(strict_types=1);

namespace Tinv\Auth;

use Tinv\Session\SessionContext;

final readonly class AuthResult
{
    public function __construct(
        public string $sessionToken,
        public int $absoluteExpiresAt,
        public SessionContext $context,
    ) {}
}
