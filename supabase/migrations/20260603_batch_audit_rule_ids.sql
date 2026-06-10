-- Soft migration: store selected rule filters on batch audit jobs
ALTER TABLE public.batch_audit_jobs
  ADD COLUMN IF NOT EXISTS creative_rule_ids uuid[] NULL,
  ADD COLUMN IF NOT EXISTS performance_rule_ids uuid[] NULL;
