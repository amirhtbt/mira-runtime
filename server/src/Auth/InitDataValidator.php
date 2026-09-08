<?php
declare(strict_types=1);

namespace Tinv\Auth;

final readonly class InitDataValidator
{
    public function __construct(
        private string $botToken,
        private int $maxAgeSeconds = 300,
        private int $futureSkewSeconds = 30,
    ) {}

    public function validate(string $rawInitData, ?int $now = null): ValidatedInitData
    {
        if ($rawInitData === '' || strlen($rawInitData) > 16384) {
            throw new ValidationException('malformed', 'initData is empty or too large');
        }

        $fields = $this->strictParse($rawInitData);
        foreach (['hash', 'auth_date', 'user'] as $required) {
            if (!isset($fields[$required]) || $fields[$required] === '') {
                throw new ValidationException('missing_field', "Missing {$required}");
            }
        }

        $receivedHash = strtolower($fields['hash']);
        if (!preg_match('/^[a-f0-9]{64}$/', $receivedHash)) {
            throw new ValidationException('invalid_hash', 'Hash has invalid format');
        }

        $checkFields = $fields;
        unset($checkFields['hash']);
        ksort($checkFields, SORT_STRING);
        $dataCheckString = implode("\n", array_map(
            static fn(string $key, string $value): string => $key . '=' . $value,
            array_keys($checkFields),
            array_values($checkFields)
        ));

        // Telegram Mini App algorithm: secret_key = HMAC_SHA256(bot_token, key="WebAppData")
        $secretKey = hash_hmac('sha256', $this->botToken, 'WebAppData', true);
        $calculatedHash = hash_hmac('sha256', $dataCheckString, $secretKey);
        if (!hash_equals($calculatedHash, $receivedHash)) {
            throw new ValidationException('invalid_hash', 'Telegram signature mismatch');
        }

        if (!preg_match('/^\\d{1,12}$/', $fields['auth_date'])) {
            throw new ValidationException('invalid_auth_date', 'auth_date is invalid');
        }
        $authDate = (int) $fields['auth_date'];
        $now ??= time();
        if ($authDate > $now + $this->futureSkewSeconds) {
            throw new ValidationException('future_auth_date', 'auth_date is too far in the future');
        }
        if ($now - $authDate > $this->maxAgeSeconds) {
            throw new ValidationException('expired', 'initData is expired');
        }

        try {
            $user = json_decode($fields['user'], true, 16, JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING);
        } catch (\JsonException $exception) {
            throw new ValidationException('invalid_user', 'Telegram user JSON is invalid');
        }
        if (!is_array($user) || !isset($user['id'])) {
            throw new ValidationException('invalid_user', 'Telegram user id is missing');
        }
        $userId = (string) $user['id'];
        if (!preg_match('/^[1-9]\\d{0,18}$/', $userId)) {
            throw new ValidationException('invalid_user', 'Telegram user id is invalid');
        }
        $user['id'] = $userId;

        return new ValidatedInitData($fields, $user, $authDate, hash('sha256', $rawInitData, true));
    }

    /** @return array<string,string> */
    private function strictParse(string $raw): array
    {
        $fields = [];
        foreach (explode('&', $raw) as $pair) {
            if ($pair === '' || !str_contains($pair, '=')) {
                throw new ValidationException('malformed', 'Malformed query-string pair');
            }
            [$encodedKey, $encodedValue] = explode('=', $pair, 2);
            if ($encodedKey === '' || preg_match('/%(?![0-9A-Fa-f]{2})/', $encodedKey . $encodedValue)) {
                throw new ValidationException('malformed', 'Malformed percent encoding');
            }
            $key = rawurldecode(str_replace('+', ' ', $encodedKey));
            $value = rawurldecode(str_replace('+', ' ', $encodedValue));
            if ($key === '' || preg_match('/[^A-Za-z0-9_]/', $key)) {
                throw new ValidationException('malformed', 'Unexpected initData key');
            }
            if (array_key_exists($key, $fields)) {
                throw new ValidationException('duplicate_field', "Duplicate initData field: {$key}");
            }
            $fields[$key] = $value;
        }
        return $fields;
    }
}
