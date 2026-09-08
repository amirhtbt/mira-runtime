<?php
declare(strict_types=1);

namespace Tinv\Auth;

final readonly class ValidatedInitData
{
    /** @param array<string,string> $fields @param array<string,mixed> $user */
    public function __construct(
        public array $fields,
        public array $user,
        public int $authDate,
        public string $fingerprintBinary,
    ) {}
}
