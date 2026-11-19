<?php
declare(strict_types=1);

namespace Tinv\Auth;

use Closure;
use PDO;
use Tinv\Support\Phone;
use Tinv\Support\Uuid;

final readonly class MobileSmsChallengeService
{
    private const TTL = 300;
    private const RESEND_DELAY = 60;
    private const SEND_WINDOW = 86400;
    private const MAX_SENDS = 5;
    private const MAX_ATTEMPTS = 5;

    /** The delivery callback receives the normalized recipient and OTP, and throws on delivery failure. */
    public function __construct(
        private PDO $pdo,
        private string $secret,
        private Closure $deliver,
    ) {
        if (strlen($secret) < 32) throw new \InvalidArgumentException('mobile_sms_secret_too_short');
    }

    public function request(string $number, ?int $now = null): string
    {
        $now ??= time();
        $phone = self::normalizeMobile($number);
        $key = $this->phoneKey($phone);
        $id = Uuid::v4();
        $code = str_pad((string)random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        $this->pdo->beginTransaction();
        try {
            $this->pdo->prepare(
                'INSERT INTO mobile_sms_challenges (phone_hash, send_window_started_at) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE phone_hash = phone_hash'
            )->execute([$key, $now]);
            $row = $this->lock($key);
            $last = $row['last_sent_at'];
            $start = (int)$row['send_window_started_at'];
            $count = (int)$row['send_count'];
            if ($now >= $start + self::SEND_WINDOW) {
                $start = $now;
                $count = 0;
            }
            if (($last !== null && $now < (int)$last + self::RESEND_DELAY) || $count >= self::MAX_SENDS) {
                throw new \DomainException('mobile_sms_rate_limited');
            }
            $this->pdo->prepare(
                'UPDATE mobile_sms_challenges
                 SET challenge_id = ?, code_hash = ?, expires_at = ?, attempt_count = 0,
                     send_window_started_at = ?, send_count = ?, last_sent_at = ?
                 WHERE phone_hash = ?'
            )->execute([$id, $this->codeHash($key, $id, $code), $now + self::TTL, $start, $count + 1, $now, $key]);
            $this->pdo->commit();
        } catch (\Throwable $error) {
            $this->pdo->rollBack();
            throw $error;
        }

        // Reserve before delivery so concurrent requests cannot send multiple codes.
        // Failed delivery retains its quota reservation and invalidates this specific challenge.
        try {
            ($this->deliver)($phone, $code);
        } catch (\Throwable) {
            $this->pdo->prepare(
                'UPDATE mobile_sms_challenges SET code_hash = NULL WHERE phone_hash = ? AND challenge_id = ?'
            )->execute([$key, $id]);
            throw new \RuntimeException('mobile_sms_delivery_failed');
        }
        return $id;
    }

    /** Returns only the verified phone. Account creation, linking and session issuance are separate. */
    public function consume(string $number, string $challengeId, string $code, ?int $now = null): ?string
    {
        $now ??= time();
        $phone = self::normalizeMobile($number);
        $key = $this->phoneKey($phone);

        $this->pdo->beginTransaction();
        try {
            $row = $this->lock($key);
            $eligible = $row && $row['challenge_id'] === $challengeId && is_string($row['code_hash'])
                && $now < (int)$row['expires_at'] && (int)$row['attempt_count'] < self::MAX_ATTEMPTS;
            $valid = $eligible && preg_match('/^[0-9]{4}$/D', $code)
                && hash_equals($row['code_hash'], $this->codeHash($key, $challengeId, $code));
            if ($eligible) {
                $this->pdo->prepare(
                    'UPDATE mobile_sms_challenges SET attempt_count = ?, code_hash = ? WHERE phone_hash = ?'
                )->execute([(int)$row['attempt_count'] + 1, $valid ? null : $row['code_hash'], $key]);
            }
            $this->pdo->commit();
            return $valid ? $phone : null;
        } catch (\Throwable $error) {
            $this->pdo->rollBack();
            throw $error;
        }
    }

    private static function normalizeMobile(string $value): string
    {
        $phone = Phone::normalize($value);
        if (!preg_match('/^09[0-9]{9}$/D', $phone)) throw new \InvalidArgumentException('mobile_sms_number_invalid');
        return $phone;
    }

    private function phoneKey(string $phone): string
    {
        return hash_hmac('sha256', 'mobile-sms-phone:' . $phone, $this->secret, true);
    }

    private function codeHash(string $key, string $id, string $code): string
    {
        return hash_hmac('sha256', 'mobile-sms-code:' . $key . ':' . $id . ':' . $code, $this->secret, true);
    }

    private function lock(string $key): array|false
    {
        $query = $this->pdo->prepare('SELECT * FROM mobile_sms_challenges WHERE phone_hash = ? FOR UPDATE');
        $query->execute([$key]);
        return $query->fetch();
    }
}
