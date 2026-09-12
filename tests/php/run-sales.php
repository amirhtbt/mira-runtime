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

Test::run('G04.1 normalizes Iranian mobiles and isolates reusable customers',function()use($pdo,$one,$two):void{
    Test::equals('09121234567',CustomerDirectory::mobile('+98 912 123 4567'));
    $directory=new CustomerDirectory($pdo);
    $saved=$directory->save($one->context->businessId,['displayName'=>'شرکت مشتری','phone'=>'+989121234567','address'=>'تهران','isOfficial'=>true,'nationalId'=>'1234567890']);
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
    $end=JalaliDate::plusDays('2026-03-20',1);Test::equals('1405/01/01',$end['jalali']);
});

$proforma=null; $invoice=null;
Test::run('G04 creates and recovers a proforma draft with stable customer',function()use($service,$one,&$proforma):void{
    $proforma=$service->createDraft($one->context->businessId,['documentType'=>'proforma','customer'=>['displayName'=>'مشتری نمونه','phone'=>'09120000000'],'items'=>[['title'=>'سفارش کامل','quantityMilli'=>'1000','unitPriceBaseUnit'=>'10000000']]]);
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

Test::run('G04 finalizes immutable proforma with settings snapshot',function()use($service,$settings,$one,&$proforma,$now):void{
    $proforma=$service->finalize($one->context->businessId,$proforma['id']); Test::equals('issued',$proforma['lifecycleStatus']);
    Test::assert(isset($proforma['settingsSnapshot']['visual']['templateId']));
    Test::throws(fn()=>$service->updateDraft($one->context->businessId,$proforma['id'],['version'=>$proforma['version'],'items'=>[['title'=>'تغییر','quantityMilli'=>'1000','unitPriceBaseUnit'=>'1']]]),SalesValidationException::class,'finalized_document_immutable');
    $settings->update($one->context->businessId,['seller'=>['businessName'=>'نام بعدی']],$now+1);
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
    $proforma=$service->recordPayment($one->context->businessId,$proforma['id'],['amountBaseUnit'=>'7000000','idempotencyKey'=>'balance-7m']);
    $again=$service->recordPayment($one->context->businessId,$proforma['id'],['amountBaseUnit'=>'7000000','idempotencyKey'=>'balance-7m']);
    Test::equals('paid',$proforma['settlementStatus']); Test::equals('0',$proforma['remainingAmountBaseUnit']); Test::equals(2,count($again['payments']));
});

Test::run('G04 converts once and final invoice omits installment breakdown',function()use($service,$one,&$proforma,&$invoice):void{
    $invoice=$service->convert($one->context->businessId,$proforma['id']); $again=$service->convert($one->context->businessId,$proforma['id']);
    Test::equals($invoice['id'],$again['id']); Test::equals('invoice',$invoice['documentType']); Test::equals($proforma['id'],$invoice['sourceDocumentId']);
    Test::equals('10000000',$invoice['grandTotalBaseUnit']); Test::equals('10000000',$invoice['paidAmountBaseUnit']); Test::assert(!array_key_exists('payments',$invoice));
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
