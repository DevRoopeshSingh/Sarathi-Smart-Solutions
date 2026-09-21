-- Apply as the migration owner after both numbered migrations. The runtime login role
-- must already exist, must not own this schema/tables, and must not inherit owner roles.
-- Example: psql -X -v ON_ERROR_STOP=1 -v runtime_role=sarathi_runtime -f database/runtime-grants.sql
-- This is an operator grant recipe, not a numbered schema migration or role creator.
\if :{?runtime_role}
\else
  \echo 'Supply -v runtime_role=the_existing_runtime_role'
  \quit 1
\endif

BEGIN;
GRANT USAGE ON SCHEMA sarathi TO :"runtime_role";
GRANT SELECT ON sarathi.users, sarathi.leads, sarathi.customers, sarathi.projects, sarathi.quotations, sarathi.payments TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON
  sarathi.auth_users, sarathi.auth_accounts, sarathi.auth_sessions,
  sarathi.auth_verifications, sarathi.auth_ratelimits TO :"runtime_role";
COMMIT;
