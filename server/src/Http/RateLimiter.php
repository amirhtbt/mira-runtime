<?php
declare(strict_types=1);

namespace Tinv\Http;

use PDO;

final readonly class RateLimiter
{
    public function __construct(private PDO $pdo, private string $pepper) {}

    public function consume(string $scope, string $action, int $limit, int $windowSeconds = 60, ?int $now = null): void
    {
        if ($limit < 1 || $windowSeconds < 1 || !preg_match('/^[a-z0-9_-]{1,48}$/', $action)) throw new \InvalidArgumentException('rate_limit_config_invalid');
        $now ??= time();
        $nowSql = gmdate('Y-m-d H:i:s', $now);
        $cutoffSql = gmdate('Y-m-d H:i:s', $now - $windowSeconds);
        $scopeHash = hash_hmac('sha256', $scope, $this->pepper);
        $sql = 'INSERT INTO rate_limit_buckets (scope_hash,action_key,window_started_at,request_count,updated_at) VALUES (?,?,?,1,?) '
            . 'ON DUPLICATE KEY UPDATE request_count=IF(window_started_at<=?,1,request_count+1),window_started_at=IF(window_started_at<=?,VALUES(window_started_at),window_started_at),updated_at=VALUES(updated_at)';
        $statement = $this->pdo->prepare($sql);
        $statement->execute([$scopeHash, $action, $nowSql, $nowSql, $cutoffSql, $cutoffSql]);
        $cleanup = $this->pdo->prepare('DELETE FROM rate_limit_buckets WHERE updated_at < ? LIMIT 100');
        $cleanup->execute([gmdate('Y-m-d H:i:s', $now - 86400)]);
        $read = $this->pdo->prepare('SELECT window_started_at,request_count FROM rate_limit_buckets WHERE scope_hash=? AND action_key=?');
        $read->execute([$scopeHash, $action]);
        $bucket = $read->fetch();
        if ($bucket && (int) $bucket['request_count'] > $limit) {
            $started = strtotime((string) $bucket['window_started_at']) ?: $now;
            throw new RateLimitExceeded(max(1, $windowSeconds - ($now - $started)));
        }
    }
}
