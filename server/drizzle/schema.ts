
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  uuid,
  pgEnum,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Platform Settings (Global configuration for OAuth apps)
export const platformSettings = pgTable("platform_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  platform: varchar("platform").notNull().unique(), // 'meta', 'google'
  appId: text("app_id"),
  appSecret: text("app_secret"),
  redirectUri: text("redirect_uri"),
  isConfigured: boolean("is_configured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscription plan enum
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'starter', 'professional', 'enterprise']);

// User role enum
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'company_admin', 'operador']);

// Company status enum
export const companyStatusEnum = pgEnum('company_status', ['active', 'suspended', 'trial', 'cancelled']);

// Subscription Plans table (Plan templates)
export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  billingCycle: varchar("billing_cycle").notNull().default('monthly'), // 'monthly', 'yearly'
  isActive: boolean("is_active").default(true),
  
  // Limites do plano
  maxUsers: integer("max_users").notNull(),
  maxCampaigns: integer("max_campaigns").notNull(),
  maxAuditsPerMonth: integer("max_audits_per_month").notNull(),
  maxIntegrations: integer("max_integrations").default(2),
  
  // Features
  features: jsonb("features"), // Array of features
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Companies table (Tenants)
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 7 }),
  status: companyStatusEnum("status").default('trial'),
  
  subscriptionPlan: subscriptionPlanEnum("subscription_plan").default('free'),
  subscriptionStatus: varchar("subscription_status").default('trial'),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  trialEndsAt: timestamp("trial_ends_at"),
  
  maxUsers: integer("max_users").default(5),
  maxCampaigns: integer("max_campaigns").default(10),
  maxAuditsPerMonth: integer("max_audits_per_month").default(100),
  
  currentUsers: integer("current_users").default(0),
  currentCampaigns: integer("current_campaigns").default(0),
  auditsThisMonth: integer("audits_this_month").default(0),
  
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  billingEmail: varchar("billing_email"),
  taxId: varchar("tax_id"),
  
  settings: jsonb("settings"),
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  role: userRoleEnum("role").notNull().default('operador'),
  profileImageUrl: varchar("profile_image_url"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Platform integrations
export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: varchar("platform").notNull(), // 'meta', 'google', 'google_sheets'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accountId: varchar("account_id"),
  accountName: text("account_name"), // Nome da conta de anúncios
  accountStatus: varchar("account_status"), // Status da conta (ACTIVE, DISABLED, etc)
  status: varchar("status").default('active'),
  lastSync: timestamp("last_sync"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  dataSource: varchar("data_source"), // For google_sheets: 'meta' or 'google' to indicate real platform
});

// Campaigns
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  integrationId: uuid("integration_id").notNull().references(() => integrations.id, { onDelete: 'cascade' }),
  externalId: varchar("external_id").notNull(),
  name: text("name").notNull(),
  platform: varchar("platform").notNull(),
  status: varchar("status").notNull(),
  account: varchar("account"),
  objective: varchar("objective"),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Ad Sets (Grupos de Anúncios)
export const adSets = pgTable("ad_sets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  externalId: varchar("external_id").notNull(),
  name: text("name").notNull(),
  status: varchar("status").notNull(),
  dailyBudget: decimal("daily_budget", { precision: 10, scale: 2 }),
  lifetimeBudget: decimal("lifetime_budget", { precision: 10, scale: 2 }),
  bidStrategy: varchar("bid_strategy"),
  targeting: jsonb("targeting"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Creatives (Anúncios)
export const creatives = pgTable("creatives", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  adSetId: uuid("ad_set_id").references(() => adSets.id, { onDelete: 'cascade' }),
  externalId: varchar("external_id").notNull(),
  name: text("name").notNull(),
  type: varchar("type").notNull(),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  text: text("text"),
  headline: text("headline"),
  description: text("description"),
  callToAction: text("call_to_action"),
  status: varchar("status").notNull(),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  conversions: integer("conversions").default(0),
  ctr: decimal("ctr", { precision: 5, scale: 3 }).default("0"),
  cpc: decimal("cpc", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Policies
export const policies = pgTable("policies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  rules: jsonb("rules").notNull(),
  performanceThresholds: jsonb("performance_thresholds"),
  status: varchar("status").default('active'),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audits
export const audits = pgTable("audits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  creativeId: uuid("creative_id").notNull(),
  policyId: uuid("policy_id").references(() => policies.id),
  status: varchar("status").notNull(),
  complianceScore: decimal("compliance_score", { precision: 5, scale: 2 }).notNull(),
  performanceScore: decimal("performance_score", { precision: 5, scale: 2 }).notNull(),
  issues: jsonb("issues"),
  recommendations: jsonb("recommendations"),
  aiAnalysis: jsonb("ai_analysis"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit Actions
export const auditActions = pgTable("audit_actions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  auditId: uuid("audit_id").notNull().references(() => audits.id, { onDelete: 'cascade' }),
  action: varchar("action").notNull(),
  status: varchar("status").default('pending'),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Brand Configurations
export const brandConfigurations = pgTable("brand_configurations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  logoUrl: text("logo_url"),
  brandName: text("brand_name").notNull(),
  primaryColor: varchar("primary_color", { length: 7 }),
  secondaryColor: varchar("secondary_color", { length: 7 }),
  accentColor: varchar("accent_color", { length: 7 }),
  fontFamily: varchar("font_family"),
  brandGuidelines: text("brand_guidelines"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Content Criteria
export const contentCriteria = pgTable("content_criteria", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  requiredKeywords: jsonb("required_keywords"),
  prohibitedKeywords: jsonb("prohibited_keywords"),
  requiredPhrases: jsonb("required_phrases"),
  prohibitedPhrases: jsonb("prohibited_phrases"),
  minTextLength: integer("min_text_length"),
  maxTextLength: integer("max_text_length"),
  requiresLogo: boolean("requires_logo").default(false),
  requiresBrandColors: boolean("requires_brand_colors").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Google Sheets Configuration
export const googleSheetsConfig = pgTable("google_sheets_config", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  sheetId: text("sheet_id").notNull(),
  tabGid: text("tab_gid").default('0'),
  name: text("name").notNull(),
  status: varchar("status").default('active'),
  lastSync: timestamp("last_sync"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaign Metrics
export const campaignMetrics = pgTable("campaign_metrics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  data: timestamp("data").notNull(),
  nomeAconta: text("nome_conta").notNull(),
  adUrl: text("ad_url"),
  campanha: text("campanha").notNull(),
  grupoAnuncios: text("grupo_anuncios").notNull(),
  anuncios: text("anuncios").notNull(),
  impressoes: integer("impressoes").default(0),
  cliques: integer("cliques").default(0),
  cpm: decimal("cpm", { precision: 10, scale: 2 }).default("0"),
  cpc: decimal("cpc", { precision: 10, scale: 2 }).default("0"),
  conversasIniciadas: integer("conversas_iniciadas").default(0),
  custoConversa: decimal("custo_conversa", { precision: 10, scale: 2 }).default("0"),
  investimento: decimal("investimento", { precision: 10, scale: 2 }).default("0"),
  source: varchar("source").default('google_sheets'),
  status: varchar("status").default('imported'),
  syncBatch: varchar("sync_batch"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_campaign_metrics_data").on(table.data),
  index("IDX_campaign_metrics_account").on(table.nomeAconta),
  index("IDX_campaign_metrics_sync_batch").on(table.syncBatch),
]);

// Performance Benchmarks
export const performanceBenchmarks = pgTable('performance_benchmarks', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull().references(() => users.id),
  ctrMin: decimal('ctr_min', { precision: 5, scale: 3 }),
  ctrTarget: decimal('ctr_target', { precision: 5, scale: 3 }),
  cpcMax: decimal('cpc_max', { precision: 10, scale: 2 }),
  cpcTarget: decimal('cpc_target', { precision: 10, scale: 2 }),
  conversionsMin: integer('conversions_min'),
  conversionsTarget: integer('conversions_target'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  campaigns: many(campaigns),
  integrations: many(integrations),
  policies: many(policies),
  brandConfigurations: many(brandConfigurations),
  contentCriteria: many(contentCriteria),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  integrations: many(integrations),
  campaigns: many(campaigns),
  creatives: many(creatives),
  policies: many(policies),
  audits: many(audits),
  auditActions: many(auditActions),
  campaignMetrics: many(campaignMetrics),
  brandConfigurations: many(brandConfigurations),
  contentCriteria: many(contentCriteria),
}));

export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  user: one(users, {
    fields: [integrations.userId],
    references: [users.id],
  }),
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [campaigns.userId],
    references: [users.id],
  }),
  integration: one(integrations, {
    fields: [campaigns.integrationId],
    references: [integrations.id],
  }),
  adSets: many(adSets),
  creatives: many(creatives),
}));

export const adSetsRelations = relations(adSets, ({ one, many }) => ({
  user: one(users, {
    fields: [adSets.userId],
    references: [users.id],
  }),
  campaign: one(campaigns, {
    fields: [adSets.campaignId],
    references: [campaigns.id],
  }),
  creatives: many(creatives),
}));

export const creativesRelations = relations(creatives, ({ one, many }) => ({
  user: one(users, {
    fields: [creatives.userId],
    references: [users.id],
  }),
  campaign: one(campaigns, {
    fields: [creatives.campaignId],
    references: [campaigns.id],
  }),
  adSet: one(adSets, {
    fields: [creatives.adSetId],
    references: [adSets.id],
  }),
  audits: many(audits),
}));

export const policiesRelations = relations(policies, ({ one, many }) => ({
  user: one(users, {
    fields: [policies.userId],
    references: [users.id],
  }),
  audits: many(audits),
}));

export const auditsRelations = relations(audits, ({ one, many }) => ({
  user: one(users, {
    fields: [audits.userId],
    references: [users.id],
  }),
  creative: one(creatives, {
    fields: [audits.creativeId],
    references: [creatives.id],
  }),
  policy: one(policies, {
    fields: [audits.policyId],
    references: [policies.id],
  }),
  actions: many(auditActions),
}));

export const auditActionsRelations = relations(auditActions, ({ one }) => ({
  user: one(users, {
    fields: [auditActions.userId],
    references: [users.id],
  }),
  audit: one(audits, {
    fields: [auditActions.auditId],
    references: [audits.id],
  }),
}));

export const campaignMetricsRelations = relations(campaignMetrics, ({ one }) => ({
  user: one(users, {
    fields: [campaignMetrics.userId],
    references: [users.id],
  }),
}));

export const brandConfigurationsRelations = relations(brandConfigurations, ({ one }) => ({
  user: one(users, {
    fields: [brandConfigurations.userId],
    references: [users.id],
  }),
}));

export const contentCriteriaRelations = relations(contentCriteria, ({ one }) => ({
  user: one(users, {
    fields: [contentCriteria.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertPlatformSettingsSchema = createInsertSchema(platformSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdSetSchema = createInsertSchema(adSets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreativeSchema = createInsertSchema(creatives).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPolicySchema = createInsertSchema(policies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditSchema = createInsertSchema(audits).omit({
  id: true,
  createdAt: true,
}).extend({
  complianceScore: z.union([z.string(), z.number()]).transform(val => Number(val)),
  performanceScore: z.union([z.string(), z.number()]).transform(val => Number(val)),
});

export const insertAuditActionSchema = createInsertSchema(auditActions).omit({
  id: true,
  createdAt: true,
});

export const insertCampaignMetricsSchema = createInsertSchema(campaignMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBrandConfigurationSchema = createInsertSchema(brandConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContentCriteriaSchema = createInsertSchema(contentCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerformanceBenchmarksSchema = createInsertSchema(performanceBenchmarks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Company schemas
export const createCompanySchema = z.object({
  name: z.string().min(1, "Nome da empresa é obrigatório"),
  slug: z.string().min(1, "Slug é obrigatório").regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  contactEmail: z.string().email("Email de contato inválido"),
  subscriptionPlan: z.enum(['free', 'starter', 'professional', 'enterprise']).default('free'),
  maxUsers: z.number().int().positive().default(5),
  maxCampaigns: z.number().int().positive().default(10),
  maxAuditsPerMonth: z.number().int().positive().default(100),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1, "Nome da empresa é obrigatório").optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  status: z.enum(['active', 'suspended', 'trial', 'cancelled']).optional(),
  subscriptionPlan: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  maxUsers: z.number().int().positive().optional(),
  maxCampaigns: z.number().int().positive().optional(),
  maxAuditsPerMonth: z.number().int().positive().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  billingEmail: z.string().email().optional(),
  taxId: z.string().optional(),
});

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
  role: z.enum(['super_admin', 'company_admin', 'operador']).default('operador'),
  companyId: z.string().uuid().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export const createUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
  role: z.enum(['administrador', 'operador']),
});

export const updateUserSchema = z.object({
  email: z.string().email("Email inválido").optional(),
  firstName: z.string().min(1, "Nome é obrigatório").optional(),
  lastName: z.string().min(1, "Sobrenome é obrigatório").optional(),
  role: z.enum(['administrador', 'operador']).optional(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, "Nome é obrigatório").optional(),
  lastName: z.string().min(1, "Sobrenome é obrigatório").optional(),
  email: z.string().email("Email inválido").optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

export const settingsDTO = z.object({
  brand: z.object({
    logoUrl: z.string().url().nullable().optional(),
    primaryColor: z.string().nullable().optional(),
    secondaryColor: z.string().nullable().optional(),
    accentColor: z.string().nullable().optional(),
    visualGuidelines: z.string().nullable().optional()
  }),
  brandPolicies: z.object({
    autoApproval: z.boolean(),
    autoActions: z.object({
      pauseOnViolation: z.boolean(),
      sendForReview: z.boolean(),
      autoFixMinor: z.boolean()
    })
  }),
  validationCriteria: z.object({
    requiredKeywords: z.array(z.string()),
    forbiddenTerms: z.array(z.string()),
    brandRequirements: z.object({
      requireLogo: z.boolean(),
      requireBrandColors: z.boolean()
    })
  }),
  performanceBenchmarks: z.object({
    ctrMin: z.number().nullable().optional(),
    ctrTarget: z.number().nullable().optional(),
    cpcMax: z.number().nullable().optional(),
    cpcTarget: z.number().nullable().optional(),
    conversionsMin: z.number().int().nullable().optional(),
    conversionsTarget: z.number().int().nullable().optional()
  })
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type RegisterData = z.infer<typeof registerSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type CreateUserData = z.infer<typeof createUserSchema>;
export type UpdateUserData = z.infer<typeof updateUserSchema>;
export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type UserRole = 'super_admin' | 'company_admin' | 'operador';
export type SubscriptionPlan = 'free' | 'starter' | 'professional' | 'enterprise';
export type CompanyStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type CreateCompanyData = z.infer<typeof createCompanySchema>;
export type UpdateCompanyData = z.infer<typeof updateCompanySchema>;
export type InsertPlatformSettings = z.infer<typeof insertPlatformSettingsSchema>;
export type PlatformSettings = typeof platformSettings.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertAdSet = z.infer<typeof insertAdSetSchema>;
export type AdSet = typeof adSets.$inferSelect;
export type InsertCreative = z.infer<typeof insertCreativeSchema>;
export type Creative = typeof creatives.$inferSelect;
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Policy = typeof policies.$inferSelect;
export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type Audit = typeof audits.$inferSelect;
export type InsertAuditAction = z.infer<typeof insertAuditActionSchema>;
export type AuditAction = typeof auditActions.$inferSelect;
export type InsertCampaignMetrics = z.infer<typeof insertCampaignMetricsSchema>;
export type CampaignMetrics = typeof campaignMetrics.$inferSelect;
export type InsertBrandConfiguration = z.infer<typeof insertBrandConfigurationSchema>;
export type BrandConfiguration = typeof brandConfigurations.$inferSelect;
export type InsertContentCriteria = z.infer<typeof insertContentCriteriaSchema>;
export type ContentCriteria = typeof contentCriteria.$inferSelect;
export type InsertPerformanceBenchmarks = z.infer<typeof insertPerformanceBenchmarksSchema>;
export type PerformanceBenchmarks = typeof performanceBenchmarks.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type SettingsDTO = z.infer<typeof settingsDTO>;
export type BrandSettings = SettingsDTO['brand'];
export type BrandPolicySettings = SettingsDTO['brandPolicies'];
export type ValidationCriteriaSettings = SettingsDTO['validationCriteria'];
export type PerformanceBenchmarksSettings = SettingsDTO['performanceBenchmarks'];
