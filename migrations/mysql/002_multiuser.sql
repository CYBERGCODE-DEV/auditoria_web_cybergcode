-- CYBERGCODE multiusuario: ejecutar una vez sobre instalaciones existentes.
-- Si el índice UNIQUE de domain tiene otro nombre, elimínalo desde el panel antes de crear el compuesto.
ALTER TABLE cybergcode_projects ADD COLUMN organization_id VARCHAR(64) NULL AFTER id;
ALTER TABLE cybergcode_projects ADD COLUMN created_by VARCHAR(64) NULL AFTER organization_id;
UPDATE cybergcode_projects SET organization_id='legacy' WHERE organization_id IS NULL OR organization_id='';
UPDATE cybergcode_projects SET created_by='legacy' WHERE created_by IS NULL OR created_by='';
ALTER TABLE cybergcode_projects DROP INDEX domain;
CREATE UNIQUE INDEX cybergcode_projects_org_domain_uidx ON cybergcode_projects(organization_id,domain);
CREATE INDEX cybergcode_projects_org_updated_idx ON cybergcode_projects(organization_id,updated_at);

ALTER TABLE cybergcode_audits ADD COLUMN organization_id VARCHAR(64) NULL AFTER project_id;
ALTER TABLE cybergcode_audits ADD COLUMN created_by VARCHAR(64) NULL AFTER organization_id;
UPDATE cybergcode_audits SET organization_id='legacy' WHERE organization_id IS NULL OR organization_id='';
UPDATE cybergcode_audits SET created_by='legacy' WHERE created_by IS NULL OR created_by='';
CREATE INDEX cybergcode_audits_org_created_idx ON cybergcode_audits(organization_id,completed_at);
