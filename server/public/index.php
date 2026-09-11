<?php
declare(strict_types=1);

$runtimeBootstrap = __DIR__ . '/tinv-runtime-bootstrap.php';
$sourceBootstrap = __DIR__ . '/../bootstrap.php';
require is_file($runtimeBootstrap) ? $runtimeBootstrap : $sourceBootstrap;

use Tinv\Auth\AuthService;
use Tinv\Auth\InitDataValidator;
use Tinv\Auth\ReplayDetected;
use Tinv\Auth\ValidationException;
use Tinv\Config;
use Tinv\Database;
use Tinv\Http\Json;
use Tinv\Http\OriginGuard;
use Tinv\Session\SessionContext;
use Tinv\Session\SessionService;
use Tinv\Sales\SalesDocumentService;
use Tinv\Sales\SalesValidationException;
use Tinv\Sales\CustomerDirectory;
use Tinv\Settings\LogoService;
use Tinv\Settings\LogoValidationException;
use Tinv\Settings\SettingsRepository;
use Tinv\Settings\SettingsService;
use Tinv\Settings\SettingsValidationException;

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($method === 'GET' && $path === '/api/v1/health') {
    Json::ok(['service' => 'telegram-invoice-api', 'gate' => 'G04']);
}

try {
    $config = Config::fromEnvironment();
    $pdo = Database::connect($config);
    $sessions = new SessionService(
        $pdo,
        $config->sessionPepper,
        $config->sessionIdleTtlSeconds,
        $config->sessionAbsoluteTtlSeconds,
        $config->sessionTouchIntervalSeconds
    );
    $settingsService = new SettingsService(new SettingsRepository($pdo));
    $salesService = new SalesDocumentService($pdo, new SettingsRepository($pdo));
    $customers = new CustomerDirectory($pdo);
    $logoService = new LogoService($pdo);
    $officialLogoService = new LogoService($pdo, 'business_official_logo_assets');
    $originGuard = new OriginGuard($config->appOrigin);
    $cookieName = $config->isProductionLike() ? '__Host-tinv_session' : 'tinv_session';

    $setCookie = static function (string $token, int $expiresAt) use ($cookieName, $config): void {
        setcookie($cookieName, $token, [
            'expires' => $expiresAt,
            'path' => '/',
            'secure' => $config->isProductionLike(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    };
    $clearCookie = static function () use ($cookieName, $config): void {
        setcookie($cookieName, '', [
            'expires' => 1,
            'path' => '/',
            'secure' => $config->isProductionLike(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    };
    $sessionContext = static function () use ($sessions, $cookieName): SessionContext {
        $token = (string) ($_COOKIE[$cookieName] ?? '');
        $context = $sessions->authenticate($token);
        if (!$context) Json::error('unauthenticated', 'No active session', 401);
        return $context;
    };

    if ($method === 'GET' && $path === '/api/v1/session') {
        $context = $sessionContext();
        Json::ok(['userId' => $context->userId, 'businessId' => $context->businessId]);
    }

    if ($method === 'GET' && $path === '/api/v1/settings') {
        $context = $sessionContext();
        header('Cache-Control: private, no-store');
        $payload = $settingsService->get($context->businessId);
        $payload['logo'] = $logoService->metadata($context->businessId);
        $payload['officialLogo'] = $officialLogoService->metadata($context->businessId);
        Json::ok($payload);
    }

    if ($method === 'GET' && $path === '/api/v1/settings/logo') {
        $context = $sessionContext();
        $asset = $logoService->get($context->businessId);
        if ($asset === null) Json::error('logo_not_found', 'Business logo not found', 404);
        header('Cache-Control: private, no-store');
        header('Content-Type: ' . $asset['mimeType']);
        header('Content-Length: ' . (string) $asset['byteSize']);
        header('Content-Disposition: inline; filename="business-logo"');
        echo $asset['bytes'];
        exit;
    }

    if ($method === 'GET' && $path === '/api/v1/settings/official-logo') {
        $context = $sessionContext();
        $asset = $officialLogoService->get($context->businessId);
        if ($asset === null) Json::error('official_logo_not_found', 'Official company logo not found', 404);
        header('Cache-Control: private, no-store'); header('Content-Type: ' . $asset['mimeType']); header('Content-Length: ' . (string) $asset['byteSize']);
        header('Content-Disposition: inline; filename="official-company-logo"'); echo $asset['bytes']; exit;
    }

    if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        $originGuard->assertAllowed($_SERVER['HTTP_ORIGIN'] ?? null);
        if (($_SERVER['HTTP_X_TINV_REQUEST'] ?? '') !== 'miniapp') {
            Json::error('request_header_required', 'Missing Mini App request header', 400);
        }
    }

    if ($method === 'POST' && $path === '/api/v1/auth/telegram') {
        $body = Json::body();
        $initData = $body['initData'] ?? null;
        if (!is_string($initData)) Json::error('init_data_required', 'initData is required', 422);

        $validator = new InitDataValidator($config->telegramBotToken, $config->authMaxAgeSeconds, $config->authFutureSkewSeconds);
        $auth = new AuthService($pdo, $validator, $sessions, $config->authMaxAgeSeconds + $config->authFutureSkewSeconds);
        $result = $auth->authenticateTelegram($initData, null, (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
        $setCookie($result->sessionToken, $result->absoluteExpiresAt);
        Json::ok(['userId' => $result->context->userId, 'businessId' => $result->context->businessId], 201);
    }

    if ($method === 'POST' && $path === '/api/v1/auth/renew') {
        $oldToken = (string) ($_COOKIE[$cookieName] ?? '');
        $rotated = $sessions->rotate($oldToken, null, (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
        if (!$rotated) Json::error('unauthenticated', 'No active session', 401);
        $setCookie($rotated['token'], $rotated['absolute_expires_at']);
        Json::ok(['userId' => $rotated['context']->userId, 'businessId' => $rotated['context']->businessId]);
    }

    if ($method === 'POST' && $path === '/api/v1/auth/logout') {
        $sessions->revoke((string) ($_COOKIE[$cookieName] ?? ''));
        $clearCookie();
        Json::ok([]);
    }

    if ($method === 'PUT' && $path === '/api/v1/settings') {
        $context = $sessionContext();
        $result = $settingsService->update($context->businessId, Json::body());
        $result['logo'] = $logoService->metadata($context->businessId);
        $result['officialLogo'] = $officialLogoService->metadata($context->businessId);
        header('Cache-Control: private, no-store');
        Json::ok($result);
    }

    if ($method === 'POST' && $path === '/api/v1/settings/logo') {
        $context = $sessionContext();
        if (array_keys($_FILES) !== ['logo'] || $_POST !== []) {
            Json::error('logo_invalid_request', 'Only one logo file is accepted', 422);
        }
        $upload = $_FILES['logo'];
        if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_string($upload['tmp_name'] ?? null)) {
            Json::error('logo_upload_failed', 'Logo upload failed', 422);
        }
        $tmp = (string) $upload['tmp_name'];
        if (!is_uploaded_file($tmp)) Json::error('logo_upload_invalid', 'Logo upload invalid', 422);
        $bytes = file_get_contents($tmp);
        if ($bytes === false) Json::error('logo_upload_failed', 'Logo upload failed', 422);
        $meta = $logoService->save($context->businessId, $bytes);
        header('Cache-Control: private, no-store');
        Json::ok(['logo' => ['present' => true] + $meta], 201);
    }

    if ($method === 'DELETE' && $path === '/api/v1/settings/logo') {
        $context = $sessionContext();
        $logoService->delete($context->businessId);
        header('Cache-Control: private, no-store');
        Json::ok(['logo' => $logoService->metadata($context->businessId)]);
    }


    if ($method === 'POST' && $path === '/api/v1/settings/official-logo') {
        $context = $sessionContext();
        if (array_keys($_FILES) !== ['logo'] || $_POST !== []) Json::error('logo_invalid_request', 'Only one logo file is accepted', 422);
        $upload = $_FILES['logo'];
        if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_string($upload['tmp_name'] ?? null)) Json::error('logo_upload_failed', 'Logo upload failed', 422);
        $tmp = (string) $upload['tmp_name']; if (!is_uploaded_file($tmp)) Json::error('logo_upload_invalid', 'Logo upload invalid', 422);
        $bytes = file_get_contents($tmp); if ($bytes === false) Json::error('logo_upload_failed', 'Logo upload failed', 422);
        $meta = $officialLogoService->save($context->businessId, $bytes); header('Cache-Control: private, no-store');
        Json::ok(['officialLogo' => ['present' => true] + $meta], 201);
    }

    if ($method === 'DELETE' && $path === '/api/v1/settings/official-logo') {
        $context = $sessionContext(); $officialLogoService->delete($context->businessId); header('Cache-Control: private, no-store');
        Json::ok(['officialLogo' => $officialLogoService->metadata($context->businessId)]);
    }

    if ($method === 'GET' && $path === '/api/v1/documents') {
        $context = $sessionContext();
        header('Cache-Control: private, no-store');
        Json::ok(['documents' => $salesService->list($context->businessId)]);
    }

    if ($method === 'GET' && $path === '/api/v1/customers') {
        $context = $sessionContext();
        header('Cache-Control: private, no-store');
        $phone = (string) ($_GET['phone'] ?? '');
        $query = (string) ($_GET['query'] ?? '');
        Json::ok(['customers' => $phone !== '' ? $customers->search($context->businessId, $phone) : $customers->list($context->businessId, $query)]);
    }

    if ($method === 'POST' && $path === '/api/v1/customers') {
        $context = $sessionContext();
        Json::ok($customers->save($context->businessId, Json::body()), 201);
    }

    if ($method === 'PUT' && preg_match('#^/api/v1/customers/([0-9a-f-]{36})$#', $path, $match)) {
        $context = $sessionContext();
        Json::ok($customers->save($context->businessId, Json::body(), $match[1]));
    }

    if ($method === 'POST' && $path === '/api/v1/documents') {
        $context = $sessionContext();
        Json::ok($salesService->createDraft($context->businessId, Json::body()), 201);
    }

    if ($method === 'GET' && preg_match('#^/api/v1/documents/([0-9a-f-]{36})/logo$#', $path, $match)) {
        $context = $sessionContext();
        $asset = $salesService->getLogo($context->businessId, $match[1]);
        if ($asset === null) Json::error('document_logo_not_found', 'Document logo not found', 404);
        header('Cache-Control: private, no-store');
        header('Content-Type: ' . $asset['mimeType']);
        header('Content-Length: ' . (string) $asset['byteSize']);
        echo $asset['bytes'];
        exit;
    }

    if (preg_match('#^/api/v1/documents/([0-9a-f-]{36})$#', $path, $match)) {
        $context = $sessionContext();
        if ($method === 'GET') Json::ok($salesService->get($context->businessId, $match[1]));
        if ($method === 'PUT') Json::ok($salesService->updateDraft($context->businessId, $match[1], Json::body()));
        if ($method === 'DELETE') { $salesService->deleteDraft($context->businessId, $match[1]); Json::ok(['deleted' => true]); }
    }

    if ($method === 'POST' && preg_match('#^/api/v1/documents/([0-9a-f-]{36})/cancel$#', $path, $match)) {
        $context = $sessionContext(); Json::ok($salesService->cancel($context->businessId, $match[1], Json::body()));
    }

    if ($method === 'POST' && preg_match('#^/api/v1/documents/([0-9a-f-]{36})/revision$#', $path, $match)) {
        $context = $sessionContext(); Json::ok($salesService->revise($context->businessId, $match[1]), 201);
    }

    if ($method === 'POST' && preg_match('#^/api/v1/documents/([0-9a-f-]{36})/finalize$#', $path, $match)) {
        $context = $sessionContext(); $body = Json::body();
        Json::ok($salesService->finalize($context->businessId, $match[1], ($body['paidConfirmed'] ?? false) === true));
    }

    if ($method === 'POST' && preg_match('#^/api/v1/documents/([0-9a-f-]{36})/payments$#', $path, $match)) {
        $context = $sessionContext();
        Json::ok($salesService->recordPayment($context->businessId, $match[1], Json::body()), 201);
    }

    if ($method === 'POST' && preg_match('#^/api/v1/documents/([0-9a-f-]{36})/final-invoice$#', $path, $match)) {
        $context = $sessionContext();
        Json::ok($salesService->convert($context->businessId, $match[1]), 201);
    }

    if ($method === 'POST' && preg_match('#^/api/v1/documents/([0-9a-f-]{36})/exports$#', $path, $match)) {
        $context = $sessionContext();
        Json::ok($salesService->recordExport($context->businessId, $match[1], Json::body()), 201);
    }

    Json::error('not_found', 'Route not found', 404);
} catch (ValidationException $exception) {
    Json::error('telegram_' . $exception->reason, 'Telegram authentication rejected', 401);
} catch (ReplayDetected) {
    Json::error('telegram_replay', 'Telegram authentication data was already used', 409);
} catch (SettingsValidationException $exception) {
    Json::error('settings_invalid', $exception->reason, 422);
} catch (LogoValidationException $exception) {
    Json::error('logo_invalid', $exception->reason, 422);
} catch (SalesValidationException $exception) {
    Json::error('sales_invalid', $exception->reason, $exception->httpStatus);
} catch (\JsonException) {
    Json::error('invalid_json', 'Invalid JSON request body', 400);
} catch (\RuntimeException $exception) {
    if (str_starts_with($exception->getMessage(), 'origin_')) {
        Json::error('origin_rejected', 'Request origin rejected', 403);
    }
    if ($exception->getMessage() === 'request_body_invalid') {
        Json::error('request_body_invalid', 'Invalid request body', 400);
    }
    error_log('[tinv] runtime error: ' . $exception->getMessage());
    Json::error('server_configuration', 'Server configuration error', 500);
} catch (\Throwable $exception) {
    error_log('[tinv] unhandled: ' . get_class($exception) . ': ' . $exception->getMessage());
    Json::error('server_error', 'Unexpected server error', 500);
}
