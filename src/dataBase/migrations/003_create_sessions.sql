CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    refresh_token_hash TEXT NOT NULL,

    ip_address INET,

    user_agent TEXT,

    expires_at TIMESTAMP NOT NULL,

    revoked_at TIMESTAMP NULL,

    last_used_at TIMESTAMP NULL,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);