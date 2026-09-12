<?php
declare(strict_types=1);

$runtimeBootstrap = __DIR__ . '/tinv-runtime-bootstrap.php';
$sourceBootstrap = __DIR__ . '/../bootstrap.php';
require is_file($runtimeBootstrap) ? $runtimeBootstrap : $sourceBootstrap;

use Tinv\Config;
use Tinv\Database;
use Tinv\Export\TemporaryExportFileService;
use Tinv\Http\Json;

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(404);
    exit;
}

try {
    $config = Config::fromEnvironment();
    $provided = (string) ($_SERVER['HTTP_X_TINV_CLEANUP_TOKEN'] ?? '');
    $expected = hash_hmac('sha256', 'g09-export-retention-sweep', $config->sessionPepper);
    if ($provided === '' || !hash_equals($expected, $provided)) {
        http_response_code(404);
        exit;
    }

    $pdo = Database::connect($config);
    $deleted = (new TemporaryExportFileService($pdo))->cleanupExpired();
    Json::ok(['deleted' => $deleted]);
} catch (Throwable) {
    Json::error('temporary_export_cleanup_failed', 'Cleanup failed', 500);
}
