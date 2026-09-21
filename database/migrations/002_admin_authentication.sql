BEGIN;

-- The numbered SQL history remains authoritative; ORM schema declarations only map these tables.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sarathi.schema_migrations WHERE version = 1 AND name = 'commercial_foundation') THEN
    RAISE EXCEPTION 'Migration 001_commercial_foundation must be applied first';
  END IF;
END;
$$;

CREATE TABLE sarathi.auth_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sarathi.auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES sarathi.auth_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX auth_sessions_user_idx ON sarathi.auth_sessions(user_id);
CREATE INDEX auth_sessions_expiry_idx ON sarathi.auth_sessions(expires_at);

CREATE TABLE sarathi.auth_accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES sarathi.auth_users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider_id, account_id)
);
CREATE INDEX auth_accounts_user_idx ON sarathi.auth_accounts(user_id);

CREATE TABLE sarathi.auth_verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX auth_verifications_identifier_idx ON sarathi.auth_verifications(identifier);

-- Fixed-window counters consumed by a single atomic PostgreSQL UPSERT, shared by all workers.
CREATE TABLE sarathi.auth_ratelimits (
  key text PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 128),
  count integer NOT NULL CHECK (count > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX auth_ratelimits_expiry_idx ON sarathi.auth_ratelimits(expires_at);

-- Existing actor rows are historic identity references, so do not add a foreign key that
-- rejects Phase 1/imported actors or cascades deletion into commercial history.
INSERT INTO sarathi.schema_migrations(version, name) VALUES (2, 'admin_authentication');
COMMIT;
