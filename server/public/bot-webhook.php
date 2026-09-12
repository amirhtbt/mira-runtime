<?php
declare(strict_types=1);

$runtimeBootstrap = __DIR__ . '/tinv-runtime-bootstrap.php';
$sourceBootstrap = __DIR__ . '/../bootstrap.php';
require is_file($runtimeBootstrap) ? $runtimeBootstrap : $sourceBootstrap;

use Tinv\Support\Env;
use Tinv\Telegram\WelcomeMessage;
use Tinv\Telegram\OwnerLaunchMessage;

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    exit;
}

try {
    $expectedSecret = hash_hmac('sha256', 'tinv-welcome-webhook-v1', Env::required('SESSION_PEPPER'));
    $origin = Env::required('APP_ORIGIN');
} catch (Throwable) {
    http_response_code(503);
    exit;
}

$receivedSecret = (string) ($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '');
if (!hash_equals($expectedSecret, $receivedSecret)) {
    http_response_code(403);
    exit;
}

$raw = file_get_contents('php://input', false, null, 0, 8193);
if (!is_string($raw) || strlen($raw) > 8192) {
    http_response_code(413);
    exit;
}
$update = json_decode($raw, true, 16);
if (!is_array($update)) {
    http_response_code(400);
    exit;
}

$response = WelcomeMessage::forUpdate($update, $origin)
    ?? OwnerLaunchMessage::forUpdate($update, $origin, Env::string('OWNER_TELEGRAM_USER_ID', ''));
if ($response === null) {
    http_response_code(204);
    exit;
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
