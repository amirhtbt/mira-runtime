<?php
declare(strict_types=1);

require __DIR__ . '/../../server/bootstrap.php';
require __DIR__ . '/Test.php';
require __DIR__ . '/TelegramFixture.php';

use Tinv\Auth\AuthService;
use Tinv\Auth\InitDataValidator;
use Tinv\Config;
use Tinv\Database;
use Tinv\Session\SessionService;
use Tinv\Settings\DocumentSettingsSnapshot;
use Tinv\Settings\LogoService;
use Tinv\Settings\LogoValidationException;
use Tinv\Settings\SettingsRepository;
use Tinv\Settings\SettingsSchema;
use Tinv\Settings\SettingsService;
use Tinv\Settings\SettingsValidationException;

$config = Config::fromEnvironment();
$pdo = Database::connect($config);
$validator = new InitDataValidator($config->telegramBotToken, $config->authMaxAgeSeconds, $config->authFutureSkewSeconds);
$sessions = new SessionService($pdo, $config->sessionPepper, 120, 600, 1);
$auth = new AuthService($pdo, $validator, $sessions, $config->authMaxAgeSeconds + $config->authFutureSkewSeconds);
$now = 1_800_010_000;
$one = $auth->authenticateTelegram(TelegramFixture::user('901000001', $now - 2, $config->telegramBotToken, 'فروشنده Mira'), $now);
$two = $auth->authenticateTelegram(TelegramFixture::user('901000002', $now - 2, $config->telegramBotToken, 'Seller Two'), $now);
$service = new SettingsService(new SettingsRepository($pdo));
$logo = new LogoService($pdo);

Test::run('G03 safe defaults require no advanced setup', function () use ($service, $one): void {
    $result = $service->get($one->context->businessId);
    Test::equals(0, $result['version']);
    Test::equals('تومان', $result['settings']['presentation']['currencyUnit'] === 'toman' ? 'تومان' : '');
    Test::equals('jalali', $result['settings']['document']['calendar']);
    Test::equals('persian', $result['settings']['document']['digits']);
    Test::equals('پیش‌فاکتور', $result['settings']['document']['proformaLabel']);
    Test::equals('فاکتور فروش', $result['settings']['document']['invoiceLabel']);
    Test::equals(false, $result['settings']['financial']['taxEnabled']);
});

Test::run('G03 persists mixed Persian Latin seller payment and presentation settings', function () use ($service, $one, $now): void {
    $saved = $service->update($one->context->businessId, [
        'seller' => [
            'businessName' => 'فروشگاه Mira 24',
            'displayName' => 'میرا / Mira',
            'phone' => '۰۹۱۲ ۱۲۳ ۴۵۶۷',
            'telegramUsername' => '@mira_test',
            'address' => 'تهران، واحد A-12',
            'showAddress' => true,
        ],
        'payment' => [
            'cardNumber' => '۱۱۱۱-۲۲۲۲-۳۳۳۳-۴۴۴۴',
            'accountNumber' => '۱۲۳۴۵۶۷۸',
            'sheba' => 'IR111111111111111111111111',
            'bankName' => 'بانک Test',
            'accountHolder' => 'Mira میرا',
            'instructions' => 'پس از واریز، رسید را ارسال کنید. Ref A12',
        ],
        'document' => ['proformaPrefix' => 'PF-A', 'invoicePrefix' => 'INV-A', 'validityDays' => 14],
        'presentation' => ['currencyUnit' => 'rial', 'thousandsSeparator' => true],
        'text' => ['footer' => 'سپاس از خرید شما / Thank you'],
    ], $now + 1);
    Test::equals(1, $saved['version']);
    Test::equals('فروشگاه Mira 24', $saved['settings']['seller']['businessName']);
    Test::equals('0912 123 4567', $saved['settings']['seller']['phone']);
    Test::equals('mira_test', $saved['settings']['seller']['telegramUsername']);
    Test::equals('1111222233334444', $saved['settings']['payment']['cardNumber']);
    Test::equals('IR111111111111111111111111', $saved['settings']['payment']['sheba']);
    Test::equals('rial', $saved['settings']['presentation']['currencyUnit']);

    $reloaded = (new SettingsService(new SettingsRepository($GLOBALS['pdo'])))->get($one->context->businessId);
    Test::equals('فروشگاه Mira 24', $reloaded['settings']['seller']['businessName']);
    Test::equals('rial', $reloaded['settings']['presentation']['currencyUnit']);
});

Test::run('G03 partial updates preserve missing optional defaults and prior values', function () use ($service, $one, $now): void {
    $saved = $service->update($one->context->businessId, ['seller' => ['subtitle' => 'Custom B2B']], $now + 2);
    Test::equals('Custom B2B', $saved['settings']['seller']['subtitle']);
    Test::equals('فروشگاه Mira 24', $saved['settings']['seller']['businessName']);
    Test::equals('', $saved['settings']['seller']['sellerName']);
    Test::equals(2, $saved['version']);
});

Test::run('G03 rejects mass assignment HTML bidi controls invalid fields and oversized values', function () use ($service, $one): void {
    Test::throws(fn() => $service->update($one->context->businessId, ['businessId' => 'attacker']), SettingsValidationException::class, 'root_unknown_field');
    Test::throws(fn() => $service->update($one->context->businessId, ['seller' => ['businessName' => '<script>alert(1)</script>']]), SettingsValidationException::class, 'seller_businessName_html_rejected');
    Test::throws(fn() => $service->update($one->context->businessId, ['seller' => ['businessName' => "Mira\u{202E}evil"]]), SettingsValidationException::class, 'seller_businessName_bidi_control_rejected');
    Test::throws(fn() => $service->update($one->context->businessId, ['document' => ['validityDays' => 999]]), SettingsValidationException::class, 'document_validityDays_out_of_range');
    Test::throws(fn() => $service->update($one->context->businessId, ['text' => ['footer' => str_repeat('الف', 700)]]), SettingsValidationException::class, 'text_footer_too_long');
});

Test::run('G03 business scope keeps tenant settings isolated', function () use ($service, $one, $two, $now): void {
    $service->update($two->context->businessId, ['seller' => ['businessName' => 'Second Business']], $now + 3);
    Test::equals('فروشگاه Mira 24', $service->get($one->context->businessId)['settings']['seller']['businessName']);
    Test::equals('Second Business', $service->get($two->context->businessId)['settings']['seller']['businessName']);
    Test::assert($one->context->businessId !== $two->context->businessId);
});

Test::run('G03 money settings remain presentation/config strings with no float conversion', function () use ($service, $one, $now): void {
    $saved = $service->update($one->context->businessId, [
        'presentation' => ['currencyUnit' => 'toman'],
        'financial' => [
            'discount' => ['kind' => 'fixed', 'amountBaseUnit' => '123456789012345', 'percentBasisPoints' => 0],
            'shippingAmountBaseUnit' => '250000',
            'serviceFeeAmountBaseUnit' => '100000',
            'customAdjustments' => [['label' => 'بسته‌بندی', 'direction' => 'surcharge', 'amountBaseUnit' => '75000']],
        ],
    ], $now + 4);
    Test::equals('123456789012345', $saved['settings']['financial']['discount']['amountBaseUnit']);
    Test::equals('250000', $saved['settings']['financial']['shippingAmountBaseUnit']);
    Test::equals('toman', $saved['settings']['presentation']['currencyUnit']);
});

Test::run('G03 per-document override contract cannot override seller or payment identity', function () use ($service, $one): void {
    $global = $service->get($one->context->businessId)['settings'];
    $merged = SettingsSchema::mergeForDocument($global, [
        'document' => ['proformaLabel' => 'پیشنهاد ویژه'],
        'presentation' => ['digits' => 'latin'] ?? [],
        'text' => ['sellerNote' => 'مختص این سند'],
    ]);
    Test::equals('پیشنهاد ویژه', $merged['document']['proformaLabel']);
    Test::equals('مختص این سند', $merged['text']['sellerNote']);
    Test::equals($global['seller']['businessName'], $merged['seller']['businessName']);
    Test::throws(fn() => SettingsSchema::mergeForDocument($global, ['seller' => ['businessName' => 'tamper']]), SettingsValidationException::class, 'document_override_unknown_field');
});

Test::run('G03 finalized settings snapshot stays immutable after global settings change', function () use ($service, $one, $now): void {
    $global = $service->get($one->context->businessId)['settings'];
    $snapshotJson = DocumentSettingsSnapshot::toJson($global, ['text' => ['footer' => 'نسخه نهایی A']]);
    $service->update($one->context->businessId, ['seller' => ['businessName' => 'نام جدید بعدی'], 'text' => ['footer' => 'نسخه جدید']], $now + 5);
    $snapshot = json_decode($snapshotJson, true, 16, JSON_THROW_ON_ERROR);
    Test::equals('فروشگاه Mira 24', $snapshot['settings']['seller']['businessName']);
    Test::equals('نسخه نهایی A', $snapshot['settings']['text']['footer']);
    Test::equals('نام جدید بعدی', $service->get($one->context->businessId)['settings']['seller']['businessName']);
});

Test::run('G03 logo validation is raster content based size bounded and business scoped', function () use ($logo, $one, $two, $now): void {
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
    Test::assert(is_string($png));
    $saved = $logo->save($one->context->businessId, $png, $now + 6);
    Test::equals('image/png', $saved['mimeType']);
    Test::equals(1, $saved['width']);
    Test::equals(true, $logo->metadata($one->context->businessId)['present']);
    Test::equals(false, $logo->metadata($two->context->businessId)['present']);
    Test::throws(fn() => LogoService::validateBytes('<svg><script>alert(1)</script></svg>'), LogoValidationException::class);
    Test::throws(fn() => LogoService::validateBytes(str_repeat('x', LogoService::MAX_BYTES + 1)), LogoValidationException::class, 'too_large');
});
