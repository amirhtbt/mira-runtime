<?php
declare(strict_types=1);

namespace Tinv\Support;

final class Env
{
    public static function loadFileIfPresent(string $path): void
    {
        if (!is_file($path) || !is_readable($path)) {
            return;
        }

        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if ($key === '' || self::read($key) !== false) {
                continue;
            }
            if ((str_starts_with($value, '"') && str_ends_with($value, '"')) || (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                $value = substr($value, 1, -1);
            }

            // Shared hosting commonly disables putenv(). Keep file-loaded
            // runtime configuration in $_ENV and let read() fall back to it.
            $_ENV[$key] = $value;
        }
    }

    private static function read(string $key): string|false
    {
        $value = getenv($key);
        if ($value !== false) {
            return $value;
        }

        if (array_key_exists($key, $_ENV) && is_scalar($_ENV[$key])) {
            return (string) $_ENV[$key];
        }

        return false;
    }

    public static function required(string $key): string
    {
        $value = self::read($key);
        if ($value === false || trim($value) === '' || str_starts_with(trim($value), '<')) {
            throw new \RuntimeException("Missing required environment variable: {$key}");
        }
        return trim($value);
    }

    public static function string(string $key, string $default): string
    {
        $value = self::read($key);
        return $value === false || trim($value) === '' ? $default : trim($value);
    }

    public static function int(string $key, int $default): int
    {
        $value = self::read($key);
        if ($value === false || trim($value) === '') return $default;
        if (!preg_match('/^-?\\d+$/', trim($value))) {
            throw new \RuntimeException("Environment variable {$key} must be an integer");
        }
        return (int) $value;
    }
}
