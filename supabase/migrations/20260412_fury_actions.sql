-- FURY v0: Action log table with undo support
-- Every action taken by the FURY engine is recorded here for auditability and undo.

CREATE TABLE IF NOT EXISTS fury_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign', 'adset', 'ad')),
    entity_id UUID NOT NULL,
    entity_external_id TEXT,
    entity_name TEXT,
    action_type TEXT NOT NULL CHECK (action_type IN ('pause', 'activate', 'update_budget', 'notify', 'flag_review')),
    action_config JSONB DEFAULT '{}',
    trigger_metric TEXT,
    trigger_value NUMERIC,
    trigger_threshold NUMERIC,
    trigger_window_days INT DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'executed' CHECK (status IN ('executed', 'undone', 'failed', 'pending_approval')),
    undone_at TIMESTAMPTZ,
    undo_deadline TIMESTAMPTZ,
    executed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_fury_actions_company_executed
    ON fury_actions (company_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_fury_actions_entity
    ON fury_actions (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_fury_actions_status
    ON fury_actions (company_id, status) WHERE status = 'pending_approval';

-- RLS
ALTER TABLE fury_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fury_actions_company_isolation" ON fury_actions
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()::text
        )
    );

-- Allow service role full access (for cron/edge functions)
CREATE POLICY "fury_actions_service_role" ON fury_actions
    FOR ALL USING (auth.role() = 'service_role');

-- Add applies_to column to automation_rules (campaign/adset/ad/all)
ALTER TABLE automation_rules
    ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'campaign'
    CHECK (applies_to IN ('campaign', 'adset', 'ad', 'all'));
