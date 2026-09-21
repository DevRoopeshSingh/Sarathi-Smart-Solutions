BEGIN;

CREATE SCHEMA sarathi;

CREATE TABLE sarathi.schema_migrations (
  version integer PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE DOMAIN sarathi.money_amount AS numeric(14,2)
  CHECK (VALUE >= 0 AND VALUE <> 'NaN'::numeric);
CREATE DOMAIN sarathi.positive_quantity AS numeric(12,3)
  CHECK (VALUE > 0 AND VALUE <> 'NaN'::numeric);
CREATE DOMAIN sarathi.percentage AS numeric(5,2)
  CHECK (VALUE BETWEEN 0 AND 100 AND VALUE <> 'NaN'::numeric);

-- Identity mapping only. Authentication, sessions and authorization are not implemented here.
CREATE TABLE sarathi.users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identity_subject text NOT NULL UNIQUE CHECK (btrim(identity_subject) <> ''),
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  role text NOT NULL CHECK (role IN ('ADMIN', 'TECHNICIAN')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sarathi.customers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  phone text NOT NULL CHECK (btrim(phone) <> ''),
  email text,
  address text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sarathi.leads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint REFERENCES sarathi.customers(id) ON DELETE RESTRICT,
  contact_name text NOT NULL CHECK (btrim(contact_name) <> ''),
  phone text NOT NULL CHECK (btrim(phone) <> ''),
  service_requested text NOT NULL CHECK (btrim(service_requested) <> ''),
  source text NOT NULL DEFAULT 'MANUAL',
  status text NOT NULL DEFAULT 'NEW'
    CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST')),
  notes text,
  requirement_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(requirement_json) = 'object'),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX leads_customer_idx ON sarathi.leads(customer_id);
CREATE INDEX leads_status_idx ON sarathi.leads(status, created_at);

CREATE TABLE sarathi.projects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES sarathi.customers(id) ON DELETE RESTRICT,
  lead_id bigint UNIQUE REFERENCES sarathi.leads(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name) <> ''),
  site_address text NOT NULL CHECK (btrim(site_address) <> ''),
  scope text NOT NULL DEFAULT '',
  service_types text[] NOT NULL DEFAULT '{}'::text[],
  operational_status text NOT NULL DEFAULT 'SURVEY_PENDING'
    CHECK (operational_status IN ('SURVEY_PENDING', 'SURVEY_COMPLETE', 'COSTING',
      'PROCUREMENT', 'INSTALLATION_SCHEDULED', 'INSTALLATION_IN_PROGRESS', 'TESTING', 'COMPLETED', 'CANCELLED')),
  on_hold boolean NOT NULL DEFAULT false,
  hold_reason text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, customer_id),
  CHECK (NOT on_hold OR (hold_reason IS NOT NULL AND btrim(hold_reason) <> '')),
  CHECK (NOT on_hold OR operational_status NOT IN ('COMPLETED', 'CANCELLED'))
);
CREATE INDEX projects_customer_idx ON sarathi.projects(customer_id);
CREATE INDEX projects_status_idx ON sarathi.projects(operational_status, on_hold);

CREATE TABLE sarathi.products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku text UNIQUE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  unit text NOT NULL CHECK (btrim(unit) <> ''),
  unit_cost sarathi.money_amount NOT NULL DEFAULT 0,
  unit_sell sarathi.money_amount NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sarathi.project_costings (
  project_id bigint PRIMARY KEY REFERENCES sarathi.projects(id) ON DELETE RESTRICT,
  contingency_percent sarathi.percentage NOT NULL DEFAULT 0,
  target_advance_percent sarathi.percentage NOT NULL DEFAULT 50,
  supplier_delivery sarathi.money_amount NOT NULL DEFAULT 0,
  technician_labour sarathi.money_amount NOT NULL DEFAULT 0,
  transport sarathi.money_amount NOT NULL DEFAULT 0,
  other_direct_cost sarathi.money_amount NOT NULL DEFAULT 0,
  warranty_callback_provision sarathi.money_amount NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sarathi.bom_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES sarathi.projects(id) ON DELETE RESTRICT,
  product_id bigint REFERENCES sarathi.products(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0),
  description text NOT NULL CHECK (btrim(description) <> ''),
  unit text NOT NULL CHECK (btrim(unit) <> ''),
  quantity sarathi.positive_quantity NOT NULL,
  unit_cost sarathi.money_amount NOT NULL,
  unit_sell sarathi.money_amount NOT NULL,
  UNIQUE (project_id, position)
);
CREATE INDEX bom_items_product_idx ON sarathi.bom_items(product_id);

CREATE TABLE sarathi.quotations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL,
  customer_id bigint NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  created_by bigint NOT NULL REFERENCES sarathi.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SENT', 'APPROVED', 'DECLINED', 'SUPERSEDED', 'VOID')),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  customer_name text NOT NULL CHECK (btrim(customer_name) <> ''),
  customer_phone text NOT NULL CHECK (btrim(customer_phone) <> ''),
  customer_email text,
  customer_address text,
  site_address text NOT NULL CHECK (btrim(site_address) <> ''),
  subtotal sarathi.money_amount NOT NULL,
  service_charges sarathi.money_amount NOT NULL DEFAULT 0,
  discount sarathi.money_amount NOT NULL DEFAULT 0,
  tax_amount sarathi.money_amount NOT NULL DEFAULT 0,
  total sarathi.money_amount NOT NULL,
  recommended_advance sarathi.money_amount NOT NULL,
  terms text NOT NULL,
  valid_until date NOT NULL,
  frozen_at timestamptz,
  sent_at timestamptz,
  approved_at timestamptz,
  declined_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id, customer_id) REFERENCES sarathi.projects(id, customer_id) ON DELETE RESTRICT,
  UNIQUE (project_id, version),
  UNIQUE (id, project_id),
  CHECK (discount <= subtotal + service_charges),
  CHECK (total = subtotal + service_charges - discount + tax_amount),
  CHECK (recommended_advance <= total),
  CHECK ((status = 'DRAFT' AND frozen_at IS NULL) OR (status <> 'DRAFT' AND frozen_at IS NOT NULL))
);
CREATE INDEX quotations_customer_idx ON sarathi.quotations(customer_id);
CREATE INDEX quotations_status_idx ON sarathi.quotations(status);
CREATE INDEX quotations_created_by_idx ON sarathi.quotations(created_by);

CREATE TABLE sarathi.quotation_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quotation_id bigint NOT NULL REFERENCES sarathi.quotations(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0),
  description text NOT NULL CHECK (btrim(description) <> ''),
  unit text NOT NULL CHECK (btrim(unit) <> ''),
  quantity sarathi.positive_quantity NOT NULL,
  unit_sell sarathi.money_amount NOT NULL,
  UNIQUE (quotation_id, position)
);

CREATE FUNCTION sarathi.guard_frozen_quotation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, sarathi AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' OR NEW.frozen_at IS NOT NULL THEN
      RAISE EXCEPTION 'New quotations must start as drafts' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.frozen_at IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Frozen quotations cannot be deleted' USING ERRCODE = '23514';
    END IF;
    -- Default-deny future columns: only these lifecycle fields may change after issue.
    IF (to_jsonb(NEW) - ARRAY['status', 'sent_at', 'approved_at', 'declined_at', 'voided_at', 'updated_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status', 'sent_at', 'approved_at', 'declined_at', 'voided_at', 'updated_at']) THEN
      RAISE EXCEPTION 'Frozen quotation content cannot be changed' USING ERRCODE = '23514';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      (OLD.status = 'SENT' AND NEW.status IN ('APPROVED', 'DECLINED', 'SUPERSEDED', 'VOID')) OR
      (OLD.status = 'APPROVED' AND NEW.status IN ('SUPERSEDED', 'VOID')) OR
      (OLD.status = 'DECLINED' AND NEW.status IN ('SUPERSEDED', 'VOID'))
    ) THEN
      RAISE EXCEPTION 'Invalid frozen quotation status transition' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status NOT IN ('DRAFT', 'SENT', 'VOID') THEN
    RAISE EXCEPTION 'Draft quotations must be issued before approval' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER quotations_immutable_after_freeze
BEFORE INSERT OR UPDATE OR DELETE ON sarathi.quotations
FOR EACH ROW EXECUTE FUNCTION sarathi.guard_frozen_quotation();

CREATE FUNCTION sarathi.guard_quotation_item() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, sarathi AS $$
DECLARE
  target_id bigint;
  parent_frozen_at timestamptz;
BEGIN
  -- Disallow reparenting even for drafts; delete + insert is explicit and locks both parents.
  IF TG_OP = 'UPDATE' AND NEW.quotation_id IS DISTINCT FROM OLD.quotation_id THEN
    RAISE EXCEPTION 'Quotation items cannot be reparented' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN target_id := OLD.quotation_id;
  ELSE target_id := NEW.quotation_id; END IF;
  SELECT frozen_at INTO parent_frozen_at FROM sarathi.quotations
    WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quotation parent does not exist' USING ERRCODE = '23503';
  END IF;
  IF parent_frozen_at IS NOT NULL THEN
    RAISE EXCEPTION 'Frozen quotation items cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER quotation_items_immutable_after_freeze
BEFORE INSERT OR UPDATE OR DELETE ON sarathi.quotation_items
FOR EACH ROW EXECUTE FUNCTION sarathi.guard_quotation_item();

CREATE TABLE sarathi.payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES sarathi.projects(id) ON DELETE RESTRICT,
  quotation_id bigint,
  kind text NOT NULL CHECK (kind IN ('RECEIPT', 'REFUND')),
  amount sarathi.money_amount NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  idempotency_key text NOT NULL UNIQUE CHECK (btrim(idempotency_key) <> ''),
  payment_method text NOT NULL CHECK (btrim(payment_method) <> ''),
  reference text,
  note text,
  occurred_at timestamptz NOT NULL,
  recorded_by bigint NOT NULL REFERENCES sarathi.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id, project_id) REFERENCES sarathi.quotations(id, project_id) ON DELETE RESTRICT
);
CREATE INDEX payments_project_idx ON sarathi.payments(project_id, occurred_at);
CREATE INDEX payments_quotation_idx ON sarathi.payments(quotation_id, project_id);
CREATE INDEX payments_recorded_by_idx ON sarathi.payments(recorded_by);

CREATE FUNCTION sarathi.reject_payment_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Payments are append-only; record a refund or correcting receipt'
    USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER payments_append_only
BEFORE UPDATE OR DELETE ON sarathi.payments
FOR EACH ROW EXECUTE FUNCTION sarathi.reject_payment_mutation();

CREATE TABLE sarathi.status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES sarathi.projects(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL,
  was_on_hold boolean NOT NULL,
  is_on_hold boolean NOT NULL,
  reason text,
  changed_by bigint NOT NULL REFERENCES sarathi.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (from_status IS NULL OR from_status IN ('SURVEY_PENDING', 'SURVEY_COMPLETE', 'COSTING',
    'PROCUREMENT', 'INSTALLATION_SCHEDULED', 'INSTALLATION_IN_PROGRESS', 'TESTING', 'COMPLETED', 'CANCELLED')),
  CHECK (to_status IN ('SURVEY_PENDING', 'SURVEY_COMPLETE', 'COSTING',
    'PROCUREMENT', 'INSTALLATION_SCHEDULED', 'INSTALLATION_IN_PROGRESS', 'TESTING', 'COMPLETED', 'CANCELLED'))
);
CREATE INDEX status_history_project_idx ON sarathi.status_history(project_id, changed_at);
CREATE INDEX status_history_changed_by_idx ON sarathi.status_history(changed_by);

CREATE FUNCTION sarathi.reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Status history is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER status_history_append_only
BEFORE UPDATE OR DELETE ON sarathi.status_history
FOR EACH ROW EXECUTE FUNCTION sarathi.reject_history_mutation();

CREATE FUNCTION sarathi.reject_protected_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical commercial tables cannot be truncated' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER quotations_no_truncate BEFORE TRUNCATE ON sarathi.quotations
FOR EACH STATEMENT EXECUTE FUNCTION sarathi.reject_protected_truncate();
CREATE TRIGGER quotation_items_no_truncate BEFORE TRUNCATE ON sarathi.quotation_items
FOR EACH STATEMENT EXECUTE FUNCTION sarathi.reject_protected_truncate();
CREATE TRIGGER payments_no_truncate BEFORE TRUNCATE ON sarathi.payments
FOR EACH STATEMENT EXECUTE FUNCTION sarathi.reject_protected_truncate();
CREATE TRIGGER status_history_no_truncate BEFORE TRUNCATE ON sarathi.status_history
FOR EACH STATEMENT EXECUTE FUNCTION sarathi.reject_protected_truncate();

INSERT INTO sarathi.schema_migrations(version, name) VALUES (1, 'commercial_foundation');
COMMIT;
