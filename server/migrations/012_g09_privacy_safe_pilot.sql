CREATE TABLE IF NOT EXISTS app_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    business_id CHAR(36) NOT NULL,
    event_name VARCHAR(48) NOT NULL,
    properties_json JSON NOT NULL,
    dedupe_hash BINARY(32) NULL,
    occurred_at DATETIME NOT NULL,
    event_day DATE NOT NULL,
    UNIQUE KEY uq_app_event_dedupe (business_id, event_name, dedupe_hash),
    KEY idx_app_events_business_time (business_id, occurred_at),
    KEY idx_app_events_user_day (user_id, event_day),
    CONSTRAINT fk_app_event_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_app_event_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pilot_feedback (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    business_id CHAR(36) NOT NULL,
    value_score TINYINT UNSIGNED NOT NULL,
    missing_category ENUM('templates','export','history','settings','payments','other') NULL,
    feedback_text VARCHAR(1000) NOT NULL DEFAULT '',
    triage_status ENUM('new','reviewed','planned','resolved','declined') NOT NULL DEFAULT 'new',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_pilot_feedback_once (user_id, business_id),
    KEY idx_pilot_feedback_triage (triage_status, created_at),
    KEY idx_pilot_feedback_business (business_id, created_at),
    CONSTRAINT fk_pilot_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_pilot_feedback_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT chk_pilot_feedback_score CHECK (value_score BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
