CREATE TABLE IF NOT EXISTS mobile_telegram_links (
    user_id CHAR(36) PRIMARY KEY,
    token_hash BINARY(32) NOT NULL UNIQUE,
    phone_hash BINARY(32) NOT NULL,
    expires_at BIGINT UNSIGNED NOT NULL,
    CONSTRAINT fk_mobile_telegram_link_user FOREIGN KEY (user_id) REFERENCES telegram_identities(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
