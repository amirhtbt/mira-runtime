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

    /** @param list<array<string,mixed>> $items @return array{subtotal:int,discount:int,surcharge:int,total:int,items:list<array<string,mixed>>} */
    public static function calculate(array $items, int $discount = 0, int $surcharge = 0): array
    {
        if ($items === []) throw new SalesValidationException('items_required');
        $subtotal = 0; $normalized = [];
        foreach ($items as $index => $item) {
            if (!is_array($item)) throw new SalesValidationException('item_invalid');
            $title = trim((string) ($item['title'] ?? ''));
            if ($title === '' || mb_strlen($title) > 240 || str_contains($title, '<')) throw new SalesValidationException('item_title_invalid');
            $quantity = self::amount($item['quantityMilli'] ?? null, 'quantity');
            $unitPrice = self::amount($item['unitPriceBaseUnit'] ?? null, 'unit_price');
            if ($quantity < 1) throw new SalesValidationException('quantity_invalid');
            if ($unitPrice > intdiv(PHP_INT_MAX, $quantity)) throw new SalesValidationException('money_overflow');
            $line = intdiv($quantity * $unitPrice + 500, 1000);
            if ($subtotal > PHP_INT_MAX - $line) throw new SalesValidationException('money_overflow');
            $subtotal += $line;
            $normalized[] = ['title' => $title, 'description' => trim((string) ($item['description'] ?? '')), 'quantityMilli' => $quantity, 'unitPriceBaseUnit' => $unitPrice, 'lineTotalBaseUnit' => $line, 'position' => $index + 1];
        }
        if ($discount > $subtotal + $surcharge) throw new SalesValidationException('discount_exceeds_total');
        return ['subtotal' => $subtotal, 'discount' => $discount, 'surcharge' => $surcharge, 'total' => $subtotal - $discount + $surcharge, 'items' => $normalized];
    }
}
