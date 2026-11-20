CREATE TABLE IF NOT EXISTS mobile_sms_challenges (
    phone_hash BINARY(32) PRIMARY KEY,
    challenge_id CHAR(36) NULL,
    code_hash BINARY(32) NULL,
    expires_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
    attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    send_window_started_at BIGINT UNSIGNED NOT NULL,
    send_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    last_sent_at BIGINT UNSIGNED NULL,
    KEY idx_mobile_sms_last_sent (last_sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
