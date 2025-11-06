
import { db } from '../../infrastructure/database/connection';
import { eq, desc, sql, and, count } from "drizzle-orm";
import {
  companies,
  users,
  integrations,
  campaigns,
  creatives,
  policies,
  audits,
  auditActions,
  brandConfigurations,
  contentCriteria,
  campaignMetrics,
  performanceBenchmarks,
  type Company,
  type InsertCompany,
  type User,
  type UpsertUser,
  type InsertIntegration,
  type Integration,
  type InsertCampaign,
  type Campaign,
  type InsertCreative,
  type Creative,
  type InsertPolicy,
  type Policy,
  type InsertAudit,
  type Audit,
  type InsertAuditAction,
  type AuditAction,
  type InsertBrandConfiguration,
  type BrandConfiguration,
  type InsertContentCriteria,
  type ContentCriteria,
  type InsertCampaignMetrics,
  type CampaignMetrics,
  type InsertPerformanceBenchmarks,
  type PerformanceBenchmarks,
} from "../schema.js";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: Omit<UpsertUser, 'id'>): Promise<User>;
  updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  getIntegrationsByUser(userId: string): Promise<Integration[]>;
  updateIntegration(id: string, data: Partial<InsertIntegration>): Promise<Integration | undefined>;
  deleteIntegration(integrationId: string, userId: string): Promise<void>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  getCampaignsByUser(userId: string): Promise<Campaign[]>;
  getCampaignById(id: string): Promise<Campaign | undefined>;
  updateCampaign(id: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  createCreative(creative: InsertCreative): Promise<Creative>;
  getCreativesByUser(userId: string): Promise<Creative[]>;
  getCreativesByCampaign(campaignId: string): Promise<Creative[]>;
  getCreativeById(id: string): Promise<Creative | undefined>;
  updateCreative(id: string, data: Partial<InsertCreative>): Promise<Creative | undefined>;
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  getPoliciesByUser(userId: string): Promise<Policy[]>;
  getPolicyById(id: string): Promise<Policy | undefined>;
  updatePolicy(id: string, data: Partial<InsertPolicy>): Promise<Policy | undefined>;
  deletePolicy(id: string): Promise<boolean>;
  createAudit(audit: InsertAudit): Promise<Audit>;
  getAuditById(id: string): Promise<Audit | undefined>;
  getAuditsByUser(userId: string): Promise<Audit[]>;
  getAuditsByCreative(creativeId: string): Promise<Audit[]>;
  getRecentAudits(userId: string, limit?: number): Promise<Audit[]>;
  deleteAudit(id: string): Promise<boolean>;
  createAuditAction(action: InsertAuditAction): Promise<AuditAction>;
  getAuditActionsByUser(userId: string): Promise<AuditAction[]>;
  updateAuditAction(id: string, data: Partial<InsertAuditAction>): Promise<AuditAction | undefined>;
  getDashboardMetrics(userId: string): Promise<{
    activeCampaigns: number;
    creativesAnalyzed: number;
    nonCompliant: number;
    lowPerformance: number;
  }>;
  getProblemCreatives(userId: string, limit?: number): Promise<(Creative & { audit: Audit })[]>;
  getCampaignMetrics(userId: string, filters: {
    page: number;
    limit: number;
    account?: string;
    campaign?: string;
  }): Promise<{ data: CampaignMetrics[]; total: number; }>;
  createBrandConfiguration(brandConfig: InsertBrandConfiguration): Promise<BrandConfiguration>;
  getBrandConfigurationsByUser(userId: string): Promise<BrandConfiguration[]>;
  getBrandConfigurationById(id: string): Promise<BrandConfiguration | undefined>;
  updateBrandConfiguration(id: string, data: Partial<InsertBrandConfiguration>): Promise<BrandConfiguration | undefined>;
  deleteBrandConfiguration(id: string): Promise<boolean>;
  createContentCriteria(contentCriteria: InsertContentCriteria): Promise<ContentCriteria>;
  getContentCriteriaByUser(userId: string): Promise<ContentCriteria[]>;
  getContentCriteriaById(id: string): Promise<ContentCriteria | undefined>;
  updateContentCriteria(id: string, data: Partial<InsertContentCriteria>): Promise<ContentCriteria | undefined>;
  deleteContentCriteria(id: string): Promise<boolean>;
  createOrUpdatePerformanceBenchmarks(userId: string, benchmarks: InsertPerformanceBenchmarks): Promise<PerformanceBenchmarks>;
  getPerformanceBenchmarksByUser(userId: string): Promise<PerformanceBenchmarks | undefined>;
  deletePerformanceBenchmarks(userId: string): Promise<boolean>;
  createCompany(company: InsertCompany): Promise<Company>;
  getCompanyById(id: string): Promise<Company | undefined>;
  getAllCompanies(): Promise<Company[]>;
  getCompanyBySlug(slug: string): Promise<Company | undefined>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;
  getCompanyStats(companyId: string): Promise<any>;
  getCampaignMetricsDebug(): Promise<{
    totalRecords: number;
    recordsBySource: { source: string; count: number }[];
    latestSyncBatch: string | null;
    dateRange: { earliest: Date | null; latest: Date | null };
    sampleRecords: CampaignMetrics[];
  }>;
}

export class DatabaseStorage implements IStorage {
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
    const [user] = await db.insert(users).values(data).returning();
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
    const user = await this.getUserById(id);
    if (user && user.email === 'rafael@clickhero.com.br') {
      throw new Error('Cannot delete master user');
    }
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: { ...userData, updatedAt: new Date() },
      })
      .returning();
    return user;
  }

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

  async getDashboardMetrics(userId: string): Promise<{
    activeCampaigns: number;
    creativesAnalyzed: number;
    nonCompliant: number;
    lowPerformance: number;
  }> {
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

  async getProblemCreatives(userId: string, limit = 10): Promise<(Creative & { audit: Audit })[]> {
    const problemCreatives = await db
      .select()
      .from(audits)
      .innerJoin(creatives, eq(audits.creativeId, creatives.id))
      .where(and(eq(audits.userId, userId), eq(audits.status, 'non_compliant')))
      .orderBy(desc(audits.createdAt))
      .limit(limit);

    return problemCreatives.map(row => ({
      ...row.creatives,
      audit: row.audits,
    }));
  }

  async getCampaignMetrics(userId: string, filters: {
    page: number;
    limit: number;
    account?: string;
    campaign?: string;
  }): Promise<{ data: CampaignMetrics[]; total: number; }> {
    const offset = (filters.page - 1) * filters.limit;
    const whereConditions = [];

    if (filters.account) {
      whereConditions.push(eq(campaignMetrics.nomeAconta, filters.account));
    }
    if (filters.campaign) {
      whereConditions.push(eq(campaignMetrics.campanha, filters.campaign));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(campaignMetrics)
      .where(whereClause);

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

  async createBrandConfiguration(brandConfig: InsertBrandConfiguration): Promise<BrandConfiguration> {
    const [result] = await db.insert(brandConfigurations).values(brandConfig).returning();
    return result;
  }

  async getBrandConfigurationsByUser(userId: string): Promise<BrandConfiguration[]> {
    return db.select().from(brandConfigurations)
      .where(eq(brandConfigurations.userId, userId))
      .orderBy(desc(brandConfigurations.createdAt));
  }

  async getBrandConfigurationById(id: string): Promise<BrandConfiguration | undefined> {
    const [result] = await db.select().from(brandConfigurations).where(eq(brandConfigurations.id, id));
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
    const result = await db.delete(brandConfigurations).where(eq(brandConfigurations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createContentCriteria(contentCriteriaData: InsertContentCriteria): Promise<ContentCriteria> {
    const [result] = await db.insert(contentCriteria).values(contentCriteriaData).returning();
    return result;
  }

  async getContentCriteriaByUser(userId: string): Promise<ContentCriteria[]> {
    return db.select().from(contentCriteria)
      .where(eq(contentCriteria.userId, userId))
      .orderBy(desc(contentCriteria.createdAt));
  }

  async getContentCriteriaById(id: string): Promise<ContentCriteria | undefined> {
    const [result] = await db.select().from(contentCriteria).where(eq(contentCriteria.id, id));
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
    const result = await db.delete(contentCriteria).where(eq(contentCriteria.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createOrUpdatePerformanceBenchmarks(userId: string, benchmarks: InsertPerformanceBenchmarks): Promise<PerformanceBenchmarks> {
    const existing = await this.getPerformanceBenchmarksByUser(userId);

    if (existing) {
      const [result] = await db
        .update(performanceBenchmarks)
        .set({ ...benchmarks, updatedAt: new Date() })
        .where(eq(performanceBenchmarks.userId, userId))
        .returning();
      return result;
    } else {
      const [result] = await db
        .insert(performanceBenchmarks)
        .values({ ...benchmarks, userId })
        .returning();
      return result;
    }
  }

  async getPerformanceBenchmarksByUser(userId: string): Promise<PerformanceBenchmarks | undefined> {
    const [result] = await db.select().from(performanceBenchmarks)
      .where(eq(performanceBenchmarks.userId, userId));
    return result;
  }

  async deletePerformanceBenchmarks(userId: string): Promise<boolean> {
    const result = await db.delete(performanceBenchmarks).where(eq(performanceBenchmarks.userId, userId));
    return (result.rowCount ?? 0) > 0;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  async getCompanyBySlug(slug: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.slug, slug));
    return company;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updated] = await db
      .update(companies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updated;
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await db.delete(companies).where(eq(companies.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getCompanyStats(companyId: string): Promise<any> {
    const [userCount] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.companyId, companyId));

    const [campaignCount] = await db
      .select({ count: count() })
      .from(campaigns)
      .innerJoin(users, eq(campaigns.userId, users.id))
      .where(eq(users.companyId, companyId));

    return {
      users: userCount?.count || 0,
      campaigns: campaignCount?.count || 0,
    };
  }

  async getCampaignMetricsDebug(): Promise<{
    totalRecords: number;
    recordsBySource: { source: string; count: number }[];
    latestSyncBatch: string | null;
    dateRange: { earliest: Date | null; latest: Date | null };
    sampleRecords: CampaignMetrics[];
  }> {
    const [totalResult] = await db.select({ count: count() }).from(campaignMetrics);

    const sourceResults = await db
      .select({ source: campaignMetrics.source, count: count() })
      .from(campaignMetrics)
      .groupBy(campaignMetrics.source);

    const [latestBatchResult] = await db
      .select({ syncBatch: campaignMetrics.syncBatch })
      .from(campaignMetrics)
      .orderBy(desc(campaignMetrics.createdAt))
      .limit(1);

    const [dateRangeResult] = await db
      .select({
        earliest: sql<Date>`min(${campaignMetrics.data})`,
        latest: sql<Date>`max(${campaignMetrics.data})`
      })
      .from(campaignMetrics);

    const sampleRecords = await db
      .select()
      .from(campaignMetrics)
      .orderBy(desc(campaignMetrics.createdAt))
      .limit(5);

    return {
      totalRecords: totalResult?.count || 0,
      recordsBySource: sourceResults.map(r => ({ source: r.source || 'unknown', count: r.count })),
      latestSyncBatch: latestBatchResult?.syncBatch || null,
      dateRange: {
        earliest: dateRangeResult?.earliest || null,
        latest: dateRangeResult?.latest || null
      },
      sampleRecords
    };
  }
}

export const storage = new DatabaseStorage();
