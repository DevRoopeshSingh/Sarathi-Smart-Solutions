BEGIN;
CREATE FUNCTION sarathi.normalize_customer_phone(p_phone text) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog AS $$
DECLARE digits text := regexp_replace(p_phone,'[^0-9]','','g');
BEGIN
 IF left(digits,2)='00' THEN digits:=substr(digits,3); END IF;
 IF digits ~ '^91[6-9][0-9]{9}$' THEN RETURN substr(digits,3); END IF;
 IF digits ~ '^0[6-9][0-9]{9}$' THEN RETURN substr(digits,2); END IF;
 RETURN digits;
END;
$$;
ALTER TABLE sarathi.customers
 ADD COLUMN normalized_phone text GENERATED ALWAYS AS (sarathi.normalize_customer_phone(phone)) STORED,
 ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0),
 ADD COLUMN creation_request_id uuid,
 ADD COLUMN creation_request_actor_id bigint,
 ADD COLUMN creation_request_hash text,
 ADD CONSTRAINT customer_request_complete CHECK(
  (creation_request_id IS NULL AND creation_request_actor_id IS NULL AND creation_request_hash IS NULL)
  OR (creation_request_id IS NOT NULL AND creation_request_actor_id IS NOT NULL AND creation_request_hash IS NOT NULL AND creation_request_hash ~ '^[a-f0-9]{64}$')),
 ADD FOREIGN KEY(organization_id,creation_request_actor_id) REFERENCES sarathi.organization_memberships(organization_id,user_id),
 ADD UNIQUE(organization_id,creation_request_actor_id,creation_request_id);
CREATE INDEX customers_phone_idx ON sarathi.customers(organization_id,normalized_phone);
CREATE INDEX customers_name_idx ON sarathi.customers(organization_id,lower(name));
CREATE TABLE sarathi.customer_changes(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id bigint NOT NULL,
 customer_id bigint NOT NULL,
 customer_version integer NOT NULL,
 changed_by bigint,
 changed_fields text[] NOT NULL CHECK(cardinality(changed_fields)>0 AND changed_fields <@ ARRAY['name','phone','email','address']::text[]),
 changed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(organization_id,customer_id) REFERENCES sarathi.customers(organization_id,id),
 FOREIGN KEY(organization_id,changed_by) REFERENCES sarathi.organization_memberships(organization_id,user_id)
);
CREATE INDEX customer_changes_page_idx ON sarathi.customer_changes(organization_id,customer_id,id DESC);
ALTER TABLE sarathi.customer_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON sarathi.customer_changes FOR SELECT USING(
 organization_id=nullif(current_setting('sarathi.organization_id',true),'')::bigint
 AND sarathi.tenant_visible(organization_id));
ALTER POLICY tenant_insert ON sarathi.customers WITH CHECK(
 sarathi.tenant_writable(organization_id,NULL,ARRAY['customers.create'])
 AND (creation_request_actor_id IS NULL OR creation_request_actor_id=nullif(current_setting('sarathi.actor_id',true),'')::bigint));
CREATE POLICY tenant_update ON sarathi.customers FOR UPDATE
 USING(sarathi.tenant_writable(organization_id,NULL,ARRAY['customers.update']))
 WITH CHECK(sarathi.tenant_writable(organization_id,NULL,ARRAY['customers.update']));
CREATE FUNCTION sarathi.customer_edit_version() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,sarathi AS $$
BEGIN
 IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.id IS DISTINCT FROM OLD.id
 OR NEW.creation_request_id IS DISTINCT FROM OLD.creation_request_id
 OR NEW.creation_request_actor_id IS DISTINCT FROM OLD.creation_request_actor_id
 OR NEW.creation_request_hash IS DISTINCT FROM OLD.creation_request_hash THEN
  RAISE EXCEPTION 'Customer ownership and submission identity are immutable';
 END IF;
 IF ROW(NEW.name,NEW.phone,NEW.email,NEW.address) IS DISTINCT FROM ROW(OLD.name,OLD.phone,OLD.email,OLD.address) THEN
  NEW.version:=OLD.version+1; NEW.updated_at:=CURRENT_TIMESTAMP;
 ELSE NEW.version:=OLD.version; NEW.updated_at:=OLD.updated_at;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER customer_version BEFORE UPDATE ON sarathi.customers
 FOR EACH ROW EXECUTE FUNCTION sarathi.customer_edit_version();
-- Audit significant changes atomically, including direct SQL edits. No old/new contact values
-- are duplicated into history. Unscoped owner maintenance has a NULL actor, labelled in the UI.
CREATE FUNCTION sarathi.audit_customer_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
DECLARE actor bigint := nullif(current_setting('sarathi.actor_id',true),'')::bigint; fields text[]:=ARRAY[]::text[];
BEGIN
 IF NEW.version=OLD.version THEN RETURN NEW; END IF;
 IF actor IS NULL THEN
  IF NOT pg_has_role(session_user,(SELECT relowner FROM pg_class WHERE oid='sarathi.customers'::regclass),'MEMBER') THEN
   RAISE EXCEPTION 'Authenticated audit actor required' USING ERRCODE='42501';
  END IF;
 ELSIF NOT sarathi.tenant_writable(NEW.organization_id,NULL,ARRAY['customers.update']) THEN
  RAISE EXCEPTION 'Authorized audit actor required' USING ERRCODE='42501';
 END IF;
 IF NEW.name IS DISTINCT FROM OLD.name THEN fields:=array_append(fields,'name'); END IF;
 IF NEW.phone IS DISTINCT FROM OLD.phone THEN fields:=array_append(fields,'phone'); END IF;
 IF NEW.email IS DISTINCT FROM OLD.email THEN fields:=array_append(fields,'email'); END IF;
 IF NEW.address IS DISTINCT FROM OLD.address THEN fields:=array_append(fields,'address'); END IF;
 INSERT INTO sarathi.customer_changes(organization_id,customer_id,customer_version,changed_by,changed_fields)
 VALUES(NEW.organization_id,NEW.id,NEW.version,actor,fields);
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION sarathi.audit_customer_change() FROM PUBLIC;
CREATE TRIGGER customer_audit AFTER UPDATE ON sarathi.customers
 FOR EACH ROW EXECUTE FUNCTION sarathi.audit_customer_change();
CREATE TRIGGER customer_changes_append_only BEFORE UPDATE OR DELETE ON sarathi.customer_changes
 FOR EACH ROW EXECUTE FUNCTION sarathi.reject_history_mutation();
CREATE TRIGGER customer_changes_no_truncate BEFORE TRUNCATE ON sarathi.customer_changes
 FOR EACH STATEMENT EXECUTE FUNCTION sarathi.reject_protected_truncate();
INSERT INTO sarathi.schema_migrations(version,name) VALUES(8,'customer_management');
COMMIT;
