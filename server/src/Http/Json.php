<?php
declare(strict_types=1);

namespace Tinv\Http;

final class Json
{
    /** @param array<string,mixed> $data */
    public static function ok(array $data = [], int $status = 200): never
    {
        self::send(['ok' => true, 'data' => $data], $status);
    }

    public static function error(string $code, string $message, int $status): never
    {
        self::send(['ok' => false, 'error' => ['code' => $code, 'message' => $message]], $status);
    }

    /** @param array<string,mixed> $payload */
    private static function send(array $payload, int $status): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        exit;
    }

    /** @return array<string,mixed> */
    public static function body(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || strlen($raw) > 65536) throw new \RuntimeException('request_body_invalid');
        $decoded = json_decode($raw === '' ? '{}' : $raw, true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($decoded)) throw new \RuntimeException('request_body_invalid');
        return $decoded;
    }
}
