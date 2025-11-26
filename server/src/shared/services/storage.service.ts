
import { db } from '../../infrastructure/database/connection';
import { eq, desc, sql, and, count, inArray, notInArray, not } from "drizzle-orm";
import {
  companies,
  users,
  integrations,
  syncHistory,
  webhookEvents,
  campaigns,
  adSets,
  creatives,
  policies,
  audits,
  auditActions,
  brandConfigurations,
  contentCriteria,
  campaignMetrics,
  performanceBenchmarks,
  platformSettings,
  subscriptionPlans,
  type Company,
  type InsertCompany,
  type User,
  type UpsertUser,
  type InsertIntegration,
  type Integration,
  type InsertCampaign,
  type Campaign,
  type InsertAdSet,
  type AdSet,
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
  type InsertPlatformSettings,
  type PlatformSettings,
  type InsertSubscriptionPlan,
  type SubscriptionPlan,
  type InsertWebhookEvent,
  type WebhookEvent,
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
  getIntegrationById(id: string): Promise<Integration | undefined>;
  updateIntegration(id: string, data: Partial<InsertIntegration>): Promise<Integration | undefined>;
  deleteIntegration(integrationId: string, userId: string): Promise<void>;
  getSyncHistoryByUser(userId: string): Promise<any[]>;
  createSyncHistory(data: { integrationId: string; userId: string; status: string; type: string; metadata?: any }): Promise<any>;
  updateSyncHistory(id: string, data: { status?: string; completedAt?: Date; campaignsSynced?: number; adSetsSynced?: number; creativeSynced?: number; errorMessage?: string; metadata?: any }): Promise<any>;
  deleteAllSyncHistoryByUser(userId: string): Promise<void>;
  createWebhookEvent(data: InsertWebhookEvent): Promise<WebhookEvent>;
  updateWebhookEvent(id: string, data: Partial<InsertWebhookEvent>): Promise<WebhookEvent | undefined>;
  getWebhookEvents(): Promise<WebhookEvent[]>;
  getUnprocessedWebhookEvents(): Promise<WebhookEvent[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  getCampaignsByUser(userId: string): Promise<Campaign[]>;
  getCampaignById(id: string): Promise<Campaign | undefined>;
  getCampaignByIdWithCompanyCheck(id: string, userId: string): Promise<Campaign | undefined>;
  updateCampaign(id: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;
  deleteAllCampaignsByUser(userId: string): Promise<void>;
  createAdSet(adSet: InsertAdSet): Promise<AdSet>;
  getAdSetsByUser(userId: string): Promise<AdSet[]>;
  getAdSetsByCampaign(campaignId: string): Promise<AdSet[]>;
  getAdSetById(id: string): Promise<AdSet | undefined>;
  updateAdSet(id: string, data: Partial<InsertAdSet>): Promise<AdSet | undefined>;
  deleteAllAdSetsByUser(userId: string): Promise<void>;
  createCreative(creative: InsertCreative): Promise<Creative>;
  getCreativesByUser(userId: string): Promise<Creative[]>;
  getCreativesByCampaign(campaignId: string): Promise<Creative[]>;
  getCreativeById(id: string): Promise<Creative | undefined>;
  updateCreative(id: string, data: Partial<InsertCreative>): Promise<Creative | undefined>;
  deleteAllCreativesByUser(userId: string): Promise<void>;
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
  getPlatformSettingsByPlatform(platform: string): Promise<PlatformSettings | undefined>;
  upsertPlatformSettings(data: Omit<InsertPlatformSettings, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlatformSettings>;
  deletePlatformSettings(platform: string): Promise<boolean>;
  getAllSubscriptionPlans(): Promise<(typeof subscriptionPlans.$inferSelect)[]>;
  getSubscriptionPlanById(id: string): Promise<typeof subscriptionPlans.$inferSelect | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<typeof subscriptionPlans.$inferSelect>;
  updateSubscriptionPlan(id: string, data: Partial<InsertSubscriptionPlan>): Promise<typeof subscriptionPlans.$inferSelect | undefined>;
  deleteSubscriptionPlan(id: string): Promise<boolean>;
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
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    // Super admin without company sees everything
    if (user.role === 'super_admin' && !user.companyId) {
      return await db.select().from(integrations);
    }
    
    // Users with company see integrations from all users in their company
    if (user.companyId) {
      const companyUsers = await db.select({ id: users.id }).from(users).where(eq(users.companyId, user.companyId));
      const companyUserIds = companyUsers.map(u => u.id);
      if (companyUserIds.length === 0) return [];
      return await db.select().from(integrations).where(inArray(integrations.userId, companyUserIds));
    }
    
    // Fallback for users without company (backward compatibility)
    return await db.select().from(integrations).where(eq(integrations.userId, userId));
  }

  async getIntegrationById(id: string): Promise<Integration | undefined> {
    const [integration] = await db.select().from(integrations).where(eq(integrations.id, id));
    return integration;
  }

  async updateIntegration(id: string, data: Partial<InsertIntegration>): Promise<Integration | undefined> {
    const [updated] = await db
      .update(integrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(integrations.id, id))
      .returning();
    return updated;
  }

  async getSyncHistoryByUser(userId: string): Promise<any[]> {
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    // Super admin without company sees everything
    if (user.role === 'super_admin' && !user.companyId) {
      return await db
        .select()
        .from(syncHistory)
        .orderBy(desc(syncHistory.startedAt))
        .limit(50);
    }
    
    // Users with company see sync history from all users in their company
    if (user.companyId) {
      const companyUsers = await db.select({ id: users.id }).from(users).where(eq(users.companyId, user.companyId));
      const companyUserIds = companyUsers.map(u => u.id);
      if (companyUserIds.length === 0) return [];
      return await db
        .select()
        .from(syncHistory)
        .where(inArray(syncHistory.userId, companyUserIds))
        .orderBy(desc(syncHistory.startedAt))
        .limit(50);
    }
    
    // Fallback for users without company
    const history = await db
      .select()
      .from(syncHistory)
      .where(eq(syncHistory.userId, userId))
      .orderBy(desc(syncHistory.startedAt))
      .limit(50);
    return history;
  }

  async createSyncHistory(data: {
    integrationId: string;
    userId: string;
    status: string;
    type: string;
    metadata?: any;
  }): Promise<any> {
    const [record] = await db
      .insert(syncHistory)
      .values({
        ...data,
        startedAt: new Date(),
        campaignsSynced: 0,
        adSetsSynced: 0,
        creativeSynced: 0,
      })
      .returning();
    return record;
  }

  async updateSyncHistory(id: string, data: {
    status?: string;
    completedAt?: Date;
    campaignsSynced?: number;
    adSetsSynced?: number;
    creativeSynced?: number;
    errorMessage?: string;
    metadata?: any;
  }): Promise<any> {
    const [updated] = await db
      .update(syncHistory)
      .set(data)
      .where(eq(syncHistory.id, id))
      .returning();
    return updated;
  }

  async deleteAllSyncHistoryByUser(userId: string): Promise<void> {
    await db
      .delete(syncHistory)
      .where(eq(syncHistory.userId, userId));
  }

  async createWebhookEvent(data: InsertWebhookEvent): Promise<WebhookEvent> {
    const [event] = await db
      .insert(webhookEvents)
      .values(data)
      .returning();
    return event;
  }

  async updateWebhookEvent(id: string, data: Partial<InsertWebhookEvent>): Promise<WebhookEvent | undefined> {
    const [updated] = await db
      .update(webhookEvents)
      .set(data)
      .where(eq(webhookEvents.id, id))
      .returning();
    return updated;
  }

  async getWebhookEvents(): Promise<WebhookEvent[]> {
    return await db
      .select()
      .from(webhookEvents)
      .orderBy(desc(webhookEvents.receivedAt));
  }

  async getUnprocessedWebhookEvents(): Promise<WebhookEvent[]> {
    return await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.processed, false))
      .orderBy(webhookEvents.receivedAt);
  }

  async disableIntegration(integrationId: string, userId: string): Promise<Integration | undefined> {
    // Just mark as inactive, keep all data
    const [updated] = await db
      .update(integrations)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(and(eq(integrations.id, integrationId), eq(integrations.userId, userId)))
      .returning();
    return updated;
  }

  async deleteIntegration(integrationId: string, userId: string, deleteData: boolean = true): Promise<void> {
    // Use a database transaction to prevent deadlocks and ensure atomicity
    await db.transaction(async (tx) => {
      if (deleteData) {
        // Get all campaigns from this integration first
        const integrationCampaigns = await tx
          .select()
          .from(campaigns)
          .where(eq(campaigns.integrationId, integrationId));
        
        const campaignIds = integrationCampaigns.map(c => c.id);
        
        if (campaignIds.length > 0) {
          // Get all creatives to delete their images
          const creativesToDelete = await tx
            .select()
            .from(creatives)
            .where(inArray(creatives.campaignId, campaignIds));
          
          // Delete image files from filesystem (outside transaction, but safe)
          for (const creative of creativesToDelete) {
            if (creative.imageUrl && creative.imageUrl.startsWith('/uploads/')) {
              await this.deleteImageFile(creative.imageUrl);
            }
          }
          
          // Delete in reverse order of dependencies to avoid foreign key conflicts
          // 1. Delete all audits and audit actions for these creatives
          const creativeIds = creativesToDelete.map(c => c.id);
          if (creativeIds.length > 0) {
            // Get all audit IDs for these creatives
            const auditsToDelete = await tx
              .select({ id: audits.id })
              .from(audits)
              .where(inArray(audits.creativeId, creativeIds));
            
            const auditIds = auditsToDelete.map(a => a.id);
            
            // Delete audit actions first (if any)
            if (auditIds.length > 0) {
              await tx
                .delete(auditActions)
                .where(inArray(auditActions.auditId, auditIds));
            }
            
            // Delete audits
            await tx
              .delete(audits)
              .where(inArray(audits.creativeId, creativeIds));
          }
          
          // 2. Delete all creatives from these campaigns
          await tx
            .delete(creatives)
            .where(inArray(creatives.campaignId, campaignIds));
          
          // 3. Delete all ad sets from these campaigns
          await tx
            .delete(adSets)
            .where(inArray(adSets.campaignId, campaignIds));
          
          // 4. Delete all campaigns from this integration
          await tx
            .delete(campaigns)
            .where(eq(campaigns.integrationId, integrationId));
        }
        
        // 5. Delete sync history for this integration
        await tx
          .delete(syncHistory)
          .where(eq(syncHistory.integrationId, integrationId));
        
        // 6. Delete webhook events related to campaigns from this integration
        if (campaignIds.length > 0) {
          const campaignExternalIds = integrationCampaigns.map(c => c.externalId);
          if (campaignExternalIds.length > 0) {
            await tx
              .delete(webhookEvents)
              .where(inArray(webhookEvents.externalId, campaignExternalIds));
          }
        }
      }
      
      // Finally, delete the integration itself
      await tx
        .delete(integrations)
        .where(and(eq(integrations.id, integrationId), eq(integrations.userId, userId)));
    });
  }

  private async deleteImageFile(imageUrl: string): Promise<void> {
    try {
      const { unlink } = await import('fs/promises');
      const { join } = await import('path');
      
      // Convert URL path to filesystem path
      const filepath = join(process.cwd(), 'server', 'public', imageUrl);
      await unlink(filepath);
      console.log(`🗑️  Deleted image file: ${filepath}`);
    } catch (error) {
      console.log(`⚠️  Could not delete image file ${imageUrl}:`, error);
    }
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaign).returning();
    return newCampaign;
  }

  async getCampaignsByUser(userId: string): Promise<Campaign[]> {
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    // Super admin without company sees everything
    if (user.role === 'super_admin' && !user.companyId) {
      return await db.select().from(campaigns);
    }
    
    // Company admins see all campaigns in their company, operators see only theirs
    if (user.companyId) {
      const isAdmin = user.role === 'company_admin' || user.role === 'super_admin';
      if (isAdmin) {
        return await db.select().from(campaigns).where(eq(campaigns.companyId, user.companyId));
      } else {
        return await db.select().from(campaigns).where(
          and(eq(campaigns.userId, userId), eq(campaigns.companyId, user.companyId))
        );
      }
    }
    
    // Fallback for users without company (backward compatibility)
    return await db.select().from(campaigns).where(eq(campaigns.userId, userId));
  }

  async getCampaignById(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async getCampaignByIdWithCompanyCheck(id: string, userId: string): Promise<Campaign | undefined> {
    const user = await this.getUserById(userId);
    if (!user) return undefined;
    
    const [campaign] = await db.select().from(campaigns).where(
      and(
        eq(campaigns.id, id),
        user.companyId ? eq(campaigns.companyId, user.companyId) : eq(campaigns.userId, userId)
      )
    );
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

  async createAdSet(adSet: InsertAdSet): Promise<AdSet> {
    const [newAdSet] = await db.insert(adSets).values(adSet).returning();
    return newAdSet;
  }

  async getAdSetsByUser(userId: string): Promise<AdSet[]> {
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    if (user.role === 'super_admin' && !user.companyId) {
      return await db.select().from(adSets);
    }
    
    if (user.companyId) {
      const isAdmin = user.role === 'company_admin' || user.role === 'super_admin';
      if (isAdmin) {
        return await db.select().from(adSets).where(eq(adSets.companyId, user.companyId));
      } else {
        return await db.select().from(adSets).where(
          and(eq(adSets.userId, userId), eq(adSets.companyId, user.companyId))
        );
      }
    }
    
    return await db.select().from(adSets).where(eq(adSets.userId, userId));
  }

  async getAdSetsByCampaign(campaignId: string): Promise<AdSet[]> {
    return await db.select().from(adSets).where(eq(adSets.campaignId, campaignId));
  }

  async getAdSetById(id: string): Promise<AdSet | undefined> {
    const [adSet] = await db.select().from(adSets).where(eq(adSets.id, id));
    return adSet;
  }

  async updateAdSet(id: string, data: Partial<InsertAdSet>): Promise<AdSet | undefined> {
    const [updated] = await db
      .update(adSets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(adSets.id, id))
      .returning();
    return updated;
  }

  async createCreative(creative: InsertCreative): Promise<Creative> {
    const [newCreative] = await db.insert(creatives).values(creative).returning();
    return newCreative;
  }

  async getCreativesByUser(userId: string): Promise<Creative[]> {
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    if (user.role === 'super_admin' && !user.companyId) {
      return await db.select().from(creatives);
    }
    
    if (user.companyId) {
      const isAdmin = user.role === 'company_admin' || user.role === 'super_admin';
      if (isAdmin) {
        return await db.select().from(creatives).where(eq(creatives.companyId, user.companyId));
      } else {
        return await db.select().from(creatives).where(
          and(eq(creatives.userId, userId), eq(creatives.companyId, user.companyId))
        );
      }
    }
    
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
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    if (user.role === 'super_admin' && !user.companyId) {
      return await db.select().from(policies);
    }
    
    if (user.companyId) {
      const isAdmin = user.role === 'company_admin' || user.role === 'super_admin';
      if (isAdmin) {
        return await db.select().from(policies).where(eq(policies.companyId, user.companyId));
      } else {
        return await db.select().from(policies).where(
          and(eq(policies.userId, userId), eq(policies.companyId, user.companyId))
        );
      }
    }
    
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
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    if (user.role === 'super_admin' && !user.companyId) {
      return await db.select().from(audits).orderBy(desc(audits.createdAt));
    }
    
    if (user.companyId) {
      const isAdmin = user.role === 'company_admin' || user.role === 'super_admin';
      if (isAdmin) {
        return await db.select().from(audits).where(eq(audits.companyId, user.companyId)).orderBy(desc(audits.createdAt));
      } else {
        return await db.select().from(audits).where(
          and(eq(audits.userId, userId), eq(audits.companyId, user.companyId))
        ).orderBy(desc(audits.createdAt));
      }
    }
    
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
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    // Super admin without company sees everything
    if (user.role === 'super_admin' && !user.companyId) {
      return await db.select().from(auditActions).orderBy(desc(auditActions.createdAt));
    }
    
    // Users with company see audit actions from all users in their company
    if (user.companyId) {
      const companyUsers = await db.select({ id: users.id }).from(users).where(eq(users.companyId, user.companyId));
      const companyUserIds = companyUsers.map(u => u.id);
      if (companyUserIds.length === 0) return [];
      return await db.select().from(auditActions)
        .where(inArray(auditActions.userId, companyUserIds))
        .orderBy(desc(auditActions.createdAt));
    }
    
    // Fallback for users without company
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
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    if (user.role === 'super_admin' && !user.companyId) {
      return db.select().from(brandConfigurations).orderBy(desc(brandConfigurations.createdAt));
    }
    
    if (user.companyId) {
      const isAdmin = user.role === 'company_admin' || user.role === 'super_admin';
      if (isAdmin) {
        return db.select().from(brandConfigurations).where(eq(brandConfigurations.companyId, user.companyId))
          .orderBy(desc(brandConfigurations.createdAt));
      } else {
        return db.select().from(brandConfigurations).where(
          and(eq(brandConfigurations.userId, userId), eq(brandConfigurations.companyId, user.companyId))
        ).orderBy(desc(brandConfigurations.createdAt));
      }
    }
    
    return db.select().from(brandConfigurations).where(eq(brandConfigurations.userId, userId))
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
    const user = await this.getUserById(userId);
    if (!user) return [];
    
    if (user.role === 'super_admin' && !user.companyId) {
      return db.select().from(contentCriteria).orderBy(desc(contentCriteria.createdAt));
    }
    
    if (user.companyId) {
      const isAdmin = user.role === 'company_admin' || user.role === 'super_admin';
      if (isAdmin) {
        return db.select().from(contentCriteria).where(eq(contentCriteria.companyId, user.companyId))
          .orderBy(desc(contentCriteria.createdAt));
      } else {
        return db.select().from(contentCriteria).where(
          and(eq(contentCriteria.userId, userId), eq(contentCriteria.companyId, user.companyId))
        ).orderBy(desc(contentCriteria.createdAt));
      }
    }
    
    return db.select().from(contentCriteria).where(eq(contentCriteria.userId, userId))
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

  async getPlatformSettingsByPlatform(platform: string): Promise<PlatformSettings | undefined> {
    const [settings] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.platform, platform));
    return settings;
  }

  async upsertPlatformSettings(data: Omit<InsertPlatformSettings, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlatformSettings> {
    const existing = await this.getPlatformSettingsByPlatform(data.platform);
    
    if (existing) {
      const [updated] = await db
        .update(platformSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(platformSettings.platform, data.platform))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(platformSettings)
        .values(data)
        .returning();
      return created;
    }
  }

  async deletePlatformSettings(platform: string): Promise<boolean> {
    const result = await db
      .delete(platformSettings)
      .where(eq(platformSettings.platform, platform));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllSubscriptionPlans(): Promise<(typeof subscriptionPlans.$inferSelect)[]> {
    return await db.select().from(subscriptionPlans);
  }

  async getSubscriptionPlanById(id: string): Promise<typeof subscriptionPlans.$inferSelect | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<typeof subscriptionPlans.$inferSelect> {
    const [newPlan] = await db.insert(subscriptionPlans).values(plan).returning();
    return newPlan;
  }

  async updateSubscriptionPlan(id: string, data: Partial<InsertSubscriptionPlan>): Promise<typeof subscriptionPlans.$inferSelect | undefined> {
    const [updated] = await db
      .update(subscriptionPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return updated;
  }

  async deleteSubscriptionPlan(id: string): Promise<boolean> {
    const result = await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const result = await db.delete(campaigns).where(eq(campaigns.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteAllCampaignsByUser(userId: string): Promise<void> {
    await db.delete(campaigns).where(eq(campaigns.userId, userId));
  }

  async deleteAllAdSetsByUser(userId: string): Promise<void> {
    await db.delete(adSets).where(eq(adSets.userId, userId));
  }

  async deleteAllCreativesByUser(userId: string): Promise<void> {
    await db.delete(creatives).where(eq(creatives.userId, userId));
  }

  /**
   * Delete ad sets that are NOT in the provided list of external IDs
   * Used for cleanup after sync to remove obsolete ad sets
   */
  async deleteAdSetsNotInList(userId: string, externalIds: string[]): Promise<number> {
    if (externalIds.length === 0) {
      // If no external IDs, delete all ad sets for this user
      const result = await db.delete(adSets).where(eq(adSets.userId, userId));
      return result.rowCount ?? 0;
    }
    
    const result = await db
      .delete(adSets)
      .where(
        and(
          eq(adSets.userId, userId),
          notInArray(adSets.externalId, externalIds)
        )
      );
    return result.rowCount ?? 0;
  }

  /**
   * Delete creatives (ads) that are NOT in the provided list of external IDs
   * Used for cleanup after sync to remove obsolete creatives
   */
  async deleteCreativesNotInList(userId: string, externalIds: string[]): Promise<number> {
    if (externalIds.length === 0) {
      // If no external IDs, delete all creatives for this user
      const result = await db.delete(creatives).where(eq(creatives.userId, userId));
      return result.rowCount ?? 0;
    }
    
    const result = await db
      .delete(creatives)
      .where(
        and(
          eq(creatives.userId, userId),
          notInArray(creatives.externalId, externalIds)
        )
      );
    return result.rowCount ?? 0;
  }

  /**
   * Delete campaigns that are NOT in the provided list of external IDs
   * Used for cleanup after sync to remove obsolete campaigns
   */
  async deleteCampaignsNotInList(userId: string, externalIds: string[]): Promise<number> {
    if (externalIds.length === 0) {
      // If no external IDs, delete all campaigns for this user
      const result = await db.delete(campaigns).where(eq(campaigns.userId, userId));
      return result.rowCount ?? 0;
    }
    
    const result = await db
      .delete(campaigns)
      .where(
        and(
          eq(campaigns.userId, userId),
          notInArray(campaigns.externalId, externalIds)
        )
      );
    return result.rowCount ?? 0;
  }
}

export const storage = new DatabaseStorage();
