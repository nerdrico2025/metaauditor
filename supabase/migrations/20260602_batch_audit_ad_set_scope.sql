-- Extend batch jobs with ad_set scope for performance batch on conjuntos
ALTER TABLE public.batch_audit_jobs
  ADD COLUMN IF NOT EXISTS ad_set_id uuid NULL REFERENCES public.ad_sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_batch_audit_jobs_ad_set
  ON public.batch_audit_jobs (ad_set_id)
  WHERE ad_set_id IS NOT NULL;
