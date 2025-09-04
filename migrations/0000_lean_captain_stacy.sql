CREATE TYPE "public"."user_role" AS ENUM('administrador', 'operador');--> statement-breakpoint
CREATE TABLE "audit_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"audit_id" uuid NOT NULL,
	"action" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"creative_id" uuid NOT NULL,
	"policy_id" uuid,
	"status" varchar NOT NULL,
	"compliance_score" numeric(3, 2) DEFAULT '0',
	"performance_score" numeric(3, 2) DEFAULT '0',
	"issues" jsonb,
	"recommendations" jsonb,
	"ai_analysis" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brand_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"logo_url" text,
	"brand_name" text NOT NULL,
	"primary_color" varchar(7),
	"secondary_color" varchar(7),
	"accent_color" varchar(7),
	"font_family" varchar,
	"brand_guidelines" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaign_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"data" timestamp NOT NULL,
	"nome_conta" text NOT NULL,
	"ad_url" text,
	"campanha" text NOT NULL,
	"grupo_anuncios" text NOT NULL,
	"anuncios" text NOT NULL,
	"impressoes" integer DEFAULT 0,
	"cliques" integer DEFAULT 0,
	"cpm" numeric(10, 2) DEFAULT '0',
	"cpc" numeric(10, 2) DEFAULT '0',
	"conversas_iniciadas" integer DEFAULT 0,
	"custo_conversa" numeric(10, 2) DEFAULT '0',
	"investimento" numeric(10, 2) DEFAULT '0',
	"source" varchar DEFAULT 'google_sheets',
	"status" varchar DEFAULT 'imported',
	"sync_batch" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"integration_id" uuid NOT NULL,
	"external_id" varchar NOT NULL,
	"name" text NOT NULL,
	"platform" varchar NOT NULL,
	"status" varchar NOT NULL,
	"budget" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"required_keywords" jsonb,
	"prohibited_keywords" jsonb,
	"required_phrases" jsonb,
	"prohibited_phrases" jsonb,
	"min_text_length" integer,
	"max_text_length" integer,
	"requires_logo" boolean DEFAULT false,
	"requires_brand_colors" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"campaign_id" uuid NOT NULL,
	"external_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" varchar NOT NULL,
	"image_url" text,
	"video_url" text,
	"text" text,
	"headline" text,
	"description" text,
	"call_to_action" text,
	"status" varchar NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"ctr" numeric(5, 3) DEFAULT '0',
	"cpc" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"account_id" varchar,
	"status" varchar DEFAULT 'active',
	"last_sync" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" jsonb NOT NULL,
	"performance_thresholds" jsonb,
	"status" varchar DEFAULT 'active',
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"role" "user_role" DEFAULT 'operador' NOT NULL,
	"profile_image_url" varchar,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_actions" ADD CONSTRAINT "audit_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_actions" ADD CONSTRAINT "audit_actions_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_configurations" ADD CONSTRAINT "brand_configurations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_criteria" ADD CONSTRAINT "content_criteria_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_campaign_metrics_data" ON "campaign_metrics" USING btree ("data");--> statement-breakpoint
CREATE INDEX "IDX_campaign_metrics_account" ON "campaign_metrics" USING btree ("nome_conta");--> statement-breakpoint
CREATE INDEX "IDX_campaign_metrics_sync_batch" ON "campaign_metrics" USING btree ("sync_batch");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");