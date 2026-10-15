BEGIN;
DO $$
DECLARE org bigint; division bigint; target text;
BEGIN
  SELECT id INTO STRICT org FROM sarathi.organizations WHERE slug='sarathi';
  SELECT id INTO STRICT division FROM sarathi.divisions WHERE organization_id=org AND slug='smart-solutions';
  -- ADD COLUMN's constant default backfills without firing immutable/audit UPDATE triggers.
  FOREACH target IN ARRAY ARRAY['customers','leads','projects','products','project_costings','bom_items','quotations','quotation_items','payments','status_history'] LOOP
    EXECUTE format('ALTER TABLE sarathi.%I ADD COLUMN organization_id bigint NOT NULL DEFAULT %s REFERENCES sarathi.organizations(id) ON DELETE RESTRICT',target,org);
    EXECUTE format('ALTER TABLE sarathi.%I ALTER COLUMN organization_id SET DEFAULT nullif(current_setting(''sarathi.organization_id'',true),'''')::bigint',target);
    EXECUTE format('CREATE INDEX %I ON sarathi.%I(organization_id)',target || '_organization_idx',target);
    IF target <> 'project_costings' THEN
      EXECUTE format('ALTER TABLE sarathi.%I ADD UNIQUE(organization_id,id)',target);
    END IF;
  END LOOP;
  FOREACH target IN ARRAY ARRAY['leads','projects'] LOOP
    EXECUTE format('ALTER TABLE sarathi.%I ADD COLUMN division_id bigint NOT NULL DEFAULT %s',target,division);
    EXECUTE format('ALTER TABLE sarathi.%I ADD FOREIGN KEY(organization_id,division_id) REFERENCES sarathi.divisions(organization_id,id) ON DELETE RESTRICT',target);
    EXECUTE format('ALTER TABLE sarathi.%I ADD UNIQUE(organization_id,division_id,id)',target);
    EXECUTE format('ALTER TABLE sarathi.%I ALTER COLUMN division_id SET DEFAULT nullif(current_setting(''sarathi.division_id'',true),'''')::bigint',target);
    EXECUTE format('CREATE INDEX %I ON sarathi.%I(organization_id,division_id,id DESC)',target || '_tenant_page_idx',target);
  END LOOP;
END;
$$;
ALTER TABLE sarathi.leads ADD FOREIGN KEY(organization_id,customer_id) REFERENCES sarathi.customers(organization_id,id);
ALTER TABLE sarathi.projects ADD FOREIGN KEY(organization_id,customer_id) REFERENCES sarathi.customers(organization_id,id),
 ADD FOREIGN KEY(organization_id,division_id,lead_id) REFERENCES sarathi.leads(organization_id,division_id,id),
 ADD UNIQUE(organization_id,id,customer_id);
ALTER TABLE sarathi.project_costings ADD FOREIGN KEY(organization_id,project_id) REFERENCES sarathi.projects(organization_id,id);
ALTER TABLE sarathi.bom_items ADD FOREIGN KEY(organization_id,project_id) REFERENCES sarathi.projects(organization_id,id),
 ADD FOREIGN KEY(organization_id,product_id) REFERENCES sarathi.products(organization_id,id);
ALTER TABLE sarathi.quotations ADD FOREIGN KEY(organization_id,project_id,customer_id) REFERENCES sarathi.projects(organization_id,id,customer_id),
 ADD FOREIGN KEY(organization_id,created_by) REFERENCES sarathi.organization_memberships(organization_id,user_id),
 ADD UNIQUE(organization_id,id,project_id);
ALTER TABLE sarathi.quotation_items ADD FOREIGN KEY(organization_id,quotation_id) REFERENCES sarathi.quotations(organization_id,id);
ALTER TABLE sarathi.payments ADD FOREIGN KEY(organization_id,project_id) REFERENCES sarathi.projects(organization_id,id),
 ADD FOREIGN KEY(organization_id,quotation_id,project_id) REFERENCES sarathi.quotations(organization_id,id,project_id),
 ADD FOREIGN KEY(organization_id,recorded_by) REFERENCES sarathi.organization_memberships(organization_id,user_id);
ALTER TABLE sarathi.status_history ADD FOREIGN KEY(organization_id,project_id) REFERENCES sarathi.projects(organization_id,id),
 ADD FOREIGN KEY(organization_id,changed_by) REFERENCES sarathi.organization_memberships(organization_id,user_id);
ALTER TABLE sarathi.products DROP CONSTRAINT products_sku_key;
ALTER TABLE sarathi.products ADD UNIQUE(organization_id,sku);
ALTER TABLE sarathi.payments DROP CONSTRAINT payments_idempotency_key_key;
ALTER TABLE sarathi.payments ADD UNIQUE(organization_id,idempotency_key);
CREATE INDEX customers_tenant_page_idx ON sarathi.customers(organization_id,id DESC);
CREATE INDEX quotations_tenant_page_idx ON sarathi.quotations(organization_id,project_id,id DESC);
CREATE INDEX payments_tenant_page_idx ON sarathi.payments(organization_id,project_id,id DESC);
CREATE INDEX history_tenant_project_idx ON sarathi.status_history(organization_id,project_id,changed_at);

-- Defense in depth. Role/permission resolution remains in the existing TS resolver.
-- This SQL guard additionally rechecks revocation and division assignments per statement.
CREATE FUNCTION sarathi.tenant_visible(p_org bigint,p_division bigint DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
 SELECT p_org=nullif(current_setting('sarathi.organization_id',true),'')::bigint
 AND EXISTS(SELECT 1 FROM sarathi.organization_memberships m
 JOIN sarathi.users u ON u.id=m.user_id AND u.active
 JOIN sarathi.organizations o ON o.id=m.organization_id AND o.active
 WHERE m.organization_id=p_org AND m.active
 AND m.user_id=nullif(current_setting('sarathi.actor_id',true),'')::bigint
 AND (p_division IS NULL OR EXISTS(SELECT 1 FROM sarathi.divisions d
 WHERE d.id=p_division AND d.organization_id=p_org AND d.active AND
 ((m.role='ADMIN' AND u.role='ADMIN') OR EXISTS(SELECT 1 FROM sarathi.division_assignments a
 WHERE a.organization_id=p_org AND a.membership_id=m.id AND a.division_id=d.id AND a.active)))))
$$;
REVOKE ALL ON FUNCTION sarathi.tenant_visible(bigint,bigint) FROM PUBLIC;
CREATE FUNCTION sarathi.tenant_writable(p_org bigint,p_division bigint,p_permissions text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
 SELECT sarathi.tenant_visible(p_org,p_division)
 AND current_setting('sarathi.permission',true)=ANY(p_permissions)
 AND EXISTS(SELECT 1 FROM sarathi.organization_memberships m JOIN sarathi.users u ON u.id=m.user_id
 WHERE m.organization_id=p_org AND m.user_id=nullif(current_setting('sarathi.actor_id',true),'')::bigint
 AND m.role IN ('ADMIN','OPERATOR') AND u.role IN ('ADMIN','OPERATOR'))
$$;
REVOKE ALL ON FUNCTION sarathi.tenant_writable(bigint,bigint,text[]) FROM PUBLIC;
DO $$
DECLARE target text; predicate text;
BEGIN
 FOREACH target IN ARRAY ARRAY['customers','leads','projects','products','project_costings','bom_items','quotations','quotation_items','payments','status_history'] LOOP
  predicate := 'sarathi.tenant_visible(organization_id)';
  IF target IN ('leads','projects') THEN predicate := 'sarathi.tenant_visible(organization_id,division_id)';
  ELSIF target IN ('project_costings','bom_items','quotations','payments','status_history') THEN
   predicate := 'sarathi.tenant_visible(organization_id) AND EXISTS(SELECT 1 FROM sarathi.projects p WHERE p.id=project_id AND p.organization_id=' || target || '.organization_id)' ;
  ELSIF target='quotation_items' THEN
   predicate := 'sarathi.tenant_visible(organization_id) AND EXISTS(SELECT 1 FROM sarathi.quotations q WHERE q.id=quotation_id AND q.organization_id=quotation_items.organization_id)' ;
  END IF;
  EXECUTE format('ALTER TABLE sarathi.%I ENABLE ROW LEVEL SECURITY',target);
  IF target='payments' THEN
   predicate := predicate || ' AND EXISTS(SELECT 1 FROM sarathi.organization_memberships m JOIN sarathi.users u ON u.id=m.user_id WHERE m.organization_id=payments.organization_id AND m.user_id=nullif(current_setting(''sarathi.actor_id'',true),'''')::bigint AND m.role IN (''ADMIN'',''OPERATOR'') AND u.role IN (''ADMIN'',''OPERATOR''))';
  END IF;
  -- Keep the organization equality visible to the planner for scoped indexes.
  predicate := 'organization_id=nullif(current_setting(''sarathi.organization_id'',true),'''')::bigint AND (' || predicate || ')';
  EXECUTE format('CREATE POLICY tenant_read ON sarathi.%I FOR SELECT USING(%s)',target,predicate);
 END LOOP;
END;
$$;
CREATE POLICY tenant_insert ON sarathi.customers FOR INSERT WITH CHECK(sarathi.tenant_writable(organization_id,NULL,ARRAY['customers.create']));
CREATE POLICY tenant_insert ON sarathi.leads FOR INSERT WITH CHECK(sarathi.tenant_writable(organization_id,division_id,ARRAY['leads.create']));
CREATE POLICY tenant_update ON sarathi.leads FOR UPDATE USING(sarathi.tenant_writable(organization_id,division_id,ARRAY['leads.update','projects.create']))
 WITH CHECK(sarathi.tenant_writable(organization_id,division_id,ARRAY['leads.update','projects.create']));
CREATE POLICY tenant_insert ON sarathi.projects FOR INSERT WITH CHECK(sarathi.tenant_writable(organization_id,division_id,ARRAY['projects.create']));
CREATE POLICY tenant_update ON sarathi.projects FOR UPDATE USING(sarathi.tenant_writable(organization_id,division_id,ARRAY['projects.update']))
 WITH CHECK(sarathi.tenant_writable(organization_id,division_id,ARRAY['projects.update']));
CREATE POLICY tenant_insert ON sarathi.status_history FOR INSERT WITH CHECK(sarathi.tenant_writable(organization_id,NULL,ARRAY['projects.create','projects.update'])
 AND changed_by=nullif(current_setting('sarathi.actor_id',true),'')::bigint
 AND EXISTS(SELECT 1 FROM sarathi.projects p WHERE p.id=project_id AND p.organization_id=status_history.organization_id));

CREATE FUNCTION sarathi.admin_set_membership_role(p_actor bigint,p_org bigint,p_target bigint,p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sarathi AS $$
BEGIN
 IF p_actor IS DISTINCT FROM nullif(current_setting('sarathi.actor_id',true),'')::bigint
 OR p_org IS DISTINCT FROM nullif(current_setting('sarathi.organization_id',true),'')::bigint
 OR current_setting('sarathi.permission',true) IS DISTINCT FROM 'admin.users.manage' THEN
  RAISE EXCEPTION 'Scoped administrator access is required' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM sarathi.organizations WHERE id=p_org AND active FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM sarathi.organization_memberships m JOIN sarathi.users u ON u.id=m.user_id
 WHERE m.organization_id=p_org AND m.user_id=p_actor AND m.active AND m.role='ADMIN' AND u.active AND u.role='ADMIN') THEN
  RAISE EXCEPTION 'Administrator access is required' USING ERRCODE='42501';
 END IF;
 IF p_role IS NULL OR p_role NOT IN ('ADMIN','OPERATOR','VIEWER') THEN RAISE EXCEPTION 'Invalid role' USING ERRCODE='22023'; END IF;
 IF p_actor=p_target AND p_role<>'ADMIN' THEN RAISE EXCEPTION 'Administrators cannot demote their own account' USING ERRCODE='42501'; END IF;
 UPDATE sarathi.organization_memberships SET role=p_role,can_record_payments=CASE WHEN p_role='VIEWER' THEN false ELSE can_record_payments END
 WHERE organization_id=p_org AND user_id=p_target;
 IF NOT FOUND THEN RAISE EXCEPTION 'User does not exist in this organization' USING ERRCODE='P0002'; END IF;
 -- A tenant administrator cannot change a shared identity ceiling: that could
 -- enable a previously capped membership in another organization.
 IF EXISTS(SELECT 1 FROM sarathi.organization_memberships WHERE user_id=p_target AND organization_id<>p_org) THEN
  IF EXISTS(SELECT 1 FROM sarathi.users WHERE id=p_target AND
    array_position(ARRAY['VIEWER','OPERATOR','ADMIN'],role)<array_position(ARRAY['VIEWER','OPERATOR','ADMIN'],p_role)) THEN
   RAISE EXCEPTION 'Shared identity ceiling requires owner authorization' USING ERRCODE='42501';
  END IF;
 ELSE
  UPDATE sarathi.users SET role=p_role WHERE id=p_target;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION sarathi.admin_set_membership_role(bigint,bigint,bigint,text) FROM PUBLIC;
INSERT INTO sarathi.schema_migrations(version,name) VALUES(7,'business_ownership');
COMMIT;
