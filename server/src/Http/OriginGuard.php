<?php
declare(strict_types=1);

namespace Tinv\Http;

final readonly class OriginGuard
{
    public function __construct(private string $allowedOrigin) {}

    public function assertAllowed(?string $origin): void
    {
        if ($origin === null || trim($origin) === '') {
            throw new \RuntimeException('origin_missing');
        }
        if (!hash_equals(strtolower($this->allowedOrigin), strtolower(rtrim(trim($origin), '/')))) {
            throw new \RuntimeException('origin_rejected');
        }
    }
}
