<?php
declare(strict_types=1);

namespace Tinv;

use Tinv\Support\Env;

final readonly class Config
{
    public function __construct(
        public string $appEnv,
        public string $appOrigin,
        public string $telegramBotToken,
        public string $sessionPepper,
        public string $dbHost,
        public int $dbPort,
        public string $dbName,
        public string $dbUser,
        public string $dbPassword,
        public int $authMaxAgeSeconds,
        public int $authFutureSkewSeconds,
        public int $sessionIdleTtlSeconds,
        public int $sessionAbsoluteTtlSeconds,
        public int $sessionTouchIntervalSeconds,
    ) {}

    public static function fromEnvironment(): self
    {
        $origin = rtrim(Env::required('APP_ORIGIN'), '/');
        $parts = parse_url($origin);
        $validOrigin = filter_var($origin, FILTER_VALIDATE_URL)
            && is_array($parts)
            && strtolower((string) ($parts['scheme'] ?? '')) === 'https'
            && isset($parts['host'])
            && !isset($parts['user'], $parts['pass'], $parts['query'], $parts['fragment'])
            && (!isset($parts['path']) || $parts['path'] === '');
        if (!$validOrigin) {
            throw new \RuntimeException('APP_ORIGIN must be an exact HTTPS origin without path, query, credentials or fragment');
        }

        $self = new self(
            Env::string('APP_ENV', 'production'),
            $origin,
            Env::required('TELEGRAM_BOT_TOKEN'),
            Env::required('SESSION_PEPPER'),
            Env::required('DB_HOST'),
            Env::int('DB_PORT', 3306),
            Env::required('DB_NAME'),
            Env::required('DB_USER'),
            Env::required('DB_PASSWORD'),
            Env::int('AUTH_MAX_AGE_SECONDS', 300),
            Env::int('AUTH_FUTURE_SKEW_SECONDS', 30),
            Env::int('SESSION_IDLE_TTL_SECONDS', 604800),
            Env::int('SESSION_ABSOLUTE_TTL_SECONDS', 2592000),
            Env::int('SESSION_TOUCH_INTERVAL_SECONDS', 300),
        );

        if ($self->authMaxAgeSeconds < 60 || $self->authMaxAgeSeconds > 3600) {
            throw new \RuntimeException('AUTH_MAX_AGE_SECONDS must be between 60 and 3600');
        }
        if ($self->sessionIdleTtlSeconds < 300 || $self->sessionAbsoluteTtlSeconds < $self->sessionIdleTtlSeconds) {
            throw new \RuntimeException('Invalid session TTL configuration');
        }
        if (strlen($self->sessionPepper) < 32) {
            throw new \RuntimeException('SESSION_PEPPER must be at least 32 characters');
        }

        return $self;
    }

    public function isProductionLike(): bool
    {
        return in_array($this->appEnv, ['production', 'staging'], true);
    }
}
