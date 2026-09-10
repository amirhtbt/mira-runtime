CREATE TABLE IF NOT EXISTS customers (
    id CHAR(36) PRIMARY KEY,
    business_id CHAR(36) NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    phone VARCHAR(32) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    KEY idx_customers_business (business_id, updated_at),
    CONSTRAINT fk_customer_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_sequences (
    business_id CHAR(36) NOT NULL,
    document_type ENUM('proforma','invoice') NOT NULL,
    next_value BIGINT UNSIGNED NOT NULL DEFAULT 1,
    PRIMARY KEY (business_id, document_type),
    CONSTRAINT fk_sequence_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_documents (
    id CHAR(36) PRIMARY KEY,
    business_id CHAR(36) NOT NULL,
    customer_id CHAR(36) NOT NULL,
    document_type ENUM('proforma','invoice') NOT NULL,
    lifecycle_status ENUM('draft','issued','cancelled') NOT NULL DEFAULT 'draft',
    settlement_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
    document_number VARCHAR(64) NULL,
    source_document_id CHAR(36) NULL,
    currency_unit ENUM('toman','rial') NOT NULL,
    subtotal_base_unit BIGINT UNSIGNED NOT NULL DEFAULT 0,
    discount_base_unit BIGINT UNSIGNED NOT NULL DEFAULT 0,
    surcharge_base_unit BIGINT UNSIGNED NOT NULL DEFAULT 0,
    grand_total_base_unit BIGINT UNSIGNED NOT NULL DEFAULT 0,
    paid_amount_base_unit BIGINT UNSIGNED NOT NULL DEFAULT 0,
    settings_snapshot_json JSON NULL,
    customer_snapshot_json JSON NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    issued_at DATETIME NULL,
    UNIQUE KEY uq_primary_conversion (source_document_id),
    KEY idx_documents_business_customer (business_id, customer_id, created_at),
    KEY idx_documents_business_type (business_id, document_type, lifecycle_status),
    CONSTRAINT fk_document_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_document_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_document_source FOREIGN KEY (source_document_id) REFERENCES sales_documents(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_document_items (
    id CHAR(36) PRIMARY KEY,
    document_id CHAR(36) NOT NULL,
    position SMALLINT UNSIGNED NOT NULL,
    title VARCHAR(240) NOT NULL,
    description VARCHAR(1000) NOT NULL DEFAULT '',
    quantity_milli BIGINT UNSIGNED NOT NULL,
    unit_price_base_unit BIGINT UNSIGNED NOT NULL,
    line_total_base_unit BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    KEY idx_items_document (document_id, position),
    CONSTRAINT fk_item_document FOREIGN KEY (document_id) REFERENCES sales_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_document_snapshots (
    id CHAR(36) PRIMARY KEY,
    document_id CHAR(36) NOT NULL,
    version INT UNSIGNED NOT NULL,
    snapshot_json JSON NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_document_snapshot (document_id, version),
    CONSTRAINT fk_snapshot_document FOREIGN KEY (document_id) REFERENCES sales_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_document_adjustments (
    id CHAR(36) PRIMARY KEY,
    document_id CHAR(36) NOT NULL,
    position SMALLINT UNSIGNED NOT NULL,
    label VARCHAR(160) NOT NULL,
    direction ENUM('discount','surcharge') NOT NULL,
    amount_base_unit BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    KEY idx_adjustments_document (document_id, position),
    CONSTRAINT fk_adjustment_document FOREIGN KEY (document_id) REFERENCES sales_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
    id CHAR(36) PRIMARY KEY,
    business_id CHAR(36) NOT NULL,
    proforma_id CHAR(36) NOT NULL,
    amount_base_unit BIGINT UNSIGNED NOT NULL,
    paid_at DATETIME NOT NULL,
    method VARCHAR(32) NOT NULL DEFAULT 'manual',
    reference_text VARCHAR(160) NOT NULL DEFAULT '',
    note VARCHAR(500) NOT NULL DEFAULT '',
    status ENUM('confirmed','void') NOT NULL DEFAULT 'confirmed',
    idempotency_key VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_payment_idempotency (business_id, idempotency_key),
    KEY idx_payments_proforma (proforma_id, paid_at),
    CONSTRAINT fk_payment_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_proforma FOREIGN KEY (proforma_id) REFERENCES sales_documents(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_allocations (
    payment_id CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    amount_base_unit BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (payment_id, document_id),
    CONSTRAINT fk_allocation_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_allocation_document FOREIGN KEY (document_id) REFERENCES sales_documents(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
