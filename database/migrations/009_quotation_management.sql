BEGIN;
-- Existing rows keep all original values. NULL legacy division inherits the owned
-- project's division; new quotation inserts must resolve an explicit division.
ALTER TABLE sarathi.divisions ADD COLUMN document_settings jsonb NOT NULL DEFAULT '{}'::jsonb
 CHECK(jsonb_typeof(document_settings)='object');
UPDATE sarathi.divisions SET document_settings=jsonb_build_object(
 'address','Bhayander East, Mira-Bhayandar, Thane - 401105',
 'phone','+91 83697 04457','email','sarathismartsolutions@gmail.com')
 WHERE organization_id=(SELECT id FROM sarathi.organizations WHERE slug='sarathi') AND slug='smart-solutions';
ALTER TABLE sarathi.projects ADD UNIQUE(organization_id,division_id,id,customer_id);
ALTER TABLE sarathi.quotations ALTER COLUMN project_id DROP NOT NULL;
DO $$ DECLARE cname text; BEGIN
 SELECT conname INTO STRICT cname FROM pg_constraint WHERE conrelid='sarathi.quotations'::regclass
 AND contype='c' AND pg_get_constraintdef(oid) LIKE '%btrim(site_address)%';
 EXECUTE format('ALTER TABLE sarathi.quotations DROP CONSTRAINT %I',cname);
END $$;
ALTER TABLE sarathi.quotations ADD CHECK(project_id IS NULL OR btrim(site_address)<>'');
ALTER TABLE sarathi.quotations
 ADD COLUMN division_id bigint,
 ADD COLUMN title text NOT NULL DEFAULT 'Quotation' CHECK(length(btrim(title)) BETWEEN 1 AND 200),
 ADD COLUMN quote_number text,
 ADD COLUMN root_quotation_id bigint,
 ADD COLUMN revision_of bigint,
 ADD COLUMN draft_version integer NOT NULL DEFAULT 1 CHECK(draft_version>0),
 ADD COLUMN creation_request_id uuid,
 ADD COLUMN creation_request_hash text,
 ADD COLUMN tax_mode text NOT NULL DEFAULT 'LEGACY' CHECK(tax_mode IN ('LEGACY','NONE','GST_EXCLUSIVE','GST_INCLUSIVE')),
 ADD FOREIGN KEY(organization_id,division_id) REFERENCES sarathi.divisions(organization_id,id),
 ADD FOREIGN KEY(organization_id,customer_id) REFERENCES sarathi.customers(organization_id,id),
 ADD FOREIGN KEY(organization_id,division_id,project_id,customer_id) REFERENCES sarathi.projects(organization_id,division_id,id,customer_id),
 ADD UNIQUE(organization_id,quote_number),
 ADD UNIQUE(organization_id,created_by,creation_request_id),
 ADD UNIQUE(organization_id,division_id,id,customer_id),
 ADD UNIQUE(organization_id,id,customer_id),
 ADD CHECK((creation_request_id IS NULL AND creation_request_hash IS NULL) OR
   (creation_request_id IS NOT NULL AND creation_request_hash IS NOT NULL AND creation_request_hash ~ '^[a-f0-9]{64}$')),
 ADD CHECK((root_quotation_id IS NULL AND revision_of IS NULL) OR
   (root_quotation_id IS NOT NULL AND revision_of IS NOT NULL AND root_quotation_id<>id AND revision_of<>id));
ALTER TABLE sarathi.quotations
 ADD FOREIGN KEY(organization_id,root_quotation_id,customer_id) REFERENCES sarathi.quotations(organization_id,id,customer_id),
 ADD FOREIGN KEY(organization_id,revision_of,customer_id) REFERENCES sarathi.quotations(organization_id,id,customer_id);
CREATE UNIQUE INDEX quotation_family_version_idx ON sarathi.quotations(organization_id,coalesce(root_quotation_id,id),version);
-- Stop for owner review if old data has conflicting accepted baselines; never erase it.
CREATE UNIQUE INDEX quotation_accepted_project_idx ON sarathi.quotations(organization_id,project_id)
 WHERE status='APPROVED' AND project_id IS NOT NULL;
CREATE UNIQUE INDEX quotation_accepted_family_idx ON sarathi.quotations(organization_id,coalesce(root_quotation_id,id)) WHERE status='APPROVED';
CREATE INDEX quotations_division_page_idx ON sarathi.quotations(organization_id,division_id,id DESC);
DO $$ DECLARE constraint_name text;
BEGIN
 SELECT conname INTO STRICT constraint_name FROM pg_constraint
 WHERE conrelid='sarathi.quotations'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%total%=%subtotal%service_charges%discount%tax_amount%';
 EXECUTE format('ALTER TABLE sarathi.quotations DROP CONSTRAINT %I',constraint_name);
END $$;
ALTER TABLE sarathi.quotations ADD CONSTRAINT quotation_total_exact CHECK(
 total=subtotal+service_charges-discount+CASE WHEN tax_mode='GST_INCLUSIVE' THEN 0 ELSE tax_amount END);
ALTER TABLE sarathi.quotation_items
 ADD COLUMN tax_percent sarathi.percentage NOT NULL DEFAULT 0,
 ADD COLUMN line_amount sarathi.money_amount,
 ADD COLUMN discount_amount sarathi.money_amount,
 ADD COLUMN net_amount sarathi.money_amount,
 ADD COLUMN tax_amount sarathi.money_amount,
 ADD COLUMN line_total sarathi.money_amount;

CREATE TABLE sarathi.quotation_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id bigint NOT NULL,
 quotation_id bigint NOT NULL,
 event text NOT NULL,
 from_status text,
 to_status text NOT NULL,
 draft_version integer NOT NULL,
 reason text,
 recorded_by bigint,
 recorded_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(organization_id,quotation_id) REFERENCES sarathi.quotations(organization_id,id),
 FOREIGN KEY(organization_id,recorded_by) REFERENCES sarathi.organization_memberships(organization_id,user_id)
);
CREATE INDEX quotation_events_page_idx ON sarathi.quotation_events(organization_id,quotation_id,id DESC);
CREATE TABLE sarathi.quotation_documents(
 organization_id bigint NOT NULL DEFAULT nullif(current_setting('sarathi.organization_id',true),'')::bigint,
 quotation_id bigint NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 pdf bytea NOT NULL CHECK(octet_length(pdf) BETWEEN 8 AND 10485760 AND substring(pdf FROM 1 FOR 5)=decode('255044462d','hex')),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 renderer_version text NOT NULL,
 created_by bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(organization_id,quotation_id),
 FOREIGN KEY(organization_id,quotation_id) REFERENCES sarathi.quotations(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES sarathi.organization_memberships(organization_id,user_id)
);
CREATE TABLE sarathi.quotation_counters(
 organization_id bigint NOT NULL,
 division_id bigint NOT NULL,
 issue_year integer NOT NULL,
 last_number bigint NOT NULL CHECK(last_number>0),
 PRIMARY KEY(organization_id,division_id,issue_year),
 FOREIGN KEY(organization_id,division_id) REFERENCES sarathi.divisions(organization_id,id)
);
ALTER TABLE sarathi.quotation_counters ENABLE ROW LEVEL SECURITY;
-- Counter allocation has no runtime table grants. Its fixed-path function is scoped.
CREATE FUNCTION sarathi.next_quotation_number(p_division bigint) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
DECLARE org bigint:=nullif(current_setting('sarathi.organization_id',true),'')::bigint;
 yr integer:=extract(year FROM CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'); n bigint; prefix text;
BEGIN
 IF NOT sarathi.tenant_writable(org,p_division,ARRAY['quotations.update']) THEN
  RAISE EXCEPTION 'Quotation issue authorization required' USING ERRCODE='42501'; END IF;
 SELECT CASE slug WHEN 'smart-solutions' THEN 'SMART' WHEN 'digital-seva-kendra' THEN 'SEVA'
 WHEN 'ai-business-solutions' THEN 'AI' ELSE 'DIV' || id::text END INTO STRICT prefix
 FROM sarathi.divisions WHERE organization_id=org AND id=p_division;
 INSERT INTO sarathi.quotation_counters VALUES(org,p_division,yr,1)
 ON CONFLICT(organization_id,division_id,issue_year) DO UPDATE SET last_number=quotation_counters.last_number+1
 RETURNING last_number INTO n;
 RETURN 'SAR-' || prefix || '-' || yr || '-' || lpad(n::text,greatest(6,length(n::text)),'0');
END $$;
REVOKE ALL ON FUNCTION sarathi.next_quotation_number(bigint) FROM PUBLIC;

ALTER POLICY tenant_read ON sarathi.quotations USING(
 organization_id=nullif(current_setting('sarathi.organization_id',true),'')::bigint
 AND sarathi.tenant_visible(organization_id,coalesce(division_id,(SELECT p.division_id FROM sarathi.projects p WHERE p.id=project_id AND p.organization_id=quotations.organization_id)))
 AND (project_id IS NULL OR EXISTS(SELECT 1 FROM sarathi.projects p WHERE p.id=project_id AND p.organization_id=quotations.organization_id)));
CREATE POLICY tenant_insert ON sarathi.quotations FOR INSERT WITH CHECK(
 creation_request_id IS NOT NULL AND tax_mode<>'LEGACY' AND division_id IS NOT NULL AND sarathi.tenant_writable(organization_id,division_id,ARRAY['quotations.create'])
 AND created_by=nullif(current_setting('sarathi.actor_id',true),'')::bigint);
CREATE POLICY tenant_update ON sarathi.quotations FOR UPDATE
 USING(sarathi.tenant_writable(organization_id,coalesce(division_id,(SELECT p.division_id FROM sarathi.projects p WHERE p.id=project_id)),ARRAY['quotations.update','quotations.create']))
 WITH CHECK(sarathi.tenant_writable(organization_id,coalesce(division_id,(SELECT p.division_id FROM sarathi.projects p WHERE p.id=project_id)),ARRAY['quotations.update','quotations.create']));
CREATE POLICY tenant_insert ON sarathi.quotation_items FOR INSERT WITH CHECK(
 sarathi.tenant_writable(organization_id,NULL,ARRAY['quotations.create','quotations.update'])
 AND EXISTS(SELECT 1 FROM sarathi.quotations q WHERE q.id=quotation_id AND q.organization_id=quotation_items.organization_id AND q.status='DRAFT'));
CREATE POLICY tenant_update ON sarathi.quotation_items FOR UPDATE USING(
 sarathi.tenant_writable(organization_id,NULL,ARRAY['quotations.update']) AND EXISTS(SELECT 1 FROM sarathi.quotations q WHERE q.id=quotation_id AND q.status='DRAFT'))
 WITH CHECK(sarathi.tenant_writable(organization_id,NULL,ARRAY['quotations.update']) AND EXISTS(SELECT 1 FROM sarathi.quotations q WHERE q.id=quotation_id AND q.status='DRAFT'));
CREATE POLICY tenant_delete ON sarathi.quotation_items FOR DELETE USING(
 sarathi.tenant_writable(organization_id,NULL,ARRAY['quotations.update']) AND EXISTS(SELECT 1 FROM sarathi.quotations q WHERE q.id=quotation_id AND q.status='DRAFT'));
DO $$ DECLARE target text;
BEGIN
 FOREACH target IN ARRAY ARRAY['quotation_events','quotation_documents'] LOOP
  EXECUTE format('ALTER TABLE sarathi.%I ENABLE ROW LEVEL SECURITY',target);
  EXECUTE format('CREATE POLICY tenant_read ON sarathi.%I FOR SELECT USING(organization_id=nullif(current_setting(''sarathi.organization_id'',true),'''')::bigint AND sarathi.tenant_visible(organization_id) AND EXISTS(SELECT 1 FROM sarathi.quotations q WHERE q.id=quotation_id AND q.organization_id=%I.organization_id))',target,target);
  EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON sarathi.%I FOR EACH ROW EXECUTE FUNCTION sarathi.reject_history_mutation()',target);
  EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON sarathi.%I FOR EACH STATEMENT EXECUTE FUNCTION sarathi.reject_protected_truncate()',target);
 END LOOP;
END $$;
CREATE POLICY tenant_insert ON sarathi.quotation_documents FOR INSERT WITH CHECK(
 sarathi.tenant_writable(organization_id,NULL,ARRAY['quotations.update'])
 AND created_by=nullif(current_setting('sarathi.actor_id',true),'')::bigint
 AND EXISTS(SELECT 1 FROM sarathi.quotations q WHERE q.id=quotation_id AND q.organization_id=quotation_documents.organization_id AND q.status='DRAFT' AND q.creation_request_id IS NOT NULL AND q.tax_mode<>'LEGACY'));
-- Explicit acceptance integration can update a visible project and append its stage audit.
ALTER POLICY tenant_update ON sarathi.projects
 USING(sarathi.tenant_writable(organization_id,division_id,ARRAY['projects.update','quotations.update']))
 WITH CHECK(sarathi.tenant_writable(organization_id,division_id,ARRAY['projects.update','quotations.update']));
ALTER POLICY tenant_insert ON sarathi.status_history WITH CHECK(
 sarathi.tenant_writable(organization_id,NULL,ARRAY['projects.create','projects.update','quotations.update'])
 AND changed_by=nullif(current_setting('sarathi.actor_id',true),'')::bigint
 AND EXISTS(SELECT 1 FROM sarathi.projects p WHERE p.id=project_id AND p.organization_id=status_history.organization_id));

-- Preserve the original default-deny frozen-content rule and lifecycle transitions.
CREATE OR REPLACE FUNCTION sarathi.guard_frozen_quotation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,sarathi AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.frozen_at IS NOT NULL THEN RAISE EXCEPTION 'New quotations must start as drafts' USING ERRCODE='23514'; END IF;
  IF NEW.division_id IS NULL AND NEW.project_id IS NOT NULL THEN
   SELECT division_id INTO NEW.division_id FROM sarathi.projects WHERE id=NEW.project_id AND organization_id=NEW.organization_id;
  END IF;
  IF NEW.division_id IS NULL THEN RAISE EXCEPTION 'Quotation division required' USING ERRCODE='23514'; END IF;
  IF NEW.revision_of IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sarathi.quotations q LEFT JOIN sarathi.projects p ON p.id=q.project_id
   WHERE q.organization_id=NEW.organization_id AND q.id=NEW.revision_of AND q.customer_id=NEW.customer_id
   AND coalesce(q.division_id,p.division_id)=NEW.division_id AND q.project_id IS NOT DISTINCT FROM NEW.project_id
   AND coalesce(q.root_quotation_id,q.id)=NEW.root_quotation_id) THEN
   RAISE EXCEPTION 'Revision association must match its parent' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Quotations are retained; withdraw or revise them' USING ERRCODE='23514'; END IF;
 IF ROW(NEW.id,NEW.organization_id,NEW.created_by,NEW.creation_request_id,NEW.creation_request_hash,NEW.root_quotation_id,NEW.revision_of)
 IS DISTINCT FROM ROW(OLD.id,OLD.organization_id,OLD.created_by,OLD.creation_request_id,OLD.creation_request_hash,OLD.root_quotation_id,OLD.revision_of) THEN
  RAISE EXCEPTION 'Quotation identity and ownership are immutable' USING ERRCODE='23514'; END IF;
 IF OLD.root_quotation_id IS NOT NULL AND ROW(NEW.customer_id,NEW.project_id,NEW.division_id) IS DISTINCT FROM ROW(OLD.customer_id,OLD.project_id,OLD.division_id) THEN
  RAISE EXCEPTION 'Revision association must match its family' USING ERRCODE='23514'; END IF;
 IF OLD.frozen_at IS NOT NULL THEN
  IF (to_jsonb(NEW)-ARRAY['status','sent_at','approved_at','declined_at','voided_at','updated_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','sent_at','approved_at','declined_at','voided_at','updated_at']) THEN
   RAISE EXCEPTION 'Frozen quotation content cannot be changed' USING ERRCODE='23514'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT(
   (OLD.status='SENT' AND NEW.status IN('APPROVED','DECLINED','SUPERSEDED','VOID')) OR
   (OLD.status IN('APPROVED','DECLINED') AND NEW.status IN('SUPERSEDED','VOID'))) THEN
   RAISE EXCEPTION 'Invalid frozen quotation status transition' USING ERRCODE='23514'; END IF;
 ELSIF NEW.status NOT IN('DRAFT','SENT','VOID') THEN RAISE EXCEPTION 'Draft quotations must be issued before approval' USING ERRCODE='23514';
 ELSE
  IF NEW.draft_version=OLD.draft_version+1 OR to_jsonb(NEW)-ARRAY['draft_version','updated_at'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['draft_version','updated_at'] THEN
   NEW.draft_version:=OLD.draft_version+1; NEW.updated_at:=CURRENT_TIMESTAMP;
  ELSE NEW.draft_version:=OLD.draft_version; NEW.updated_at:=OLD.updated_at; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION sarathi.audit_quotation_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
DECLARE actor bigint:=nullif(current_setting('sarathi.actor_id',true),'')::bigint; kind text; old_status text;
BEGIN
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 IF actor IS NULL THEN
  IF NOT pg_has_role(session_user,(SELECT relowner FROM pg_class WHERE oid='sarathi.quotations'::regclass),'MEMBER') THEN
   RAISE EXCEPTION 'Quotation audit actor required' USING ERRCODE='42501'; END IF;
 ELSIF NOT sarathi.tenant_writable(NEW.organization_id,coalesce(NEW.division_id,(SELECT division_id FROM sarathi.projects WHERE id=NEW.project_id)),ARRAY['quotations.create','quotations.update']) THEN
  RAISE EXCEPTION 'Quotation audit authorization required' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN kind:='CREATED'; ELSE
  old_status:=OLD.status;
  kind:=CASE WHEN NEW.status=OLD.status THEN 'EDITED' WHEN NEW.status='SENT' THEN 'ISSUED'
   WHEN NEW.status='APPROVED' THEN 'ACCEPTED_STAFF' WHEN NEW.status='DECLINED' THEN 'REJECTED_STAFF'
   ELSE NEW.status END;
 END IF;
 INSERT INTO sarathi.quotation_events(organization_id,quotation_id,event,from_status,to_status,draft_version,reason,recorded_by)
 VALUES(NEW.organization_id,NEW.id,kind,old_status,NEW.status,NEW.draft_version,
  nullif(current_setting('sarathi.quote_reason',true),''),actor);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sarathi.audit_quotation_change() FROM PUBLIC;
CREATE TRIGGER quotation_audit AFTER INSERT OR UPDATE ON sarathi.quotations
 FOR EACH ROW EXECUTE FUNCTION sarathi.audit_quotation_change();
CREATE FUNCTION sarathi.require_issued_document() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,sarathi AS $$
BEGIN
 IF NEW.creation_request_id IS NOT NULL AND NEW.frozen_at IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM sarathi.quotation_documents d WHERE d.organization_id=NEW.organization_id AND d.quotation_id=NEW.id
  AND d.snapshot->>'quotationNumber'=NEW.quote_number) THEN
  RAISE EXCEPTION 'Issued quotation document missing' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER issued_document_required AFTER INSERT OR UPDATE ON sarathi.quotations
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sarathi.require_issued_document();
INSERT INTO sarathi.schema_migrations(version,name) VALUES(9,'quotation_management');
COMMIT;
