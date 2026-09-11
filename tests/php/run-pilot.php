<?php
declare(strict_types=1);

require __DIR__ . '/../../server/bootstrap.php';
require __DIR__ . '/Test.php';
require __DIR__ . '/TelegramFixture.php';

use Tinv\Auth\AuthService;
use Tinv\Auth\InitDataValidator;
use Tinv\Config;
use Tinv\Database;
use Tinv\Pilot\PilotService;
use Tinv\Pilot\PilotValidationException;
use Tinv\Sales\SalesDocumentService;
use Tinv\Session\SessionService;
use Tinv\Settings\SettingsRepository;

$config = Config::fromEnvironment(); $pdo = Database::connect($config); $now = time();
$validator = new InitDataValidator($config->telegramBotToken, $config->authMaxAgeSeconds, $config->authFutureSkewSeconds);
$sessions = new SessionService($pdo, $config->sessionPepper, 120, 600, 1);
$auth = new AuthService($pdo, $validator, $sessions, $config->authMaxAgeSeconds + $config->authFutureSkewSeconds);
$one = $auth->authenticateTelegram(TelegramFixture::user('909000001', $now - 2, $config->telegramBotToken, 'Pilot One'), $now);
$two = $auth->authenticateTelegram(TelegramFixture::user('909000002', $now - 2, $config->telegramBotToken, 'Pilot Two'), $now);
$pilot = new PilotService($pdo, $config->sessionPepper);
$sales = new SalesDocumentService($pdo, new SettingsRepository($pdo));

Test::run('G09 event schema rejects content and arbitrary telemetry', function () use ($pilot, $one, $now): void {
    $pilot->recordClient($one->context->userId, $one->context->businessId, ['event' => 'app_open', 'properties' => []], $now - 86400);
    $pilot->recordClient($one->context->userId, $one->context->businessId, ['event' => 'app_open', 'properties' => []], $now - 86400);
    Test::throws(fn() => $pilot->recordClient($one->context->userId, $one->context->businessId, ['event' => 'customer_viewed', 'properties' => []], $now), PilotValidationException::class, 'event_not_allowed');
    Test::throws(fn() => $pilot->recordClient($one->context->userId, $one->context->businessId, ['event' => 'template_selected', 'properties' => ['customerName' => 'نباید ذخیره شود']], $now), PilotValidationException::class, 'unknown_field');
    $count = $pdo->prepare("SELECT COUNT(*) FROM app_events WHERE business_id=? AND event_name='app_open'"); $count->execute([$one->context->businessId]);
    Test::equals('1', (string) $count->fetchColumn());
    Test::equals(false, $pilot->recordBestEffort($one->context->userId, $one->context->businessId, 'unknown_system_event'));
});

$issued = [];
Test::run('G09 feedback waits until value delivery and is tenant scoped', function () use ($pilot, $sales, $one, $two, &$issued): void {
    Test::equals(false, $pilot->feedbackStatus($one->context->userId, $one->context->businessId)['eligible']);
    for ($index = 0; $index < 3; $index++) {
        $draft = $sales->createDraft($one->context->businessId, ['documentType' => 'invoice', 'customer' => ['displayName' => 'Pilot customer', 'phone' => '0912555000' . $index], 'items' => [['title' => 'Pilot item', 'quantityMilli' => '1000', 'unitPriceBaseUnit' => '1000']]]);
        $issued[] = $sales->finalize($one->context->businessId, $draft['id'], true);
    }
    Test::equals(true, $pilot->feedbackStatus($one->context->userId, $one->context->businessId)['eligible']);
    Test::equals(false, $pilot->feedbackStatus($two->context->userId, $two->context->businessId)['eligible']);
    $saved = $pilot->submitFeedback($one->context->userId, $one->context->businessId, ['score' => 5, 'missingCategory' => 'templates', 'text' => 'قالب بیشتر لازم است']);
    Test::equals(true, $saved['submitted']);
    Test::throws(fn() => $pilot->submitFeedback($one->context->userId, $one->context->businessId, ['score' => 4, 'text' => 'again']), PilotValidationException::class, 'already_submitted');
});

Test::run('G09 metrics use authoritative outcomes and explicit conversion links', function () use ($pilot, $sales, $one, &$issued, $now): void {
    $pilot->record($one->context->userId, $one->context->businessId, 'app_open', [], 'daily:' . gmdate('Y-m-d'), $now - 120);
    foreach ($issued as $document) $pilot->record($one->context->userId, $one->context->businessId, 'invoice_completed', ['document_type' => 'invoice', 'is_official' => false], 'finalize:' . $document['id'], $now - 60);
    $proforma = $sales->createDraft($one->context->businessId, ['documentType' => 'proforma', 'customer' => ['displayName' => 'Conversion customer', 'phone' => '09126660000'], 'items' => [['title' => 'Conversion item', 'quantityMilli' => '1000', 'unitPriceBaseUnit' => '5000']]]);
    $proforma = $sales->finalize($one->context->businessId, $proforma['id']);
    $sales->recordPayment($one->context->businessId, $proforma['id'], ['amountBaseUnit' => '5000', 'idempotencyKey' => 'g09-full']);
    $invoice = $sales->convert($one->context->businessId, $proforma['id']);
    $sales->recordExport($one->context->businessId, $invoice['id'], ['format' => 'pdf', 'byteSize' => 1000]);
    $metrics = $pilot->metrics($one->context->businessId, $now + 1);
    Test::equals(1, $metrics['activated']);
    Test::equals(1, $metrics['retainedD1']);
    Test::equals(null, $metrics['retainedD7']);
    Test::assert($metrics['issuedDocuments30'] >= 5);
    Test::equals(1, $metrics['eligibleProformas30']);
    Test::equals(1, $metrics['explicitConversions30']);
    Test::equals(1.0, $metrics['conversionRate']);
    Test::assert($metrics['exportShareRate'] > 0);
});

Test::run('G09 stored analytics payload contains no document/customer/payment content', function () use ($pdo, $one): void {
    $statement = $pdo->prepare('SELECT GROUP_CONCAT(properties_json) FROM app_events WHERE business_id=?'); $statement->execute([$one->context->businessId]);
    $payload = (string) $statement->fetchColumn();
    foreach (['Pilot customer', '0912', 'Pilot item', 'قالب بیشتر لازم است'] as $forbidden) Test::assert(!str_contains($payload, $forbidden));
});
