\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.expect_error(statement text, expected_state text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE actual_state text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
    IF actual_state <> expected_state THEN
      RAISE EXCEPTION 'Expected SQLSTATE %, got % for %', expected_state, actual_state, statement;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE %, but statement succeeded: %', expected_state, statement;
END;
$$;

INSERT INTO sarathi.users(identity_subject, display_name, role) VALUES ('test-admin', 'Test admin', 'ADMIN');
INSERT INTO sarathi.customers(name, phone) VALUES ('Customer one', '100'), ('Customer two', '200');
INSERT INTO sarathi.leads(contact_name, phone, service_requested) VALUES ('Customer one', '100', 'CCTV');
INSERT INTO sarathi.projects(customer_id, lead_id, name, site_address)
  VALUES (1, 1, 'First site', 'Address one'), (2, NULL, 'Second site', 'Address two');
INSERT INTO sarathi.project_costings(project_id) VALUES (1);
INSERT INTO sarathi.products(name, unit, unit_cost, unit_sell) VALUES ('Camera', 'piece', 100.00, 150.00);
INSERT INTO sarathi.bom_items(project_id, product_id, position, description, unit, quantity, unit_cost, unit_sell)
  VALUES (1, 1, 1, 'Camera', 'piece', 2, 100, 150);

SELECT pg_temp.expect_error($q$INSERT INTO sarathi.products(name, unit, unit_cost) VALUES ('Bad', 'piece', -1)$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO sarathi.products(name, unit, unit_cost) VALUES ('Bad', 'piece', 'NaN')$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO sarathi.products(name, unit, unit_cost) VALUES ('Bad', 'piece', NULL)$q$, '23502');
SELECT pg_temp.expect_error($q$INSERT INTO sarathi.products(name, unit, unit_cost) VALUES ('Bad', 'piece', 1000000000000)$q$, '22003');
SELECT pg_temp.expect_error($q$UPDATE sarathi.bom_items SET quantity = 0$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.bom_items SET quantity = 'NaN'$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.project_costings SET contingency_percent = 101$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.project_costings SET target_advance_percent = 'NaN'$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.projects SET on_hold = true WHERE id = 1$q$, '23514');
UPDATE sarathi.projects SET on_hold = true, hold_reason = 'Waiting for customer' WHERE id = 1;
UPDATE sarathi.projects SET on_hold = false, hold_reason = NULL WHERE id = 1;
SELECT pg_temp.expect_error($q$UPDATE sarathi.projects SET operational_status = 'PAYMENT_PENDING' WHERE id = 1$q$, '23514');

INSERT INTO sarathi.quotations(project_id, customer_id, version, created_by, customer_name, customer_phone,
  site_address, subtotal, total, recommended_advance, terms, valid_until)
  VALUES (1, 1, 1, 1, 'Customer one', '100', 'Address one', 300, 300, 200, 'Test terms', CURRENT_DATE + 14);
INSERT INTO sarathi.quotation_items(quotation_id, position, description, unit, quantity, unit_sell)
  VALUES (1, 1, 'Camera snapshot', 'piece', 2, 150);
UPDATE sarathi.quotation_items SET description = 'Editable draft snapshot' WHERE quotation_id = 1;
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET total = 299 WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET discount = 301 WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET recommended_advance = 301 WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET customer_id = 2 WHERE id = 1$q$, '23503');
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET status = 'SENT' WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET status = 'APPROVED', frozen_at = CURRENT_TIMESTAMP WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO sarathi.quotations(project_id, customer_id, version, created_by, customer_name, customer_phone, site_address, subtotal, total, recommended_advance, terms, valid_until) VALUES (1, 1, 1, 1, 'Customer', '1', 'Site', 0, 0, 0, '', CURRENT_DATE)$q$, '23505');

UPDATE sarathi.quotations SET status = 'SENT', frozen_at = CURRENT_TIMESTAMP, sent_at = CURRENT_TIMESTAMP WHERE id = 1;
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET subtotal = 400, total = 400 WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET terms = 'Changed' WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET customer_name = 'Changed' WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET version = 2 WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET project_id = 2, customer_id = 2 WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET status = 'DRAFT', frozen_at = NULL WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$DELETE FROM sarathi.quotations WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotation_items SET quantity = 3 WHERE quotation_id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$DELETE FROM sarathi.quotation_items WHERE quotation_id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO sarathi.quotation_items(quotation_id, position, description, unit, quantity, unit_sell) VALUES (1, 2, 'Addition', 'piece', 1, 1)$q$, '23514');
UPDATE sarathi.quotations SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP WHERE id = 1;
SELECT pg_temp.expect_error($q$UPDATE sarathi.quotations SET status = 'SENT' WHERE id = 1$q$, '23514');

INSERT INTO sarathi.payments(project_id, quotation_id, kind, amount, idempotency_key, payment_method, occurred_at, recorded_by)
  VALUES (1, 1, 'RECEIPT', 200, 'receipt-1', 'UPI', CURRENT_TIMESTAMP, 1);
SELECT pg_temp.expect_error($q$INSERT INTO sarathi.payments(project_id, quotation_id, kind, amount, idempotency_key, payment_method, occurred_at, recorded_by) VALUES (2, 1, 'RECEIPT', 1, 'cross-project', 'UPI', CURRENT_TIMESTAMP, 1)$q$, '23503');
SELECT pg_temp.expect_error($q$INSERT INTO sarathi.payments(project_id, kind, amount, idempotency_key, payment_method, occurred_at, recorded_by) VALUES (1, 'RECEIPT', 0, 'zero', 'UPI', CURRENT_TIMESTAMP, 1)$q$, '23514');
SELECT pg_temp.expect_error($q$INSERT INTO sarathi.payments(project_id, kind, amount, idempotency_key, payment_method, occurred_at, recorded_by) VALUES (1, 'RECEIPT', 200, 'receipt-1', 'UPI', CURRENT_TIMESTAMP, 1)$q$, '23505');
SELECT pg_temp.expect_error($q$UPDATE sarathi.payments SET amount = 1 WHERE id = 1$q$, '23514');
SELECT pg_temp.expect_error($q$DELETE FROM sarathi.payments WHERE id = 1$q$, '23514');
INSERT INTO sarathi.payments(project_id, quotation_id, kind, amount, idempotency_key, payment_method, occurred_at, recorded_by)
  VALUES (1, 1, 'REFUND', 20, 'refund-1', 'UPI', CURRENT_TIMESTAMP, 1);

INSERT INTO sarathi.status_history(project_id, from_status, to_status, was_on_hold, is_on_hold, changed_by)
  VALUES (1, NULL, 'SURVEY_PENDING', false, false, 1);
SELECT pg_temp.expect_error($q$UPDATE sarathi.status_history SET reason = 'Rewritten'$q$, '23514');
SELECT pg_temp.expect_error($q$DELETE FROM sarathi.status_history$q$, '23514');
SELECT pg_temp.expect_error($q$TRUNCATE sarathi.quotations CASCADE$q$, '23514');
SELECT pg_temp.expect_error($q$TRUNCATE sarathi.quotation_items$q$, '23514');
SELECT pg_temp.expect_error($q$TRUNCATE sarathi.payments$q$, '23514');
SELECT pg_temp.expect_error($q$TRUNCATE sarathi.status_history$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE sarathi.leads SET requirement_json = '[]'::jsonb$q$, '23514');

DO $$
BEGIN
  IF (SELECT count(*) FROM sarathi.schema_migrations WHERE version = 1) <> 1 THEN
    RAISE EXCEPTION 'Migration version missing';
  END IF;
  IF (SELECT SUM(CASE kind WHEN 'RECEIPT' THEN amount ELSE -amount END) FROM sarathi.payments WHERE project_id = 1) <> 180 THEN
    RAISE EXCEPTION 'Payment receipt/refund arithmetic incorrect';
  END IF;
  IF (SELECT target_advance_percent FROM sarathi.project_costings WHERE project_id = 1) <> 50 THEN
    RAISE EXCEPTION 'Expected 50 percent advance default';
  END IF;
END;
$$;
ROLLBACK;
\echo Commercial foundation constraints passed.
