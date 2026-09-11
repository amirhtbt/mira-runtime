<?php
declare(strict_types=1);

namespace Tinv\Settings;

final class SettingsSchema
{
    public const SCHEMA_VERSION = 2;

    /** @return array<string,mixed> */
    public static function defaults(): array
    {
        return [
            'seller' => [
                'businessName' => '',
                'displayName' => '',
                'subtitle' => '',
                'sellerName' => '',
                'phone' => '',
                'telegramUsername' => '',
                'address' => '',
                'showAddress' => false,
                'customContactLine' => '',
            ],
            'payment' => [
                'accounts' => [],
                'cardNumber' => '',
                'accountNumber' => '',
                'sheba' => '',
                'bankName' => '',
                'accountHolder' => '',
                'instructions' => '',
            ],
            'officialSeller' => [
                'companyName' => '',
                'address' => '',
                'phone' => '',
                'nationalId' => '',
            ],
            'officialPayment' => [
                'accounts' => [], 'cardNumber' => '', 'accountNumber' => '', 'sheba' => '',
                'bankName' => '', 'accountHolder' => '', 'instructions' => '',
            ],
            'document' => [
                'proformaLabel' => 'پیش‌فاکتور',
                'invoiceLabel' => 'فاکتور فروش',
                'numberingMode' => 'auto',
                'proformaPrefix' => 'PF',
                'invoicePrefix' => 'INV',
                'numberPadding' => 5,
                'issueDateMode' => 'today',
                'validityDays' => 7,
                'calendar' => 'jalali',
                'digits' => 'persian',
            ],
            'presentation' => [
                'currencyUnit' => 'rial',
                'thousandsSeparator' => true,
                'decimalPolicy' => 'none',
                'roundTotal' => 'none',
            ],
            'items' => [
                'rowNumber' => true,
                'sku' => false,
                'image' => false,
                'title' => true,
                'description' => true,
                'unit' => false,
                'quantity' => true,
                'unitPrice' => true,
                'lineDiscount' => false,
                'tax' => false,
                'lineTotal' => true,
            ],
            'financial' => [
                'discount' => [
                    'kind' => 'none',
                    'amountBaseUnit' => '0',
                    'percentBasisPoints' => 0,
                ],
                'shippingAmountBaseUnit' => '0',
                'serviceFeeAmountBaseUnit' => '0',
                'taxEnabled' => false,
                'taxRateBasisPoints' => 1000,
                'customAdjustments' => [],
            ],
            'text' => [
                'sellerNote' => '',
                'paymentTerms' => '',
                'shippingTerms' => '',
                'footer' => '',
                'validityNotice' => '',
                'thankYou' => '',
            ],
            'visual' => [
                'templateId' => 'minimal',
                'accent' => '#2f80ed',
                'invoiceVariant' => 'auto',
                'logoPosition' => 'start',
                'density' => 'comfortable',
                'fontSize' => 'medium',
            ],
        ];
    }

    /** @param array<string,mixed> $current @param array<string,mixed> $patch @return array<string,mixed> */
    public static function merge(array $current, array $patch): array
    {
        self::assertAllowedKeys($patch, ['seller', 'payment', 'officialSeller', 'officialPayment', 'document', 'presentation', 'items', 'financial', 'text', 'visual'], 'root');
        $next = $current;

        foreach ($patch as $section => $value) {
            if (!is_array($value) || array_is_list($value)) {
                throw new SettingsValidationException($section . '_object_required');
            }
            $base = is_array($next[$section] ?? null) ? $next[$section] : [];
            $next[$section] = match ($section) {
                'seller' => self::seller($base, $value),
                'payment' => self::payment($base, $value),
                'officialSeller' => self::officialSeller($base, $value),
                'officialPayment' => self::payment($base, $value),
                'document' => self::document($base, $value),
                'presentation' => self::presentation($base, $value),
                'items' => self::items($base, $value),
                'financial' => self::financial($base, $value),
                'text' => self::text($base, $value),
                'visual' => self::visual($base, $value),
                default => throw new SettingsValidationException('unknown_section'),
            };
        }

        $encoded = json_encode($next, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (strlen($encoded) > 32768) {
            throw new SettingsValidationException('payload_too_large');
        }
        return $next;
    }

    /** @param array<string,mixed> $global @param array<string,mixed> $overrides @return array<string,mixed> */
    public static function mergeForDocument(array $global, array $overrides): array
    {
        self::assertAllowedKeys($overrides, ['document', 'presentation', 'items', 'financial', 'text', 'visual'], 'document_override');
        return self::merge($global, $overrides);
    }

    /** @param array<string,mixed> $base @param array<string,mixed> $patch @return array<string,mixed> */
    private static function seller(array $base, array $patch): array
    {
        self::assertAllowedKeys($patch, ['businessName', 'displayName', 'subtitle', 'sellerName', 'phone', 'telegramUsername', 'address', 'showAddress', 'customContactLine'], 'seller');
        foreach ($patch as $key => $value) {
            $base[$key] = match ($key) {
                'businessName', 'displayName', 'subtitle', 'sellerName' => self::plainText($value, 120, 'seller_' . $key),
                'phone' => self::phone($value),
                'telegramUsername' => self::telegramUsername($value),
                'address' => self::plainText($value, 500, 'seller_address', true),
                'showAddress' => self::bool($value, 'seller_showAddress'),
                'customContactLine' => self::plainText($value, 180, 'seller_customContactLine', true),
                default => throw new SettingsValidationException('seller_unknown'),
            };
        }
        return $base;
    }

    /** @param array<string,mixed> $base @param array<string,mixed> $patch @return array<string,mixed> */
    private static function officialSeller(array $base, array $patch): array
    {
        self::assertAllowedKeys($patch, ['companyName', 'address', 'phone', 'nationalId'], 'officialSeller');
        foreach ($patch as $key => $value) {
            $base[$key] = match ($key) {
                'companyName' => self::plainText($value, 160, 'officialSeller_companyName'),
                'address' => self::plainText($value, 500, 'officialSeller_address', true),
                'phone' => self::phone($value),
                'nationalId' => self::digitsIdentifier($value, 10, 14, 'officialSeller_nationalId'),
                default => throw new SettingsValidationException('officialSeller_unknown'),
            };
        }
        return $base;
    }

    /** @param array<string,mixed> $base @param array<string,mixed> $patch @return array<string,mixed> */
    private static function payment(array $base, array $patch): array
    {
        self::assertAllowedKeys($patch, ['accounts','cardNumber', 'accountNumber', 'sheba', 'bankName', 'accountHolder', 'instructions'], 'payment');
        foreach ($patch as $key => $value) {
            $base[$key] = match ($key) {
                'accounts' => self::paymentAccounts($value),
                'cardNumber' => self::digitsIdentifier($value, 16, 16, 'payment_cardNumber'),
                'accountNumber' => self::digitsIdentifier($value, 4, 32, 'payment_accountNumber'),
                'sheba' => self::sheba($value),
                'bankName', 'accountHolder' => self::plainText($value, 120, 'payment_' . $key),
                'instructions' => self::plainText($value, 800, 'payment_instructions', true),
                default => throw new SettingsValidationException('payment_unknown'),
            };
        }
        return $base;
    }

    /** @return list<array<string,string>> */
    private static function paymentAccounts(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value) || count($value) > 10) throw new SettingsValidationException('payment_accounts_invalid');
        $out=[];foreach($value as $row){if(!is_array($row)||array_is_list($row))throw new SettingsValidationException('payment_account_invalid');self::assertAllowedKeys($row,['cardNumber','sheba','bankName','accountHolder'],'payment_account');$out[]=['cardNumber'=>self::digitsIdentifier($row['cardNumber']??'',16,16,'payment_cardNumber'),'sheba'=>self::sheba($row['sheba']??''),'bankName'=>self::plainText($row['bankName']??'',120,'payment_bankName'),'accountHolder'=>self::plainText($row['accountHolder']??'',120,'payment_accountHolder')];}return$out;
    }

    /** @param array<string,mixed> $base @param array<string,mixed> $patch @return array<string,mixed> */
    private static function document(array $base, array $patch): array
    {
        self::assertAllowedKeys($patch, ['proformaLabel', 'invoiceLabel', 'numberingMode', 'proformaPrefix', 'invoicePrefix', 'numberPadding', 'issueDateMode', 'validityDays', 'calendar', 'digits'], 'document');
        foreach ($patch as $key => $value) {
            $base[$key] = match ($key) {
                'proformaLabel', 'invoiceLabel' => self::plainText($value, 64, 'document_' . $key),
                'numberingMode' => self::enum($value, ['auto', 'manual'], 'document_numberingMode'),
                'proformaPrefix', 'invoicePrefix' => self::plainText($value, 12, 'document_' . $key),
                'numberPadding' => self::intRange($value, 1, 12, 'document_numberPadding'),
                'issueDateMode' => self::enum($value, ['today', 'manual'], 'document_issueDateMode'),
                'validityDays' => self::intRange($value, 0, 365, 'document_validityDays'),
                'calendar' => self::enum($value, ['jalali', 'gregorian'], 'document_calendar'),
                'digits' => self::enum($value, ['persian', 'latin'], 'document_digits'),
                default => throw new SettingsValidationException('document_unknown'),
            };
        }
        return $base;
    }

    /** @param array<string,mixed> $base @param array<string,mixed> $patch @return array<string,mixed> */
    private static function presentation(array $base, array $patch): array
    {
        self::assertAllowedKeys($patch, ['currencyUnit', 'thousandsSeparator', 'decimalPolicy', 'roundTotal'], 'presentation');
        foreach ($patch as $key => $value) {
            $base[$key] = match ($key) {
                'currencyUnit' => self::enum($value, ['rial'], 'presentation_currencyUnit'),
                'thousandsSeparator' => self::bool($value, 'presentation_thousandsSeparator'),
                'decimalPolicy' => self::enum($value, ['none', 'auto'], 'presentation_decimalPolicy'),
                'roundTotal' => self::enum($value, ['none', 'nearest10', 'nearest100', 'nearest1000'], 'presentation_roundTotal'),
                default => throw new SettingsValidationException('presentation_unknown'),
            };
        }
        return $base;
    }

    /** @param array<string,mixed> $base @param array<string,mixed> $patch @return array<string,mixed> */
    private static function items(array $base, array $patch): array
    {
        $keys = ['rowNumber', 'sku', 'image', 'title', 'description', 'unit', 'quantity', 'unitPrice', 'lineDiscount', 'tax', 'lineTotal'];
        self::assertAllowedKeys($patch, $keys, 'items');
        foreach ($patch as $key => $value) {
            $base[$key] = self::bool($value, 'items_' . $key);
        }
        return $base;
    }

    /** @param array<string,mixed> $base @param array<string,mixed> $patch @return array<string,mixed> */
    private static function financial(array $base, array $patch): array
    {
        self::assertAllowedKeys($patch, ['discount', 'shippingAmountBaseUnit', 'serviceFeeAmountBaseUnit', 'taxEnabled', 'taxRateBasisPoints', 'customAdjustments'], 'financial');
        foreach ($patch as $key => $value) {
            if ($key === 'discount') {
                if (!is_array($value) || array_is_list($value)) throw new SettingsValidationException('financial_discount_object_required');
                self::assertAllowedKeys($value, ['kind', 'amountBaseUnit', 'percentBasisPoints'], 'financial_discount');
                $discount = is_array($base['discount'] ?? null) ? $base['discount'] : ['kind' => 'none', 'amountBaseUnit' => '0', 'percentBasisPoints' => 0];
                foreach ($value as $discountKey => $discountValue) {
                    $discount[$discountKey] = match ($discountKey) {
                        'kind' => self::enum($discountValue, ['none', 'fixed', 'percent'], 'financial_discount_kind'),
                        'amountBaseUnit' => self::amount($discountValue, 'financial_discount_amount'),
                        'percentBasisPoints' => self::intRange($discountValue, 0, 10000, 'financial_discount_percent'),
                        default => throw new SettingsValidationException('financial_discount_unknown'),
                    };
                }
                $base['discount'] = $discount;
                continue;
            }
            $base[$key] = match ($key) {
                'shippingAmountBaseUnit', 'serviceFeeAmountBaseUnit' => self::amount($value, 'financial_' . $key),
                'taxEnabled' => self::bool($value, 'financial_taxEnabled'),
                'taxRateBasisPoints' => self::intRange($value, 0, 10000, 'financial_taxRateBasisPoints'),
                'customAdjustments' => self::customAdjustments($value),
                default => throw new SettingsValidationException('financial_unknown'),
            };
        }
        return $base;
    }

    /** @param array<string,mixed> $base @param array<string,mixed> $patch @return array<string,mixed> */
    private static function text(array $base, array $patch): array
    {
        self::assertAllowedKeys($patch, ['sellerNote', 'paymentTerms', 'shippingTerms', 'footer', 'validityNotice', 'thankYou'], 'text');
        foreach ($patch as $key => $value) {
            $max = in_array($key, ['paymentTerms', 'shippingTerms'], true) ? 2000 : ($key === 'sellerNote' ? 1200 : 600);
            $base[$key] = self::plainText($value, $max, 'text_' . $key, true);
        }
        return $base;
    }

    /** @param array<string,mixed> $base @param array<string,mixed> $patch @return array<string,mixed> */
    private static function visual(array $base, array $patch): array
    {
        self::assertAllowedKeys($patch, ['templateId', 'accent', 'invoiceVariant', 'logoPosition', 'density', 'fontSize'], 'visual');
        foreach ($patch as $key => $value) {
            $base[$key] = match ($key) {
                'templateId' => self::enum($value, ['minimal', 'modern-business', 'classic-business'], 'visual_templateId'),
                'accent' => self::accent($value),
                'invoiceVariant' => self::enum($value, ['auto', 'light', 'dark'], 'visual_invoiceVariant'),
                'logoPosition' => self::enum($value, ['start', 'center', 'end'], 'visual_logoPosition'),
                'density' => self::enum($value, ['compact', 'comfortable'], 'visual_density'),
                'fontSize' => self::enum($value, ['small', 'medium', 'large'], 'visual_fontSize'),
                default => throw new SettingsValidationException('visual_unknown'),
            };
        }
        return $base;
    }

    /** @return array<int,array<string,mixed>> */
    private static function customAdjustments(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value)) throw new SettingsValidationException('financial_customAdjustments_list_required');
        if (count($value) > 5) throw new SettingsValidationException('financial_customAdjustments_too_many');
        $result = [];
        foreach ($value as $index => $row) {
            if (!is_array($row) || array_is_list($row)) throw new SettingsValidationException('financial_customAdjustment_invalid');
            self::assertAllowedKeys($row, ['label', 'direction', 'amountBaseUnit'], 'financial_customAdjustment_' . $index);
            if (!array_key_exists('label', $row) || !array_key_exists('direction', $row) || !array_key_exists('amountBaseUnit', $row)) {
                throw new SettingsValidationException('financial_customAdjustment_incomplete');
            }
            $result[] = [
                'label' => self::plainText($row['label'], 60, 'financial_customAdjustment_label'),
                'direction' => self::enum($row['direction'], ['surcharge', 'discount'], 'financial_customAdjustment_direction'),
                'amountBaseUnit' => self::amount($row['amountBaseUnit'], 'financial_customAdjustment_amount'),
            ];
        }
        return $result;
    }

    private static function plainText(mixed $value, int $max, string $field, bool $multiline = false): string
    {
        if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) throw new SettingsValidationException($field . '_string_required');
        $value = str_replace("\r\n", "\n", trim($value));
        if (mb_strlen($value, 'UTF-8') > $max) throw new SettingsValidationException($field . '_too_long');
        if (str_contains($value, '<') || str_contains($value, '>')) throw new SettingsValidationException($field . '_html_rejected');
        if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $value) === 1) throw new SettingsValidationException($field . '_control_rejected');
        if (preg_match('/[\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', $value) === 1) throw new SettingsValidationException($field . '_bidi_control_rejected');
        if (!$multiline && str_contains($value, "\n")) throw new SettingsValidationException($field . '_multiline_rejected');
        return $value;
    }

    private static function phone(mixed $value): string
    {
        $phone = self::plainText($value, 32, 'seller_phone');
        if ($phone === '') return '';
        $phone = self::normalizeDigits($phone);
        if (preg_match('/^\+?[0-9().\-\s]{4,31}$/', $phone) !== 1) throw new SettingsValidationException('seller_phone_invalid');
        return $phone;
    }

    private static function telegramUsername(mixed $value): string
    {
        $username = self::plainText($value, 33, 'seller_telegramUsername');
        if ($username === '') return '';
        $username = ltrim($username, '@');
        if (preg_match('/^[A-Za-z0-9_]{5,32}$/', $username) !== 1) throw new SettingsValidationException('seller_telegramUsername_invalid');
        return $username;
    }

    private static function digitsIdentifier(mixed $value, int $min, int $max, string $field): string
    {
        if (!is_string($value)) throw new SettingsValidationException($field . '_string_required');
        $value = self::normalizeDigits($value);
        $value = preg_replace('/[\s-]+/u', '', trim($value)) ?? '';
        if ($value === '') return '';
        if (preg_match('/^\d+$/', $value) !== 1 || strlen($value) < $min || strlen($value) > $max) {
            throw new SettingsValidationException($field . '_invalid');
        }
        return $value;
    }

    private static function sheba(mixed $value): string
    {
        if (!is_string($value)) throw new SettingsValidationException('payment_sheba_string_required');
        $value = strtoupper(self::normalizeDigits(preg_replace('/[\s-]+/u', '', trim($value)) ?? ''));
        if ($value === '') return '';
        if (preg_match('/^IR\d{24}$/', $value) !== 1) throw new SettingsValidationException('payment_sheba_invalid');
        return $value;
    }

    private static function amount(mixed $value, string $field): string
    {
        if (!is_string($value)) throw new SettingsValidationException($field . '_string_required');
        $value = self::normalizeDigits(trim($value));
        if (preg_match('/^\d{1,18}$/', $value) !== 1) throw new SettingsValidationException($field . '_invalid');
        $value = ltrim($value, '0');
        return $value === '' ? '0' : $value;
    }

    private static function bool(mixed $value, string $field): bool
    {
        if (!is_bool($value)) throw new SettingsValidationException($field . '_boolean_required');
        return $value;
    }

    private static function intRange(mixed $value, int $min, int $max, string $field): int
    {
        if (!is_int($value) || $value < $min || $value > $max) throw new SettingsValidationException($field . '_out_of_range');
        return $value;
    }

    /** @param list<string> $allowed */
    private static function enum(mixed $value, array $allowed, string $field): string
    {
        if (!is_string($value) || !in_array($value, $allowed, true)) throw new SettingsValidationException($field . '_invalid');
        return $value;
    }

    private static function slug(mixed $value, string $field): string
    {
        if (!is_string($value) || preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/', $value) !== 1) {
            throw new SettingsValidationException($field . '_invalid');
        }
        return $value;
    }

    private static function accent(mixed $value): string
    {
        if (!is_string($value) || preg_match('/^#[0-9A-Fa-f]{6}$/', $value) !== 1) throw new SettingsValidationException('visual_accent_invalid');
        return strtolower($value);
    }

    /** @param array<string,mixed> $value @param list<string> $allowed */
    private static function assertAllowedKeys(array $value, array $allowed, string $path): void
    {
        foreach (array_keys($value) as $key) {
            if (!is_string($key) || !in_array($key, $allowed, true)) {
                throw new SettingsValidationException($path . '_unknown_field');
            }
        }
    }

    private static function normalizeDigits(string $value): string
    {
        return strtr($value, [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
    }
}
