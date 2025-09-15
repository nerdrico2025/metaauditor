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

// User role enum
export const userRoleEnum = pgEnum('user_role', ['administrador', 'operador']);

// User storage table (custom auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  platform: varchar("platform").notNull(), // 'meta' or 'google'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accountId: varchar("account_id"),
  status: varchar("status").default('active'), // 'active', 'inactive', 'error'
  lastSync: timestamp("last_sync"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaigns
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  integrationId: uuid("integration_id").notNull().references(() => integrations.id, { onDelete: 'cascade' }),
  externalId: varchar("external_id").notNull(), // ID from Meta/Google
  name: text("name").notNull(),
  platform: varchar("platform").notNull(),
  status: varchar("status").notNull(), // 'active', 'paused', 'inactive'
  budget: decimal("budget", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Creatives
export const creatives = pgTable("creatives", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  externalId: varchar("external_id").notNull(),
  name: text("name").notNull(),
  type: varchar("type").notNull(), // 'image', 'video', 'carousel', 'text'
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  text: text("text"),
  headline: text("headline"),
  description: text("description"),
  callToAction: text("call_to_action"),
  status: varchar("status").notNull(), // 'active', 'paused', 'inactive'
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
  rules: jsonb("rules").notNull(), // JSON structure for validation rules
  performanceThresholds: jsonb("performance_thresholds"), // JSON for performance criteria
  status: varchar("status").default('active'), // 'active', 'inactive'
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audits
export const audits = pgTable("audits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  creativeId: uuid("creative_id").notNull().references(() => creatives.id, { onDelete: 'cascade' }),
  policyId: uuid("policy_id").references(() => policies.id),
  status: varchar("status").notNull(), // 'compliant', 'non_compliant', 'low_performance', 'needs_review'
  complianceScore: decimal("compliance_score", { precision: 3, scale: 2 }).default("0"),
  performanceScore: decimal("performance_score", { precision: 3, scale: 2 }).default("0"),
  issues: jsonb("issues"), // Array of detected issues
  recommendations: jsonb("recommendations"), // Array of recommended actions
  aiAnalysis: jsonb("ai_analysis"), // Full AI analysis results
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit Actions
export const auditActions = pgTable("audit_actions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  auditId: uuid("audit_id").notNull().references(() => audits.id, { onDelete: 'cascade' }),
  action: varchar("action").notNull(), // 'pause', 'flag_review', 'request_correction'
  status: varchar("status").default('pending'), // 'pending', 'executed', 'failed'
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Brand Configurations
export const brandConfigurations = pgTable("brand_configurations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  logoUrl: text("logo_url"), // URL of uploaded brand logo
  brandName: text("brand_name").notNull(),
  primaryColor: varchar("primary_color", { length: 7 }), // Hex color code
  secondaryColor: varchar("secondary_color", { length: 7 }),
  accentColor: varchar("accent_color", { length: 7 }),
  fontFamily: varchar("font_family"),
  brandGuidelines: text("brand_guidelines"), // Text description of brand guidelines
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Content Criteria
export const contentCriteria = pgTable("content_criteria", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // Name of the criteria set
  description: text("description"),
  requiredKeywords: jsonb("required_keywords"), // Array of required words/phrases
  prohibitedKeywords: jsonb("prohibited_keywords"), // Array of prohibited words/phrases
  requiredPhrases: jsonb("required_phrases"), // Array of required phrases
  prohibitedPhrases: jsonb("prohibited_phrases"), // Array of prohibited phrases
  minTextLength: integer("min_text_length"),
  maxTextLength: integer("max_text_length"),
  requiresLogo: boolean("requires_logo").default(false),
  requiresBrandColors: boolean("requires_brand_colors").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaign Metrics from Google Sheets
export const campaignMetrics = pgTable("campaign_metrics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  data: timestamp("data").notNull(), // Date from sheet
  nomeAconta: text("nome_conta").notNull(), // Account name
  adUrl: text("ad_url"), // Ad URL (can be null/empty)
  campanha: text("campanha").notNull(), // Campaign name
  grupoAnuncios: text("grupo_anuncios").notNull(), // Ad group name
  anuncios: text("anuncios").notNull(), // Ad name
  impressoes: integer("impressoes").default(0), // Impressions
  cliques: integer("cliques").default(0), // Clicks
  cpm: decimal("cpm", { precision: 10, scale: 2 }).default("0"), // Cost per mille
  cpc: decimal("cpc", { precision: 10, scale: 2 }).default("0"), // Cost per click
  conversasIniciadas: integer("conversas_iniciadas").default(0), // Conversations started
  custoConversa: decimal("custo_conversa", { precision: 10, scale: 2 }).default("0"), // Cost per conversation
  investimento: decimal("investimento", { precision: 10, scale: 2 }).default("0"), // Investment
  source: varchar("source").default('google_sheets'), // Data source
  status: varchar("status").default('imported'), // 'imported', 'pending', 'failed'
  syncBatch: varchar("sync_batch"), // Batch identifier for tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_campaign_metrics_data").on(table.data),
  index("IDX_campaign_metrics_account").on(table.nomeAconta),
  index("IDX_campaign_metrics_sync_batch").on(table.syncBatch),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
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

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
  role: z.enum(['administrador', 'operador']).default('operador'),
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

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type RegisterData = z.infer<typeof registerSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type CreateUserData = z.infer<typeof createUserSchema>;
export type UpdateUserData = z.infer<typeof updateUserSchema>;
export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type UserRole = 'administrador' | 'operador';
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;
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

// Performance Benchmarks table
export const performanceBenchmarks = pgTable('performance_benchmarks', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull().references(() => users.id),
  ctrMin: decimal('ctr_min', { precision: 5, scale: 3 }), // Minimum CTR threshold
  ctrTarget: decimal('ctr_target', { precision: 5, scale: 3 }), // Target CTR
  cpcMax: decimal('cpc_max', { precision: 10, scale: 2 }), // Maximum CPC allowed
  cpcTarget: decimal('cpc_target', { precision: 10, scale: 2 }), // Target CPC
  conversionsMin: integer('conversions_min'), // Minimum conversions
  conversionsTarget: integer('conversions_target'), // Target conversions
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Performance Benchmarks schemas
export const insertPerformanceBenchmarksSchema = createInsertSchema(performanceBenchmarks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Unified Settings DTO Schema (updated without character limits and required phrases)
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

// Settings DTO types
// Additional types for performance benchmarks
export type InsertPerformanceBenchmarks = z.infer<typeof insertPerformanceBenchmarksSchema>;
export type PerformanceBenchmarks = typeof performanceBenchmarks.$inferSelect;

// Settings DTO types
export type SettingsDTO = z.infer<typeof settingsDTO>;
export type BrandSettings = SettingsDTO['brand'];
export type BrandPolicySettings = SettingsDTO['brandPolicies'];
export type ValidationCriteriaSettings = SettingsDTO['validationCriteria'];
export type PerformanceBenchmarksSettings = SettingsDTO['performanceBenchmarks'];