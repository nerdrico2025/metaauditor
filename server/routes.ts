import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { AuthService, generateToken, hashPassword, comparePassword, authenticateToken, type User, type AuthRequest } from "./auth";
import {
  insertIntegrationSchema,
  insertCampaignSchema,
  insertCreativeSchema,
  insertPolicySchema,
  insertAuditSchema,
  insertAuditActionSchema,
  insertBrandConfigurationSchema,
  insertContentCriteriaSchema,
  registerSchema,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
  changePasswordSchema,
  type UserRole,
} from "@shared/schema";
import { analyzeCreativeCompliance, analyzeCreativePerformance } from "./services/aiAnalysis";
import { registerRoutes as registerReplitAuthRoutes } from "./replitAuth";
import type { LoginData, RegisterData, CreateUserData, UpdateUserData, UpdateProfileData, ChangePasswordData } from "@shared/schema";
import { randomUUID } from "crypto";
import { cronManager, triggerManualSync } from "./services/cronManager";
import { getSyncStatus } from "./services/sheetsSingleTabSync";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup storage in app locals for middleware access
  app.locals.storage = storage;

  // Setup Replit Auth conditionally - DISABLE in deployment to fix "helium" error
  const isDeployment = !!(
    process.env.REPLIT_DEPLOYMENT ||
    process.env.REPLIT_ENVIRONMENT === 'production' ||
    process.env.REPLIT_HELIUM_ENABLED === 'true'
  );
  
  if (!isDeployment) {
    console.log('🔗 DEVELOPMENT: Setting up Replit Auth');
    try {
      await registerReplitAuthRoutes(app);
    } catch (error) {
      console.warn('⚠️ Replit Auth setup failed, continuing with JWT-only:', error);
    }
  } else {
    console.log('🚀 DEPLOYMENT: Skipping Replit Auth to avoid "helium" DNS lookup');
    // Add minimal session support for JWT-only mode
    app.use(session({
      secret: process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      },
    }));
  }

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

  app.post('/api/auth/logout', async (req, res) => {
    // JWT is stateless, so logout is handled on the client
    res.json({ message: 'Logout realizado com sucesso' });
  });

  // Get current user route for JWT auth
  app.get('/api/auth/user', authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      // Return safe user data without password
      res.json({
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        isActive: req.user.isActive,
        lastLoginAt: req.user.lastLoginAt,
        profileImageUrl: req.user.profileImageUrl,
      });
    } catch (error: any) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ message: "Erro ao buscar dados do usuário" });
    }
  });

  // Role-based authorization middleware
  const requireAdmin = (req: Request, res: Response, next: any) => {
    if (req.user?.role !== 'administrador') {
      return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
    }
    next();
  };

  // User Management routes (Admin only)
  app.get('/api/users', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      }));
      res.json(safeUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.post('/api/users', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = createUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'Usuário com este email já existe' });
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);

      // Create user
      const user = await storage.createUser({
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        role: validatedData.role,
      });

      // Return safe user data
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(400).json({ message: error.message || "Erro ao criar usuário" });
    }
  });

  app.put('/api/users/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const validatedData = updateUserSchema.parse(req.body);

      // Check if trying to modify master user role
      const targetUser = await storage.getUserById(userId);
      if (targetUser?.email === 'rafael@clickhero.com.br' && validatedData.role && validatedData.role !== 'administrador') {
        return res.status(400).json({ message: 'Não é possível alterar o nível do usuário master' });
      }

      // Update user
      const updatedUser = await storage.updateUser(userId, validatedData);
      if (!updatedUser) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Return safe user data
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      });
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(400).json({ message: error.message || "Erro ao atualizar usuário" });
    }
  });

  app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      
      // Prevent deletion of current user
      if (userId === req.user?.id) {
        return res.status(400).json({ message: 'Você não pode deletar sua própria conta' });
      }

      // Check if trying to delete master user
      const targetUser = await storage.getUserById(userId);
      if (targetUser?.email === 'rafael@clickhero.com.br') {
        return res.status(400).json({ message: 'Não é possível deletar o usuário master' });
      }

      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      res.json({ message: 'Usuário removido com sucesso' });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(400).json({ message: error.message || "Erro ao remover usuário" });
    }
  });

  // Profile Management routes (for current user)
  app.get('/api/profile', authenticateToken, async (req: Request, res: Response) => {
    try {
      res.json({
        id: req.user!.id,
        email: req.user!.email,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
        role: req.user!.role,
        profileImageUrl: req.user!.profileImageUrl,
        lastLoginAt: req.user!.lastLoginAt,
        createdAt: req.user!.createdAt,
      });
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Erro ao buscar perfil" });
    }
  });

  app.put('/api/profile', authenticateToken, async (req: Request, res: Response) => {
    try {
      const validatedData = updateProfileSchema.parse(req.body);
      
      // Update user profile
      const updatedUser = await storage.updateUser(req.user!.id, validatedData);
      if (!updatedUser) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Return safe user data
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        profileImageUrl: updatedUser.profileImageUrl,
        updatedAt: updatedUser.updatedAt,
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      res.status(400).json({ message: error.message || "Erro ao atualizar perfil" });
    }
  });

  app.put('/api/profile/password', authenticateToken, async (req: Request, res: Response) => {
    try {
      const validatedData = changePasswordSchema.parse(req.body);
      
      // Get current user with password
      const currentUser = await storage.getUserById(req.user!.id);
      if (!currentUser) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Verify current password
      const isCurrentPasswordValid = await comparePassword(validatedData.currentPassword, currentUser.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Senha atual incorreta' });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(validatedData.newPassword);

      // Update password
      await storage.updateUser(req.user!.id, { password: hashedNewPassword });

      res.json({ message: 'Senha alterada com sucesso' });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(400).json({ message: error.message || "Erro ao alterar senha" });
    }
  });

  // Get current authenticated user
  app.get('/api/auth/user', authenticateToken, async (req: Request, res: Response) => {
    res.json({
      id: req.user!.id,
      email: req.user!.email,
      firstName: req.user!.firstName,
      lastName: req.user!.lastName,
      role: req.user!.role,
      profileImageUrl: req.user!.profileImageUrl,
    });
  });

  // Force clear session cache for production
  app.post('/api/clear-session', async (req: Request, res: Response) => {
    try {
      // Clear session data
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destroy error:', err);
          }
        });
      }
      
      res.clearCookie('connect.sid');
      res.json({ message: 'Session cleared successfully' });
    } catch (error) {
      console.error("Error clearing session:", error);
      res.status(500).json({ message: "Failed to clear session" });
    }
  });

  // Ensure demo user exists for production
  app.get('/api/ensure-demo-user', async (req: Request, res: Response) => {
    try {
      const demoEmail = 'rafael@clickhero.com.br';
      let demoUser = await storage.getUserByEmail(demoEmail);
      
      if (!demoUser) {
        // Create demo user if it doesn't exist
        const hashedPassword = await hashPassword('X@drez13');
        demoUser = await storage.createUser({
          email: demoEmail,
          password: hashedPassword,
          firstName: 'Rafael',
          lastName: 'Master',
          role: 'administrador',
        });
        console.log('✅ Demo user created for production:', demoUser.email);
      } else {
        console.log('✅ Demo user already exists:', demoUser.email);
      }
      
      // Also ensure test user exists
      const testEmail = 'usuario.teste@clickauditor-demo.com';
      let testUser = await storage.getUserByEmail(testEmail);
      
      if (!testUser) {
        const testHashedPassword = await hashPassword('TesteFacebook2025!');
        testUser = await storage.createUser({
          email: testEmail,
          password: testHashedPassword,
          firstName: 'Usuário',
          lastName: 'Teste',
          role: 'operador',
        });
        console.log('✅ Test user created for production:', testUser.email);
      }
      
      res.json({ 
        message: 'Demo users ensured', 
        users: [
          { email: demoUser.email, id: demoUser.id },
          { email: testUser?.email, id: testUser?.id }
        ]
      });
    } catch (error) {
      console.error("Error ensuring demo user:", error);
      res.status(500).json({ message: "Failed to ensure demo user" });
    }
  });

  // Integration routes
  app.get('/api/integrations', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const integrations = await storage.getIntegrationsByUser(userId);
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post('/api/integrations', authenticateToken, async (req: AuthRequest, res: Response) => {
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
      const userId = req.user!.id;
      await storage.deleteIntegration(integrationId, userId);
      res.json({ message: "Integration deleted successfully" });
    } catch (error) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // Policy routes
  app.get('/api/policies', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const policies = await storage.getPoliciesByUser(userId);
      res.json(policies);
    } catch (error) {
      console.error("Error fetching policies:", error);
      res.status(500).json({ message: "Failed to fetch policies" });
    }
  });

  app.post('/api/policies', authenticateToken, async (req: AuthRequest, res: Response) => {
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

  app.get('/api/policies/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
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

  // Brand Configuration routes
  app.get('/api/brand-configurations', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = 'demo-user-real';
      const brandConfigurations = await storage.getBrandConfigurationsByUser(userId);
      res.json(brandConfigurations);
    } catch (error) {
      console.error("Error fetching brand configurations:", error);
      res.status(500).json({ message: "Failed to fetch brand configurations" });
    }
  });

  app.get('/api/brand-configurations/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id;
      const brandConfiguration = await storage.getBrandConfigurationById(id);
      if (!brandConfiguration) {
        return res.status(404).json({ message: "Brand configuration not found" });
      }
      res.json(brandConfiguration);
    } catch (error) {
      console.error("Error fetching brand configuration:", error);
      res.status(500).json({ message: "Failed to fetch brand configuration" });
    }
  });

  app.post('/api/brand-configurations', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = 'demo-user-real';
      const validatedData = insertBrandConfigurationSchema.parse({
        ...req.body,
        userId,
      });
      const brandConfiguration = await storage.createBrandConfiguration(validatedData);
      res.json(brandConfiguration);
    } catch (error) {
      console.error("Error creating brand configuration:", error);
      res.status(500).json({ message: "Failed to create brand configuration" });
    }
  });

  app.put('/api/brand-configurations/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const brandConfiguration = await storage.updateBrandConfiguration(id, req.body);
      if (!brandConfiguration) {
        return res.status(404).json({ message: "Brand configuration not found" });
      }
      res.json(brandConfiguration);
    } catch (error) {
      console.error("Error updating brand configuration:", error);
      res.status(500).json({ message: "Failed to update brand configuration" });
    }
  });

  app.delete('/api/brand-configurations/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const success = await storage.deleteBrandConfiguration(id);
      if (!success) {
        return res.status(404).json({ message: "Brand configuration not found" });
      }
      res.json({ message: "Brand configuration deleted successfully" });
    } catch (error) {
      console.error("Error deleting brand configuration:", error);
      res.status(500).json({ message: "Failed to delete brand configuration" });
    }
  });

  // Content Criteria routes
  app.get('/api/content-criteria', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = 'demo-user-real';
      const contentCriteria = await storage.getContentCriteriaByUser(userId);
      res.json(contentCriteria);
    } catch (error) {
      console.error("Error fetching content criteria:", error);
      res.status(500).json({ message: "Failed to fetch content criteria" });
    }
  });

  app.get('/api/content-criteria/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id;
      const contentCriteria = await storage.getContentCriteriaById(id);
      if (!contentCriteria) {
        return res.status(404).json({ message: "Content criteria not found" });
      }
      res.json(contentCriteria);
    } catch (error) {
      console.error("Error fetching content criteria:", error);
      res.status(500).json({ message: "Failed to fetch content criteria" });
    }
  });

  app.post('/api/content-criteria', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = 'demo-user-real';
      const validatedData = insertContentCriteriaSchema.parse({
        ...req.body,
        userId,
      });
      const contentCriteria = await storage.createContentCriteria(validatedData);
      res.json(contentCriteria);
    } catch (error) {
      console.error("Error creating content criteria:", error);
      res.status(500).json({ message: "Failed to create content criteria" });
    }
  });

  app.put('/api/content-criteria/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const contentCriteria = await storage.updateContentCriteria(id, req.body);
      if (!contentCriteria) {
        return res.status(404).json({ message: "Content criteria not found" });
      }
      res.json(contentCriteria);
    } catch (error) {
      console.error("Error updating content criteria:", error);
      res.status(500).json({ message: "Failed to update content criteria" });
    }
  });

  app.delete('/api/content-criteria/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const success = await storage.deleteContentCriteria(id);
      if (!success) {
        return res.status(404).json({ message: "Content criteria not found" });
      }
      res.json({ message: "Content criteria deleted successfully" });
    } catch (error) {
      console.error("Error deleting content criteria:", error);
      res.status(500).json({ message: "Failed to delete content criteria" });
    }
  });

  // Object storage routes for brand logo upload
  app.get('/api/objects/:objectPath(*)', async (req: Request, res: Response) => {
    try {
      const objectPath = req.params.objectPath;
      // For now, redirect to public assets or return placeholder
      res.status(200).json({ 
        message: "Object serving endpoint ready", 
        objectPath: objectPath,
        url: `/public-objects/${objectPath}`
      });
    } catch (error) {
      console.error("Error serving object:", error);
      res.status(500).json({ message: "Failed to serve object" });
    }
  });

  app.post('/api/objects/upload', async (req: Request, res: Response) => {
    try {
      // Generate a unique filename for the logo
      const fileExtension = req.body.fileType?.split('/')[1] || 'png';
      const filename = `logos/${randomUUID()}.${fileExtension}`;
      
      // Create a mock presigned URL for now
      // In production, this would integrate with the actual object storage
      const uploadURL = `https://storage.googleapis.com/replit-objstore-3a4bda15-c9f7-47e3-844a-a44e681f9f17/public/${filename}`;
      
      res.json({ 
        method: "PUT" as const,
        url: uploadURL,
        objectPath: `/objects/${filename}`
      });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Serve public assets
  app.get('/public-objects/:filePath(*)', async (req: Request, res: Response) => {
    try {
      const filePath = req.params.filePath;
      // This would integrate with actual object storage
      res.status(404).json({ message: "Public object not found", filePath });
    } catch (error) {
      console.error("Error serving public object:", error);
      res.status(500).json({ message: "Failed to serve public object" });
    }
  });

  // Campaign routes
  app.get('/api/campaigns', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const campaigns = await storage.getCampaignsByUser(userId);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.post('/api/campaigns', authenticateToken, async (req: AuthRequest, res: Response) => {
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

  // GET /api/campaigns/:id/metrics - Get metrics for specific campaign
  app.get('/api/campaigns/:id/metrics', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      // Get campaign details
      const campaign = await storage.getCampaignById(id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Get campaign metrics from campaign_metrics table filtered by campaign name
      const metrics = await storage.getCampaignMetrics(userId, {
        page: 1,
        limit: 1000,
        campaign: campaign.name
      });
      
      res.json({
        campaign,
        metrics: metrics.data
      });
    } catch (error) {
      console.error("Error fetching campaign metrics:", error);
      res.status(500).json({ message: "Failed to fetch campaign metrics" });
    }
  });

  // GET /api/campaigns/:id/creatives - Get creatives for specific campaign
  app.get('/api/campaigns/:id/creatives', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const creatives = await storage.getCreativesByCampaign(id);
      res.json(creatives);
    } catch (error) {
      console.error("Error fetching campaign creatives:", error);
      res.status(500).json({ message: "Failed to fetch campaign creatives" });
    }
  });

  // Creative routes
  app.get('/api/creatives', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const creatives = await storage.getCreativesByUser(userId);
      res.json(creatives);
    } catch (error) {
      console.error("Error fetching creatives:", error);
      res.status(500).json({ message: "Failed to fetch creatives" });
    }
  });

  app.get('/api/creatives/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
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

  app.post('/api/creatives', authenticateToken, async (req: AuthRequest, res: Response) => {
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

  // Creative analysis endpoint
  app.post('/api/creatives/:id/analyze', async (req: Request, res: Response) => {
    try {
      const creativeId = req.params.id;
      const userId = req.user!.id;

      // Get the creative
      const creative = await storage.getCreativeById(creativeId);
      if (!creative) {
        return res.status(404).json({ message: "Creative not found" });
      }

      // Get user's brand configurations and content criteria
      const brandConfigs = await storage.getBrandConfigurationsByUser(userId);
      const contentCriteria = await storage.getContentCriteriaByUser(userId);
      const activeBrandConfig = brandConfigs.find(config => config.isActive) || brandConfigs[0];
      const activeContentCriteria = contentCriteria.find(criteria => criteria.isActive) || contentCriteria[0];

      // Debug logging
      console.log('📊 Analysis Debug Info:');
      console.log(`- Brand configs found: ${brandConfigs.length}`);
      console.log(`- Content criteria found: ${contentCriteria.length}`);
      console.log(`- Active brand config:`, activeBrandConfig ? {
        name: activeBrandConfig.brandName,
        primaryColor: activeBrandConfig.primaryColor,
        secondaryColor: activeBrandConfig.secondaryColor,
        isActive: activeBrandConfig.isActive
      } : 'None found');
      console.log(`- Active content criteria:`, activeContentCriteria ? {
        name: activeContentCriteria.name,
        requiredKeywords: activeContentCriteria.requiredKeywords,
        prohibitedKeywords: activeContentCriteria.prohibitedKeywords,
        isActive: activeContentCriteria.isActive
      } : 'None found');

      // Perform compliance analysis with user's configurations
      const complianceResult = await analyzeCreativeCompliance(
        creative, 
        activeBrandConfig, 
        activeContentCriteria
      );

      // Perform performance analysis
      const performanceResult = await analyzeCreativePerformance(creative);

      // Combine results and determine overall status
      let status: string = 'compliant';
      const issues: any[] = [];
      const recommendations: string[] = [];
      let complianceScore = complianceResult.score;
      let performanceScore = performanceResult.score;

      // Process compliance issues
      if (complianceResult.issues.length > 0) {
        status = 'non_compliant';
        issues.push(...complianceResult.issues.map(issue => ({
          type: 'Compliance Issue',
          description: issue,
          severity: 'high'
        })));
      }

      // Process performance issues  
      if (performanceResult.performance === 'low') {
        status = status === 'compliant' ? 'low_performance' : status;
        issues.push({
          type: 'Performance Issue',
          description: `Performance is ${performanceResult.performance}. Consider optimization.`,
          severity: 'medium'
        });
      }

      // Combine recommendations
      recommendations.push(...complianceResult.recommendations);
      recommendations.push(...performanceResult.recommendations);

      // Create detailed analysis with checks
      const checks = [
        {
          category: 'Conformidade da marca',
          description: 'Verificação de logo e cores da marca',
          status: complianceResult.analysis.logoCompliance && complianceResult.analysis.colorCompliance ? 'passed' : 'failed',
          details: activeBrandConfig ? `Verificado contra: ${activeBrandConfig.brandName} - Cores: ${activeBrandConfig.primaryColor}, ${activeBrandConfig.secondaryColor}, ${activeBrandConfig.accentColor}` : 'Nenhuma configuração de marca encontrada'
        },
        {
          category: 'Conteúdo textual',
          description: 'Análise do texto e call-to-action',
          status: complianceResult.analysis.textCompliance ? 'passed' : 'failed',
          details: activeContentCriteria ? `Verificado contra critérios: ${activeContentCriteria.name}` : 'Nenhum critério de conteúdo encontrado'
        },
        {
          category: 'Performance',
          description: 'Métricas de CTR e conversão', 
          status: performanceResult.performance === 'high' ? 'passed' : performanceResult.performance === 'medium' ? 'warning' : 'failed',
          details: `CTR: ${creative.ctr}%, Conversões: ${creative.conversions}`
        }
      ];

      // Handle AI analysis failures internally - don't expose technical errors to users
      if (complianceResult.issues.includes("Analysis failed - unable to process creative") || 
          complianceResult.issues.some(issue => issue.includes("Análise falhou"))) {
        
        // Log the error internally
        console.log('🚨 AI Analysis Failed for creative:', creative.id, {
          complianceScore: complianceResult.score,
          issues: complianceResult.issues,
          brandConfig: activeBrandConfig?.brandName,
          contentCriteria: activeContentCriteria?.name
        });
        
        // Set status but don't add technical error to user-facing issues
        status = 'non_compliant';
        
        // Add user-friendly issue instead of technical error
        issues.push({
          type: 'Revisão necessária',
          description: 'Este criativo requer revisão manual de conformidade.',
          severity: 'medium'
        });
        
        // Update check details without technical error messages
        checks.forEach(check => {
          if (check.status === 'passed') {
            check.status = 'failed';
            check.details += ' - Requer verificação manual';
          }
        });
      }

      // Create audit record
      const auditData = {
        userId,
        creativeId,
        status,
        complianceScore: complianceScore.toString(),
        performanceScore: performanceScore.toString(),
        issues: JSON.stringify(issues),
        recommendations: JSON.stringify(recommendations),
        aiAnalysis: JSON.stringify({
          checks,
          summary: issues.length === 0 ? 'Criativo conforme com todas as verificações' : `${issues.length} problema(s) identificado(s)`,
          brandConfig: activeBrandConfig ? {
            name: activeBrandConfig.brandName,
            primaryColor: activeBrandConfig.primaryColor,
            secondaryColor: activeBrandConfig.secondaryColor
          } : null,
          contentCriteria: activeContentCriteria ? {
            name: activeContentCriteria.name,
            hasRequiredKeywords: !!activeContentCriteria.requiredKeywords,
            hasProhibitedKeywords: !!activeContentCriteria.prohibitedKeywords
          } : null
        }),
      };

      const audit = await storage.createAudit(auditData);
      res.json(audit);
    } catch (error) {
      console.error("Error analyzing creative:", error);
      res.status(500).json({ message: "Failed to analyze creative" });
    }
  });

  // Get audits for a specific creative
  app.get('/api/creatives/:id/audits', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const creativeId = req.params.id;
      const audits = await storage.getAuditsByCreative(creativeId);
      res.json(audits);
    } catch (error) {
      console.error("Error fetching creative audits:", error);
      res.status(500).json({ message: "Failed to fetch creative audits" });
    }
  });

  // Audit routes
  app.get('/api/audits', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const audits = await storage.getAuditsByUser(userId);
      res.json(audits);
    } catch (error) {
      console.error("Error fetching audits:", error);
      res.status(500).json({ message: "Failed to fetch audits" });
    }
  });

  app.post('/api/audits', authenticateToken, async (req: AuthRequest, res: Response) => {
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
  app.get('/api/audit-actions', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const actions = await storage.getAuditActionsByUser(userId);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching audit actions:", error);
      res.status(500).json({ message: "Failed to fetch audit actions" });
    }
  });

  app.post('/api/audit-actions', async (req: Request, res: Response) => {
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
  app.get('/api/dashboard/metrics', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const metrics = await storage.getDashboardMetrics(userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get('/api/dashboard/problem-creatives', authenticateToken, async (req: AuthRequest, res: Response) => {
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
      const userId = req.user!.id;
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
      const userId = req.user!.id;
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
      const userId = req.user!.id;
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

  // Replit deploy readiness endpoints
  app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.head('/healthz', (req, res) => {
    res.status(200).end();
  });

  // General health check endpoint
  app.head('/api', (req, res) => {
    res.status(200).end();
  });

  const httpServer = createServer(app);
  return httpServer;
}