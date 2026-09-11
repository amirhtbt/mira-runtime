<?php
declare(strict_types=1);
namespace Tinv\Sales;

final class Money
{
    public static function amount(mixed $value, string $field): int
    {
        if (is_int($value)) $text = (string) $value;
        elseif (is_string($value)) $text = $value;
        else throw new SalesValidationException($field . '_integer_required');
        if (!preg_match('/^(0|[1-9][0-9]{0,14})$/', $text)) throw new SalesValidationException($field . '_invalid');
        return (int) $text;
    }

    /** @param list<array<string,mixed>> $items @return array{subtotal:int,discount:int,surcharge:int,tax:int,total:int,items:list<array<string,mixed>>} */
    public static function calculate(array $items, int $discount = 0, int $surcharge = 0, int $taxRateBasisPoints = 0): array
    {
        if ($items === []) throw new SalesValidationException('items_required');
        if ($taxRateBasisPoints < 0 || $taxRateBasisPoints > 10000) throw new SalesValidationException('tax_rate_invalid');
        $subtotal = 0; $lineDiscounts = 0; $taxTotal = 0; $normalized = [];
        foreach ($items as $index => $item) {
            if (!is_array($item)) throw new SalesValidationException('item_invalid');
            $title = trim((string) ($item['title'] ?? ''));
            if ($title === '' || mb_strlen($title) > 240 || str_contains($title, '<')) throw new SalesValidationException('item_title_invalid');
            $quantity = self::amount($item['quantityMilli'] ?? null, 'quantity');
            $unitPrice = self::amount($item['unitPriceBaseUnit'] ?? null, 'unit_price');
            if ($quantity < 1) throw new SalesValidationException('quantity_invalid');
            if ($unitPrice > intdiv(PHP_INT_MAX, $quantity)) throw new SalesValidationException('money_overflow');
            $gross = intdiv($quantity * $unitPrice + 500, 1000);
            $lineDiscount = self::amount($item['discountBaseUnit'] ?? '0', 'line_discount');
            if ($lineDiscount > $gross) throw new SalesValidationException('line_discount_exceeds_total');
            $net = $gross - $lineDiscount;
            $tax = intdiv($net * $taxRateBasisPoints + 5000, 10000);
            $line = $net + $tax;
            if ($subtotal > PHP_INT_MAX - $line) throw new SalesValidationException('money_overflow');
            $subtotal += $gross; $lineDiscounts += $lineDiscount; $taxTotal += $tax;
            $normalized[] = ['title' => $title, 'description' => trim((string) ($item['description'] ?? '')), 'quantityMilli' => $quantity, 'unitPriceBaseUnit' => $unitPrice, 'discountBaseUnit' => $lineDiscount, 'taxBaseUnit' => $tax, 'lineTotalBaseUnit' => $line, 'position' => $index + 1];
        }
        $allDiscounts=$discount+$lineDiscounts;
        if ($allDiscounts > $subtotal + $surcharge) throw new SalesValidationException('discount_exceeds_total');
        return ['subtotal' => $subtotal, 'discount' => $allDiscounts, 'surcharge' => $surcharge, 'tax'=>$taxTotal, 'total' => $subtotal - $allDiscounts + $taxTotal + $surcharge, 'items' => $normalized];
    }
}
