import {
  users,
  integrations,
  campaigns,
  creatives,
  policies,
  audits,
  auditActions,
  campaignMetrics,
  brandConfigurations,
  contentCriteria,
  performanceBenchmarks,
  type User,
  type UpsertUser,
  type Integration,
  type InsertIntegration,
  type Campaign,
  type InsertCampaign,
  type Creative,
  type InsertCreative,
  type Policy,
  type InsertPolicy,
  type Audit,
  type InsertAudit,
  type AuditAction,
  type InsertAuditAction,
  type CampaignMetrics,
  type InsertCampaignMetrics,
  type BrandConfiguration,
  type InsertBrandConfiguration,
  type ContentCriteria,
  type InsertContentCriteria,
  type PerformanceBenchmarks,
  type InsertPerformanceBenchmarks,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: Omit<UpsertUser, 'id'>): Promise<User>;
  updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Integration operations
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  getIntegrationsByUser(userId: string): Promise<Integration[]>;
  updateIntegration(id: string, data: Partial<InsertIntegration>): Promise<Integration | undefined>;
  deleteIntegration(integrationId: string, userId: string): Promise<void>;

  // Campaign operations
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  getCampaignsByUser(userId: string): Promise<Campaign[]>;
  getCampaignById(id: string): Promise<Campaign | undefined>;
  updateCampaign(id: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined>;

  // Creative operations
  createCreative(creative: InsertCreative): Promise<Creative>;
  getCreativesByUser(userId: string): Promise<Creative[]>;
  getCreativesByCampaign(campaignId: string): Promise<Creative[]>;
  getCreativeById(id: string): Promise<Creative | undefined>;
  updateCreative(id: string, data: Partial<InsertCreative>): Promise<Creative | undefined>;

  // Policy operations
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  getPoliciesByUser(userId: string): Promise<Policy[]>;
  getPolicyById(id: string): Promise<Policy | undefined>;
  updatePolicy(id: string, data: Partial<InsertPolicy>): Promise<Policy | undefined>;
  deletePolicy(id: string): Promise<boolean>;

  // Audit operations
  createAudit(audit: InsertAudit): Promise<Audit>;
  getAuditById(id: string): Promise<Audit | undefined>;
  getAuditsByUser(userId: string): Promise<Audit[]>;
  getAuditsByCreative(creativeId: string): Promise<Audit[]>;
  getRecentAudits(userId: string, limit?: number): Promise<Audit[]>;
  deleteAudit(id: string): Promise<boolean>;

  // Audit Action operations
  createAuditAction(action: InsertAuditAction): Promise<AuditAction>;
  getAuditActionsByUser(userId: string): Promise<AuditAction[]>;
  updateAuditAction(id: string, data: Partial<InsertAuditAction>): Promise<AuditAction | undefined>;

  // Dashboard metrics
  getDashboardMetrics(userId: string): Promise<{
    activeCampaigns: number;
    creativesAnalyzed: number;
    nonCompliant: number;
    lowPerformance: number;
  }>;

  // Problem creatives
  getProblemCreatives(userId: string, limit?: number): Promise<(Creative & { audit: Audit })[]>;

  // Campaign Metrics operations
  getCampaignMetrics(userId: string, filters: {
    page: number;
    limit: number;
    account?: string;
    campaign?: string;
  }): Promise<{
    data: CampaignMetrics[];
    total: number;
  }>;

  // Brand Configuration operations
  createBrandConfiguration(brandConfig: InsertBrandConfiguration): Promise<BrandConfiguration>;
  getBrandConfigurationsByUser(userId: string): Promise<BrandConfiguration[]>;
  getBrandConfigurationById(id: string): Promise<BrandConfiguration | undefined>;
  updateBrandConfiguration(id: string, data: Partial<InsertBrandConfiguration>): Promise<BrandConfiguration | undefined>;
  deleteBrandConfiguration(id: string): Promise<boolean>;

  // Content Criteria operations
  createContentCriteria(contentCriteria: InsertContentCriteria): Promise<ContentCriteria>;
  getContentCriteriaByUser(userId: string): Promise<ContentCriteria[]>;
  getContentCriteriaById(id: string): Promise<ContentCriteria | undefined>;
  updateContentCriteria(id: string, data: Partial<InsertContentCriteria>): Promise<ContentCriteria | undefined>;
  deleteContentCriteria(id: string): Promise<boolean>;

  // Performance Benchmark operations
  createOrUpdatePerformanceBenchmarks(userId: string, benchmarks: InsertPerformanceBenchmarks): Promise<PerformanceBenchmarks>;
  getPerformanceBenchmarksByUser(userId: string): Promise<PerformanceBenchmarks | undefined>;
  deletePerformanceBenchmarks(userId: string): Promise<boolean>;

  // Debug methods for campaign metrics verification
  getAllUsers(): Promise<User[]>;
  getCampaignMetricsDebug(): Promise<{
    totalRecords: number;
    recordsBySource: { source: string; count: number }[];
    latestSyncBatch: string | null;
    dateRange: { earliest: Date | null; latest: Date | null };
    sampleRecords: CampaignMetrics[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(data: Omit<UpsertUser, 'id'>): Promise<User> {
    const [user] = await db.insert(users)
      .values(data)
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Prevent deletion of master user
    const user = await this.getUserById(id);
    if (user && user.email === 'rafael@clickhero.com.br') {
      throw new Error('Cannot delete master user');
    }
    
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Integration operations
  async createIntegration(integration: InsertIntegration): Promise<Integration> {
    const [newIntegration] = await db.insert(integrations).values(integration).returning();
    return newIntegration;
  }

  async getIntegrationsByUser(userId: string): Promise<Integration[]> {
    return await db.select().from(integrations).where(eq(integrations.userId, userId));
  }

  async updateIntegration(id: string, data: Partial<InsertIntegration>): Promise<Integration | undefined> {
    const [updated] = await db
      .update(integrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(integrations.id, id))
      .returning();
    return updated;
  }

  async deleteIntegration(integrationId: string, userId: string): Promise<void> {
    await db
      .delete(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.userId, userId)));
  }

  // Campaign operations
  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaign).returning();
    return newCampaign;
  }

  async getCampaignsByUser(userId: string): Promise<Campaign[]> {
    return await db.select().from(campaigns).where(eq(campaigns.userId, userId));
  }

  async getCampaignById(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async updateCampaign(id: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [updated] = await db
      .update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  // Creative operations
  async createCreative(creative: InsertCreative): Promise<Creative> {
    const [newCreative] = await db.insert(creatives).values(creative).returning();
    return newCreative;
  }

  async getCreativesByUser(userId: string): Promise<Creative[]> {
    return await db.select().from(creatives).where(eq(creatives.userId, userId));
  }

  async getCreativesByCampaign(campaignId: string): Promise<Creative[]> {
    return await db.select().from(creatives).where(eq(creatives.campaignId, campaignId));
  }

  async getCreativeById(id: string): Promise<Creative | undefined> {
    const [creative] = await db.select().from(creatives).where(eq(creatives.id, id));
    return creative;
  }

  async updateCreative(id: string, data: Partial<InsertCreative>): Promise<Creative | undefined> {
    const [updated] = await db
      .update(creatives)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(creatives.id, id))
      .returning();
    return updated;
  }

  // Policy operations
  async createPolicy(policy: InsertPolicy): Promise<Policy> {
    const [newPolicy] = await db.insert(policies).values(policy).returning();
    return newPolicy;
  }

  async getPoliciesByUser(userId: string): Promise<Policy[]> {
    return await db.select().from(policies).where(eq(policies.userId, userId));
  }

  async getPolicyById(id: string): Promise<Policy | undefined> {
    const [policy] = await db.select().from(policies).where(eq(policies.id, id));
    return policy;
  }

  async updatePolicy(id: string, data: Partial<InsertPolicy>): Promise<Policy | undefined> {
    const [updated] = await db
      .update(policies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(policies.id, id))
      .returning();
    return updated;
  }

  async deletePolicy(id: string): Promise<boolean> {
    const result = await db.delete(policies).where(eq(policies.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Audit operations
  async createAudit(audit: InsertAudit): Promise<Audit> {
    const [newAudit] = await db.insert(audits).values(audit).returning();
    return newAudit;
  }

  async getAuditById(id: string): Promise<Audit | undefined> {
    const [audit] = await db.select().from(audits).where(eq(audits.id, id));
    return audit;
  }

  async getAuditsByUser(userId: string): Promise<Audit[]> {
    return await db.select().from(audits).where(eq(audits.userId, userId)).orderBy(desc(audits.createdAt));
  }

  async getAuditsByCreative(creativeId: string): Promise<Audit[]> {
    return await db.select().from(audits).where(eq(audits.creativeId, creativeId)).orderBy(desc(audits.createdAt));
  }

  async getRecentAudits(userId: string, limit = 10): Promise<Audit[]> {
    return await db.select().from(audits)
      .where(eq(audits.userId, userId))
      .orderBy(desc(audits.createdAt))
      .limit(limit);
  }

  async deleteAudit(id: string): Promise<boolean> {
    const result = await db.delete(audits).where(eq(audits.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Audit Action operations
  async createAuditAction(action: InsertAuditAction): Promise<AuditAction> {
    const [newAction] = await db.insert(auditActions).values(action).returning();
    return newAction;
  }

  async getAuditActionsByUser(userId: string): Promise<AuditAction[]> {
    return await db.select().from(auditActions).where(eq(auditActions.userId, userId)).orderBy(desc(auditActions.createdAt));
  }

  async updateAuditAction(id: string, data: Partial<InsertAuditAction>): Promise<AuditAction | undefined> {
    const [updated] = await db
      .update(auditActions)
      .set(data)
      .where(eq(auditActions.id, id))
      .returning();
    return updated;
  }

  // Dashboard metrics
  async getDashboardMetrics(userId: string): Promise<{
    activeCampaigns: number;
    creativesAnalyzed: number;
    nonCompliant: number;
    lowPerformance: number;
  }> {
    // Count distinct campaigns from Google Sheets data (campaignMetrics)
    // This reflects the actual data being synced from the spreadsheet
    // For now, return global count from sheets since campaignMetrics doesn't have userId
    // TODO: Add userId to campaignMetrics during sync for proper user scoping
    const [activeCampaignsResult] = await db
      .select({ count: sql<number>`COUNT(DISTINCT campanha)` })
      .from(campaignMetrics)
      .where(eq(campaignMetrics.source, 'google_sheets'));

    const [creativesAnalyzedResult] = await db
      .select({ count: count() })
      .from(audits)
      .where(eq(audits.userId, userId));

    const [nonCompliantResult] = await db
      .select({ count: count() })
      .from(audits)
      .where(and(eq(audits.userId, userId), eq(audits.status, 'non_compliant')));

    const [lowPerformanceResult] = await db
      .select({ count: count() })
      .from(audits)
      .where(and(eq(audits.userId, userId), eq(audits.status, 'low_performance')));

    return {
      activeCampaigns: activeCampaignsResult?.count || 0,
      creativesAnalyzed: creativesAnalyzedResult?.count || 0,
      nonCompliant: nonCompliantResult?.count || 0,
      lowPerformance: lowPerformanceResult?.count || 0,
    };
  }

  // Problem creatives
  async getProblemCreatives(userId: string, limit = 10): Promise<(Creative & { audit: Audit })[]> {
    const problemCreatives = await db
      .select()
      .from(audits)
      .innerJoin(creatives, eq(audits.creativeId, creatives.id))
      .where(
        and(
          eq(audits.userId, userId),
          eq(audits.status, 'non_compliant')
        )
      )
      .orderBy(desc(audits.createdAt))
      .limit(limit);

    return problemCreatives.map(row => ({
      ...row.creatives,
      audit: row.audits,
    }));
  }

  // Campaign Metrics operations
  async getCampaignMetrics(userId: string, filters: {
    page: number;
    limit: number;
    account?: string;
    campaign?: string;
  }): Promise<{
    data: CampaignMetrics[];
    total: number;
  }> {
    const offset = (filters.page - 1) * filters.limit;

    // Build where conditions
    const whereConditions = [];

    // For now, we'll get all records since campaign metrics are global data
    // In a production system, you might want to filter by user's accessible accounts
    if (filters.account) {
      whereConditions.push(eq(campaignMetrics.nomeAconta, filters.account));
    }

    if (filters.campaign) {
      whereConditions.push(eq(campaignMetrics.campanha, filters.campaign));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(campaignMetrics)
      .where(whereClause);

    // Get paginated data
    const metricsData = await db
      .select()
      .from(campaignMetrics)
      .where(whereClause)
      .orderBy(desc(campaignMetrics.data))
      .limit(filters.limit)
      .offset(offset);

    return {
      data: metricsData,
      total: totalResult?.count || 0
    };
  }

  // Debug methods for campaign metrics verification
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getCampaignMetricsDebug(): Promise<{
    totalRecords: number;
    recordsBySource: { source: string; count: number }[];
    latestSyncBatch: string | null;
    dateRange: { earliest: Date | null; latest: Date | null };
    sampleRecords: CampaignMetrics[];
  }> {
    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(campaignMetrics);

    // Get count by source
    const sourceResults = await db
      .select({
        source: campaignMetrics.source,
        count: count()
      })
      .from(campaignMetrics)
      .groupBy(campaignMetrics.source);

    // Get latest sync batch
    const [latestBatchResult] = await db
      .select({ syncBatch: campaignMetrics.syncBatch })
      .from(campaignMetrics)
      .orderBy(desc(campaignMetrics.createdAt))
      .limit(1);

    // Get date range
    const [dateRangeResult] = await db
      .select({
        earliest: sql<Date>`min(${campaignMetrics.data})`,
        latest: sql<Date>`max(${campaignMetrics.data})`
      })
      .from(campaignMetrics);

    // Get sample records (latest 5)
    const sampleRecords = await db
      .select()
      .from(campaignMetrics)
      .orderBy(desc(campaignMetrics.createdAt))
      .limit(5);

    return {
      totalRecords: totalResult?.count || 0,
      recordsBySource: sourceResults.map(r => ({
        source: r.source || 'unknown',
        count: r.count
      })),
      latestSyncBatch: latestBatchResult?.syncBatch || null,
      dateRange: {
        earliest: dateRangeResult?.earliest || null,
        latest: dateRangeResult?.latest || null
      },
      sampleRecords
    };
  }

  // Brand Configuration operations
  async createBrandConfiguration(brandConfig: InsertBrandConfiguration): Promise<BrandConfiguration> {
    const [result] = await db
      .insert(brandConfigurations)
      .values(brandConfig)
      .returning();
    return result;
  }

  async getBrandConfigurationsByUser(userId: string): Promise<BrandConfiguration[]> {
    return db
      .select()
      .from(brandConfigurations)
      .where(eq(brandConfigurations.userId, userId))
      .orderBy(desc(brandConfigurations.createdAt));
  }

  async getBrandConfigurationById(id: string): Promise<BrandConfiguration | undefined> {
    const [result] = await db
      .select()
      .from(brandConfigurations)
      .where(eq(brandConfigurations.id, id));
    return result;
  }

  async updateBrandConfiguration(id: string, data: Partial<InsertBrandConfiguration>): Promise<BrandConfiguration | undefined> {
    const [result] = await db
      .update(brandConfigurations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(brandConfigurations.id, id))
      .returning();
    return result;
  }

  async deleteBrandConfiguration(id: string): Promise<boolean> {
    const result = await db
      .delete(brandConfigurations)
      .where(eq(brandConfigurations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Content Criteria operations
  async createContentCriteria(contentCriteriaData: InsertContentCriteria): Promise<ContentCriteria> {
    const [result] = await db
      .insert(contentCriteria)
      .values(contentCriteriaData)
      .returning();
    return result;
  }

  async getContentCriteriaByUser(userId: string): Promise<ContentCriteria[]> {
    return db
      .select()
      .from(contentCriteria)
      .where(eq(contentCriteria.userId, userId))
      .orderBy(desc(contentCriteria.createdAt));
  }

  async getContentCriteriaById(id: string): Promise<ContentCriteria | undefined> {
    const [result] = await db
      .select()
      .from(contentCriteria)
      .where(eq(contentCriteria.id, id));
    return result;
  }

  async updateContentCriteria(id: string, data: Partial<InsertContentCriteria>): Promise<ContentCriteria | undefined> {
    const [result] = await db
      .update(contentCriteria)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contentCriteria.id, id))
      .returning();
    return result;
  }

  async deleteContentCriteria(id: string): Promise<boolean> {
    const result = await db
      .delete(contentCriteria)
      .where(eq(contentCriteria.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Performance Benchmark operations
  async createOrUpdatePerformanceBenchmarks(userId: string, benchmarks: InsertPerformanceBenchmarks): Promise<PerformanceBenchmarks> {
    // First try to get existing benchmarks for this user
    const existing = await this.getPerformanceBenchmarksByUser(userId);
    
    if (existing) {
      // Update existing benchmarks
      const [result] = await db
        .update(performanceBenchmarks)
        .set({ ...benchmarks, updatedAt: new Date() })
        .where(eq(performanceBenchmarks.userId, userId))
        .returning();
      return result;
    } else {
      // Create new benchmarks
      const [result] = await db
        .insert(performanceBenchmarks)
        .values({ ...benchmarks, userId })
        .returning();
      return result;
    }
  }

  async getPerformanceBenchmarksByUser(userId: string): Promise<PerformanceBenchmarks | undefined> {
    const [result] = await db
      .select()
      .from(performanceBenchmarks)
      .where(eq(performanceBenchmarks.userId, userId));
    return result;
  }

  async deletePerformanceBenchmarks(userId: string): Promise<boolean> {
    const result = await db
      .delete(performanceBenchmarks)
      .where(eq(performanceBenchmarks.userId, userId));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();