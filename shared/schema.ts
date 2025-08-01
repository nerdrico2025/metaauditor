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

// User storage table (custom auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  integrations: many(integrations),
  campaigns: many(campaigns),
  creatives: many(creatives),
  policies: many(policies),
  audits: many(audits),
  auditActions: many(auditActions),
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

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type RegisterData = z.infer<typeof registerSchema>;
export type LoginData = z.infer<typeof loginSchema>;
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