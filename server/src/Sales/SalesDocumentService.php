<?php
declare(strict_types=1);
namespace Tinv\Sales;

use PDO;
use Tinv\Settings\DocumentSettingsSnapshot;
use Tinv\Settings\SettingsRepository;
use Tinv\Settings\SettingsSchema;
use Tinv\Support\Uuid;

final readonly class SalesDocumentService
{
    public function __construct(private PDO $pdo, private SettingsRepository $settings) {}

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function createDraft(string $businessId, array $input): array
    {
        self::keys($input, ['documentType','customer','items','discountBaseUnit','surchargeBaseUnit','settingsOverrides']);
        $type = $input['documentType'] ?? 'proforma';
        if (!in_array($type, ['proforma','invoice'], true)) throw new SalesValidationException('document_type_invalid');
        $customer = $input['customer'] ?? null;
        if (!is_array($customer)) throw new SalesValidationException('customer_required');
        self::keys($customer, ['id','displayName','phone']);
        $name = trim((string) ($customer['displayName'] ?? ''));
        if ($name === '' || mb_strlen($name) > 160 || str_contains($name, '<')) throw new SalesValidationException('customer_name_invalid');
        $discount = Money::amount($input['discountBaseUnit'] ?? '0', 'discount');
        $surcharge = Money::amount($input['surchargeBaseUnit'] ?? '0', 'surcharge');
        $items = $input['items'] ?? [];
        if (!is_array($items) || !array_is_list($items)) throw new SalesValidationException('items_invalid');
        $totals = Money::calculate($items, $discount, $surcharge);
        $settings = $this->settings->find($businessId)['settings'] ?? SettingsSchema::defaults();
        $overrides = $input['settingsOverrides'] ?? [];
        if (!is_array($overrides)) throw new SalesValidationException('settings_overrides_invalid');
        $currency = (string) ($settings['presentation']['currencyUnit'] ?? 'toman');
        $now = gmdate('Y-m-d H:i:s'); $documentId = Uuid::v4();
        $this->pdo->beginTransaction();
        try {
            $customerId = $this->upsertCustomer($businessId, $customer, $name, $now);
            $stmt = $this->pdo->prepare('INSERT INTO sales_documents (id,business_id,customer_id,document_type,currency_unit,subtotal_base_unit,discount_base_unit,surcharge_base_unit,grand_total_base_unit,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([$documentId,$businessId,$customerId,$type,$currency,$totals['subtotal'],$discount,$surcharge,$totals['total'],$now,$now]);
            $this->replaceItems($documentId, $totals['items'], $now);
            $this->pdo->commit();
        } catch (\Throwable $e) { $this->pdo->rollBack(); throw $e; }
        return $this->get($businessId, $documentId);
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function updateDraft(string $businessId, string $id, array $input): array
    {
        self::keys($input, ['items','discountBaseUnit','surchargeBaseUnit','version']);
        $current = $this->owned($businessId, $id);
        if ($current['lifecycle_status'] !== 'draft') throw new SalesValidationException('finalized_document_immutable', 409);
        $expected = Money::amount($input['version'] ?? null, 'version');
        $discount = Money::amount($input['discountBaseUnit'] ?? (string)$current['discount_base_unit'], 'discount');
        $surcharge = Money::amount($input['surchargeBaseUnit'] ?? (string)$current['surcharge_base_unit'], 'surcharge');
        $items = $input['items'] ?? $this->items($id);
        if (!is_array($items)) throw new SalesValidationException('items_invalid');
        $totals = Money::calculate(array_values($items), $discount, $surcharge); $now = gmdate('Y-m-d H:i:s');
        $this->pdo->beginTransaction();
        try {
            $stmt=$this->pdo->prepare("UPDATE sales_documents SET subtotal_base_unit=?,discount_base_unit=?,surcharge_base_unit=?,grand_total_base_unit=?,version=version+1,updated_at=? WHERE id=? AND business_id=? AND lifecycle_status='draft' AND version=?");
            $stmt->execute([$totals['subtotal'],$discount,$surcharge,$totals['total'],$now,$id,$businessId,$expected]);
            if ($stmt->rowCount() !== 1) throw new SalesValidationException('draft_version_conflict', 409);
            $this->replaceItems($id,$totals['items'],$now); $this->pdo->commit();
        } catch (\Throwable $e) { $this->pdo->rollBack(); throw $e; }
        return $this->get($businessId,$id);
    }

    /** @return array<string,mixed> */
    public function finalize(string $businessId, string $id, bool $paidConfirmed = false): array
    {
        $this->pdo->beginTransaction();
        try {
            $doc=$this->owned($businessId,$id,true);
            if ($doc['lifecycle_status'] === 'issued') { $this->pdo->commit(); return $this->get($businessId,$id); }
            if ($doc['lifecycle_status'] !== 'draft') throw new SalesValidationException('document_not_finalizable',409);
            if ((int)$doc['grand_total_base_unit'] < 1) throw new SalesValidationException('document_total_required');
            if ($doc['document_type'] === 'invoice' && !$paidConfirmed) throw new SalesValidationException('full_payment_confirmation_required');
            $settings=$this->settings->find($businessId)['settings'] ?? SettingsSchema::defaults();
            $customer=$this->customer($businessId,(string)$doc['customer_id']);
            $snapshot=DocumentSettingsSnapshot::toJson($settings);
            $number=$this->nextNumber($businessId,(string)$doc['document_type'],$settings);
            $paid=$doc['document_type']==='invoice' ? (int)$doc['grand_total_base_unit'] : 0;
            $settlement=$paid>0 ? 'paid' : 'unpaid'; $now=gmdate('Y-m-d H:i:s');
            $stmt=$this->pdo->prepare("UPDATE sales_documents SET lifecycle_status='issued',settlement_status=?,document_number=?,paid_amount_base_unit=?,settings_snapshot_json=?,customer_snapshot_json=?,version=version+1,issued_at=?,updated_at=? WHERE id=? AND business_id=? AND lifecycle_status='draft'");
            $stmt->execute([$settlement,$number,$paid,$snapshot,json_encode($customer,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$now,$now,$id,$businessId]);
            $full=$this->documentSnapshot($businessId,$id);
            $this->pdo->prepare('INSERT INTO sales_document_snapshots (id,document_id,version,snapshot_json,created_at) VALUES (?,?,?,?,?)')->execute([Uuid::v4(),$id,1,json_encode($full,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),$now]);
            $this->pdo->commit();
        } catch (\Throwable $e) { $this->pdo->rollBack(); throw $e; }
        return $this->get($businessId,$id);
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function recordPayment(string $businessId,string $id,array $input): array
    {
        self::keys($input,['amountBaseUnit','paidAt','method','reference','note','idempotencyKey']);
        $amount=Money::amount($input['amountBaseUnit'] ?? null,'payment_amount');
        if ($amount<1) throw new SalesValidationException('payment_amount_invalid');
        $key=trim((string)($input['idempotencyKey']??''));
        if ($key==='' || strlen($key)>100) throw new SalesValidationException('idempotency_key_invalid');
        $this->pdo->beginTransaction();
        try {
            $prior=$this->pdo->prepare('SELECT id FROM payments WHERE business_id=? AND idempotency_key=? LIMIT 1'); $prior->execute([$businessId,$key]);
            if ($prior->fetch()) { $this->pdo->commit(); return $this->get($businessId,$id); }
            $doc=$this->owned($businessId,$id,true);
            if ($doc['document_type']!=='proforma' || $doc['lifecycle_status']!=='issued') throw new SalesValidationException('payment_requires_issued_proforma',409);
            $paid=(int)$doc['paid_amount_base_unit']; $total=(int)$doc['grand_total_base_unit'];
            if ($amount>$total-$paid) throw new SalesValidationException('overpayment_rejected',409);
            $paymentId=Uuid::v4(); $now=gmdate('Y-m-d H:i:s'); $paidAt=(string)($input['paidAt']??$now);
            $this->pdo->prepare('INSERT INTO payments (id,business_id,proforma_id,amount_base_unit,paid_at,method,reference_text,note,idempotency_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([$paymentId,$businessId,$id,$amount,$paidAt,substr((string)($input['method']??'manual'),0,32),substr((string)($input['reference']??''),0,160),substr((string)($input['note']??''),0,500),$key,$now]);
            $this->pdo->prepare('INSERT INTO payment_allocations (payment_id,document_id,amount_base_unit,created_at) VALUES (?,?,?,?)')->execute([$paymentId,$id,$amount,$now]);
            $next=$paid+$amount; $status=$next===$total?'paid':'partial';
            $this->pdo->prepare('UPDATE sales_documents SET paid_amount_base_unit=?,settlement_status=?,version=version+1,updated_at=? WHERE id=? AND business_id=?')->execute([$next,$status,$now,$id,$businessId]);
            $this->pdo->commit();
        } catch (\Throwable $e) { $this->pdo->rollBack(); throw $e; }
        return $this->get($businessId,$id);
    }

    /** @return array<string,mixed> */
    public function convert(string $businessId,string $id): array
    {
        $this->pdo->beginTransaction();
        try {
            $existing=$this->pdo->prepare("SELECT id FROM sales_documents WHERE business_id=? AND source_document_id=? AND document_type='invoice' LIMIT 1"); $existing->execute([$businessId,$id]); $found=$existing->fetch();
            if ($found) { $this->pdo->commit(); return $this->get($businessId,(string)$found['id'],false); }
            $source=$this->owned($businessId,$id,true);
            if ($source['document_type']!=='proforma'||$source['lifecycle_status']!=='issued'||$source['settlement_status']!=='paid'||(int)$source['paid_amount_base_unit']!==(int)$source['grand_total_base_unit']) throw new SalesValidationException('proforma_not_fully_paid',409);
            $settings=json_decode((string)$source['settings_snapshot_json'],true,32,JSON_THROW_ON_ERROR)['settings'];
            $invoiceId=Uuid::v4(); $now=gmdate('Y-m-d H:i:s'); $number=$this->nextNumber($businessId,'invoice',$settings);
            $stmt=$this->pdo->prepare("INSERT INTO sales_documents (id,business_id,customer_id,document_type,lifecycle_status,settlement_status,document_number,source_document_id,currency_unit,subtotal_base_unit,discount_base_unit,surcharge_base_unit,grand_total_base_unit,paid_amount_base_unit,settings_snapshot_json,customer_snapshot_json,created_at,updated_at,issued_at) VALUES (?,?,?,'invoice','issued','paid',?,?,?,?,?,?,?,?,?,?,?,?,?)");
            $stmt->execute([$invoiceId,$businessId,$source['customer_id'],$number,$id,$source['currency_unit'],$source['subtotal_base_unit'],$source['discount_base_unit'],$source['surcharge_base_unit'],$source['grand_total_base_unit'],$source['grand_total_base_unit'],$source['settings_snapshot_json'],$source['customer_snapshot_json'],$now,$now,$now]);
            $copy=$this->pdo->prepare('INSERT INTO sales_document_items (id,document_id,position,title,description,quantity_milli,unit_price_base_unit,line_total_base_unit,created_at,updated_at) SELECT UUID(),?,position,title,description,quantity_milli,unit_price_base_unit,line_total_base_unit,?,? FROM sales_document_items WHERE document_id=?'); $copy->execute([$invoiceId,$now,$now,$id]);
            $full=$this->documentSnapshot($businessId,$invoiceId);
            $this->pdo->prepare('INSERT INTO sales_document_snapshots (id,document_id,version,snapshot_json,created_at) VALUES (?,?,?,?,?)')->execute([Uuid::v4(),$invoiceId,1,json_encode($full,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),$now]);
            $this->pdo->commit();
        } catch (\Throwable $e) { $this->pdo->rollBack(); throw $e; }
        return $this->get($businessId,$invoiceId,false);
    }

    /** @return array<string,mixed> */
    public function get(string $businessId,string $id,bool $includePayments=true): array
    {
        $doc=$this->owned($businessId,$id); $items=$this->items($id); $payments=[];
        if ($includePayments && $doc['document_type']==='proforma') { $s=$this->pdo->prepare("SELECT id,amount_base_unit,paid_at,method,reference_text,note,status FROM payments WHERE business_id=? AND proforma_id=? ORDER BY paid_at,id"); $s->execute([$businessId,$id]); $payments=$s->fetchAll(); }
        return $this->present($doc,$items,$payments);
    }

    /** @return list<array<string,mixed>> */
    public function list(string $businessId): array { $s=$this->pdo->prepare('SELECT id FROM sales_documents WHERE business_id=? ORDER BY created_at DESC LIMIT 50');$s->execute([$businessId]);return array_map(fn($r)=>$this->get($businessId,(string)$r['id'],false),$s->fetchAll()); }
    /** @return array<string,mixed> */
    private function owned(string $businessId,string $id,bool $lock=false): array { $s=$this->pdo->prepare('SELECT d.*,c.display_name AS customer_name FROM sales_documents d INNER JOIN customers c ON c.id=d.customer_id AND c.business_id=d.business_id WHERE d.id=? AND d.business_id=?'.($lock?' FOR UPDATE':''));$s->execute([$id,$businessId]);$r=$s->fetch();if(!$r)throw new SalesValidationException('document_not_found',404);return $r; }
    /** @return list<array<string,mixed>> */
    private function items(string $id): array { $s=$this->pdo->prepare('SELECT title,description,quantity_milli AS quantityMilli,unit_price_base_unit AS unitPriceBaseUnit,line_total_base_unit AS lineTotalBaseUnit,position FROM sales_document_items WHERE document_id=? ORDER BY position');$s->execute([$id]);return $s->fetchAll(); }
    /** @param list<array<string,mixed>> $items */
    private function replaceItems(string $id,array $items,string $now):void{$this->pdo->prepare('DELETE FROM sales_document_items WHERE document_id=?')->execute([$id]);$s=$this->pdo->prepare('INSERT INTO sales_document_items (id,document_id,position,title,description,quantity_milli,unit_price_base_unit,line_total_base_unit,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)');foreach($items as $i)$s->execute([Uuid::v4(),$id,$i['position'],$i['title'],$i['description'],$i['quantityMilli'],$i['unitPriceBaseUnit'],$i['lineTotalBaseUnit'],$now,$now]);}
    /** @param array<string,mixed> $customer */
    private function upsertCustomer(string $businessId,array $customer,string $name,string $now):string{$id=$customer['id']??null;if(is_string($id)&&$id!==''){$this->customer($businessId,$id);return $id;}$id=Uuid::v4();$this->pdo->prepare('INSERT INTO customers (id,business_id,display_name,phone,created_at,updated_at) VALUES (?,?,?,?,?,?)')->execute([$id,$businessId,$name,substr(trim((string)($customer['phone']??'')),0,32),$now,$now]);return $id;}
    /** @return array<string,mixed> */
    private function customer(string $businessId,string $id):array{$s=$this->pdo->prepare('SELECT id,display_name AS displayName,phone FROM customers WHERE id=? AND business_id=?');$s->execute([$id,$businessId]);$r=$s->fetch();if(!$r)throw new SalesValidationException('customer_not_found',404);return $r;}
    /** @param array<string,mixed> $settings */
    private function nextNumber(string $businessId,string $type,array $settings):string{$this->pdo->prepare("INSERT INTO document_sequences (business_id,document_type,next_value) VALUES (?,?,1) ON DUPLICATE KEY UPDATE next_value=next_value")->execute([$businessId,$type]);$s=$this->pdo->prepare('SELECT next_value FROM document_sequences WHERE business_id=? AND document_type=? FOR UPDATE');$s->execute([$businessId,$type]);$n=(int)$s->fetchColumn();$this->pdo->prepare('UPDATE document_sequences SET next_value=next_value+1 WHERE business_id=? AND document_type=?')->execute([$businessId,$type]);$d=$settings['document']??[];$prefix=$type==='proforma'?($d['proformaPrefix']??'PF'):($d['invoicePrefix']??'INV');return (string)$prefix.'-'.str_pad((string)$n,(int)($d['numberPadding']??5),'0',STR_PAD_LEFT);}
    /** @return array<string,mixed> */
    private function documentSnapshot(string $businessId,string $id):array{$d=$this->owned($businessId,$id);return ['document'=>$d,'items'=>$this->items($id)];}
    /** @param array<string,mixed> $doc @param list<array<string,mixed>> $items @param list<array<string,mixed>> $payments @return array<string,mixed> */
    private function present(array $doc,array $items,array $payments):array{$total=(int)$doc['grand_total_base_unit'];$paid=(int)$doc['paid_amount_base_unit'];$out=['id'=>$doc['id'],'customerId'=>$doc['customer_id'],'customerName'=>$doc['customer_name'],'documentType'=>$doc['document_type'],'lifecycleStatus'=>$doc['lifecycle_status'],'settlementStatus'=>$doc['settlement_status'],'documentNumber'=>$doc['document_number'],'sourceDocumentId'=>$doc['source_document_id'],'currencyUnit'=>$doc['currency_unit'],'subtotalBaseUnit'=>(string)$doc['subtotal_base_unit'],'discountBaseUnit'=>(string)$doc['discount_base_unit'],'surchargeBaseUnit'=>(string)$doc['surcharge_base_unit'],'grandTotalBaseUnit'=>(string)$total,'paidAmountBaseUnit'=>(string)$paid,'remainingAmountBaseUnit'=>(string)max(0,$total-$paid),'version'=>(int)$doc['version'],'items'=>$items,'canIssueFinalInvoice'=>$doc['document_type']==='proforma'&&$doc['lifecycle_status']==='issued'&&$paid===$total];if($doc['document_type']==='proforma')$out['payments']=$payments;return $out;}
    /** @param array<string,mixed> $input @param list<string> $allowed */
    private static function keys(array $input,array $allowed):void{foreach(array_keys($input) as $key)if(!in_array($key,$allowed,true))throw new SalesValidationException('unknown_field_'.$key);}
}
