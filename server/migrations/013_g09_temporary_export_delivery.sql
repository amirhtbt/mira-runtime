CREATE TABLE IF NOT EXISTS temporary_export_files (
    token_hash BINARY(32) PRIMARY KEY,
    business_id CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    file_name VARCHAR(180) NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    file_bytes LONGBLOB NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    KEY idx_temporary_export_expiry (expires_at),
    KEY idx_temporary_export_business (business_id),
    CONSTRAINT fk_temporary_export_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_temporary_export_document FOREIGN KEY (document_id) REFERENCES sales_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
