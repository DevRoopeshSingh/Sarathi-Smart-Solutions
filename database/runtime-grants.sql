-- Apply as the migration owner after all numbered migrations. The runtime login role
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
  sarathi.auth_verifications, sarathi.auth_ratelimits, sarathi.auth_two_factors TO :"runtime_role";
-- Only columns used by the authenticated admin workflows. Historical financial
-- records, user roles, costs and deletes remain outside the runtime write boundary.
-- GENERATED ALWAYS identity defaults do not require broad sequence privileges.
GRANT INSERT (name, phone, email, address) ON sarathi.customers TO :"runtime_role";
GRANT INSERT (contact_name, phone, service_requested, source, notes, status)
  ON sarathi.leads TO :"runtime_role";
GRANT UPDATE (status, customer_id, updated_at) ON sarathi.leads TO :"runtime_role";
GRANT INSERT (customer_id, lead_id, name, site_address, scope, service_types, operational_status)
  ON sarathi.projects TO :"runtime_role";
GRANT UPDATE (operational_status, updated_at) ON sarathi.projects TO :"runtime_role";
GRANT INSERT (project_id, from_status, to_status, was_on_hold, is_on_hold, reason, changed_by)
  ON sarathi.status_history TO :"runtime_role";
COMMIT;
