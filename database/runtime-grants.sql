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
SELECT set_config('sarathi.grant_runtime_role', :'runtime_role', true);
DO $$
DECLARE role_name text := current_setting('sarathi.grant_runtime_role');
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='sarathi' AND c.relkind='r' AND pg_has_role(role_name,c.relowner,'MEMBER')) THEN
  RAISE EXCEPTION 'Runtime role must not bypass row security or belong to a table-owner role';
 END IF;
END;
$$;
GRANT USAGE ON SCHEMA sarathi TO :"runtime_role";
GRANT SELECT ON sarathi.users, sarathi.leads, sarathi.customers, sarathi.projects, sarathi.quotations, sarathi.payments TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON
  sarathi.auth_users, sarathi.auth_accounts, sarathi.auth_sessions,
  sarathi.auth_verifications, sarathi.auth_ratelimits, sarathi.auth_two_factors TO :"runtime_role";
-- Only columns used by the authenticated admin workflows. Historical financial
-- records, user roles, costs and deletes remain outside the runtime write boundary.
-- GENERATED ALWAYS identity defaults do not require broad sequence privileges.
GRANT SELECT ON sarathi.customer_changes TO :"runtime_role";
GRANT UPDATE (name, phone, email, address) ON sarathi.customers TO :"runtime_role";
GRANT INSERT (name, phone, email, address, creation_request_id, creation_request_actor_id, creation_request_hash) ON sarathi.customers TO :"runtime_role";
GRANT INSERT (contact_name, phone, service_requested, source, notes, status)
  ON sarathi.leads TO :"runtime_role";
GRANT UPDATE (status, customer_id, updated_at) ON sarathi.leads TO :"runtime_role";
GRANT INSERT (customer_id, lead_id, name, site_address, scope, service_types, operational_status)
  ON sarathi.projects TO :"runtime_role";
GRANT UPDATE (operational_status, updated_at) ON sarathi.projects TO :"runtime_role";
GRANT INSERT (project_id, from_status, to_status, was_on_hold, is_on_hold, reason, changed_by)
  ON sarathi.status_history TO :"runtime_role";
REVOKE EXECUTE ON FUNCTION sarathi.admin_set_user_role(bigint, bigint, text) FROM :"runtime_role";
GRANT EXECUTE ON FUNCTION sarathi.admin_set_membership_role(bigint,bigint,bigint,text),
 sarathi.tenant_visible(bigint,bigint), sarathi.tenant_writable(bigint,bigint,text[]) TO :"runtime_role";
-- Milestone 4: quotation drafts/lifecycle/documents only, never payments or costs.
GRANT SELECT ON sarathi.quotation_items,sarathi.quotation_events,sarathi.quotation_documents TO :"runtime_role";
GRANT INSERT (customer_id,division_id,project_id,title,version,created_by,customer_name,customer_phone,customer_email,customer_address,site_address,subtotal,discount,tax_amount,total,recommended_advance,terms,valid_until,tax_mode,root_quotation_id,revision_of,creation_request_id,creation_request_hash)
 ON sarathi.quotations TO :"runtime_role";
GRANT UPDATE (customer_id,division_id,project_id,title,version,customer_name,customer_phone,customer_email,customer_address,site_address,subtotal,discount,tax_amount,total,recommended_advance,terms,valid_until,tax_mode,draft_version,quote_number,status,frozen_at,sent_at,approved_at,declined_at,updated_at)
 ON sarathi.quotations TO :"runtime_role";
GRANT INSERT (quotation_id,position,description,unit,quantity,unit_sell,tax_percent,line_amount,discount_amount,net_amount,tax_amount,line_total)
 ON sarathi.quotation_items TO :"runtime_role";
GRANT DELETE ON sarathi.quotation_items TO :"runtime_role";
GRANT INSERT (quotation_id,snapshot,pdf,sha256,renderer_version,created_by) ON sarathi.quotation_documents TO :"runtime_role";
GRANT EXECUTE ON FUNCTION sarathi.next_quotation_number(bigint) TO :"runtime_role";
-- Milestone 5: append-only receipts/refunds, positive allocations and private artifacts.
-- No financial UPDATE/DELETE, counter or audit-writing grant is supplied.
GRANT SELECT ON sarathi.payment_documents,sarathi.payment_allocations,sarathi.payment_events TO :"runtime_role";
GRANT INSERT (project_id,quotation_id,customer_id,division_id,kind,amount,idempotency_key,payment_method,reference,note,occurred_at,purpose,refund_of_id,creation_request_id,creation_request_hash)
 ON sarathi.payments TO :"runtime_role";
GRANT INSERT (payment_id,snapshot,pdf,sha256,renderer_version) ON sarathi.payment_documents TO :"runtime_role";
GRANT INSERT (receipt_id,quotation_id,amount,request_id,request_hash) ON sarathi.payment_allocations TO :"runtime_role";
GRANT EXECUTE ON FUNCTION sarathi.payment_access(bigint,bigint,text) TO :"runtime_role";
-- Read recorded project activity and acknowledge only the current user's introduction.
GRANT SELECT ON sarathi.status_history TO :"runtime_role";
GRANT UPDATE (onboarding_completed_at) ON sarathi.users TO :"runtime_role";
-- Organization metadata is owner-managed; runtime has no membership/assignment writes.
GRANT SELECT ON sarathi.organizations, sarathi.divisions,
  sarathi.organization_memberships, sarathi.division_assignments TO :"runtime_role";
COMMIT;
