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
use Tinv\Http\RateLimiter;
use Tinv\Http\RateLimitExceeded;

$config = Config::fromEnvironment();
$pdo = Database::connect($config);
$pdo->exec('DELETE FROM rate_limit_buckets');
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

Test::run('session renewal never extends original absolute lifetime', function () use ($auth, $sessions, $config, $now): void {
    $raw = TelegramFixture::user('900000007', $now - 2, $config->telegramBotToken);
    $result = $auth->authenticateTelegram($raw, $now);
    $rotated = $sessions->rotate($result->sessionToken, $now + 100, 'integration-test');
    Test::assert($rotated !== null);
    Test::equals($result->absoluteExpiresAt, $rotated['absolute_expires_at']);
    Test::equals(null, $sessions->authenticate($rotated['token'], $now + 600));
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

Test::run('a session is accepted only for its bound Telegram identity', function () use ($auth, $sessions, $config, $now): void {
    $one = $auth->authenticateTelegram(TelegramFixture::user('900000008', $now - 2, $config->telegramBotToken), $now);
    $two = $auth->authenticateTelegram(TelegramFixture::user('900000009', $now - 2, $config->telegramBotToken), $now);
    Test::assert($sessions->belongsToTelegramIdentity($one->context, '900000008'));
    Test::assert(!$sessions->belongsToTelegramIdentity($one->context, '900000009'));
    Test::assert($sessions->belongsToTelegramIdentity($two->context, '900000009'));
    Test::assert(!$sessions->belongsToTelegramIdentity($two->context, '900000008'));
});

Test::run('G08 rate limiter is atomic, resettable and stores no raw scope', function () use ($pdo, $config, $now): void {
    $limiter = new RateLimiter($pdo, $config->sessionPepper);
    $scope = 'auth-ip:203.0.113.42';
    $limiter->consume($scope, 'auth_test', 2, 60, $now);
    $limiter->consume($scope, 'auth_test', 2, 60, $now + 1);
    Test::throws(fn() => $limiter->consume($scope, 'auth_test', 2, 60, $now + 2), RateLimitExceeded::class);
    $stored = $pdo->query("SELECT scope_hash FROM rate_limit_buckets WHERE action_key='auth_test'")->fetchColumn();
    Test::assert(is_string($stored) && strlen($stored) === 64 && $stored !== $scope);
    $limiter->consume($scope, 'auth_test', 2, 60, $now + 61);
});

require __DIR__ . '/ExportDeliveryChecks.php';

Test::run('mobile sms challenge expires, limits requests and guesses, and consumes a correct code once', function () use ($pdo, $now): void {
    $pdo->exec('DELETE FROM mobile_sms_challenges');
    $outbox = [];
    $service = new \Tinv\Auth\MobileSmsChallengeService(
        $pdo, str_repeat('test-secret-', 4),
        static function (string $phone, string $code) use (&$outbox): void { $outbox[] = [$phone, $code]; },
    );
    $phone = '09121234567';
    $id = $service->request('+۹۸ ۹۱۲ ۱۲۳ ۴۵۶۷', $now);
    Test::equals($phone, $outbox[0][0]);
    Test::assert(preg_match('/^[0-9]{4}$/D', $outbox[0][1]) === 1);
    Test::throws(fn() => $service->request($phone, $now + 59), DomainException::class);
    Test::equals(null, $service->consume('09121234568', $id, $outbox[0][1], $now + 1));
    Test::equals($phone, $service->consume($phone, $id, $outbox[0][1], $now + 1));
    Test::equals(null, $service->consume($phone, $id, $outbox[0][1], $now + 2));

    $id = $service->request($phone, $now + 60);
    for ($attempt = 0; $attempt < 5; $attempt++) {
        Test::equals(null, $service->consume($phone, $id, 'wrong', $now + 61));
    }
    Test::equals(null, $service->consume($phone, $id, $outbox[1][1], $now + 62));

    $id = $service->request($phone, $now + 120);
    Test::equals(null, $service->consume($phone, $id, $outbox[2][1], $now + 420));
    $service->request($phone, $now + 180);
    $service->request($phone, $now + 240);
    Test::throws(fn() => $service->request($phone, $now + 300), DomainException::class);
    $service->request($phone, $now + 86400);
    Test::equals(6, count($outbox));
});

Test::run('mobile SMS login issues a session for one stable business after each verified challenge', function () use ($pdo, $sessions, $now): void {
    $outbox = [];
    $secret = str_repeat('second-test-secret-', 3);
    $phone = '09121234569';
    $challenges = new \Tinv\Auth\MobileSmsChallengeService(
        $pdo, $secret,
        static function (string $phone, string $code) use (&$outbox): void { $outbox[] = $code; },
    );
    $auth = new \Tinv\Auth\MobileSmsAuthService($pdo, $challenges, $sessions, $secret);
    $id = $challenges->request($phone, $now);
    Test::equals(null, $auth->verify($phone, $id, 'wrong', $now + 1));
    $first = $auth->verify($phone, $id, $outbox[0], $now + 2);
    Test::assert($first !== null);
    Test::equals($first->context->businessId, $sessions->authenticate($first->sessionToken, $now + 3)?->businessId);
    Test::equals(null, $auth->verify($phone, $id, $outbox[0], $now + 4));

    $second = $auth->verify($phone, $challenges->request($phone, $now + 60), $outbox[1], $now + 61);
    Test::equals($first->context->userId, $second?->context->userId);
    Test::equals($first->context->businessId, $second?->context->businessId);
    Test::assert($first->sessionToken !== $second?->sessionToken);
});

Test::run('Telegram linking requires the verified target number and retains the existing Telegram business', function () use ($pdo, $auth, $sessions, $config, $now): void {
    $telegram = $auth->authenticateTelegram(TelegramFixture::user('900009916', $now, $config->telegramBotToken), $now);
    $secret = str_repeat('link-test-secret-', 3);
    $phone = '09121234570';
    $wrongPhone = '09121234571';
    $outbox = [];
    $challenges = new \Tinv\Auth\MobileSmsChallengeService(
        $pdo, $secret, static function (string $phone, string $code) use (&$outbox): void { $outbox[$phone] = $code; },
    );
    $links = new \Tinv\Auth\MobileTelegramLink($pdo, $secret);
    $mobile = new \Tinv\Auth\MobileSmsAuthService($pdo, $challenges, $sessions, $secret);
    $ticket = $links->issue($telegram->context, $phone, $now);
    $wrongId = $challenges->request($wrongPhone, $now);
    Test::throws(fn() => $mobile->verify($wrongPhone, $wrongId, $outbox[$wrongPhone], $now + 1, '', $ticket), DomainException::class);

    $id = $challenges->request($phone, $now);
    $joined = $mobile->verify($phone, $id, $outbox[$phone], $now + 1, '', $ticket);
    Test::equals($telegram->context->businessId, $joined?->context->businessId);
    Test::equals($telegram->context->userId, $joined?->context->userId);

    $id = $challenges->request($phone, $now + 60);
    Test::throws(fn() => $mobile->verify($phone, $id, $outbox[$phone], $now + 61, '', $ticket), DomainException::class);
    $id = $challenges->request($phone, $now + 120);
    $again = $mobile->verify($phone, $id, $outbox[$phone], $now + 121);
    Test::equals($telegram->context->businessId, $again?->context->businessId);

    $id = $challenges->request($wrongPhone, $now + 60);
    $independent = $mobile->verify($wrongPhone, $id, $outbox[$wrongPhone], $now + 61);
    $conflict = $links->issue($telegram->context, $wrongPhone, $now + 65);
    $id = $challenges->request($wrongPhone, $now + 120);
    Test::throws(fn() => $mobile->verify($wrongPhone, $id, $outbox[$wrongPhone], $now + 121, '', $conflict), DomainException::class);
    $id = $challenges->request($wrongPhone, $now + 180);
    $unchanged = $mobile->verify($wrongPhone, $id, $outbox[$wrongPhone], $now + 181);
    Test::assert($independent !== null && $independent->context->businessId !== $telegram->context->businessId);
    Test::equals($independent->context->businessId, $unchanged?->context->businessId);
});
