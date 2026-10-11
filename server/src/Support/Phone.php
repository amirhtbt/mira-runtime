<?php
declare(strict_types=1);
namespace Tinv\Support;

final class Phone
{
    public static function normalize(string $value): string
    {
        $value = strtr($value, array_combine(
            preg_split('//u', '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', -1, PREG_SPLIT_NO_EMPTY),
            str_split('01234567890123456789')
        ));
        $value = preg_replace('/[\s\p{Z}\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}\x{2066}-\x{2069}\x{FEFF}]/u', '', $value) ?? '';
        $value = preg_replace('/^(?:\+98|0098)/', '0', $value) ?? '';
        return preg_replace('/^989(?=[0-9]{9}$)/', '09', $value) ?? '';
    }
}
