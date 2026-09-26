BEGIN;
ALTER TABLE sarathi.auth_users ADD COLUMN two_factor_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE sarathi.auth_two_factors (
  id text PRIMARY KEY,
  secret text NOT NULL,
  backup_codes text NOT NULL,
  user_id text NOT NULL UNIQUE REFERENCES sarathi.auth_users(id) ON DELETE CASCADE,
  verified boolean NOT NULL DEFAULT true,
  failed_verification_count integer NOT NULL DEFAULT 0 CHECK (failed_verification_count >= 0),
  locked_until timestamptz
);
CREATE INDEX auth_two_factors_secret_idx ON sarathi.auth_two_factors(secret);
INSERT INTO sarathi.schema_migrations(version, name) VALUES (3, 'admin_two_factor');
COMMIT;
