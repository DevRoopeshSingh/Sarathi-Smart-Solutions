BEGIN;
ALTER TABLE sarathi.users ADD COLUMN onboarding_completed_at timestamptz;
INSERT INTO sarathi.schema_migrations(version, name) VALUES (5, 'workflow_guidance');
COMMIT;
