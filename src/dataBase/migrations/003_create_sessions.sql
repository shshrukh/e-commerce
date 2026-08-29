CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    selector TEXT NOT NULL UNIQUE,

    refresh_token_hash TEXT NOT NULL,

    ip_address INET,

    user_agent TEXT,

    device_name TEXT,

    location TEXT,

    expire_at TIMESTAMPTZ NOT NULL,

    last_use_at TIMESTAMPTZ,

    revoked_at TIMESTAMPTZ,

    revoked_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);