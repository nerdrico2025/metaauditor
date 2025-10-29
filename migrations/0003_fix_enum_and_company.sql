
-- Step 1: Create companies table if not exists
CREATE TABLE IF NOT EXISTS "companies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) UNIQUE NOT NULL,
  "logo_url" text,
  "primary_color" varchar(7),
  "status" company_status DEFAULT 'trial',
  "subscription_plan" subscription_plan DEFAULT 'free',
  "subscription_status" varchar DEFAULT 'trial',
  "subscription_start_date" timestamp,
  "subscription_end_date" timestamp,
  "trial_ends_at" timestamp,
  "max_users" integer DEFAULT 5,
  "max_campaigns" integer DEFAULT 10,
  "max_audits_per_month" integer DEFAULT 100,
  "current_users" integer DEFAULT 0,
  "current_campaigns" integer DEFAULT 0,
  "audits_this_month" integer DEFAULT 0,
  "contact_email" varchar,
  "contact_phone" varchar,
  "billing_email" varchar,
  "tax_id" varchar,
  "settings" jsonb,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Step 2: Add company_id to users if not exists (nullable first)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "company_id" uuid;
  END IF;
END $$;

-- Step 3: Add company_id to campaigns if not exists (nullable first)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE "campaigns" ADD COLUMN "company_id" uuid;
  END IF;
END $$;

-- Step 4: Create a default company for existing data
DO $$
DECLARE
  default_company_id uuid;
BEGIN
  -- Check if we need to create a default company
  IF NOT EXISTS (SELECT 1 FROM companies LIMIT 1) THEN
    INSERT INTO companies (
      name, 
      slug, 
      contact_email, 
      status, 
      subscription_plan,
      created_at,
      updated_at
    ) VALUES (
      'Click Auditor Demo',
      'click-auditor-demo',
      'admin@clickauditor-demo.com',
      'active',
      'professional',
      now(),
      now()
    ) RETURNING id INTO default_company_id;
    
    -- Update existing users with the default company
    UPDATE users SET company_id = default_company_id WHERE company_id IS NULL;
    
    -- Update existing campaigns with the default company
    UPDATE campaigns SET company_id = default_company_id WHERE company_id IS NULL;
  END IF;
END $$;

-- Step 5: Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_company_id_companies_id_fk'
  ) THEN
    ALTER TABLE "users" 
    ADD CONSTRAINT "users_company_id_companies_id_fk" 
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") 
    ON DELETE cascade;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'campaigns_company_id_companies_id_fk'
  ) THEN
    ALTER TABLE "campaigns" 
    ADD CONSTRAINT "campaigns_company_id_companies_id_fk" 
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") 
    ON DELETE cascade;
  END IF;
END $$;

-- Step 6: Add unique constraint on email if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_email_unique'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
  END IF;
END $$;
