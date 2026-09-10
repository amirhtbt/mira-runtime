CREATE TABLE IF NOT EXISTS business_settings (
    business_id CHAR(36) PRIMARY KEY,
    settings_json JSON NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_business_settings_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_logo_assets (
    business_id CHAR(36) PRIMARY KEY,
    mime_type VARCHAR(32) NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    width SMALLINT UNSIGNED NOT NULL,
    height SMALLINT UNSIGNED NOT NULL,
    image_bytes MEDIUMBLOB NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_business_logo_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
