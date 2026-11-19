CREATE TABLE IF NOT EXISTS mobile_phone_identities (
    phone_hash BINARY(32) PRIMARY KEY,
    user_id CHAR(36) NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_mobile_phone_user (user_id),
    CONSTRAINT fk_mobile_phone_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
