CREATE TABLE IF NOT EXISTS migrations (
    version VARCHAR(128) PRIMARY KEY,
    applied_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS businesses (
    id CHAR(36) PRIMARY KEY,
    owner_user_id CHAR(36) NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_business_owner (owner_user_id),
    CONSTRAINT fk_business_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telegram_identities (
    user_id CHAR(36) PRIMARY KEY,
    telegram_user_id BIGINT UNSIGNED NOT NULL,
    username VARCHAR(64) NULL,
    first_name VARCHAR(128) NULL,
    last_name VARCHAR(128) NULL,
    linked_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_telegram_user_id (telegram_user_id),
    CONSTRAINT fk_telegram_identity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
    token_hash BINARY(32) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    business_id CHAR(36) NOT NULL,
    created_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    idle_expires_at DATETIME NOT NULL,
    absolute_expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    user_agent_hash BINARY(32) NULL,
    KEY idx_sessions_user (user_id),
    KEY idx_sessions_expiry (absolute_expires_at),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telegram_auth_replays (
    fingerprint BINARY(32) PRIMARY KEY,
    telegram_user_id BIGINT UNSIGNED NOT NULL,
    accepted_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    session_hash BINARY(32) NULL,
    KEY idx_replay_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
