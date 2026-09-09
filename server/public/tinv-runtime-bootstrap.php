<?php
declare(strict_types=1);

const TINV_FLAT_RUNTIME_ROOT = __DIR__;

spl_autoload_register(static function (string $class): void {
    $prefix = 'Tinv\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $flat = str_replace('\\', '__', $relative);
    $path = TINV_FLAT_RUNTIME_ROOT . '/tinv-runtime-src-' . $flat . '.php';
    if (is_file($path)) {
        require $path;
    }
});

Tinv\Support\Env::loadFileIfPresent(TINV_FLAT_RUNTIME_ROOT . '/tinv-runtime.env');
