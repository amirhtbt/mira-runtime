<?php
declare(strict_types=1);

require __DIR__ . '/../../server/bootstrap.php';
require __DIR__ . '/Test.php';
require __DIR__ . '/TelegramFixture.php';

use Tinv\Auth\InitDataValidator;
use Tinv\Auth\ValidationException;
use Tinv\Http\OriginGuard;
use Tinv\Support\Env;
use Tinv\Support\Uuid;

$token = 'unit-test-token-not-a-real-secret';
$now = 1_800_000_000;
$validator = new InitDataValidator($token, 300, 30);

Test::run('fixed HMAC vector matches independent implementation', function () use ($validator): void {
    $vectorToken = 'fixed-vector-token:ABCDEF0123456789_not_real';
    $raw = 'auth_date=1800000000&hash=befa3c60e54b1524b9693c85d5382226c69a7855ca9658fc092c83188a036395&query_id=AAE-fixed-vector&user=%7B%22id%22%3A777000111%2C%22first_name%22%3A%22%D8%B9%D9%84%DB%8C%22%2C%22language_code%22%3A%22fa%22%7D';
    $fixed = new InitDataValidator($vectorToken, 300, 30);
    $validated = $fixed->validate($raw, 1_800_000_010);
    Test::equals('777000111', $validated->user['id']);
});

Test::run('valid initData', function () use ($validator, $token, $now): void {
    $raw = TelegramFixture::user('777000111', $now - 10, $token);
    $validated = $validator->validate($raw, $now);
    Test::equals('777000111', $validated->user['id']);
});

Test::run('tampered signed user is rejected', function () use ($validator, $token, $now): void {
    $raw = TelegramFixture::user('777000111', $now - 10, $token);
    $tampered = str_replace('777000111', '777000112', rawurldecode($raw));
    Test::throws(fn() => $validator->validate($tampered, $now), ValidationException::class, 'invalid_hash');
});

Test::run('expired auth is rejected', function () use ($validator, $token, $now): void {
    $raw = TelegramFixture::user('777000111', $now - 301, $token);
    Test::throws(fn() => $validator->validate($raw, $now), ValidationException::class, 'expired');
});

Test::run('future auth is rejected', function () use ($validator, $token, $now): void {
    $raw = TelegramFixture::user('777000111', $now + 31, $token);
    Test::throws(fn() => $validator->validate($raw, $now), ValidationException::class, 'future_auth_date');
});

Test::run('duplicate security field is rejected', function () use ($validator, $token, $now): void {
    $raw = TelegramFixture::user('777000111', $now - 1, $token) . '&user=%7B%22id%22%3A1%7D';
    Test::throws(fn() => $validator->validate($raw, $now), ValidationException::class, 'duplicate_field');
});

Test::run('malformed percent encoding is rejected', function () use ($validator, $now): void {
    Test::throws(fn() => $validator->validate('auth_date=1&user=%ZZ&hash=' . str_repeat('a', 64), $now), ValidationException::class, 'malformed');
});

Test::run('origin isolation is exact', function (): void {
    $guard = new OriginGuard('https://app.example.com');
    $guard->assertAllowed('https://app.example.com');
    Test::throws(fn() => $guard->assertAllowed('https://evil.example.com'), RuntimeException::class);
    Test::throws(fn() => $guard->assertAllowed(null), RuntimeException::class);
});

Test::run('internal UUID is independent and RFC4122-shaped', function (): void {
    $uuid = Uuid::v4();
    Test::assert((bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $uuid));
    Test::assert($uuid !== '777000111');
});

Test::run('env file loader works without putenv dependency', function (): void {
    $key = 'TINV_FILE_ENV_' . bin2hex(random_bytes(8));
    $path = tempnam(sys_get_temp_dir(), 'tinv-env-');
    if ($path === false) {
        throw new RuntimeException('Could not create temp env file');
    }

    try {
        unset($_ENV[$key]);
        file_put_contents($path, $key . "=loaded-from-file\n");
        Env::loadFileIfPresent($path);
        Test::equals('loaded-from-file', Env::required($key));
    } finally {
        unset($_ENV[$key]);
        @unlink($path);
    }
});
