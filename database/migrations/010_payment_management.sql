BEGIN;
-- No legacy financial row is updated, deleted or given a retrospective document.
ALTER TABLE sarathi.payments ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE sarathi.payments ALTER COLUMN recorded_by SET DEFAULT nullif(current_setting('sarathi.actor_id',true),'')::bigint;
ALTER TABLE sarathi.payments
 ADD COLUMN customer_id bigint,
 ADD COLUMN division_id bigint,
 ADD COLUMN refund_of_id bigint,
 ADD COLUMN purpose text,
 ADD COLUMN receipt_number text,
 ADD COLUMN creation_request_id uuid,
 ADD COLUMN creation_request_hash text,
 ADD FOREIGN KEY(organization_id,customer_id) REFERENCES sarathi.customers(organization_id,id),
 ADD FOREIGN KEY(organization_id,division_id) REFERENCES sarathi.divisions(organization_id,id),
 ADD FOREIGN KEY(organization_id,refund_of_id) REFERENCES sarathi.payments(organization_id,id),
 ADD FOREIGN KEY(organization_id,quotation_id) REFERENCES sarathi.quotations(organization_id,id),
 ADD UNIQUE(organization_id,receipt_number),
 ADD UNIQUE(organization_id,recorded_by,creation_request_id),
 ADD CHECK(project_id IS NOT NULL OR quotation_id IS NOT NULL),
 ADD CHECK((creation_request_id IS NULL AND creation_request_hash IS NULL) OR
  (creation_request_id IS NOT NULL AND creation_request_hash IS NOT NULL AND creation_request_hash ~ '^[a-f0-9]{64}$' AND customer_id IS NOT NULL AND division_id IS NOT NULL)),
 ADD CHECK(refund_of_id IS NULL OR kind='REFUND');
CREATE INDEX payments_refund_idx ON sarathi.payments(organization_id,refund_of_id);
CREATE INDEX payments_division_idx ON sarathi.payments(organization_id,division_id,id DESC);
CREATE TABLE sarathi.payment_counters(
 organization_id bigint NOT NULL,
 division_id bigint NOT NULL,
 issue_year integer NOT NULL,
 last_number bigint NOT NULL CHECK(last_number>0),
 PRIMARY KEY(organization_id,division_id,issue_year),
 FOREIGN KEY(organization_id,division_id) REFERENCES sarathi.divisions(organization_id,id)
);
ALTER TABLE sarathi.payment_counters ENABLE ROW LEVEL SECURITY;
CREATE TABLE sarathi.payment_documents(
 organization_id bigint NOT NULL DEFAULT nullif(current_setting('sarathi.organization_id',true),'')::bigint,
 payment_id bigint NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 pdf bytea NOT NULL CHECK(octet_length(pdf) BETWEEN 8 AND 10485760 AND substring(pdf FROM 1 FOR 5)=decode('255044462d','hex')),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 renderer_version text NOT NULL,
 created_by bigint NOT NULL DEFAULT nullif(current_setting('sarathi.actor_id',true),'')::bigint,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(organization_id,payment_id),
 FOREIGN KEY(organization_id,payment_id) REFERENCES sarathi.payments(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES sarathi.organization_memberships(organization_id,user_id)
);
CREATE TABLE sarathi.payment_allocations(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id bigint NOT NULL DEFAULT nullif(current_setting('sarathi.organization_id',true),'')::bigint,
 receipt_id bigint NOT NULL,
 quotation_id bigint NOT NULL,
 amount numeric(16,2) NOT NULL CHECK(amount<>0),
 refund_id bigint,
 request_id uuid,
 request_hash text,
 created_by bigint NOT NULL DEFAULT nullif(current_setting('sarathi.actor_id',true),'')::bigint,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(organization_id,receipt_id) REFERENCES sarathi.payments(organization_id,id),
 FOREIGN KEY(organization_id,quotation_id) REFERENCES sarathi.quotations(organization_id,id),
 FOREIGN KEY(organization_id,refund_id) REFERENCES sarathi.payments(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES sarathi.organization_memberships(organization_id,user_id),
 UNIQUE(organization_id,created_by,request_id),
 CHECK((amount>0 AND refund_id IS NULL) OR (amount<0 AND refund_id IS NOT NULL)),
 CHECK((request_id IS NULL AND request_hash IS NULL) OR (request_id IS NOT NULL AND request_hash ~ '^[a-f0-9]{64}$'))
);
CREATE INDEX payment_allocations_receipt_idx ON sarathi.payment_allocations(organization_id,receipt_id,id);
CREATE TABLE sarathi.payment_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id bigint NOT NULL,
 payment_id bigint NOT NULL,
 event text NOT NULL,
 amount numeric(16,2) NOT NULL,
 quotation_id bigint,
 recorded_by bigint NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(organization_id,payment_id) REFERENCES sarathi.payments(organization_id,id),
 FOREIGN KEY(organization_id,quotation_id) REFERENCES sarathi.quotations(organization_id,id),
 FOREIGN KEY(organization_id,recorded_by) REFERENCES sarathi.organization_memberships(organization_id,user_id)
);
CREATE INDEX payment_events_page_idx ON sarathi.payment_events(organization_id,payment_id,id DESC);
CREATE FUNCTION sarathi.payment_access(p_org bigint,p_division bigint,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
 SELECT sarathi.tenant_visible(p_org,p_division)
 AND (p_permission='payments.read' OR current_setting('sarathi.permission',true)=p_permission)
 AND EXISTS(SELECT 1 FROM sarathi.organization_memberships m JOIN sarathi.users u ON u.id=m.user_id
 WHERE m.organization_id=p_org AND m.user_id=nullif(current_setting('sarathi.actor_id',true),'')::bigint
 AND m.active AND u.active AND m.role IN ('ADMIN','OPERATOR') AND u.role IN ('ADMIN','OPERATOR')
 AND (p_permission='payments.read' OR (m.role='ADMIN' AND u.role='ADMIN') OR
  (p_permission IN ('payments.create','payments.allocate') AND m.can_record_payments)))
$$;
REVOKE ALL ON FUNCTION sarathi.payment_access(bigint,bigint,text) FROM PUBLIC;
ALTER POLICY tenant_read ON sarathi.payments USING(
 organization_id=nullif(current_setting('sarathi.organization_id',true),'')::bigint
 AND sarathi.payment_access(organization_id,coalesce(division_id,(SELECT p.division_id FROM sarathi.projects p WHERE p.id=project_id AND p.organization_id=payments.organization_id)),'payments.read')
 AND ((project_id IS NOT NULL AND EXISTS(SELECT 1 FROM sarathi.projects p WHERE p.id=project_id AND p.organization_id=payments.organization_id)) OR
 (project_id IS NULL AND EXISTS(SELECT 1 FROM sarathi.quotations q WHERE q.id=quotation_id AND q.organization_id=payments.organization_id))));
CREATE POLICY tenant_insert ON sarathi.payments FOR INSERT WITH CHECK(
 creation_request_id IS NOT NULL AND recorded_by=nullif(current_setting('sarathi.actor_id',true),'')::bigint
 AND sarathi.payment_access(organization_id,division_id,CASE kind WHEN 'REFUND' THEN 'payments.refund' ELSE 'payments.create' END));
DO $$ DECLARE target text;
BEGIN
 FOREACH target IN ARRAY ARRAY['payment_documents','payment_allocations','payment_events'] LOOP
  EXECUTE format('ALTER TABLE sarathi.%I ENABLE ROW LEVEL SECURITY',target);
  EXECUTE format('CREATE POLICY tenant_read ON sarathi.%I FOR SELECT USING(organization_id=nullif(current_setting(''sarathi.organization_id'',true),'''')::bigint AND EXISTS(SELECT 1 FROM sarathi.payments p WHERE p.organization_id=%I.organization_id AND p.id=%I))',target,target,CASE target WHEN 'payment_allocations' THEN 'receipt_id' ELSE 'payment_id' END);
  EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON sarathi.%I FOR EACH ROW EXECUTE FUNCTION sarathi.reject_history_mutation()',target);
  EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON sarathi.%I FOR EACH STATEMENT EXECUTE FUNCTION sarathi.reject_protected_truncate()',target);
 END LOOP;
END $$;
CREATE POLICY tenant_insert ON sarathi.payment_documents FOR INSERT WITH CHECK(
 created_by=nullif(current_setting('sarathi.actor_id',true),'')::bigint AND EXISTS(
 SELECT 1 FROM sarathi.payments p WHERE p.id=payment_id AND p.organization_id=payment_documents.organization_id
 AND p.creation_request_id IS NOT NULL AND p.recorded_by=created_by
 AND sarathi.payment_access(p.organization_id,p.division_id,CASE p.kind WHEN 'REFUND' THEN 'payments.refund' ELSE 'payments.create' END)));
CREATE POLICY tenant_insert ON sarathi.payment_allocations FOR INSERT WITH CHECK(
 amount>0 AND refund_id IS NULL AND request_id IS NOT NULL AND created_by=nullif(current_setting('sarathi.actor_id',true),'')::bigint
 AND EXISTS(SELECT 1 FROM sarathi.payments p WHERE p.id=receipt_id AND p.organization_id=payment_allocations.organization_id
 AND sarathi.payment_access(p.organization_id,p.division_id,'payments.allocate')));

CREATE FUNCTION sarathi.guard_payment_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
DECLARE p sarathi.projects; q sarathi.quotations; original sarathi.payments; refunded numeric; yr integer; n bigint;
BEGIN
 IF NEW.creation_request_id IS NULL THEN
  IF NOT pg_has_role(session_user,(SELECT relowner FROM pg_class WHERE oid='sarathi.payments'::regclass),'MEMBER') THEN
   RAISE EXCEPTION 'Durable payment request required' USING ERRCODE='42501'; END IF;
  IF NEW.project_id IS NULL OR NEW.customer_id IS NOT NULL OR NEW.division_id IS NOT NULL OR NEW.refund_of_id IS NOT NULL OR NEW.receipt_number IS NOT NULL THEN
   RAISE EXCEPTION 'Legacy import requires owner reconciliation' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.recorded_by IS DISTINCT FROM nullif(current_setting('sarathi.actor_id',true),'')::bigint OR
  NOT coalesce(sarathi.payment_access(NEW.organization_id,NEW.division_id,CASE NEW.kind WHEN 'REFUND' THEN 'payments.refund' ELSE 'payments.create' END),false) THEN
  RAISE EXCEPTION 'Payment authorization required' USING ERRCODE='42501'; END IF;
 IF NEW.payment_method NOT IN ('CASH','UPI','BANK_TRANSFER','CARD','OTHER','CORRECTION') OR NEW.purpose IS NULL OR NEW.purpose NOT IN ('ADVANCE','PROGRESS','FINAL','OTHER','REFUND','REVERSAL') OR
  length(coalesce(NEW.reference,''))>200 OR length(coalesce(NEW.note,''))>2000 OR
  NEW.occurred_at>CURRENT_TIMESTAMP+interval '5 minutes' OR NEW.occurred_at<'2000-01-01'::timestamptz THEN
  RAISE EXCEPTION 'Invalid payment details' USING ERRCODE='23514'; END IF;
 IF NEW.payment_method IN ('UPI','BANK_TRANSFER','CARD','OTHER','CORRECTION') AND length(btrim(coalesce(NEW.reference,'')))<1 THEN
  RAISE EXCEPTION 'Transaction reference required' USING ERRCODE='23514'; END IF;
 IF (NEW.purpose='REVERSAL') IS DISTINCT FROM (NEW.payment_method='CORRECTION') THEN RAISE EXCEPTION 'Receipt correction method required' USING ERRCODE='23514'; END IF;
 IF NEW.project_id IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('quote-project:' || NEW.project_id::text,0));
  SELECT * INTO STRICT p FROM sarathi.projects WHERE id=NEW.project_id AND organization_id=NEW.organization_id FOR UPDATE;
  IF p.customer_id<>NEW.customer_id OR p.division_id<>NEW.division_id THEN RAISE EXCEPTION 'Payment ownership mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.quotation_id IS NOT NULL THEN
  SELECT * INTO STRICT q FROM sarathi.quotations WHERE id=NEW.quotation_id AND organization_id=NEW.organization_id;
  PERFORM pg_advisory_xact_lock(hashtextextended('quote-family:' || coalesce(q.root_quotation_id,q.id)::text,0));
  SELECT * INTO STRICT q FROM sarathi.quotations WHERE id=NEW.quotation_id AND organization_id=NEW.organization_id;
  IF q.customer_id<>NEW.customer_id OR coalesce(q.division_id,p.division_id)<>NEW.division_id OR q.project_id IS DISTINCT FROM NEW.project_id
   OR (NEW.kind='RECEIPT' AND q.status<>'APPROVED') THEN RAISE EXCEPTION 'Select an accepted quotation in this scope' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.kind='REFUND' THEN
  IF NEW.refund_of_id IS NULL OR NEW.purpose NOT IN ('REFUND','REVERSAL') OR length(btrim(coalesce(NEW.note,'')))<8 THEN
   RAISE EXCEPTION 'Refund receipt and reason required' USING ERRCODE='23514'; END IF;
  SELECT * INTO STRICT original FROM sarathi.payments WHERE organization_id=NEW.organization_id AND id=NEW.refund_of_id FOR UPDATE;
  IF original.kind<>'RECEIPT' OR original.creation_request_id IS NULL OR original.project_id IS DISTINCT FROM NEW.project_id OR original.quotation_id IS DISTINCT FROM NEW.quotation_id OR
   coalesce(original.customer_id,p.customer_id)<>NEW.customer_id OR coalesce(original.division_id,p.division_id)<>NEW.division_id THEN
   RAISE EXCEPTION 'Refund must match its original receipt' USING ERRCODE='23514'; END IF;
  SELECT coalesce(sum(amount),0) INTO refunded FROM sarathi.payments WHERE organization_id=NEW.organization_id AND refund_of_id=original.id;
  IF NEW.amount>original.amount-refunded THEN RAISE EXCEPTION 'Refund exceeds remaining receipt' USING ERRCODE='23514'; END IF;
 ELSIF NEW.refund_of_id IS NOT NULL OR NEW.purpose IN ('REFUND','REVERSAL') THEN RAISE EXCEPTION 'Invalid receipt kind' USING ERRCODE='23514';
 END IF;
 yr:=extract(year FROM CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata');
 INSERT INTO sarathi.payment_counters VALUES(NEW.organization_id,NEW.division_id,yr,1)
 ON CONFLICT(organization_id,division_id,issue_year) DO UPDATE SET last_number=payment_counters.last_number+1 RETURNING last_number INTO n;
 NEW.receipt_number:='SAR-' || CASE WHEN NEW.purpose='REVERSAL' THEN 'ADJ' WHEN NEW.kind='REFUND' THEN 'RFND' ELSE 'RCPT' END || '-' || NEW.division_id || '-' || yr || '-' || lpad(n::text,greatest(6,length(n::text)),'0');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sarathi.guard_payment_insert() FROM PUBLIC;
CREATE TRIGGER payment_insert_guard BEFORE INSERT ON sarathi.payments FOR EACH ROW EXECUTE FUNCTION sarathi.guard_payment_insert();

CREATE FUNCTION sarathi.guard_payment_allocation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
DECLARE p sarathi.payments; q sarathi.quotations; r sarathi.payments; available numeric; allocated numeric; div bigint;
BEGIN
 SELECT * INTO STRICT p FROM sarathi.payments WHERE id=NEW.receipt_id AND organization_id=NEW.organization_id;
 SELECT coalesce(p.division_id,pr.division_id) INTO div FROM sarathi.projects pr WHERE pr.id=p.project_id;
 div:=coalesce(p.division_id,div);
 IF p.project_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('quote-project:' || p.project_id::text,0));
 ELSE SELECT * INTO STRICT q FROM sarathi.quotations WHERE id=p.quotation_id AND organization_id=p.organization_id;
  PERFORM pg_advisory_xact_lock(hashtextextended('quote-family:' || coalesce(q.root_quotation_id,q.id)::text,0)); END IF;
 SELECT * INTO STRICT p FROM sarathi.payments WHERE id=NEW.receipt_id AND organization_id=NEW.organization_id FOR UPDATE;
 IF p.kind<>'RECEIPT' OR p.creation_request_id IS NULL OR NEW.created_by IS DISTINCT FROM nullif(current_setting('sarathi.actor_id',true),'')::bigint THEN RAISE EXCEPTION 'Receipt allocation required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT q FROM sarathi.quotations WHERE id=NEW.quotation_id AND organization_id=NEW.organization_id;
 IF NEW.amount>0 THEN
  IF NOT coalesce(sarathi.payment_access(NEW.organization_id,div,current_setting('sarathi.permission',true)),false) OR
   current_setting('sarathi.permission',true) NOT IN ('payments.create','payments.allocate') OR q.status<>'APPROVED' OR
   q.project_id IS DISTINCT FROM p.project_id OR
   (p.project_id IS NULL AND coalesce(q.root_quotation_id,q.id)<>(SELECT coalesce(root_quotation_id,id) FROM sarathi.quotations WHERE id=p.quotation_id)) THEN
   RAISE EXCEPTION 'Accepted quotation allocation required' USING ERRCODE='42501'; END IF;
  SELECT p.amount-coalesce((SELECT sum(amount) FROM sarathi.payments WHERE organization_id=p.organization_id AND refund_of_id=p.id),0)
   -coalesce((SELECT sum(amount) FROM sarathi.payment_allocations WHERE organization_id=p.organization_id AND receipt_id=p.id),0) INTO available;
  IF NEW.amount>available THEN RAISE EXCEPTION 'Allocation exceeds unallocated receipt' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO STRICT r FROM sarathi.payments WHERE id=NEW.refund_id AND organization_id=NEW.organization_id;
  IF NOT coalesce(sarathi.payment_access(NEW.organization_id,div,'payments.refund'),false) OR r.refund_of_id<>p.id THEN RAISE EXCEPTION 'Authorized refund required' USING ERRCODE='42501'; END IF;
  SELECT coalesce(sum(amount),0) INTO allocated FROM sarathi.payment_allocations WHERE organization_id=p.organization_id AND receipt_id=p.id AND quotation_id=q.id;
  IF -NEW.amount>allocated OR -NEW.amount>r.amount-coalesce((SELECT -sum(amount) FROM sarathi.payment_allocations WHERE refund_id=r.id),0) THEN RAISE EXCEPTION 'Invalid allocation reversal' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sarathi.guard_payment_allocation() FROM PUBLIC;
CREATE TRIGGER allocation_guard BEFORE INSERT ON sarathi.payment_allocations FOR EACH ROW EXECUTE FUNCTION sarathi.guard_payment_allocation();
CREATE FUNCTION sarathi.audit_payment_allocation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
BEGIN
 INSERT INTO sarathi.payment_events(organization_id,payment_id,event,amount,quotation_id,recorded_by)
 VALUES(NEW.organization_id,NEW.receipt_id,CASE WHEN NEW.amount>0 THEN 'ALLOCATED' WHEN EXISTS(SELECT 1 FROM sarathi.payments p WHERE p.id=NEW.refund_id AND p.purpose='REVERSAL') THEN 'ALLOCATION_REVERSED' ELSE 'ALLOCATION_REFUNDED' END,NEW.amount,NEW.quotation_id,NEW.created_by);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sarathi.audit_payment_allocation() FROM PUBLIC;
CREATE TRIGGER allocation_audit AFTER INSERT ON sarathi.payment_allocations FOR EACH ROW EXECUTE FUNCTION sarathi.audit_payment_allocation();
CREATE FUNCTION sarathi.audit_payment_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
DECLARE release_amount numeric; portion numeric; entry record; original_amount numeric;
BEGIN
 IF NEW.creation_request_id IS NULL THEN RETURN NEW; END IF;
 INSERT INTO sarathi.payment_events(organization_id,payment_id,event,amount,quotation_id,recorded_by)
 VALUES(NEW.organization_id,NEW.id,CASE WHEN NEW.purpose='REVERSAL' THEN 'RECEIPT_REVERSED' ELSE NEW.kind END,NEW.amount,NEW.quotation_id,NEW.recorded_by);
 IF NEW.kind='RECEIPT' AND NEW.quotation_id IS NOT NULL THEN
  INSERT INTO sarathi.payment_allocations(organization_id,receipt_id,quotation_id,amount,created_by) VALUES(NEW.organization_id,NEW.id,NEW.quotation_id,NEW.amount,NEW.recorded_by);
 ELSIF NEW.kind='REFUND' THEN
  SELECT amount INTO STRICT original_amount FROM sarathi.payments WHERE id=NEW.refund_of_id AND organization_id=NEW.organization_id;
  SELECT coalesce(sum(amount),0)-(original_amount-coalesce((SELECT sum(amount) FROM sarathi.payments WHERE refund_of_id=NEW.refund_of_id AND organization_id=NEW.organization_id),0)) INTO release_amount
   FROM sarathi.payment_allocations WHERE receipt_id=NEW.refund_of_id AND organization_id=NEW.organization_id;
  FOR entry IN SELECT quotation_id,sum(amount) AS amount FROM sarathi.payment_allocations WHERE receipt_id=NEW.refund_of_id AND organization_id=NEW.organization_id GROUP BY quotation_id HAVING sum(amount)>0 ORDER BY max(id) DESC LOOP
   EXIT WHEN release_amount<=0;
   portion:=least(release_amount,entry.amount);
   INSERT INTO sarathi.payment_allocations(organization_id,receipt_id,quotation_id,amount,refund_id,created_by) VALUES(NEW.organization_id,NEW.refund_of_id,entry.quotation_id,-portion,NEW.id,NEW.recorded_by);
   release_amount:=release_amount-portion;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sarathi.audit_payment_insert() FROM PUBLIC;
CREATE TRIGGER payment_audit AFTER INSERT ON sarathi.payments FOR EACH ROW EXECUTE FUNCTION sarathi.audit_payment_insert();
CREATE FUNCTION sarathi.require_payment_document() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
BEGIN
 IF NEW.creation_request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sarathi.payment_documents d
 WHERE d.organization_id=NEW.organization_id AND d.payment_id=NEW.id AND d.created_by=NEW.recorded_by
 AND d.snapshot->>'number'=NEW.receipt_number AND d.snapshot->>'amount'=NEW.amount::text
 AND d.snapshot->>'kind'=NEW.kind AND d.snapshot->>'id'=NEW.id::text) THEN
  RAISE EXCEPTION 'Private payment document required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sarathi.require_payment_document() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER payment_document_required AFTER INSERT ON sarathi.payments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sarathi.require_payment_document();
INSERT INTO sarathi.schema_migrations(version,name) VALUES(10,'payment_management');
COMMIT;
