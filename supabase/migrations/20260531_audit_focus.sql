-- Separate audit history by module focus (performance vs branding)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS audit_focus text
  NOT NULL DEFAULT 'performance'
  CHECK (audit_focus IN ('performance', 'branding'));

CREATE INDEX IF NOT EXISTS idx_audits_creative_focus_created
  ON audits (creative_id, audit_focus, created_at DESC);
