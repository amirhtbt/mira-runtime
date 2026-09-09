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
use Tinv\Session\SessionService;

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($method === 'GET' && $path === '/api/v1/health') {
    Json::ok(['service' => 'telegram-invoice-api', 'gate' => 'G01']);
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

    if ($method === 'GET' && $path === '/api/v1/session') {
        $token = (string) ($_COOKIE[$cookieName] ?? '');
        $context = $sessions->authenticate($token);
        if (!$context) Json::error('unauthenticated', 'No active session', 401);
        Json::ok(['userId' => $context->userId, 'businessId' => $context->businessId]);
    }

    if ($method === 'POST') {
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

    Json::error('not_found', 'Route not found', 404);
} catch (ValidationException $exception) {
    Json::error('telegram_' . $exception->reason, 'Telegram authentication rejected', 401);
} catch (ReplayDetected) {
    Json::error('telegram_replay', 'Telegram authentication data was already used', 409);
} catch (\JsonException) {
    Json::error('invalid_json', 'Invalid JSON request body', 400);
} catch (\RuntimeException $exception) {
    if (str_starts_with($exception->getMessage(), 'origin_')) {
        Json::error('origin_rejected', 'Request origin rejected', 403);
    }
    error_log('[tinv] runtime error: ' . $exception->getMessage());
    Json::error('server_configuration', 'Server configuration error', 500);
} catch (\Throwable $exception) {
    error_log('[tinv] unhandled: ' . get_class($exception) . ': ' . $exception->getMessage());
    Json::error('server_error', 'Unexpected server error', 500);
}
