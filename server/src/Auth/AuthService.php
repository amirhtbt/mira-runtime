<?php
declare(strict_types=1);

namespace Tinv\Auth;

use PDO;
use PDOException;
use Tinv\Session\SessionService;
use Tinv\Support\Uuid;

final readonly class AuthService
{
    public function __construct(
        private PDO $pdo,
        private InitDataValidator $validator,
        private SessionService $sessions,
        private int $replayRetentionSeconds,
    ) {}

    public function authenticateTelegram(string $rawInitData, ?int $now = null, string $userAgent = ''): AuthResult
    {
        $now ??= time();
        $validated = $this->validator->validate($rawInitData, $now);
        $telegramId = (string) $validated->user['id'];

        $this->pdo->beginTransaction();
        try {
            $this->reserveReplayFingerprint($validated->fingerprintBinary, $telegramId, $now);

            $identity = $this->findIdentity($telegramId);
            if ($identity) {
                $userId = (string) $identity['user_id'];
                $businessId = (string) $identity['business_id'];
                $this->updateIdentityProfile($userId, $validated->user, $now);
            } else {
                [$userId, $businessId] = $this->createUserAndBusiness($telegramId, $validated->user, $now);
            }

            $issued = $this->sessions->issue($userId, $businessId, $now, $userAgent);
            $stmt = $this->pdo->prepare('UPDATE telegram_auth_replays SET session_hash = ? WHERE fingerprint = ?');
            $stmt->execute([$issued['token_hash'], $validated->fingerprintBinary]);

            $this->pdo->commit();
            return new AuthResult($issued['token'], $issued['absolute_expires_at'], $issued['context']);
        } catch (\Throwable $exception) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $exception;
        }
    }

    private function reserveReplayFingerprint(string $fingerprint, string $telegramId, int $now): void
    {
        try {
            $stmt = $this->pdo->prepare('INSERT INTO telegram_auth_replays (fingerprint, telegram_user_id, accepted_at, expires_at) VALUES (?, ?, ?, ?)');
            $stmt->execute([$fingerprint, $telegramId, gmdate('Y-m-d H:i:s', $now), gmdate('Y-m-d H:i:s', $now + $this->replayRetentionSeconds)]);
        } catch (PDOException $exception) {
            if ((string) $exception->getCode() === '23000') {
                throw new ReplayDetected('Telegram initData has already minted a session');
            }
            throw $exception;
        }
    }

    /** @return array{user_id:string,business_id:string}|null */
    private function findIdentity(string $telegramId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT ti.user_id, b.id business_id FROM telegram_identities ti JOIN businesses b ON b.owner_user_id = ti.user_id WHERE ti.telegram_user_id = ? LIMIT 1');
        $stmt->execute([$telegramId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** @param array<string,mixed> $telegramUser @return array{string,string} */
    private function createUserAndBusiness(string $telegramId, array $telegramUser, int $now): array
    {
        $userId = Uuid::v4();
        $businessId = Uuid::v4();
        $at = gmdate('Y-m-d H:i:s', $now);

        $this->pdo->prepare('INSERT INTO users (id, created_at) VALUES (?, ?)')->execute([$userId, $at]);
        $this->pdo->prepare('INSERT INTO businesses (id, owner_user_id, created_at) VALUES (?, ?, ?)')->execute([$businessId, $userId, $at]);
        $stmt = $this->pdo->prepare('INSERT INTO telegram_identities (user_id, telegram_user_id, username, first_name, last_name, linked_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $userId,
            $telegramId,
            self::cleanOptional($telegramUser['username'] ?? null, 64),
            self::cleanOptional($telegramUser['first_name'] ?? null, 128),
            self::cleanOptional($telegramUser['last_name'] ?? null, 128),
            $at,
            $at,
        ]);

        return [$userId, $businessId];
    }

    /** @param array<string,mixed> $telegramUser */
    private function updateIdentityProfile(string $userId, array $telegramUser, int $now): void
    {
        $stmt = $this->pdo->prepare('UPDATE telegram_identities SET username = ?, first_name = ?, last_name = ?, updated_at = ? WHERE user_id = ?');
        $stmt->execute([
            self::cleanOptional($telegramUser['username'] ?? null, 64),
            self::cleanOptional($telegramUser['first_name'] ?? null, 128),
            self::cleanOptional($telegramUser['last_name'] ?? null, 128),
            gmdate('Y-m-d H:i:s', $now),
            $userId,
        ]);
    }

    private static function cleanOptional(mixed $value, int $maxLength): ?string
    {
        if (!is_string($value) || trim($value) === '') return null;
        return mb_substr(trim($value), 0, $maxLength, 'UTF-8');
    }
}
