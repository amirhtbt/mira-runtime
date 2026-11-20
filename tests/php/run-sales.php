<?php
declare(strict_types=1);

require __DIR__ . '/../../server/bootstrap.php';
require __DIR__ . '/Test.php';
require __DIR__ . '/TelegramFixture.php';

use Tinv\Auth\AuthService;
use Tinv\Auth\InitDataValidator;
use Tinv\Config;
use Tinv\Database;
use Tinv\Sales\Money;
use Tinv\Sales\SalesDocumentService;
use Tinv\Sales\SalesValidationException;
use Tinv\Sales\CustomerDirectory;
use Tinv\Sales\DocumentHistoryService;
use Tinv\Sales\JalaliDate;
use Tinv\Session\SessionService;
use Tinv\Settings\SettingsRepository;
use Tinv\Settings\SettingsService;

$config=Config::fromEnvironment(); $pdo=Database::connect($config);
$validator=new InitDataValidator($config->telegramBotToken,$config->authMaxAgeSeconds,$config->authFutureSkewSeconds);
$sessions=new SessionService($pdo,$config->sessionPepper,120,600,1);
$auth=new AuthService($pdo,$validator,$sessions,$config->authMaxAgeSeconds+$config->authFutureSkewSeconds);
$now=1_800_020_000;
$one=$auth->authenticateTelegram(TelegramFixture::user('902000001',$now-2,$config->telegramBotToken,'فروشنده G04'),$now);
$two=$auth->authenticateTelegram(TelegramFixture::user('902000002',$now-2,$config->telegramBotToken,'Tenant Two'),$now);
$settings=new SettingsService(new SettingsRepository($pdo));
$settings->update($one->context->businessId,['seller'=>['businessName'=>'میرا اصلی'],'document'=>['proformaPrefix'=>'PF','invoicePrefix'=>'INV'],'presentation'=>['currencyUnit'=>'rial']],$now);
$service=new SalesDocumentService($pdo,new SettingsRepository($pdo));
$history=new DocumentHistoryService($pdo,$service);

Test::run('G04 integer-only deterministic money calculation',function():void{
    $result=Money::calculate([['title'=>'خدمت','quantityMilli'=>'1500','unitPriceBaseUnit'=>'10000000']],500000,100000);
    Test::equals(15000000,$result['subtotal']); Test::equals(14600000,$result['total']);
    Test::throws(fn()=>Money::amount('1.5','amount'),SalesValidationException::class,'amount_invalid');
});

$moneyFixtures = json_decode(file_get_contents(__DIR__ . '/../fixtures/offline-sale-money.json'), true, 32, JSON_THROW_ON_ERROR);
foreach ($moneyFixtures as $fixture) {
    Test::run('Offline money reference: ' . $fixture['name'], function () use ($fixture): void {
        $actual = Money::calculate($fixture['items'], 0, 0, $fixture['taxRateBasisPoints']);
        foreach (['subtotal', 'discount', 'tax', 'total'] as $key) {
            Test::equals($fixture['expected'][$key], (string)$actual[$key]);
        }
        $items = array_map(static fn(array $line): array => [
            'taxBaseUnit' => (string)$line['taxBaseUnit'],
            'lineTotalBaseUnit' => (string)$line['lineTotalBaseUnit'],
        ], $actual['items']);
        Test::equals($fixture['expected']['items'], $items);
    });
}

Test::run('Offline money reference: PHP requires a line title', function (): void {
    Test::throws(
        fn() => Money::calculate([['title' => '', 'quantityMilli' => '1000', 'unitPriceBaseUnit' => '1']]),
        SalesValidationException::class,
        'item_title_invalid'
    );
});

Test::run('G04.1 normalizes Iranian mobiles and isolates reusable customers',function()use($pdo,$one,$two):void{
    Test::equals('09121234567',CustomerDirectory::mobile('+98 912 123 4567'));
    $directory=new CustomerDirectory($pdo);
    $saved=$directory->save($one->context->businessId,['displayName'=>'شرکت مشتری','phone'=>'+۹۸ ۹۱۲ ۱۲۳ ۴۵۶۷','address'=>'تهران','isOfficial'=>true,'nationalId'=>'1234567890']);
    Test::equals('09121234567', $saved['phone']);
    Test::equals($saved['id'],$directory->search($one->context->businessId,'09121234567')[0]['id']);
    Test::equals($saved['id'],$directory->list($one->context->businessId)[0]['id']);
    Test::equals($saved['id'],$directory->list($one->context->businessId,'شرکت مشتری')[0]['id']);
    Test::equals($saved['id'],$directory->list($one->context->businessId,'1234')[0]['id']);
    Test::equals(0,count($directory->search($two->context->businessId,'09121234567')));
    Test::equals(0,count($directory->list($two->context->businessId)));
    Test::throws(fn()=>$directory->save($one->context->businessId,['displayName'=>'تکراری','phone'=>'09121234567','isOfficial'=>false]),SalesValidationException::class,'customer_mobile_exists');
});

Test::run('G04.1 official VAT is deterministic per line and unofficial remains zero',function():void{
    $official=Money::calculate([['title'=>'کالا','quantityMilli'=>'2000','unitPriceBaseUnit'=>'1000000','discountBaseUnit'=>'100000']],0,0,1000);
    Test::equals(2000000,$official['subtotal']);Test::equals(190000,$official['tax']);Test::equals(2090000,$official['total']);
    $unofficial=Money::calculate([['title'=>'کالا','quantityMilli'=>'2000','unitPriceBaseUnit'=>'1000000']],0,0,0);Test::equals(0,$unofficial['tax']);
});

Test::run('G04.1 Jalali issue and expiry dates cross boundaries correctly',function():void{
    Test::equals(['date' => '2026-03-20', 'jalali' => '1404/12/29'], JalaliDate::plusDays('2026-03-20', 0));
    Test::equals(['date' => '2026-03-21', 'jalali' => '1405/01/01'], JalaliDate::plusDays('2026-03-20', 1));
});

$proforma=null; $invoice=null;
Test::run('G04 creates and recovers a proforma draft with stable customer',function()use($service,$one,&$proforma):void{
    $proforma=$service->createDraft($one->context->businessId,['documentType'=>'proforma','customer'=>['displayName'=>'مشتری نمونه','phone'=>'09120000000'],'validityDays'=>1,'items'=>[['title'=>'سفارش کامل','quantityMilli'=>'1000','unitPriceBaseUnit'=>'10000000']]]);
    Test::equals('draft',$proforma['lifecycleStatus']); Test::equals('10000000',$proforma['grandTotalBaseUnit']);
    $loaded=$service->get($one->context->businessId,$proforma['id']); Test::equals($proforma['customerId'],$loaded['customerId']);
});

Test::run('G04 optimistic version prevents stale draft overwrite',function()use($service,$one,&$proforma):void{
    $saved=$service->updateDraft($one->context->businessId,$proforma['id'],['version'=>$proforma['version'],'items'=>[['title'=>'سفارش کامل','quantityMilli'=>'1000','unitPriceBaseUnit'=>'10000000']]]);
    Test::throws(fn()=>$service->updateDraft($one->context->businessId,$proforma['id'],['version'=>$proforma['version'],'items'=>[['title'=>'قدیمی','quantityMilli'=>'1000','unitPriceBaseUnit'=>'1']]]),SalesValidationException::class,'draft_version_conflict');
    $proforma=$saved;
});

Test::run('G04 tenant and customer scope prevent cross-business access',function()use($service,$one,$two,&$proforma):void{
    Test::throws(fn()=>$service->get($two->context->businessId,$proforma['id']),SalesValidationException::class,'document_not_found');
    Test::throws(fn()=>$service->createDraft($two->context->businessId,['documentType'=>'proforma','customer'=>['id'=>$proforma['customerId'],'displayName'=>'tamper','phone'=>'09121111111'],'items'=>[['title'=>'x','quantityMilli'=>'1000','unitPriceBaseUnit'=>'1']]]),SalesValidationException::class,'customer_not_found');
});

Test::run('G04 finalizes immutable proforma with settings snapshot',function()use($service,$settings,$one,&$proforma,$now,$pdo):void{
    $dateBefore = JalaliDate::today()['date'];
    $proforma=$service->finalize($one->context->businessId,$proforma['id']); Test::equals('issued',$proforma['lifecycleStatus']);
    Test::assert(isset($proforma['settingsSnapshot']['visual']['templateId']));
    Test::throws(fn()=>$service->updateDraft($one->context->businessId,$proforma['id'],['version'=>$proforma['version'],'items'=>[['title'=>'تغییر','quantityMilli'=>'1000','unitPriceBaseUnit'=>'1']]]),SalesValidationException::class,'finalized_document_immutable');
    $dateAfter = JalaliDate::today()['date'];
    $issueDate = $proforma['issueDate'];
    $validUntil = $proforma['validUntil'];
    $matchesIssueDate = static fn(string $date): bool =>
        [$issueDate, $validUntil] === [JalaliDate::plusDays($date, 0)['jalali'], JalaliDate::plusDays($date, 1)['jalali']];
    Test::assert($matchesIssueDate($dateBefore) || $matchesIssueDate($dateAfter));
    Test::equals('میرا اصلی', $proforma['settingsSnapshot']['seller']['businessName']);

    $settings->update($one->context->businessId,['seller'=>['businessName'=>'نام بعدی']],$now+1);
    (new CustomerDirectory($pdo))->save($one->context->businessId, [
        'displayName' => 'نام تغییر یافته در دفتر مشتریان',
        'phone' => '09120000002',
    ], $proforma['customerId']);
    $reloaded = $service->finalize($one->context->businessId, $proforma['id']);
    Test::equals($proforma, $reloaded);
    // Restore the live directory entry for the history-search cases below.
    (new CustomerDirectory($pdo))->save($one->context->businessId, [
        'displayName' => $proforma['customerName'],
        'phone' => $proforma['customerPhone'],
    ], $proforma['customerId']);
});

Test::run('G06 records tenant-scoped export evidence only for issued documents',function()use($service,$one,$two,&$proforma,$pdo):void{
    $result=$service->recordExport($one->context->businessId,$proforma['id'],['format'=>'pdf','byteSize'=>120000]);
    Test::throws(fn()=>$service->recordExport($one->context->businessId,$proforma['id'],['format'=>'png','byteSize'=>10]),SalesValidationException::class,'export_format_invalid');
    Test::equals('pdf',$result['format']);
    Test::throws(fn()=>$service->recordExport($two->context->businessId,$proforma['id'],['format'=>'png','byteSize'=>10]),SalesValidationException::class,'document_not_found');
    $count=$pdo->query('SELECT COUNT(*) FROM document_exports')->fetchColumn();Test::equals('1',(string)$count);
});

Test::run('G04 records 3m deposit, rejects overpayment, then settles remaining 7m idempotently',function()use($service,$one,&$proforma):void{
    $proforma=$service->recordPayment($one->context->businessId,$proforma['id'],['amountBaseUnit'=>'3000000','idempotencyKey'=>'deposit-3m']);
    Test::equals('3000000',$proforma['paidAmountBaseUnit']); Test::equals('7000000',$proforma['remainingAmountBaseUnit']); Test::equals('partial',$proforma['settlementStatus']);
    Test::throws(fn()=>$service->recordPayment($one->context->businessId,$proforma['id'],['amountBaseUnit'=>'7000001','idempotencyKey'=>'too-much']),SalesValidationException::class,'overpayment_rejected');
    Test::throws(
        fn() => $service->convert($one->context->businessId, $proforma['id']),
        SalesValidationException::class,
        'proforma_not_fully_paid'
    );
    Test::equals($proforma, $service->get($one->context->businessId, $proforma['id']));
    $proforma=$service->recordPayment($one->context->businessId,$proforma['id'],['amountBaseUnit'=>'7000000','idempotencyKey'=>'balance-7m']);
    $again=$service->recordPayment($one->context->businessId,$proforma['id'],['amountBaseUnit'=>'7000000','idempotencyKey'=>'balance-7m']);
    Test::equals('paid',$proforma['settlementStatus']); Test::equals('0',$proforma['remainingAmountBaseUnit']); Test::equals(2,count($again['payments']));
});

Test::run('G04 converts once and final invoice omits installment breakdown',function()use($service,$one,&$proforma,&$invoice):void{
    $invoice=$service->convert($one->context->businessId,$proforma['id']); $again=$service->convert($one->context->businessId,$proforma['id']);
    Test::equals($invoice['id'],$again['id']); Test::equals('invoice',$invoice['documentType']); Test::equals($proforma['id'],$invoice['sourceDocumentId']);
    Test::equals('10000000',$invoice['grandTotalBaseUnit']); Test::equals('10000000',$invoice['paidAmountBaseUnit']); Test::assert(!array_key_exists('payments',$invoice));
    Test::equals($invoice['documentNumber'], $again['documentNumber']);
    Test::equals(null, $invoice['validUntil']);
    Test::equals($proforma['settingsSnapshot'], $invoice['settingsSnapshot']);
    Test::equals($proforma['customerName'], $invoice['customerName']);
    Test::equals($proforma['customerPhone'], $invoice['customerPhone']);
    Test::equals(2,count($service->get($one->context->businessId,$proforma['id'])['payments']));
});

Test::run('G04 direct invoice requires explicit full-payment confirmation',function()use($service,$one):void{
    $draft=$service->createDraft($one->context->businessId,['documentType'=>'invoice','customer'=>['displayName'=>'خریدار نقدی','phone'=>'09120000001'],'items'=>[['title'=>'فروش نقدی','quantityMilli'=>'1000','unitPriceBaseUnit'=>'2500000']]]);
    Test::throws(fn()=>$service->finalize($one->context->businessId,$draft['id']),SalesValidationException::class,'full_payment_confirmation_required');
    $final=$service->finalize($one->context->businessId,$draft['id'],true); Test::equals(null,$final['sourceDocumentId']); Test::equals('paid',$final['settlementStatus']); Test::assert(!array_key_exists('payments',$final));
});

Test::run('G04 projections keep proforma deposits separate from final invoiced sales',function()use($pdo,$one):void{
    $s=$pdo->prepare("SELECT SUM(CASE WHEN document_type='invoice' AND lifecycle_status='issued' THEN grand_total_base_unit ELSE 0 END) invoiced, SUM(CASE WHEN document_type='proforma' THEN paid_amount_base_unit ELSE 0 END) deposits FROM sales_documents WHERE business_id=?");$s->execute([$one->context->businessId]);$row=$s->fetch();
    Test::equals('12500000',(string)$row['invoiced']); Test::equals('10000000',(string)$row['deposits']);
});

Test::run('G04 archive returns both document types with customer identity',function()use($service,$one):void{
    $documents=$service->list($one->context->businessId);
    Test::equals(3,count($documents));
    Test::assert(in_array('proforma',array_column($documents,'documentType'),true));
    Test::assert(in_array('invoice',array_column($documents,'documentType'),true));
    Test::assert(!in_array('',array_column($documents,'customerName'),true));
});

Test::run('G07 history search is tenant scoped and finds customer, number and item text',function()use($history,$one,$two):void{
    $byCustomer=$history->list($one->context->businessId,['query'=>'مشتری نمونه','limit'=>20]);
    Test::assert(count($byCustomer['documents'])>=2);
    $byItem=$history->list($one->context->businessId,['query'=>'سفارش کامل','documentType'=>'proforma','limit'=>20]);
    Test::equals(1,count($byItem['documents']));
    $other=$history->list($two->context->businessId,['query'=>'سفارش کامل','limit'=>20]);
    Test::equals(0,count($other['documents']));
});

Test::run('G07 duplicate creates an independent draft and archive is reversible',function()use($history,$one,&$proforma):void{
    $copy=$history->duplicate($one->context->businessId,$proforma['id']);
    Test::equals('draft',$copy['lifecycleStatus']);
    Test::equals($proforma['grandTotalBaseUnit'],$copy['grandTotalBaseUnit']);
    Test::assert($copy['id']!==$proforma['id']);
    $history->setArchived($one->context->businessId,$copy['id'],true);
    $active=$history->list($one->context->businessId,['query'=>$copy['customerName'],'limit'=>50]);
    Test::assert(!in_array($copy['id'],array_column($active['documents'],'id'),true));
    $archived=$history->list($one->context->businessId,['archived'=>true,'limit'=>50]);
    Test::assert(in_array($copy['id'],array_column($archived['documents'],'id'),true));
    $history->setArchived($one->context->businessId,$copy['id'],false);
});

Test::run('G07 cursor pagination never repeats a document',function()use($history,$one):void{
    $first=$history->list($one->context->businessId,['limit'=>2]);
    Test::assert($first['nextCursor']!==null);
    $second=$history->list($one->context->businessId,['limit'=>2,'cursor'=>$first['nextCursor']]);
    Test::equals([],array_values(array_intersect(array_column($first['documents'],'id'),array_column($second['documents'],'id'))));
});

Test::run('Android sync preserves number and issue date, deduplicates payments and conversion, and rejects conflicts', function () use ($pdo, $service, $one, $two): void {
    $sync = new \Tinv\Sales\MobileDocumentSync($pdo);
    $business = $one->context->businessId;
    $localId = \Tinv\Support\Uuid::v4();
    $series = \Tinv\Support\Uuid::v4();
    $document = [
        'id' => $localId, 'version' => 1, 'documentType' => 'proforma', 'currencyUnit' => 'rial',
        'lifecycleStatus' => 'issued', 'documentNumber' => 'PF-' . $series . '-00001',
        'issuedAt' => '2026-03-19T21:00:00.000Z', 'validityDays' => 1,
        'isOfficial' => false, 'taxRateBasisPoints' => 0, 'customerName' => 'شرکت بهار',
        'customerPhone' => '09121234567', 'subtotalBaseUnit' => '1000', 'discountBaseUnit' => '0',
        'grandTotalBaseUnit' => '1000', 'taxTotalBaseUnit' => '0', 'surchargeBaseUnit' => '0',
        'paidAmountBaseUnit' => '0', 'settingsSnapshot' => \Tinv\Settings\SettingsSchema::defaults(),
        'items' => [['title' => 'کالا', 'quantityMilli' => '1000', 'unitPriceBaseUnit' => '1000']],
    ];
    $id = $sync->push($business, $document);
    Test::equals($id, $sync->push($business, $document));
    $issued = $service->get($business, $id);
    Test::equals($document['documentNumber'], $issued['documentNumber']);
    Test::equals('1404/12/29', $issued['issueDate']);
    Test::equals('1405/01/01', $issued['validUntil']);
    Test::throws(fn() => $service->get($two->context->businessId, $id), SalesValidationException::class);

    $settled = array_replace($document, [
        'version' => 2, 'paidAmountBaseUnit' => '1000',
        'payments' => [[
            'id' => \Tinv\Support\Uuid::v4(), 'amount_base_unit' => '1000', 'paid_at' => '2026-03-20T08:00:00.000Z',
        ]],
    ]);
    Test::equals($id, $sync->push($business, $settled));
    Test::equals($id, $sync->push($business, $settled));
    $paid = $service->get($business, $id);
    Test::equals('1000', $paid['paidAmountBaseUnit']);
    Test::equals(1, count($paid['payments']));
    Test::throws(fn() => $sync->push($business, $document), SalesValidationException::class, 'mobile_sync_conflict');

    $invoice = array_replace($document, [
        'id' => \Tinv\Support\Uuid::v4(), 'sourceDocumentId' => $localId, 'documentType' => 'invoice',
        'validityDays' => null, 'documentNumber' => 'INV-' . $series . '-00001', 'paidAmountBaseUnit' => '1000',
    ]);
    $invoiceId = $sync->push($business, $invoice);
    Test::equals($invoiceId, $sync->push($business, $invoice));
    Test::equals($id, $service->get($business, $invoiceId)['sourceDocumentId']);
    Test::throws(fn() => $sync->push($business, array_replace($invoice, [
        'id' => \Tinv\Support\Uuid::v4(), 'documentNumber' => 'INV-' . $series . '-00002',
    ])), SalesValidationException::class, 'mobile_source_conflict');
});
