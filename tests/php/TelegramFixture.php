<?php
declare(strict_types=1);

final class TelegramFixture
{
    /** @param array<string,string> $fields */
    public static function signed(array $fields, string $botToken): string
    {
        ksort($fields, SORT_STRING);
        $check = implode("\n", array_map(
            static fn(string $k, string $v): string => $k . '=' . $v,
            array_keys($fields),
            array_values($fields)
        ));
        $secret = hash_hmac('sha256', $botToken, 'WebAppData', true);
        $fields['hash'] = hash_hmac('sha256', $check, $secret);
        ksort($fields, SORT_STRING);
        return implode('&', array_map(
            static fn(string $k, string $v): string => rawurlencode($k) . '=' . rawurlencode($v),
            array_keys($fields),
            array_values($fields)
        ));
    }

    public static function user(string $id, int $authDate, string $botToken, string $firstName = 'Ali'): string
    {
        return self::signed([
            'auth_date' => (string) $authDate,
            'query_id' => 'AAE-unit-test-query',
            'user' => json_encode(['id' => $id, 'first_name' => $firstName, 'language_code' => 'fa'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        ], $botToken);
    }
}
