<?php
declare(strict_types=1);

namespace Tinv\Auth;

use PDO;
use Tinv\Session\SessionService;
use Tinv\Support\Uuid;

final readonly class MobileSmsAuthService
{
    public function __construct(
        private PDO $pdo,
        private MobileSmsChallengeService $challenges,
        private SessionService $sessions,
        private string $secret,
    ) {}

    public function verify(string $number, string $challengeId, string $code, ?int $now = null, string $userAgent = ''): ?AuthResult
    {
        $now ??= time();
        $phone = $this->challenges->consume($number, $challengeId, $code, $now);
        if ($phone === null) return null;

        $key = hash_hmac('sha256', 'mobile-account-phone:' . $phone, $this->secret, true);
        $at = gmdate('Y-m-d H:i:s', $now);
        $this->pdo->beginTransaction();
        try {
            $this->pdo->prepare(
                'INSERT INTO mobile_phone_identities (phone_hash, created_at) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE phone_hash = phone_hash'
            )->execute([$key, $at]);
            $query = $this->pdo->prepare(
                'SELECT i.user_id, b.id AS business_id FROM mobile_phone_identities i
                 LEFT JOIN businesses b ON b.owner_user_id = i.user_id WHERE i.phone_hash = ? FOR UPDATE'
            );
            $query->execute([$key]);
            $identity = $query->fetch();
            if ($identity['user_id'] === null) {
                $userId = Uuid::v4();
                $businessId = Uuid::v4();
                $this->pdo->prepare('INSERT INTO users (id, created_at) VALUES (?, ?)')->execute([$userId, $at]);
                $this->pdo->prepare('INSERT INTO businesses (id, owner_user_id, created_at) VALUES (?, ?, ?)')->execute([$businessId, $userId, $at]);
                $this->pdo->prepare('UPDATE mobile_phone_identities SET user_id = ? WHERE phone_hash = ?')->execute([$userId, $key]);
            } else {
                $userId = (string)$identity['user_id'];
                $businessId = (string)$identity['business_id'];
                if ($businessId === '') throw new \RuntimeException('mobile_business_missing');
            }
            $issued = $this->sessions->issue($userId, $businessId, $now, $userAgent);
            $this->pdo->commit();
            return new AuthResult($issued['token'], $issued['absolute_expires_at'], $issued['context']);
        } catch (\Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }
}
