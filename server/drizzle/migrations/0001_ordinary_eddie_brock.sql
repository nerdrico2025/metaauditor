CREATE TYPE "public"."company_status" AS ENUM('active', 'suspended', 'trial', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"logo_url" text,
	"primary_color" varchar(7),
	"status" "company_status" DEFAULT 'trial',
	"subscription_plan" "subscription_plan" DEFAULT 'free',
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
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "audits" DROP CONSTRAINT "audits_creative_id_creatives_id_fk";
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "company_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'company_admin', 'operador');--> statement-breakpoint
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";