<?php
declare(strict_types=1);

namespace Tinv\Session;

use PDO;

final readonly class SessionService
{
    public function __construct(
        private PDO $pdo,
        private string $pepper,
        private int $idleTtlSeconds,
        private int $absoluteTtlSeconds,
        private int $touchIntervalSeconds,
    ) {}

    /** @return array{token:string,token_hash:string,context:SessionContext,absolute_expires_at:int} */
    public function issue(
        string $userId,
        string $businessId,
        ?int $now = null,
        string $userAgent = '',
        ?int $absoluteExpiresAt = null,
    ): array {
        $now ??= time();
        $token = self::base64Url(random_bytes(32));
        $tokenHash = $this->hashToken($token);
        $defaultAbsoluteExpires = $now + $this->absoluteTtlSeconds;
        $absoluteExpires = $absoluteExpiresAt === null
            ? $defaultAbsoluteExpires
            : min($absoluteExpiresAt, $defaultAbsoluteExpires);
        if ($absoluteExpires <= $now) {
            throw new \RuntimeException('session_absolute_expiry_invalid');
        }
        $idleExpires = min($now + $this->idleTtlSeconds, $absoluteExpires);
        $userAgentHash = $userAgent === '' ? null : hash('sha256', $userAgent, true);

        $stmt = $this->pdo->prepare('INSERT INTO sessions (token_hash, user_id, business_id, created_at, last_seen_at, idle_expires_at, absolute_expires_at, user_agent_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $tokenHash,
            $userId,
            $businessId,
            self::dbTime($now),
            self::dbTime($now),
            self::dbTime($idleExpires),
            self::dbTime($absoluteExpires),
            $userAgentHash,
        ]);

        return [
            'token' => $token,
            'token_hash' => $tokenHash,
            'context' => new SessionContext($userId, $businessId),
            'absolute_expires_at' => $absoluteExpires,
        ];
    }

    public function authenticate(string $token, ?int $now = null): ?SessionContext
    {
        if ($token === '' || strlen($token) > 128) return null;
        $now ??= time();
        $hash = $this->hashToken($token);
        $stmt = $this->pdo->prepare('SELECT user_id, business_id, UNIX_TIMESTAMP(last_seen_at) last_seen, UNIX_TIMESTAMP(idle_expires_at) idle_expires, UNIX_TIMESTAMP(absolute_expires_at) absolute_expires, revoked_at FROM sessions WHERE token_hash = ? LIMIT 1');
        $stmt->execute([$hash]);
        $row = $stmt->fetch();
        if (!$row || $row['revoked_at'] !== null) return null;

        if ($now >= (int) $row['idle_expires'] || $now >= (int) $row['absolute_expires']) {
            $this->revokeByHash($hash, $now);
            return null;
        }

        if ($now - (int) $row['last_seen'] >= $this->touchIntervalSeconds) {
            $newIdle = min($now + $this->idleTtlSeconds, (int) $row['absolute_expires']);
            $touch = $this->pdo->prepare('UPDATE sessions SET last_seen_at = ?, idle_expires_at = ? WHERE token_hash = ? AND revoked_at IS NULL');
            $touch->execute([self::dbTime($now), self::dbTime($newIdle), $hash]);
        }

        return new SessionContext((string) $row['user_id'], (string) $row['business_id']);
    }

    public function belongsToTelegramIdentity(SessionContext $context, string $telegramUserId): bool
    {
        if (!preg_match('/^[1-9]\d{0,18}$/', $telegramUserId)) return false;
        $stmt = $this->pdo->prepare(
            'SELECT 1 FROM telegram_identities ti INNER JOIN businesses b ON b.owner_user_id = ti.user_id '
            . 'WHERE ti.user_id = ? AND ti.telegram_user_id = ? AND b.id = ? LIMIT 1'
        );
        $stmt->execute([$context->userId, $telegramUserId, $context->businessId]);
        return (bool) $stmt->fetchColumn();
    }

    /** @return array{token:string,context:SessionContext,absolute_expires_at:int}|null */
    public function rotate(string $token, ?int $now = null, string $userAgent = ''): ?array
    {
        if ($token === '' || strlen($token) > 128) return null;
        $now ??= time();
        $hash = $this->hashToken($token);
        $ownsTransaction = !$this->pdo->inTransaction();
        if ($ownsTransaction) $this->pdo->beginTransaction();

        try {
            $stmt = $this->pdo->prepare('SELECT user_id, business_id, UNIX_TIMESTAMP(idle_expires_at) idle_expires, UNIX_TIMESTAMP(absolute_expires_at) absolute_expires, revoked_at FROM sessions WHERE token_hash = ? LIMIT 1 FOR UPDATE');
            $stmt->execute([$hash]);
            $row = $stmt->fetch();
            if (!$row || $row['revoked_at'] !== null) {
                if ($ownsTransaction) $this->pdo->commit();
                return null;
            }

            $absoluteExpires = (int) $row['absolute_expires'];
            if ($now >= (int) $row['idle_expires'] || $now >= $absoluteExpires) {
                $this->revokeByHash($hash, $now);
                if ($ownsTransaction) $this->pdo->commit();
                return null;
            }

            $context = new SessionContext((string) $row['user_id'], (string) $row['business_id']);
            $this->revokeByHash($hash, $now);
            $new = $this->issue($context->userId, $context->businessId, $now, $userAgent, $absoluteExpires);

            if ($ownsTransaction) $this->pdo->commit();
            return [
                'token' => $new['token'],
                'context' => $new['context'],
                'absolute_expires_at' => $new['absolute_expires_at'],
            ];
        } catch (\Throwable $exception) {
            if ($ownsTransaction && $this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $exception;
        }
    }

    public function revoke(string $token, ?int $now = null): void
    {
        if ($token === '') return;
        $this->revokeByHash($this->hashToken($token), $now ?? time());
    }

    public function hashToken(string $token): string
    {
        return hash_hmac('sha256', $token, $this->pepper, true);
    }

    private function revokeByHash(string $hash, int $now): void
    {
        $stmt = $this->pdo->prepare('UPDATE sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE token_hash = ?');
        $stmt->execute([self::dbTime($now), $hash]);
    }

    private static function dbTime(int $timestamp): string
    {
        return gmdate('Y-m-d H:i:s', $timestamp);
    }

    private static function base64Url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}
