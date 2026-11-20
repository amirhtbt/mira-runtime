CREATE TABLE IF NOT EXISTS mobile_document_sync (
    business_id CHAR(36) NOT NULL,
    local_id CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    document_number VARCHAR(64) NOT NULL,
    immutable_hash BINARY(32) NOT NULL,
    revision_hash BINARY(32) NOT NULL,
    local_version INT UNSIGNED NOT NULL,
    server_version INT UNSIGNED NOT NULL,
    server_archived_at DATETIME NULL,
    PRIMARY KEY (business_id, local_id),
    UNIQUE KEY uq_mobile_sync_number (business_id, document_number),
    UNIQUE KEY uq_mobile_sync_document (document_id),
    CONSTRAINT fk_mobile_sync_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_mobile_sync_document FOREIGN KEY (document_id) REFERENCES sales_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
