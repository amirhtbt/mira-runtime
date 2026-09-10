-- Preserve historical issued documents exactly as issued. Normalize editable business
-- defaults so every document created from G05 onward is calculated in integer Rial.
UPDATE business_settings
SET settings_json = JSON_SET(settings_json, '$.presentation.currencyUnit', 'rial')
WHERE JSON_UNQUOTE(JSON_EXTRACT(settings_json, '$.presentation.currencyUnit')) = 'toman';
