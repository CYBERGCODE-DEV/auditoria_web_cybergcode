-- CYBERGCODE multiusuario: ejecutar una vez sobre instalaciones existentes.
ALTER TABLE cybergcode_projects ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE cybergcode_projects ADD COLUMN IF NOT EXISTS created_by TEXT;
UPDATE cybergcode_projects SET organization_id='legacy' WHERE organization_id IS NULL OR organization_id='';
UPDATE cybergcode_projects SET created_by='legacy' WHERE created_by IS NULL OR created_by='';
ALTER TABLE cybergcode_projects DROP CONSTRAINT IF EXISTS cybergcode_projects_domain_key;
CREATE UNIQUE INDEX IF NOT EXISTS cybergcode_projects_org_domain_uidx ON cybergcode_projects(organization_id,domain);
CREATE INDEX IF NOT EXISTS cybergcode_projects_org_updated_idx ON cybergcode_projects(organization_id,updated_at DESC);

ALTER TABLE cybergcode_audits ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE cybergcode_audits ADD COLUMN IF NOT EXISTS created_by TEXT;
UPDATE cybergcode_audits SET organization_id='legacy' WHERE organization_id IS NULL OR organization_id='';
UPDATE cybergcode_audits SET created_by='legacy' WHERE created_by IS NULL OR created_by='';
CREATE INDEX IF NOT EXISTS cybergcode_audits_org_created_idx ON cybergcode_audits(organization_id,completed_at DESC);
