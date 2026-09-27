BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sarathi.schema_migrations WHERE version = 3 AND name = 'admin_two_factor'
  ) THEN
    RAISE EXCEPTION 'Migration 003_admin_two_factor must be applied first';
  END IF;
END;
$$;

ALTER TABLE sarathi.users DROP CONSTRAINT users_role_check;
UPDATE sarathi.users SET role = 'OPERATOR' WHERE role = 'TECHNICIAN';
ALTER TABLE sarathi.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'OPERATOR', 'VIEWER'));

CREATE FUNCTION sarathi.admin_set_user_role(p_actor_id bigint, p_target_id bigint, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, sarathi
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(1935766113, 2);

  IF NOT EXISTS (
    SELECT 1 FROM sarathi.users WHERE id = p_actor_id AND active AND role = 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'Administrator access is required' USING ERRCODE = '42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('ADMIN', 'OPERATOR', 'VIEWER') THEN
    RAISE EXCEPTION 'Invalid role' USING ERRCODE = '22023';
  END IF;
  IF p_actor_id = p_target_id AND p_role <> 'ADMIN' THEN
    RAISE EXCEPTION 'Administrators cannot demote their own account' USING ERRCODE = '42501';
  END IF;
  IF p_role <> 'ADMIN'
     AND EXISTS (SELECT 1 FROM sarathi.users WHERE id = p_target_id AND active AND role = 'ADMIN')
     AND (SELECT count(*) FROM sarathi.users WHERE active AND role = 'ADMIN') <= 1 THEN
    RAISE EXCEPTION 'At least one active administrator must remain' USING ERRCODE = '42501';
  END IF;

  UPDATE sarathi.users SET role = p_role WHERE id = p_target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User does not exist' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION sarathi.admin_set_user_role(bigint, bigint, text) FROM PUBLIC;

INSERT INTO sarathi.schema_migrations(version, name) VALUES (4, 'role_based_access');
COMMIT;