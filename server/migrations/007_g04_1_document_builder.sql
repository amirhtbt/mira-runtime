ALTER TABLE customers
    ADD COLUMN normalized_mobile VARCHAR(16) NULL AFTER phone,
    ADD COLUMN address VARCHAR(500) NOT NULL DEFAULT '' AFTER normalized_mobile,
    ADD COLUMN is_official TINYINT(1) NOT NULL DEFAULT 0 AFTER address,
    ADD COLUMN national_id VARCHAR(20) NOT NULL DEFAULT '' AFTER is_official,
    ADD COLUMN archived_at DATETIME NULL AFTER national_id,
    ADD UNIQUE KEY uq_customer_business_mobile (business_id, normalized_mobile);

ALTER TABLE sales_documents
    ADD COLUMN is_official TINYINT(1) NOT NULL DEFAULT 0 AFTER source_document_id,
    ADD COLUMN national_id VARCHAR(20) NOT NULL DEFAULT '' AFTER is_official,
    ADD COLUMN customer_address VARCHAR(500) NOT NULL DEFAULT '' AFTER national_id,
    ADD COLUMN shipping_method VARCHAR(32) NOT NULL DEFAULT '' AFTER customer_address,
    ADD COLUMN validity_days SMALLINT UNSIGNED NULL AFTER shipping_method,
    ADD COLUMN notes VARCHAR(2000) NOT NULL DEFAULT '' AFTER validity_days,
    ADD COLUMN issue_date DATE NULL AFTER notes,
    ADD COLUMN valid_until DATE NULL AFTER issue_date,
    ADD COLUMN tax_rate_basis_points SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER valid_until,
    ADD COLUMN tax_total_base_unit BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER tax_rate_basis_points;

ALTER TABLE sales_document_items
    ADD COLUMN discount_base_unit BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER unit_price_base_unit,
    ADD COLUMN tax_base_unit BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER discount_base_unit;

UPDATE business_settings
SET settings_json = JSON_SET(
    settings_json,
    '$.financial.taxRateBasisPoints',
    CASE
        WHEN COALESCE(JSON_EXTRACT(settings_json, '$.financial.taxRateBasisPoints'), 0) = 0 THEN 1000
        ELSE JSON_EXTRACT(settings_json, '$.financial.taxRateBasisPoints')
    END
);
