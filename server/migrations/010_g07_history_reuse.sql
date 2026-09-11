ALTER TABLE sales_documents
    ADD COLUMN archived_at DATETIME NULL AFTER cancelled_at,
    ADD COLUMN duplicated_from_document_id CHAR(36) NULL AFTER revision_of_document_id,
    ADD COLUMN draft_settings_json JSON NULL AFTER customer_snapshot_json,
    ADD KEY idx_documents_business_history (business_id, archived_at, created_at, id),
    ADD KEY idx_documents_business_number (business_id, document_number),
    ADD KEY idx_documents_duplicate_source (duplicated_from_document_id),
    ADD CONSTRAINT fk_document_duplicate_source FOREIGN KEY (duplicated_from_document_id) REFERENCES sales_documents(id) ON DELETE SET NULL;
