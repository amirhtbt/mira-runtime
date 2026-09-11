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
        return;
    }

    // CI authenticated E2E runs the source checkout directly. Never allow this
    // fallback outside the explicitly disposable test environment; staging and
    // production continue to require the generated flat shared-host runtime.
    if (getenv('APP_ENV') === 'test') {
        $source = dirname(__DIR__) . '/src/' . str_replace('\\', '/', $relative) . '.php';
        if (is_file($source)) {
            require $source;
        }
    }
});

Tinv\Support\Env::loadFileIfPresent(TINV_FLAT_RUNTIME_ROOT . '/tinv-runtime.env');