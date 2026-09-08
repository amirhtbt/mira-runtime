<?php
declare(strict_types=1);

const TINV_SERVER_ROOT = __DIR__;
const TINV_PROJECT_ROOT = __DIR__ . '/..';

spl_autoload_register(static function (string $class): void {
    $prefix = 'Tinv\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $path = TINV_SERVER_ROOT . '/src/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

Tinv\Support\Env::loadFileIfPresent(TINV_PROJECT_ROOT . '/.env');
Tinv\Support\Env::loadFileIfPresent(TINV_SERVER_ROOT . '/.env');
