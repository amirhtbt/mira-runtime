CREATE TABLE IF NOT EXISTS business_official_logo_assets (
  business_id CHAR(36) NOT NULL PRIMARY KEY,
  mime_type VARCHAR(32) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  width SMALLINT UNSIGNED NOT NULL,
  height SMALLINT UNSIGNED NOT NULL,
  image_bytes MEDIUMBLOB NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_official_logo_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE sales_documents
  ADD COLUMN revision_of_document_id CHAR(36) NULL AFTER source_document_id,
  ADD COLUMN cancelled_at DATETIME NULL AFTER issued_at,
  ADD COLUMN cancel_reason VARCHAR(500) NULL AFTER cancelled_at,
  ADD INDEX idx_sales_documents_revision (business_id, revision_of_document_id),
  ADD CONSTRAINT fk_sales_documents_revision FOREIGN KEY (revision_of_document_id) REFERENCES sales_documents(id) ON DELETE RESTRICT;
