CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    scope_hash CHAR(64) NOT NULL,
    action_key VARCHAR(48) NOT NULL,
    window_started_at DATETIME NOT NULL,
    request_count INT UNSIGNED NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (scope_hash, action_key),
    KEY idx_rate_limit_cleanup (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE payments
    ADD KEY idx_payments_business_created (business_id, created_at);
