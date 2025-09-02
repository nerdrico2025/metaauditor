import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { AuthService, generateToken, hashPassword, comparePassword } from "./auth";
import {
  insertIntegrationSchema,
  insertCampaignSchema,
  insertCreativeSchema,
  insertPolicySchema,
  insertAuditSchema,
  insertAuditActionSchema,
  registerSchema,
  loginSchema,
  type User,
} from "@shared/schema";
import { analyzeCreativeCompliance, analyzeCreativePerformance } from "./services/aiAnalysis";
import { registerRoutes as registerReplitAuthRoutes } from "./replitAuth";
import type { LoginData, RegisterData } from "@shared/schema";
import { randomUUID } from "crypto";
import { cronManager, triggerManualSync } from "./services/cronManager";
import { getSyncStatus } from "./services/sheetsSingleTabSync";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup storage in app locals for middleware access
  app.locals.storage = storage;

  // Setup Replit Auth first
  await registerReplitAuthRoutes(app);

  // Custom Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await AuthService.register(validatedData);
      res.json(result);
    } catch (error: any) {
      console.error("Error registering user:", error);
      res.status(400).json({ message: error.message || "Erro ao criar conta" });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await AuthService.login(validatedData);
      res.json(result);
    } catch (error: any) {
      console.error("Error logging in:", error);
      res.status(400).json({ message: error.message || "Erro ao fazer login" });
    }
  });

  // Authentication disabled - this route is no longer needed
  app.get('/api/auth/user', async (req: Request, res: Response) => {
    // Return demo user data since authentication is disabled
    const userData = {
      id: 'demo-user',
      email: 'demo@clickauditor.com',
      firstName: 'Demo',
      lastName: 'User',
      profileImageUrl: null,
    };
    res.json(userData);
  });

  // Integration routes
  app.get('/api/integrations', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const integrations = await storage.getIntegrationsByUser(userId);
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post('/api/integrations', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const validatedData = insertIntegrationSchema.parse({
        ...req.body,
        userId,
      });
      const integration = await storage.createIntegration(validatedData);
      res.json(integration);
    } catch (error) {
      console.error("Error creating integration:", error);
      res.status(500).json({ message: "Failed to create integration" });
    }
  });

  app.put('/api/integrations/:id', async (req: Request, res: Response) => {
    try {
      const integrationId = req.params.id;
      const integration = await storage.updateIntegration(integrationId, req.body);
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }
      res.json(integration);
    } catch (error) {
      console.error("Error updating integration:", error);
      res.status(500).json({ message: "Failed to update integration" });
    }
  });

  app.delete('/api/integrations/:id', async (req: Request, res: Response) => {
    try {
      const integrationId = req.params.id;
      const userId = 'demo-user-real'; // Using real user with real data
      await storage.deleteIntegration(integrationId, userId);
      res.json({ message: "Integration deleted successfully" });
    } catch (error) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // Policy routes
  app.get('/api/policies', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const policies = await storage.getPoliciesByUser(userId);
      res.json(policies);
    } catch (error) {
      console.error("Error fetching policies:", error);
      res.status(500).json({ message: "Failed to fetch policies" });
    }
  });

  app.post('/api/policies', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const validatedData = insertPolicySchema.parse({
        ...req.body,
        userId,
      });
      const policy = await storage.createPolicy(validatedData);
      res.json(policy);
    } catch (error) {
      console.error("Error creating policy:", error);
      res.status(500).json({ message: "Failed to create policy" });
    }
  });

  app.get('/api/policies/:id', async (req: Request, res: Response) => {
    try {
      const policyId = req.params.id;
      const policy = await storage.getPolicyById(policyId);
      if (!policy) {
        return res.status(404).json({ message: "Policy not found" });
      }
      res.json(policy);
    } catch (error) {
      console.error("Error fetching policy:", error);
      res.status(500).json({ message: "Failed to fetch policy" });
    }
  });

  app.put('/api/policies/:id', async (req: Request, res: Response) => {
    try {
      const policyId = req.params.id;
      const policy = await storage.updatePolicy(policyId, req.body);
      if (!policy) {
        return res.status(404).json({ message: "Policy not found" });
      }
      res.json(policy);
    } catch (error) {
      console.error("Error updating policy:", error);
      res.status(500).json({ message: "Failed to update policy" });
    }
  });

  app.delete('/api/policies/:id', async (req: Request, res: Response) => {
    try {
      const policyId = req.params.id;
      const success = await storage.deletePolicy(policyId);
      if (!success) {
        return res.status(404).json({ message: "Policy not found" });
      }
      res.json({ message: "Policy deleted successfully" });
    } catch (error) {
      console.error("Error deleting policy:", error);
      res.status(500).json({ message: "Failed to delete policy" });
    }
  });

  // Campaign routes
  app.get('/api/campaigns', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real campaign data
      const campaigns = await storage.getCampaignsByUser(userId);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.post('/api/campaigns', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real campaign data
      const validatedData = insertCampaignSchema.parse({
        ...req.body,
        userId,
      });
      const campaign = await storage.createCampaign(validatedData);
      res.json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  // Creative routes
  app.get('/api/creatives', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real creative data
      const creatives = await storage.getCreativesByUser(userId);
      res.json(creatives);
    } catch (error) {
      console.error("Error fetching creatives:", error);
      res.status(500).json({ message: "Failed to fetch creatives" });
    }
  });

  app.get('/api/creatives/:id', async (req: Request, res: Response) => {
    try {
      const creativeId = req.params.id;
      const creative = await storage.getCreativeById(creativeId);
      if (!creative) {
        return res.status(404).json({ message: "Creative not found" });
      }
      res.json(creative);
    } catch (error) {
      console.error("Error fetching creative:", error);
      res.status(500).json({ message: "Failed to fetch creative" });
    }
  });

  app.post('/api/creatives', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const validatedData = insertCreativeSchema.parse({
        ...req.body,
        userId,
      });
      const creative = await storage.createCreative(validatedData);
      res.json(creative);
    } catch (error) {
      console.error("Error creating creative:", error);
      res.status(500).json({ message: "Failed to create creative" });
    }
  });

  // Audit routes
  app.get('/api/audits', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const audits = await storage.getAuditsByUser(userId);
      res.json(audits);
    } catch (error) {
      console.error("Error fetching audits:", error);
      res.status(500).json({ message: "Failed to fetch audits" });
    }
  });

  app.post('/api/audits', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const validatedData = insertAuditSchema.parse({
        ...req.body,
        userId,
      });
      const audit = await storage.createAudit(validatedData);
      res.json(audit);
    } catch (error) {
      console.error("Error creating audit:", error);
      res.status(500).json({ message: "Failed to create audit" });
    }
  });

  // Audit Action routes
  app.get('/api/audit-actions', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const actions = await storage.getAuditActionsByUser(userId);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching audit actions:", error);
      res.status(500).json({ message: "Failed to fetch audit actions" });
    }
  });

  app.post('/api/audit-actions', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const validatedData = insertAuditActionSchema.parse({
        ...req.body,
        userId,
      });
      const action = await storage.createAuditAction(validatedData);
      res.json(action);
    } catch (error) {
      console.error("Error creating audit action:", error);
      res.status(500).json({ message: "Failed to create audit action" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/metrics', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const metrics = await storage.getDashboardMetrics(userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get('/api/dashboard/problem-creatives', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const problemCreatives = await storage.getProblemCreatives(userId, limit);
      res.json(problemCreatives);
    } catch (error) {
      console.error("Error fetching problem creatives:", error);
      res.status(500).json({ message: "Failed to fetch problem creatives" });
    }
  });

  // AI Analysis routes
  app.post('/api/analyze/compliance', async (req: Request, res: Response) => {
    try {
      const { creativeContent, policyRules } = req.body;
      const result = await analyzeCreativeCompliance(creativeContent, policyRules);
      res.json(result);
    } catch (error) {
      console.error("Error analyzing compliance:", error);
      res.status(500).json({ message: "Failed to analyze compliance" });
    }
  });

  app.post('/api/analyze/performance', async (req: Request, res: Response) => {
    try {
      const { creative } = req.body;
      const result = await analyzeCreativePerformance(creative);
      res.json(result);
    } catch (error) {
      console.error("Error analyzing performance:", error);
      res.status(500).json({ message: "Failed to analyze performance" });
    }
  });

  // Google Sheets Sync routes
  app.post('/api/sync-single-tab-now', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      console.log(`🔄 Manual sync triggered by user: ${userId}`);

      const result = await triggerManualSync();

      if (result.success) {
        res.json({
          success: true,
          message: 'Sync completed successfully',
          data: {
            totalDownloaded: result.totalDownloaded,
            totalProcessed: result.totalProcessed,
            totalInserted: result.totalInserted,
            completionPercentage: result.completionPercentage,
            syncBatch: result.syncBatch
          }
        });
      } else {
        res.status(207).json({
          success: false,
          message: 'Sync completed with errors',
          data: {
            totalDownloaded: result.totalDownloaded,
            totalProcessed: result.totalProcessed,
            totalInserted: result.totalInserted,
            completionPercentage: result.completionPercentage,
            errors: result.errors
          }
        });
      }
    } catch (error) {
      console.error("Error during manual sync:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync Google Sheets data",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/admin/sync-single-tab', async (req: Request, res: Response) => {
    try {
      // TODO: Add admin role verification here
      const userId = 'demo-user-real'; // Using real user with real data
      console.log(`🛠️ Admin sync triggered by user: ${userId}`);

      const result = await triggerManualSync();

      res.json({
        success: result.success,
        message: result.success ? 'Admin sync completed successfully' : 'Admin sync completed with errors',
        data: {
          totalDownloaded: result.totalDownloaded,
          totalProcessed: result.totalProcessed,
          totalInserted: result.totalInserted,
          completionPercentage: result.completionPercentage,
          batchResults: result.batchResults,
          errors: result.errors,
          syncBatch: result.syncBatch
        }
      });
    } catch (error) {
      console.error("Error during admin sync:", error);
      res.status(500).json({
        success: false,
        message: "Failed to execute admin sync",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/campaign-metrics', async (req: Request, res: Response) => {
    try {
      const userId = 'demo-user-real'; // Using real user with real data
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const account = req.query.account as string;
      const campaign = req.query.campaign as string;

      // TODO: Implement getCampaignMetrics method in storage
      // For now, return mock response
      const metrics = await storage.getCampaignMetrics(userId, { page, limit, account, campaign });

      res.json({
        success: true,
        data: metrics.data,
        pagination: {
          page,
          limit,
          total: metrics.total,
          totalPages: Math.ceil(metrics.total / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching campaign metrics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch campaign metrics",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/sync/status', async (req: Request, res: Response) => {
    try {
      const syncStatus = await getSyncStatus();
      const cronJobsStatus = cronManager.getJobStatus();

      res.json({
        success: true,
        data: {
          syncStatus: {
            recordCount: syncStatus.recordCount,
            lastSyncBatch: syncStatus.lastSyncBatch,
            latestRecord: syncStatus.latestRecord
          },
          cronJobs: cronJobsStatus.map(job => ({
            name: job.name,
            enabled: job.enabled,
            status: job.status,
            lastRun: job.lastRun,
            nextRun: job.nextRun,
            description: job.description
          }))
        }
      });
    } catch (error) {
      console.error("Error fetching sync status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch sync status",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/cron-jobs', async (req: Request, res: Response) => {
    try {
      // TODO: Add admin role verification here
      const cronJobsStatus = cronManager.getJobStatus();

      res.json({
        success: true,
        data: cronJobsStatus
      });
    } catch (error) {
      console.error("Error fetching cron jobs status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch cron jobs status",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/cron-jobs/:jobId/run', async (req: Request, res: Response) => {
    try {
      // TODO: Add admin role verification here
      const jobId = req.params.jobId;
      const result = await cronManager.runJobNow(jobId);

      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      console.error("Error running cron job:", error);
      res.status(500).json({
        success: false,
        message: "Failed to run cron job",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/cron-jobs/:jobId/enable', async (req: Request, res: Response) => {
    try {
      // TODO: Add admin role verification here
      const jobId = req.params.jobId;
      const success = cronManager.enableJob(jobId);

      if (success) {
        res.json({
          success: true,
          message: `Job ${jobId} enabled successfully`
        });
      } else {
        res.status(404).json({
          success: false,
          message: `Job ${jobId} not found`
        });
      }
    } catch (error) {
      console.error("Error enabling cron job:", error);
      res.status(500).json({
        success: false,
        message: "Failed to enable cron job",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/cron-jobs/:jobId/disable', async (req: Request, res: Response) => {
    try {
      // TODO: Add admin role verification here
      const jobId = req.params.jobId;
      const success = cronManager.disableJob(jobId);

      if (success) {
        res.json({
          success: true,
          message: `Job ${jobId} disabled successfully`
        });
      } else {
        res.status(404).json({
          success: false,
          message: `Job ${jobId} not found`
        });
      }
    } catch (error) {
      console.error("Error disabling cron job:", error);
      res.status(500).json({
        success: false,
        message: "Failed to disable cron job",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Debug endpoint to list users (development only)
  app.get('/api/debug/users', async (req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: "Not found" });
      }
      const users = await storage.getAllUsers();
      res.json(users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt
      })));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Debug endpoint to check campaign metrics data (development only)
  app.get('/api/debug/campaign-metrics-count', async (req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: "Not found" });
      }

      const metrics = await storage.getCampaignMetricsDebug();
      res.json({
        totalRecords: metrics.totalRecords,
        recordsBySource: metrics.recordsBySource,
        latestSyncBatch: metrics.latestSyncBatch,
        dateRange: metrics.dateRange,
        sampleRecords: metrics.sampleRecords
      });
    } catch (error) {
      console.error("Error fetching campaign metrics debug info:", error);
      res.status(500).json({ message: "Failed to fetch campaign metrics debug info" });
    }
  });

  // Debug endpoint to compare sheet data vs database data
  app.get('/api/debug/compare-sheet-data', async (req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: "Not found" });
      }

      // Import the function here to avoid circular dependencies
      const { fetchSingleTabData } = await import('./services/sheetsSingleTabSync');

      const sheetData = await fetchSingleTabData();
      const dbMetrics = await storage.getCampaignMetricsDebug();

      res.json({
        sheetData: {
          success: sheetData.success,
          totalRecords: sheetData.data.length,
          error: sheetData.error
        },
        databaseData: {
          totalRecords: dbMetrics.totalRecords,
          latestSyncBatch: dbMetrics.latestSyncBatch,
          recordsBySource: dbMetrics.recordsBySource
        },
        comparison: {
          dataMatches: sheetData.data.length === dbMetrics.totalRecords,
          difference: sheetData.data.length - dbMetrics.totalRecords
        }
      });
    } catch (error) {
      console.error("Error comparing sheet and database data:", error);
      res.status(500).json({ message: "Failed to compare data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}