import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { AuthService, authenticateToken, generateToken, hashPassword, comparePassword, type AuthRequest } from "./auth";
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup storage in app locals for middleware access
  app.locals.storage = storage;

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

  app.get('/api/auth/user', authenticateToken, async (req: Request, res: Response) => {
    try {
      res.json(req.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Integration routes
  app.get('/api/integrations', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const integrations = await storage.getIntegrationsByUser(userId);
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post('/api/integrations', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
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

  app.put('/api/integrations/:id', authenticateToken, async (req: Request, res: Response) => {
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

  app.delete('/api/integrations/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const integrationId = req.params.id;
      const userId = req.user!.id;
      await storage.deleteIntegration(integrationId, userId);
      res.json({ message: "Integration deleted successfully" });
    } catch (error) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // Policy routes
  app.get('/api/policies', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const policies = await storage.getPoliciesByUser(userId);
      res.json(policies);
    } catch (error) {
      console.error("Error fetching policies:", error);
      res.status(500).json({ message: "Failed to fetch policies" });
    }
  });

  app.post('/api/policies', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
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

  app.get('/api/policies/:id', authenticateToken, async (req: AuthRequest, res) => {
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

  app.put('/api/policies/:id', authenticateToken, async (req: Request, res: Response) => {
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

  app.delete('/api/policies/:id', authenticateToken, async (req: Request, res: Response) => {
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
  app.get('/api/campaigns', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const campaigns = await storage.getCampaignsByUser(userId);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.post('/api/campaigns', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
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
  app.get('/api/creatives', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const creatives = await storage.getCreativesByUser(userId);
      res.json(creatives);
    } catch (error) {
      console.error("Error fetching creatives:", error);
      res.status(500).json({ message: "Failed to fetch creatives" });
    }
  });

  app.get('/api/creatives/:id', authenticateToken, async (req: AuthRequest, res) => {
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

  app.post('/api/creatives', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
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
  app.get('/api/audits', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const audits = await storage.getAuditsByUser(userId);
      res.json(audits);
    } catch (error) {
      console.error("Error fetching audits:", error);
      res.status(500).json({ message: "Failed to fetch audits" });
    }
  });

  app.post('/api/audits', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
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
  app.get('/api/audit-actions', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const actions = await storage.getAuditActionsByUser(userId);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching audit actions:", error);
      res.status(500).json({ message: "Failed to fetch audit actions" });
    }
  });

  app.post('/api/audit-actions', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
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
  app.get('/api/dashboard/metrics', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const metrics = await storage.getDashboardMetrics(userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get('/api/dashboard/problem-creatives', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const problemCreatives = await storage.getProblemCreatives(userId, limit);
      res.json(problemCreatives);
    } catch (error) {
      console.error("Error fetching problem creatives:", error);
      res.status(500).json({ message: "Failed to fetch problem creatives" });
    }
  });

  // AI Analysis routes
  app.post('/api/analyze/compliance', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { creativeContent, policyRules } = req.body;
      const result = await analyzeCreativeCompliance(creativeContent, policyRules);
      res.json(result);
    } catch (error) {
      console.error("Error analyzing compliance:", error);
      res.status(500).json({ message: "Failed to analyze compliance" });
    }
  });

  app.post('/api/analyze/performance', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { creativeContent, platformData } = req.body;
      const result = await analyzeCreativePerformance(creativeContent, platformData);
      res.json(result);
    } catch (error) {
      console.error("Error analyzing performance:", error);
      res.status(500).json({ message: "Failed to analyze performance" });
    }
  });

  // Initialize Replit Auth (for production use)
  try {
    await registerReplitAuthRoutes(app);
  } catch (error) {
    console.log("Replit Auth not available in development mode");
  }



  const httpServer = createServer(app);
  return httpServer;
}