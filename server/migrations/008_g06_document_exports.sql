CREATE TABLE IF NOT EXISTS document_exports (
    id CHAR(36) PRIMARY KEY,
    business_id CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    document_version INT UNSIGNED NOT NULL,
    format ENUM('png','pdf','share') NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    template_id VARCHAR(64) NOT NULL,
    template_version INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    KEY idx_document_exports_business_created (business_id, created_at),
    KEY idx_document_exports_document (document_id, created_at),
    CONSTRAINT fk_document_exports_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_document_exports_document FOREIGN KEY (document_id) REFERENCES sales_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_document_logo_snapshots (
    document_id CHAR(36) PRIMARY KEY,
    business_id CHAR(36) NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    image_bytes MEDIUMBLOB NOT NULL,
    created_at DATETIME NOT NULL,
    KEY idx_document_logo_business (business_id),
    CONSTRAINT fk_document_logo_document FOREIGN KEY (document_id) REFERENCES sales_documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_document_logo_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
