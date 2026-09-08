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
            if ($key === '' || getenv($key) !== false) {
                continue;
            }
            if ((str_starts_with($value, '"') && str_ends_with($value, '"')) || (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                $value = substr($value, 1, -1);
            }
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }

    public static function required(string $key): string
    {
        $value = getenv($key);
        if ($value === false || trim($value) === '' || str_starts_with(trim($value), '<')) {
            throw new \RuntimeException("Missing required environment variable: {$key}");
        }
        return trim($value);
    }

    public static function string(string $key, string $default): string
    {
        $value = getenv($key);
        return $value === false || trim($value) === '' ? $default : trim($value);
    }

    public static function int(string $key, int $default): int
    {
        $value = getenv($key);
        if ($value === false || trim($value) === '') return $default;
        if (!preg_match('/^-?\\d+$/', trim($value))) {
            throw new \RuntimeException("Environment variable {$key} must be an integer");
        }
        return (int) $value;
    }
}
