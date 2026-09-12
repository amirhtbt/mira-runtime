<?php
declare(strict_types=1);

$runtimeBootstrap = __DIR__ . '/tinv-runtime-bootstrap.php';
$sourceBootstrap = __DIR__ . '/../bootstrap.php';
require is_file($runtimeBootstrap) ? $runtimeBootstrap : $sourceBootstrap;

use Tinv\Config;
use Tinv\Database;
use Tinv\Export\TemporaryExportFileService;
use Tinv\Http\Json;
use Tinv\Http\OriginGuard;
use Tinv\Http\RateLimiter;
use Tinv\Http\RateLimitExceeded;
use Tinv\Sales\SalesDocumentService;
use Tinv\Session\SessionService;
use Tinv\Settings\SettingsRepository;
use Tinv\Telegram\PreparedMessageService;

$incomingRequestId = (string) ($_SERVER['HTTP_X_REQUEST_ID'] ?? '');
$requestId = preg_match('/^[A-Za-z0-9._-]{8,64}$/', $incomingRequestId) ? $incomingRequestId : bin2hex(random_bytes(16));
header('X-Request-Id: ' . $requestId);
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: private, no-store');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

try {
    $config = Config::fromEnvironment();
    $pdo = Database::connect($config);
    $files = new TemporaryExportFileService($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $token = (string) ($_GET['token'] ?? '');
        $file = $files->fetch($token);
        if ($file === null) {
            Json::error('temporary_export_not_found', 'File is unavailable or expired', 404);
        }
        $asciiName = $file['mimeType'] === 'application/pdf' ? 'mira-document.pdf' : 'mira-document.png';
        header('Content-Type: ' . $file['mimeType']);
        header('Content-Length: ' . (string) $file['byteSize']);
        header('Content-Disposition: attachment; filename="' . $asciiName . '"; filename*=UTF-8\'\'' . rawurlencode($file['fileName']));
        echo $file['bytes'];
        exit;
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        Json::error('method_not_allowed', 'Method not allowed', 405);
    }

    (new OriginGuard($config->appOrigin))->assertAllowed($_SERVER['HTTP_ORIGIN'] ?? null);
    if (($_SERVER['HTTP_X_TINV_REQUEST'] ?? '') !== 'miniapp') {
        Json::error('request_header_required', 'Missing Mini App request header', 400);
    }

    $sessions = new SessionService(
        $pdo,
        $config->sessionPepper,
        $config->sessionIdleTtlSeconds,
        $config->sessionAbsoluteTtlSeconds,
        $config->sessionTouchIntervalSeconds
    );
    $cookieName = $config->isProductionLike() ? '__Host-tinv_session' : 'tinv_session';
    $context = $sessions->authenticate((string) ($_COOKIE[$cookieName] ?? ''));
    if ($context === null) {
        Json::error('unauthenticated', 'No active session', 401);
    }
    (new RateLimiter($pdo, $config->sessionPepper))->consume('business:' . $context->businessId, 'write', $config->writeRateLimitPerMinute);

    $documentId = trim((string) ($_POST['documentId'] ?? ''));
    $purpose = (string) ($_POST['purpose'] ?? 'download');
    $format = (string) ($_POST['format'] ?? '');
    $title = trim((string) ($_POST['title'] ?? 'سند فروش میرا'));
    if (!preg_match('/^[0-9a-f-]{36}$/D', $documentId) || !in_array($purpose, ['download', 'share'], true) || !in_array($format, ['pdf', 'png'], true)) {
        Json::error('temporary_export_request_invalid', 'Export request is invalid', 422);
    }
    if ($purpose === 'share' && $format !== 'pdf') {
        Json::error('share_format_invalid', 'Only PDF can be shared', 422);
    }
    if (array_keys($_FILES) !== ['file']) {
        Json::error('temporary_export_file_required', 'One export file is required', 422);
    }
    $upload = $_FILES['file'];
    if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_string($upload['tmp_name'] ?? null)) {
        Json::error('temporary_export_upload_failed', 'Export upload failed', 422);
    }
    $tmp = (string) $upload['tmp_name'];
    if (!is_uploaded_file($tmp)) {
        Json::error('temporary_export_upload_invalid', 'Export upload is invalid', 422);
    }
    $bytes = file_get_contents($tmp);
    if ($bytes === false) {
        Json::error('temporary_export_upload_failed', 'Export upload failed', 422);
    }
    $expectedMime = $format === 'pdf' ? 'application/pdf' : 'image/png';
    $claimedMime = (string) ($upload['type'] ?? '');
    $fileName = (string) ($upload['name'] ?? ('mira-document.' . $format));
    if ($claimedMime !== $expectedMime) {
        Json::error('temporary_export_type_invalid', 'Export type is invalid', 422);
    }

    $sales = new SalesDocumentService($pdo, new SettingsRepository($pdo));
    $sales->get($context->businessId, $documentId, false);
    $staged = $files->store($context->businessId, $documentId, $bytes, $expectedMime, $fileName);
    $url = $config->appOrigin . '/export-file/' . rawurlencode($staged['token']) . '/' . rawurlencode($staged['fileName']);
    $response = [
        'url' => $url,
        'fileName' => $staged['fileName'],
        'byteSize' => $staged['byteSize'],
        'expiresAt' => $staged['expiresAt'],
        'preparedMessageId' => null,
    ];

    if ($purpose === 'share') {
        try {
            $identity = $pdo->prepare('SELECT telegram_user_id FROM telegram_identities WHERE user_id=? LIMIT 1');
            $identity->execute([$context->userId]);
            $telegramUserId = $identity->fetchColumn();
            if (!is_string($telegramUserId) && !is_int($telegramUserId)) {
                throw new RuntimeException('telegram_identity_missing');
            }
            $prepared = (new PreparedMessageService($config->telegramBotToken))->preparePdf((string) $telegramUserId, $url, $title);
            $response['preparedMessageId'] = $prepared['id'];
            $response['expiresAt'] = $files->extendExpiry($staged['token'], $prepared['expirationDate']);
        } catch (Throwable) {
            $files->delete($staged['token']);
            Json::error('share_prepare_failed', 'Telegram share preparation failed', 502);
        }
    }

    Json::ok($response, 201);
} catch (RateLimitExceeded $exception) {
    header('Retry-After: ' . (string) $exception->retryAfterSeconds);
    Json::error('rate_limited', 'Too many requests', 429);
} catch (RuntimeException $exception) {
    $code = $exception->getMessage();
    if (in_array($code, ['origin_missing', 'origin_rejected'], true)) {
        Json::error('origin_rejected', 'Request origin rejected', 403);
    }
    if (str_starts_with($code, 'temporary_export_')) {
        Json::error($code, 'Export delivery request is invalid', 422);
    }
    Json::error('export_delivery_failed', 'Export delivery failed', 500);
} catch (Throwable) {
    Json::error('export_delivery_failed', 'Export delivery failed', 500);
}
