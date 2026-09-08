<?php
declare(strict_types=1);

require __DIR__ . '/../../server/bootstrap.php';
require __DIR__ . '/Test.php';
require __DIR__ . '/TelegramFixture.php';

use Tinv\Auth\AuthService;
use Tinv\Auth\InitDataValidator;
use Tinv\Auth\ReplayDetected;
use Tinv\Config;
use Tinv\Database;
use Tinv\Session\SessionService;

$config = Config::fromEnvironment();
$pdo = Database::connect($config);
$pdo->exec('DELETE FROM telegram_auth_replays');
$pdo->exec('DELETE FROM sessions');
$pdo->exec('DELETE FROM telegram_identities');
$pdo->exec('DELETE FROM businesses');
$pdo->exec('DELETE FROM users');

$validator = new InitDataValidator($config->telegramBotToken, $config->authMaxAgeSeconds, $config->authFutureSkewSeconds);
$sessions = new SessionService($pdo, $config->sessionPepper, 120, 600, 1);
$auth = new AuthService($pdo, $validator, $sessions, $config->authMaxAgeSeconds + $config->authFutureSkewSeconds);
$now = 1_800_000_000;

Test::run('auth creates internal user/business and session', function () use ($auth, $sessions, $config, $now): void {
    $raw = TelegramFixture::user('900000001', $now - 2, $config->telegramBotToken, 'Sara');
    $result = $auth->authenticateTelegram($raw, $now, 'integration-test');
    Test::assert($result->context->userId !== '900000001');
    Test::assert(strlen($result->context->userId) === 36);
    Test::assert(strlen($result->context->businessId) === 36);
    $context = $sessions->authenticate($result->sessionToken, $now + 1);
    Test::equals($result->context->userId, $context?->userId);
    Test::equals($result->context->businessId, $context?->businessId);
});

Test::run('same launch data cannot mint a second session', function () use ($auth, $config, $now): void {
    $raw = TelegramFixture::user('900000002', $now - 2, $config->telegramBotToken);
    $auth->authenticateTelegram($raw, $now);
    Test::throws(fn() => $auth->authenticateTelegram($raw, $now + 1), ReplayDetected::class);
});

Test::run('session renewal rotates token and revokes old token', function () use ($auth, $sessions, $config, $now): void {
    $raw = TelegramFixture::user('900000003', $now - 2, $config->telegramBotToken);
    $result = $auth->authenticateTelegram($raw, $now);
    $rotated = $sessions->rotate($result->sessionToken, $now + 10, 'integration-test');
    Test::assert($rotated !== null);
    Test::assert($rotated['token'] !== $result->sessionToken);
    Test::equals(null, $sessions->authenticate($result->sessionToken, $now + 11));
    Test::equals($result->context->userId, $sessions->authenticate($rotated['token'], $now + 11)?->userId);
});

Test::run('expired session is rejected', function () use ($auth, $sessions, $config, $now): void {
    $raw = TelegramFixture::user('900000004', $now - 2, $config->telegramBotToken);
    $result = $auth->authenticateTelegram($raw, $now);
    Test::equals(null, $sessions->authenticate($result->sessionToken, $now + 121));
});

Test::run('different Telegram identities never share internal tenant scope', function () use ($auth, $config, $now): void {
    $one = $auth->authenticateTelegram(TelegramFixture::user('900000005', $now - 2, $config->telegramBotToken), $now);
    $two = $auth->authenticateTelegram(TelegramFixture::user('900000006', $now - 2, $config->telegramBotToken), $now);
    Test::assert($one->context->userId !== $two->context->userId);
    Test::assert($one->context->businessId !== $two->context->businessId);
});
