<?php
declare(strict_types=1);

namespace Tinv\Auth;

use PDO;
use Tinv\Session\SessionContext;

final readonly class MobileTelegramLink
{
    public const TTL = 600;

    public function __construct(private PDO $pdo, private string $secret) {}

    public function phoneKey(string $phone): string
    {
        return hash_hmac('sha256', 'mobile-account-phone:' . $phone, $this->secret, true);
    }

    public function issue(SessionContext $context, string $number, int $now): string
    {
        $phone = MobileSmsChallengeService::normalizeMobile($number);
        $code = bin2hex(random_bytes(12));
        $this->pdo->prepare(
            'INSERT INTO mobile_telegram_links (user_id, token_hash, phone_hash, expires_at) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), phone_hash = VALUES(phone_hash), expires_at = VALUES(expires_at)'
        )->execute([$context->userId, hash('sha256', $code, true), $this->phoneKey($phone), $now + self::TTL]);
        return $code;
    }

    /** Called inside the same transaction that assigns the phone identity and issues the mobile session. */
    public function consume(string $code, string $phoneHash, int $now): array
    {
        if (!$this->pdo->inTransaction()) throw new \LogicException('mobile_link_requires_transaction');
        if (!preg_match('/^[a-f0-9]{24}$/D', $code)) throw new \DomainException('mobile_link_invalid');
        $hash = hash('sha256', $code, true);
        $query = $this->pdo->prepare(
            'SELECT l.user_id, l.phone_hash, l.expires_at, b.id AS business_id
             FROM mobile_telegram_links l
             JOIN businesses b ON b.owner_user_id = l.user_id
             WHERE l.token_hash = ? FOR UPDATE'
        );
        $query->execute([$hash]);
        $link = $query->fetch();
        if (!$link || (int)$link['expires_at'] <= $now || !hash_equals($link['phone_hash'], $phoneHash)) {
            throw new \DomainException('mobile_link_invalid');
        }
        $this->pdo->prepare('DELETE FROM mobile_telegram_links WHERE token_hash = ?')->execute([$hash]);
        return $link;
    }
}
