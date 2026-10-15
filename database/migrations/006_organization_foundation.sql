BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM sarathi.schema_migrations WHERE version=5 AND name='workflow_guidance') THEN
    RAISE EXCEPTION 'Migration 005_workflow_guidance must be applied first';
  END IF;
END $$;

-- Additive foundation only: existing business records and auth tables are unchanged.
-- Do not onboard another organization until business ownership/query scoping is complete.
CREATE TABLE sarathi.organizations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9-]{0,62}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sarathi.divisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES sarathi.organizations(id) ON DELETE RESTRICT,
  slug text NOT NULL CHECK (slug ~ '^[a-z][a-z0-9-]{0,62}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, slug),
  UNIQUE (organization_id, id)
);
CREATE TABLE sarathi.organization_memberships (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES sarathi.organizations(id) ON DELETE RESTRICT,
  user_id bigint NOT NULL REFERENCES sarathi.users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('ADMIN','OPERATOR','VIEWER')),
  active boolean NOT NULL DEFAULT true,
  can_record_payments boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (role <> 'VIEWER' OR NOT can_record_payments),
  UNIQUE (organization_id, user_id),
  UNIQUE (organization_id, id)
);
CREATE INDEX organization_memberships_user_idx ON sarathi.organization_memberships(user_id, organization_id);
CREATE TABLE sarathi.division_assignments (
  organization_id bigint NOT NULL,
  membership_id bigint NOT NULL,
  division_id bigint NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (membership_id, division_id),
  FOREIGN KEY (organization_id, membership_id)
    REFERENCES sarathi.organization_memberships(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, division_id)
    REFERENCES sarathi.divisions(organization_id, id) ON DELETE RESTRICT
);

INSERT INTO sarathi.organizations(slug,name) VALUES ('sarathi','Sarathi');
INSERT INTO sarathi.divisions(organization_id,slug,name)
  SELECT o.id, v.slug, v.name FROM sarathi.organizations o CROSS JOIN (VALUES
    ('digital-seva-kendra','Digital Seva Kendra'),
    ('smart-solutions','Smart Solutions'),
    ('ai-business-solutions','AI & Business Solutions')
  ) AS v(slug,name) WHERE o.slug='sarathi';
-- Preserve every existing user's role and inactive state. New users need explicit provisioning.
INSERT INTO sarathi.organization_memberships(organization_id,user_id,role,active)
  SELECT o.id,u.id,u.role,u.active FROM sarathi.users u
  CROSS JOIN sarathi.organizations o WHERE o.slug='sarathi';
-- Historical workflows are Smart Solutions. Never implicitly assign new divisions to staff.
INSERT INTO sarathi.division_assignments(organization_id,membership_id,division_id)
  SELECT m.organization_id,m.id,d.id FROM sarathi.organization_memberships m
  JOIN sarathi.divisions d ON d.organization_id=m.organization_id AND d.slug='smart-solutions';

INSERT INTO sarathi.schema_migrations(version,name) VALUES (6,'organization_foundation');
COMMIT;
