-- Create ad_set_metrics table for storing ad set performance metrics
CREATE TABLE IF NOT EXISTS ad_set_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ad_set_id UUID NOT NULL REFERENCES ad_sets(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Core metrics
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    spend DECIMAL(12, 2) DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    reach BIGINT DEFAULT 0,
    frequency DECIMAL(10, 2) DEFAULT 0,

    -- Calculated metrics
    cpc DECIMAL(10, 4) DEFAULT 0,
    cpm DECIMAL(10, 4) DEFAULT 0,
    ctr DECIMAL(10, 4) DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint to prevent duplicate metrics for same ad_set and date
    CONSTRAINT ad_set_metrics_unique UNIQUE (company_id, ad_set_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ad_set_metrics_company_id ON ad_set_metrics(company_id);
CREATE INDEX IF NOT EXISTS idx_ad_set_metrics_ad_set_id ON ad_set_metrics(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_ad_set_metrics_date ON ad_set_metrics(date);
CREATE INDEX IF NOT EXISTS idx_ad_set_metrics_company_ad_set ON ad_set_metrics(company_id, ad_set_id);

-- Enable Row Level Security
ALTER TABLE ad_set_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view ad_set_metrics from their company"
ON ad_set_metrics FOR SELECT
USING (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert ad_set_metrics for their company"
ON ad_set_metrics FOR INSERT
WITH CHECK (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can update ad_set_metrics from their company"
ON ad_set_metrics FOR UPDATE
USING (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
    )
);

-- Add comment to table
COMMENT ON TABLE ad_set_metrics IS 'Stores daily performance metrics for ad sets from Meta Ads and other platforms';
