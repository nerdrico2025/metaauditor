-- FURY v0 Phase 2: Rule templates + historical evaluation support

-- Built-in rule templates (non-editable, activated per tenant with 1 click)
CREATE TABLE IF NOT EXISTS automation_rule_templates (
    id TEXT PRIMARY KEY, -- slug: 'saturation', 'high_cac', etc.
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'performance', -- 'performance' | 'budget' | 'creative'
    trigger_conditions JSONB NOT NULL,
    action_type TEXT NOT NULL,
    applies_to TEXT NOT NULL DEFAULT 'campaign',
    icon TEXT, -- lucide icon name for UI
    severity TEXT DEFAULT 'warning' -- 'info' | 'warning' | 'critical'
);

-- Seed built-in templates
INSERT INTO automation_rule_templates (id, name, description, category, trigger_conditions, action_type, applies_to, icon, severity)
VALUES
    ('saturation',
     'Saturacao de Criativo',
     'Pausa automaticamente anuncios com frequencia media acima de 3.0 por 3 dias consecutivos. Criativos saturados desperdicam budget com audiencia repetida.',
     'creative',
     '{"metric": "frequency", "operator": "gt", "threshold": 3.0, "window_days": 3, "mode": "historical_avg"}',
     'pause',
     'ad',
     'RefreshCw',
     'critical'),

    ('high_cac',
     'CAC Elevado',
     'Pausa conjuntos de anuncios onde o CPA esta acima do threshold configurado por 2 dias consecutivos.',
     'performance',
     '{"metric": "cpa", "operator": "gt", "threshold": 50.0, "window_days": 2, "mode": "historical_avg"}',
     'pause',
     'adset',
     'TrendingDown',
     'critical'),

    ('low_ctr',
     'CTR Abaixo do Minimo',
     'Sinaliza criativos com CTR abaixo de 0.5% por 48h para revisao. Indica que o criativo nao esta gerando interesse.',
     'creative',
     '{"metric": "ctr", "operator": "lt", "threshold": 0.5, "window_days": 2, "mode": "historical_avg"}',
     'flag_review',
     'ad',
     'MousePointerClick',
     'warning'),

    ('budget_depleted',
     'Orcamento Esgotando',
     'Alerta quando mais de 90% do orcamento diario foi consumido antes das 18h. Permite realocar verba antes do fim do dia.',
     'budget',
     '{"metric": "budget_usage_pct", "operator": "gt", "threshold": 90, "window_days": 1, "mode": "snapshot", "time_before": "18:00"}',
     'notify',
     'campaign',
     'Wallet',
     'warning'),

    ('scaling_opportunity',
     'Oportunidade de Scaling',
     'Sugere aumento de 15% no orcamento quando CPA esta 20% abaixo do target por 3 dias consecutivos. Indica espaco para crescer.',
     'performance',
     '{"metric": "cpa", "operator": "lt", "threshold_pct_below_target": 20, "threshold": 40.0, "window_days": 3, "mode": "historical_avg"}',
     'notify',
     'adset',
     'TrendingUp',
     'info')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    trigger_conditions = EXCLUDED.trigger_conditions,
    action_type = EXCLUDED.action_type,
    applies_to = EXCLUDED.applies_to;

-- Add evaluation_mode to automation_rules ('snapshot' or 'historical_avg')
ALTER TABLE automation_rules
    ADD COLUMN IF NOT EXISTS evaluation_mode TEXT DEFAULT 'snapshot'
    CHECK (evaluation_mode IN ('snapshot', 'historical_avg'));

-- Add template_id to track which template a rule was created from
ALTER TABLE automation_rules
    ADD COLUMN IF NOT EXISTS template_id TEXT REFERENCES automation_rule_templates(id);
