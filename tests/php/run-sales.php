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
$settings->update($one->context->businessId,['seller'=>['businessName'=>'میرا اصلی'],'document'=>['proformaPrefix'=>'PF','invoicePrefix'=>'INV'],'presentation'=>['currencyUnit'=>'toman']],$now);
$service=new SalesDocumentService($pdo,new SettingsRepository($pdo));

Test::run('G04 integer-only deterministic money calculation',function():void{
    $result=Money::calculate([['title'=>'خدمت','quantityMilli'=>'1500','unitPriceBaseUnit'=>'10000000']],500000,100000);
    Test::equals(15000000,$result['subtotal']); Test::equals(14600000,$result['total']);
    Test::throws(fn()=>Money::amount('1.5','amount'),SalesValidationException::class,'amount_invalid');
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
    Test::throws(fn()=>$service->createDraft($two->context->businessId,['documentType'=>'proforma','customer'=>['id'=>$proforma['customerId'],'displayName'=>'tamper'],'items'=>[['title'=>'x','quantityMilli'=>'1000','unitPriceBaseUnit'=>'1']]]),SalesValidationException::class,'customer_not_found');
});

Test::run('G04 finalizes immutable proforma with settings snapshot',function()use($service,$settings,$one,&$proforma,$now):void{
    $proforma=$service->finalize($one->context->businessId,$proforma['id']); Test::equals('issued',$proforma['lifecycleStatus']);
    Test::throws(fn()=>$service->updateDraft($one->context->businessId,$proforma['id'],['version'=>$proforma['version'],'items'=>[['title'=>'تغییر','quantityMilli'=>'1000','unitPriceBaseUnit'=>'1']]]),SalesValidationException::class,'finalized_document_immutable');
    $settings->update($one->context->businessId,['seller'=>['businessName'=>'نام بعدی']],$now+1);
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
    $draft=$service->createDraft($one->context->businessId,['documentType'=>'invoice','customer'=>['displayName'=>'خریدار نقدی'],'items'=>[['title'=>'فروش نقدی','quantityMilli'=>'1000','unitPriceBaseUnit'=>'2500000']]]);
    Test::throws(fn()=>$service->finalize($one->context->businessId,$draft['id']),SalesValidationException::class,'full_payment_confirmation_required');
    $final=$service->finalize($one->context->businessId,$draft['id'],true); Test::equals(null,$final['sourceDocumentId']); Test::equals('paid',$final['settlementStatus']); Test::assert(!array_key_exists('payments',$final));
});

Test::run('G04 projections keep proforma deposits separate from final invoiced sales',function()use($pdo,$one):void{
    $s=$pdo->prepare("SELECT SUM(CASE WHEN document_type='invoice' AND lifecycle_status='issued' THEN grand_total_base_unit ELSE 0 END) invoiced, SUM(CASE WHEN document_type='proforma' THEN paid_amount_base_unit ELSE 0 END) deposits FROM sales_documents WHERE business_id=?");$s->execute([$one->context->businessId]);$row=$s->fetch();
    Test::equals('12500000',(string)$row['invoiced']); Test::equals('10000000',(string)$row['deposits']);
});
