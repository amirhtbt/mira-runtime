<?php
declare(strict_types=1);
namespace Tinv\Sales;

use PDO;
use Tinv\Support\Uuid;

final readonly class CustomerDirectory
{
    public function __construct(private PDO $pdo) {}

    public static function mobile(string $value): string
    {
        $digits = strtr(trim($value), ['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
        $digits = preg_replace('/[^0-9+]/', '', $digits) ?? '';
        if (str_starts_with($digits, '+98')) $digits = '0' . substr($digits, 3);
        elseif (str_starts_with($digits, '0098')) $digits = '0' . substr($digits, 4);
        elseif (str_starts_with($digits, '98') && strlen($digits) === 12) $digits = '0' . substr($digits, 2);
        if (!preg_match('/^09[0-9]{9}$/', $digits)) throw new SalesValidationException('customer_mobile_invalid');
        return $digits;
    }

    /** @return list<array<string,mixed>> */
    public function search(string $businessId, string $phone): array
    {
        $normalized = self::mobile($phone);
        $s=$this->pdo->prepare('SELECT id,display_name,phone,normalized_mobile,address,is_official,national_id FROM customers WHERE business_id=? AND normalized_mobile=? AND archived_at IS NULL LIMIT 5');
        $s->execute([$businessId,$normalized]);
        return array_map(self::present(...),$s->fetchAll());
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function save(string $businessId,array $input,?string $id=null):array
    {
        self::keys($input,['displayName','phone','address','isOfficial','nationalId']);
        $name=trim((string)($input['displayName']??''));
        if($name===''||mb_strlen($name)>160||str_contains($name,'<'))throw new SalesValidationException('customer_name_invalid');
        $phone=trim((string)($input['phone']??''));$normalized=self::mobile($phone);
        $official=($input['isOfficial']??false)===true;$national=self::nationalId((string)($input['nationalId']??''),$official);
        $address=trim((string)($input['address']??''));if(mb_strlen($address)>500||str_contains($address,'<'))throw new SalesValidationException('customer_address_invalid');
        $now=gmdate('Y-m-d H:i:s');
        $existing=$this->pdo->prepare('SELECT id FROM customers WHERE business_id=? AND normalized_mobile=? LIMIT 1');$existing->execute([$businessId,$normalized]);$existingId=$existing->fetchColumn();
        if($id===null&&$existingId)throw new SalesValidationException('customer_mobile_exists',409);
        if($id!==null){
            $owned=$this->pdo->prepare('SELECT id FROM customers WHERE id=? AND business_id=? AND archived_at IS NULL');$owned->execute([$id,$businessId]);if(!$owned->fetch())throw new SalesValidationException('customer_not_found',404);
            if($existingId&&$existingId!==$id)throw new SalesValidationException('customer_mobile_exists',409);
            $this->pdo->prepare('UPDATE customers SET display_name=?,phone=?,normalized_mobile=?,address=?,is_official=?,national_id=?,updated_at=? WHERE id=? AND business_id=?')->execute([$name,$phone,$normalized,$address,$official?1:0,$national,$now,$id,$businessId]);
        }else{$id=Uuid::v4();$this->pdo->prepare('INSERT INTO customers (id,business_id,display_name,phone,normalized_mobile,address,is_official,national_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([$id,$businessId,$name,$phone,$normalized,$address,$official?1:0,$national,$now,$now]);}
        return $this->get($businessId,$id);
    }

    /** @return array<string,mixed> */
    public function get(string $businessId,string $id):array
    {
        $s=$this->pdo->prepare('SELECT id,display_name,phone,normalized_mobile,address,is_official,national_id FROM customers WHERE id=? AND business_id=? AND archived_at IS NULL');$s->execute([$id,$businessId]);$r=$s->fetch();if(!$r)throw new SalesValidationException('customer_not_found',404);return self::present($r);
    }
    public static function nationalId(string $value,bool $required):string{$v=preg_replace('/\D/u','',strtr(trim($value),['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9']))??'';if($required&&!preg_match('/^[0-9]{10,11}$/',$v))throw new SalesValidationException('national_id_required');if(!$required)return '';return $v;}
    /** @param array<string,mixed> $r @return array<string,mixed> */
    private static function present(array $r):array{return ['id'=>$r['id'],'displayName'=>$r['display_name'],'phone'=>$r['phone'],'normalizedMobile'=>$r['normalized_mobile'],'address'=>$r['address'],'isOfficial'=>(bool)$r['is_official'],'nationalId'=>$r['national_id']];}
    /** @param array<string,mixed> $input @param list<string> $allowed */
    private static function keys(array $input,array $allowed):void{foreach(array_keys($input)as$key)if(!in_array($key,$allowed,true))throw new SalesValidationException('unknown_field_'.$key);}
}
