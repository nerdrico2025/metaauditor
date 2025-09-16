import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { storage } from "./storage";
import { db } from "./db";
import { eq, desc, sql, count, and } from "drizzle-orm";
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
  settingsDTO,
  brandConfigurations,
  policies,
  contentCriteria,
  campaignMetrics,
  campaigns,
  type UserRole,
  type SettingsDTO,
} from "@shared/schema";
import { analyzeCreativeCompliance, analyzeCreativePerformance } from "./services/aiAnalysis";
import { registerRoutes as registerReplitAuthRoutes } from "./replitAuth";
import type { LoginData, RegisterData, CreateUserData, UpdateUserData, UpdateProfileData, ChangePasswordData } from "@shared/schema";
import { randomUUID } from "crypto";
import { cronManager, triggerManualSync } from "./services/cronManager";
import { getSyncStatus } from "./services/sheetsSingleTabSync";
import fetch from "node-fetch";

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
    // Add PostgreSQL session support for JWT-only mode  
    const PostgreSQLStore = ConnectPgSimple(session);
    
    app.use(session({
      store: new PostgreSQLStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        tableName: 'session'
      }),
      secret: (() => {
        const secret = process.env.SESSION_SECRET;
        if (!secret) {
          console.error('🚨 CRITICAL: SESSION_SECRET environment variable is required!');
          if (process.env.NODE_ENV === 'production') {
            console.error('🚨 Production startup failed: Missing SESSION_SECRET');
            process.exit(1);
          }
          console.warn('⚠️ Development: Using fallback session secret (INSECURE!)');
          return 'development-only-fallback';
        }
        return secret;
      })(),
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
  app.get('/api/auth/user', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      // CRITICAL: Force no-cache to prevent serving stale demo data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Vary', 'Authorization');
      
      console.log(`🔍 Auth user request - ID: ${req.user.id}, Email: ${req.user.email}, Name: ${req.user.firstName} ${req.user.lastName}`);

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
  app.get('/api/users', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
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

  app.post('/api/users', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
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

  app.put('/api/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.params.id;
      const validatedData = updateUserSchema.parse(req.body);

      // Check if trying to modify admin user role to non-admin
      const targetUser = await storage.getUserById(userId);
      if (targetUser?.role === 'administrador' && validatedData.role && validatedData.role !== 'administrador') {
        return res.status(400).json({ message: 'Não é possível alterar o nível de administrador' });
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

  app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.params.id;
      
      // Prevent deletion of current user
      if (userId === req.user?.id) {
        return res.status(400).json({ message: 'Você não pode deletar sua própria conta' });
      }

      // Check if trying to delete admin user
      const targetUser = await storage.getUserById(userId);
      if (targetUser?.role === 'administrador') {
        return res.status(400).json({ message: 'Não é possível deletar usuários administradores' });
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
  app.get('/api/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
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

  app.put('/api/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
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

  app.put('/api/profile/password', authenticateToken, async (req: AuthRequest, res: Response) => {
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
  // REMOVED: Duplicate endpoint - keeping the one with better error handling above

  // Force clear ALL cache and session data for production
  app.post('/api/clear-session', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      // Clear session data
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destroy error:', err);
          }
        });
      }
      
      // Clear all possible cookies
      res.clearCookie('connect.sid');
      res.clearCookie('token');
      res.clearCookie('auth-token');
      
      // Force cache headers to prevent caching
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      res.json({ message: 'All session and cache cleared successfully', timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("Error clearing session:", error);
      res.status(500).json({ message: "Failed to clear session" });
    }
  });

  // Force refresh user data endpoint 
  // REMOVED: /api/force-refresh-user endpoint - SECURITY VIOLATION ELIMINATED
  // This endpoint was publicly accessible without authentication and leaked sensitive user data
  // Use proper authenticated endpoints instead

  // REMOVED: /api/ensure-demo-user endpoint - SECURITY RISK ELIMINATED
  // This endpoint was creating accounts with known passwords and was publicly accessible
  // Real users exist in database and are managed via proper authentication

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

  app.put('/api/integrations/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const integrationId = req.params.id;
      const userId = req.user!.id;
      
      // Verify ownership by getting user integrations and finding the specific one
      const userIntegrations = await storage.getIntegrationsByUser(userId);
      const existingIntegration = userIntegrations.find(integration => integration.id === integrationId);
      if (!existingIntegration) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
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

  app.delete('/api/integrations/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
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

  // Unified Policies Settings routes - MUST come before parametrized routes
  app.get('/api/policies/settings', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      
      // Load data from all four sources
      const [brandConfigs, policies, contentCriterias, performanceBenchmarks] = await Promise.all([
        storage.getBrandConfigurationsByUser(userId),
        storage.getPoliciesByUser(userId),
        storage.getContentCriteriaByUser(userId),
        storage.getPerformanceBenchmarksByUser(userId)
      ]);

      // Get the first/active configuration for each type (or use defaults)
      const brandConfig = brandConfigs.find(b => b.isActive) || brandConfigs[0];
      const policy = policies.find(p => p.isDefault || p.status === 'active') || policies[0];
      const contentCriteria = contentCriterias.find(c => c.isActive) || contentCriterias[0];

      // Map to SettingsDTO format
      const settings: SettingsDTO = {
        brand: {
          logoUrl: brandConfig?.logoUrl || null,
          primaryColor: brandConfig?.primaryColor || null,
          secondaryColor: brandConfig?.secondaryColor || null,
          accentColor: brandConfig?.accentColor || null,
          visualGuidelines: brandConfig?.brandGuidelines || null,
        },
        brandPolicies: {
          autoApproval: Boolean(policy?.rules && typeof policy.rules === 'object' && 
                               (policy.rules as any).autoApproval === true),
          autoActions: {
            pauseOnViolation: Boolean(policy?.rules && typeof policy.rules === 'object' && 
                                     (policy.rules as any).pauseOnViolation === true),
            sendForReview: Boolean(policy?.rules && typeof policy.rules === 'object' && 
                                  (policy.rules as any).sendForReview === true),
            autoFixMinor: Boolean(policy?.rules && typeof policy.rules === 'object' && 
                                 (policy.rules as any).autoFixMinor === true),
          },
        },
        validationCriteria: {
          requiredKeywords: contentCriteria?.requiredKeywords && Array.isArray(contentCriteria.requiredKeywords) ? 
                            contentCriteria.requiredKeywords as string[] : [],
          forbiddenTerms: contentCriteria?.prohibitedKeywords && Array.isArray(contentCriteria.prohibitedKeywords) ? 
                          contentCriteria.prohibitedKeywords as string[] : [],
          brandRequirements: {
            requireLogo: contentCriteria?.requiresLogo || false,
            requireBrandColors: contentCriteria?.requiresBrandColors || false,
          },
        },
        performanceBenchmarks: {
          ctrMin: performanceBenchmarks?.ctrMin ? Number(performanceBenchmarks.ctrMin) : null,
          ctrTarget: performanceBenchmarks?.ctrTarget ? Number(performanceBenchmarks.ctrTarget) : null,
          cpcMax: performanceBenchmarks?.cpcMax ? Number(performanceBenchmarks.cpcMax) : null,
          cpcTarget: performanceBenchmarks?.cpcTarget ? Number(performanceBenchmarks.cpcTarget) : null,
          conversionsMin: performanceBenchmarks?.conversionsMin || null,
          conversionsTarget: performanceBenchmarks?.conversionsTarget || null,
        },
      };

      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put('/api/policies/settings', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      
      console.log("📝 Settings update request:", {
        userId,
        requestBody: JSON.stringify(req.body, null, 2)
      });
      
      // Validate request body against SettingsDTO schema
      const validatedSettings = settingsDTO.parse(req.body);
      
      console.log("✅ Settings validation passed:", {
        userId,
        brandKeys: Object.keys(validatedSettings.brand),
        validationKeys: Object.keys(validatedSettings.validationCriteria),
        performanceKeys: Object.keys(validatedSettings.performanceBenchmarks)
      });
      
      // Execute all operations within a single transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Load existing data with deterministic ordering within transaction
        const [brandConfigs, userPolicies, userContentCriteria] = await Promise.all([
          tx.select()
            .from(brandConfigurations)
            .where(eq(brandConfigurations.userId, userId))
            .orderBy(desc(brandConfigurations.updatedAt)), // Deterministic ordering by updatedAt
          tx.select()
            .from(policies)
            .where(eq(policies.userId, userId))
            .orderBy(desc(policies.updatedAt)), // Deterministic ordering by updatedAt  
          tx.select()
            .from(contentCriteria)
            .where(eq(contentCriteria.userId, userId))
            .orderBy(desc(contentCriteria.updatedAt)) // Deterministic ordering by updatedAt
        ]);

        // Deterministic record selection - prefer active/default, then most recent
        let brandConfig = brandConfigs.find((b: any) => b.isActive) || brandConfigs[0];
        let policy = userPolicies.find((p: any) => p.isDefault || p.status === 'active') || userPolicies[0];
        let contentCriteriaRecord = userContentCriteria.find((c: any) => c.isActive) || userContentCriteria[0];

        // Update or create brand configuration
        if (brandConfig) {
          const [updatedBrandConfig] = await tx
            .update(brandConfigurations)
            .set({
              logoUrl: validatedSettings.brand.logoUrl,
              primaryColor: validatedSettings.brand.primaryColor,
              secondaryColor: validatedSettings.brand.secondaryColor,
              accentColor: validatedSettings.brand.accentColor,

              brandGuidelines: validatedSettings.brand.visualGuidelines,
              updatedAt: new Date()
            })
            .where(eq(brandConfigurations.id, brandConfig.id))
            .returning();
          
          if (!updatedBrandConfig) {
            throw new Error("Failed to update brand configuration");
          }
          brandConfig = updatedBrandConfig;
        } else {
          const [newBrandConfig] = await tx
            .insert(brandConfigurations)
            .values({
              userId,
              brandName: "Default Brand",
              logoUrl: validatedSettings.brand.logoUrl,
              primaryColor: validatedSettings.brand.primaryColor,
              secondaryColor: validatedSettings.brand.secondaryColor,
              accentColor: validatedSettings.brand.accentColor,

              brandGuidelines: validatedSettings.brand.visualGuidelines,
              isActive: true,
            })
            .returning();
          brandConfig = newBrandConfig;
        }

        // Update or create policy
        const policyRules = {
          autoApproval: validatedSettings.brandPolicies.autoApproval,
          pauseOnViolation: validatedSettings.brandPolicies.autoActions.pauseOnViolation,
          sendForReview: validatedSettings.brandPolicies.autoActions.sendForReview,
          autoFixMinor: validatedSettings.brandPolicies.autoActions.autoFixMinor,
        };

        if (policy) {
          const [updatedPolicy] = await tx
            .update(policies)
            .set({
              rules: policyRules,
              updatedAt: new Date()
            })
            .where(eq(policies.id, policy.id))
            .returning();
          
          if (!updatedPolicy) {
            throw new Error("Failed to update policy");
          }
          policy = updatedPolicy;
        } else {
          const [newPolicy] = await tx
            .insert(policies)
            .values({
              userId,
              name: "Default Policy",
              description: "Auto-generated default policy for brand settings",
              rules: policyRules,
              status: 'active',
              isDefault: true,
            })
            .returning();
          policy = newPolicy;
        }

        // Update or create content criteria
        if (contentCriteriaRecord) {
          const [updatedContentCriteria] = await tx
            .update(contentCriteria)
            .set({
              requiredKeywords: validatedSettings.validationCriteria.requiredKeywords,
              prohibitedKeywords: validatedSettings.validationCriteria.forbiddenTerms,

              requiresLogo: validatedSettings.validationCriteria.brandRequirements.requireLogo,
              requiresBrandColors: validatedSettings.validationCriteria.brandRequirements.requireBrandColors,
              updatedAt: new Date()
            })
            .where(eq(contentCriteria.id, contentCriteriaRecord.id))
            .returning();
          
          if (!updatedContentCriteria) {
            throw new Error("Failed to update content criteria");
          }
          contentCriteriaRecord = updatedContentCriteria;
        } else {
          const [newContentCriteria] = await tx
            .insert(contentCriteria)
            .values({
              userId,
              name: "Default Criteria",
              description: "Auto-generated default validation criteria",
              requiredKeywords: validatedSettings.validationCriteria.requiredKeywords,
              prohibitedKeywords: validatedSettings.validationCriteria.forbiddenTerms,

              requiresLogo: validatedSettings.validationCriteria.brandRequirements.requireLogo,
              requiresBrandColors: validatedSettings.validationCriteria.brandRequirements.requireBrandColors,
              isActive: true,
            })
            .returning();
          contentCriteriaRecord = newContentCriteria;
        }

        // Return the actual updated SettingsDTO from database within transaction
        const updatedSettings: SettingsDTO = {
          brand: {
            logoUrl: brandConfig.logoUrl || null,
            primaryColor: brandConfig.primaryColor || null,
            secondaryColor: brandConfig.secondaryColor || null,
            accentColor: brandConfig.accentColor || null,
            visualGuidelines: brandConfig.brandGuidelines || null,
          },
          brandPolicies: {
            autoApproval: Boolean(policy?.rules && typeof policy.rules === 'object' && 
                                  (policy.rules as any).autoApproval === true),
            autoActions: {
              pauseOnViolation: Boolean(policy?.rules && typeof policy.rules === 'object' && 
                                      (policy.rules as any).pauseOnViolation === true),
              sendForReview: Boolean(policy?.rules && typeof policy.rules === 'object' && 
                                    (policy.rules as any).sendForReview === true),
              autoFixMinor: Boolean(policy?.rules && typeof policy.rules === 'object' && 
                                   (policy.rules as any).autoFixMinor === true),
            },
          },
          validationCriteria: {
            requiredKeywords: contentCriteriaRecord?.requiredKeywords && Array.isArray(contentCriteriaRecord.requiredKeywords) ? 
                              contentCriteriaRecord.requiredKeywords as string[] : [],
            forbiddenTerms: contentCriteriaRecord?.prohibitedKeywords && Array.isArray(contentCriteriaRecord.prohibitedKeywords) ? 
                            contentCriteriaRecord.prohibitedKeywords as string[] : [],
            brandRequirements: {
              requireLogo: contentCriteriaRecord?.requiresLogo || false,
              requireBrandColors: contentCriteriaRecord?.requiresBrandColors || false,
            },
          },
          performanceBenchmarks: {
            ctrMin: null,
            ctrTarget: null,
            cpcMax: null,
            cpcTarget: null,
            conversionsMin: null,
            conversionsTarget: null,
          },
        };

        // Update or create performance benchmarks
        const benchmarksData = validatedSettings.performanceBenchmarks;
        const savedBenchmarks = await storage.createOrUpdatePerformanceBenchmarks(userId, {
          userId,
          ctrMin: benchmarksData.ctrMin?.toString() || null,
          ctrTarget: benchmarksData.ctrTarget?.toString() || null,
          cpcMax: benchmarksData.cpcMax?.toString() || null,
          cpcTarget: benchmarksData.cpcTarget?.toString() || null,
          conversionsMin: benchmarksData.conversionsMin || null,
          conversionsTarget: benchmarksData.conversionsTarget || null,
        });

        // Update the returned object with actually saved benchmark values
        updatedSettings.performanceBenchmarks = {
          ctrMin: savedBenchmarks.ctrMin ? parseFloat(savedBenchmarks.ctrMin) : null,
          ctrTarget: savedBenchmarks.ctrTarget ? parseFloat(savedBenchmarks.ctrTarget) : null,
          cpcMax: savedBenchmarks.cpcMax ? parseFloat(savedBenchmarks.cpcMax) : null,
          cpcTarget: savedBenchmarks.cpcTarget ? parseFloat(savedBenchmarks.cpcTarget) : null,
          conversionsMin: savedBenchmarks.conversionsMin || null,
          conversionsTarget: savedBenchmarks.conversionsTarget || null,
        };
        
        return updatedSettings;
      });

      // Return the updated settings from the transaction
      console.log("🎉 Settings update completed successfully:", {
        userId,
        responseSize: JSON.stringify(result).length,
        timestamp: new Date().toISOString()
      });
      
      res.json(result);
    } catch (error) {
      console.error("❌ Error updating settings:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        console.log("🔍 Zod validation error details:", (error as any).errors);
        return res.status(400).json({ message: "Invalid settings data", errors: (error as any).errors });
      }
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.get('/api/policies/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const policyId = req.params.id;
      const userId = req.user!.id;
      const policy = await storage.getPolicyById(policyId);
      
      // Verify ownership
      if (!policy || policy.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (!policy) {
        return res.status(404).json({ message: "Policy not found" });
      }
      res.json(policy);
    } catch (error) {
      console.error("Error fetching policy:", error);
      res.status(500).json({ message: "Failed to fetch policy" });
    }
  });

  app.put('/api/policies/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const policyId = req.params.id;
      const userId = req.user!.id;
      
      // Verify ownership  
      const existingPolicy = await storage.getPolicyById(policyId);
      if (!existingPolicy || existingPolicy.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
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

  app.delete('/api/policies/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const policyId = req.params.id;
      const userId = req.user!.id;
      
      // Verify ownership
      const existingPolicy = await storage.getPolicyById(policyId);
      if (!existingPolicy || existingPolicy.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
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
      const userId = req.user!.id;
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
      const userId = req.user!.id;
      const brandConfiguration = await storage.getBrandConfigurationById(id);
      
      // Verify ownership
      if (!brandConfiguration || brandConfiguration.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
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
      const userId = req.user!.id;
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

  app.put('/api/brand-configurations/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id;
      const userId = req.user!.id;
      
      // Verify ownership
      const existing = await storage.getBrandConfigurationById(id);
      if (!existing || existing.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
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

  app.delete('/api/brand-configurations/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id;
      const userId = req.user!.id;
      
      // Verify ownership
      const existing = await storage.getBrandConfigurationById(id);
      if (!existing || existing.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
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
      const userId = req.user!.id;
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
      const userId = req.user!.id;
      const contentCriteria = await storage.getContentCriteriaById(id);
      
      // Verify ownership
      if (!contentCriteria || contentCriteria.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
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
      const userId = req.user!.id;
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

  app.put('/api/content-criteria/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id;
      const userId = req.user!.id;
      
      // Verify ownership
      const existing = await storage.getContentCriteriaById(id);
      if (!existing || existing.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
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

  app.delete('/api/content-criteria/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id;
      const userId = req.user!.id;
      
      // Verify ownership
      const existing = await storage.getContentCriteriaById(id);
      if (!existing || existing.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
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

  app.post('/api/objects/upload', authenticateToken, async (req: AuthRequest, res: Response) => {
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

  // Creative routes - Modified to use campaign metrics data
  app.get('/api/creatives', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      // Get campaign metrics data and transform to creative format
      const metrics = await storage.getCampaignMetrics(userId, { 
        page: 1, 
        limit: 1000, // Get all records for now
      });
      
      // Helper function to validate if URL could be an image
      const isValidImageUrl = (url: string | null): boolean => {
        if (!url) return false;
        try {
          const urlObj = new URL(url);
          // Check if it's an HTTP(S) URL and has image-like patterns
          return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') &&
                 (url.includes('scontent') || // Facebook CDN
                  url.includes('googleadservices') || // Google Ads
                  /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url)); // Image extensions
        } catch {
          return false;
        }
      };
      
      // Group and deduplicate by ad URL to avoid duplicates
      const uniqueAds = new Map<string, any>();
      
      metrics.data.forEach(metric => {
        const key = metric.adUrl || metric.anuncios || metric.id;
        
        // Only include if we have a valid image URL or if we haven't seen this ad before
        if (!uniqueAds.has(key) || isValidImageUrl(metric.adUrl)) {
          uniqueAds.set(key, metric);
        }
      });
      
      // Transform unique campaign metrics to creative-like objects
      const creatives = Array.from(uniqueAds.values())
        .slice(0, 50) // Limit to reasonable number for UI performance
        .map(metric => ({
          id: metric.id,
          userId: userId,
          campaignId: null, // Set to null since we don't have valid campaign table references
          externalId: `metric_${metric.id}`,
          name: metric.anuncios || 'Anúncio sem nome', // Ad name with fallback
          type: 'image' as const,
          imageUrl: isValidImageUrl(metric.adUrl) ? metric.adUrl : null, // Only set if valid
          videoUrl: null,
          text: null,
          headline: metric.anuncios || 'Anúncio',
          description: `Campaign: ${metric.campanha || 'N/A'}`,
          callToAction: null,
          status: 'active' as const,
          impressions: metric.impressoes || 0,
          clicks: metric.cliques || 0,
          conversions: 0,
          ctr: (metric.cliques && metric.impressoes && metric.impressoes > 0) ? 
            Number((metric.cliques / metric.impressoes * 100).toFixed(3)) : 0,
          cpc: (metric.cpc && !isNaN(Number(metric.cpc))) ? Number(metric.cpc) : 0,
          createdAt: metric.createdAt || new Date(),
          updatedAt: metric.updatedAt || new Date(),
          // Additional fields for debugging
          sourceUrl: metric.adUrl, // Keep original URL for reference
          campaignName: metric.campanha,
          accountName: metric.nomeAconta,
        }));
      
      res.json(creatives);
    } catch (error) {
      console.error("Error fetching creatives:", error);
      res.status(500).json({ message: "Failed to fetch creatives" });
    }
  });

  app.get('/api/creatives/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const creativeId = req.params.id;
      const userId = req.user!.id;
      const creative = await storage.getCreativeById(creativeId);
      
      // Verify ownership
      if (!creative || creative.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
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

  // Creative analysis endpoint - Fixed to work with campaign_metrics data
  app.post('/api/creatives/:id/analyze', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const creativeId = req.params.id;
      const userId = req.user!.id;

      // First try to get the creative from the actual creatives table
      let creative = await storage.getCreativeById(creativeId);
      
      // If not found in creatives table, look for it in campaign_metrics (transformed data)
      if (!creative) {
        console.log(`🔍 Creative ${creativeId} not found in creatives table, searching in campaign_metrics...`);
        
        // Get the campaign metrics data and find the matching record
        const metricsResult = await storage.getCampaignMetrics(userId, { 
          page: 1, 
          limit: 1000 
        });
        
        const matchingMetric = metricsResult.data.find(metric => metric.id === creativeId);
        
        if (!matchingMetric) {
          console.log(`❌ Creative ${creativeId} not found in either creatives or campaign_metrics table`);
          return res.status(404).json({ message: "Creative not found" });
        }
        
        // Transform campaign metric to creative format for analysis
        const isValidImageUrl = (url: string | null): boolean => {
          if (!url) return false;
          try {
            const urlObj = new URL(url);
            return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') &&
                   (url.includes('scontent') || url.includes('googleadservices') || 
                    /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url));
          } catch { return false; }
        };
        
        creative = {
          id: matchingMetric.id,
          userId: userId,
          campaignId: `campaign_${matchingMetric.id}`, // Generate a campaign ID from metric ID
          externalId: `metric_${matchingMetric.id}`,
          name: matchingMetric.anuncios || 'Anúncio sem nome',
          type: 'image' as const,
          imageUrl: isValidImageUrl(matchingMetric.adUrl) ? matchingMetric.adUrl : null,
          videoUrl: null,
          text: null,
          headline: matchingMetric.anuncios || 'Anúncio',
          description: `Campaign: ${matchingMetric.campanha || 'N/A'}`,
          callToAction: null,
          status: 'active' as const,
          impressions: matchingMetric.impressoes || 0,
          clicks: matchingMetric.cliques || 0,
          conversions: 0, // Not available in campaign_metrics
          ctr: (matchingMetric.cliques && matchingMetric.impressoes && matchingMetric.impressoes > 0) ? 
            (matchingMetric.cliques / matchingMetric.impressoes * 100).toFixed(3) : "0.000",
          cpc: (matchingMetric.cpc && !isNaN(Number(matchingMetric.cpc))) ? Number(matchingMetric.cpc).toFixed(2) : "0.00",
          createdAt: matchingMetric.createdAt || new Date(),
          updatedAt: matchingMetric.updatedAt || new Date(),
        };
        
        console.log(`✅ Found and transformed creative from campaign_metrics: ${creative.name}`);
      }

      // Verify we have a creative before proceeding
      if (!creative) {
        console.log(`❌ Creative ${creativeId} could not be found or created`);
        return res.status(404).json({ message: "Creative not found" });
      }

      // Get user's brand configurations, content criteria, and performance benchmarks
      const brandConfigs = await storage.getBrandConfigurationsByUser(userId);
      const contentCriteria = await storage.getContentCriteriaByUser(userId);
      const performanceBenchmarks = await storage.getPerformanceBenchmarksByUser(userId);
      const activeBrandConfig = brandConfigs.find(config => config.isActive) || brandConfigs[0];
      const activeContentCriteria = contentCriteria.find(criteria => criteria.isActive) || contentCriteria[0];

      // Debug logging
      console.log('📊 Analysis Debug Info:');
      console.log(`- Brand configs found: ${brandConfigs.length}`);
      console.log(`- Content criteria found: ${contentCriteria.length}`);
      console.log(`- Performance benchmarks found:`, performanceBenchmarks ? 'Yes' : 'None');
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

      // Perform performance analysis with benchmarks
      const performanceResult = await analyzeCreativePerformance(creative, performanceBenchmarks);

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
      const hasAnalysisErrors = complianceResult.issues.some(issue => 
        issue.includes("Análise falhou") || 
        issue.includes("configuração da OpenAI") ||
        issue.includes("Analysis failed")
      );

      if (hasAnalysisErrors) {
        // Log the error internally
        console.log('🚨 AI Analysis Failed for creative:', creative.id, {
          complianceScore: complianceResult.score,
          performanceScore: performanceResult.score,
          brandConfig: activeBrandConfig?.brandName,
          contentCriteria: activeContentCriteria?.name
        });
        
        // Don't change status if analysis worked with fallback
        if (complianceResult.score === 0) {
          status = 'non_compliant';
          
          // Replace technical errors with user-friendly messages
          issues.length = 0; // Clear technical errors
          issues.push({
            type: 'Análise Pendente',
            description: 'Este criativo precisa de análise manual. Verifique configurações de IA.',
            severity: 'medium'
          });
          
          // Update check details
          checks.forEach(check => {
            if (check.status === 'passed') {
              check.status = 'warning';
              check.details = 'Verificação manual necessária';
            }
          });
        } else {
          // Analysis worked with fallback, just filter out technical messages
          complianceResult.issues = complianceResult.issues.filter(issue => 
            !issue.includes("Análise falhou") && 
            !issue.includes("configuração da OpenAI") &&
            !issue.includes("Analysis failed")
          );
        }
      }

      // Validate and sanitize score values to prevent overflow
      const validateScore = (score: number | null | undefined, name: string): number => {
        if (score === null || score === undefined || isNaN(score)) {
          console.warn(`⚠️ Invalid ${name}: ${score}, defaulting to 0`);
          return 0;
        }
        const numericScore = Number(score);
        if (numericScore < 0) {
          console.warn(`⚠️ Negative ${name}: ${numericScore}, clamping to 0`);
          return 0;
        }
        if (numericScore > 99.99) {
          console.warn(`⚠️ Overflow ${name}: ${numericScore}, clamping to 99.99`);
          return 99.99;
        }
        // Ensure we have proper decimal precision (max 2 decimal places for 5,2 precision)
        return Math.round(numericScore * 100) / 100;
      };

      const validatedComplianceScore = validateScore(complianceScore, 'complianceScore');
      const validatedPerformanceScore = validateScore(performanceScore, 'performanceScore');

      // Format scores as strings with 2 decimal places for database persistence
      const complianceScoreStr = validatedComplianceScore.toFixed(2);
      const performanceScoreStr = validatedPerformanceScore.toFixed(2);

      // Create audit record with properly formatted values
      const auditData = {
        userId,
        creativeId,
        status,
        complianceScore: complianceScoreStr,
        performanceScore: performanceScoreStr,
        issues, // Pass as plain object - Drizzle handles JSONB serialization
        recommendations, // Pass as plain object - Drizzle handles JSONB serialization  
        aiAnalysis: {
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
        },
      };

      console.log('🐛 Debug auditData before insert:', {
        complianceScore: auditData.complianceScore,
        performanceScore: auditData.performanceScore,
        issuesType: typeof auditData.issues,
        aiAnalysisType: typeof auditData.aiAnalysis
      });

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
      const userId = req.user?.id;
      
      console.log('🔍 GET /api/creatives/:id/audits DEBUG:', {
        creativeId,
        userId,
        hasUser: !!req.user,
        authHeader: req.headers.authorization ? 'Bearer ***' : 'None'
      });
      
      const rawAudits = await storage.getAuditsByCreative(creativeId);
      
      // ✅ Fix: Ensure decimal scores are properly converted to numbers
      const audits = rawAudits.map(audit => ({
        ...audit,
        complianceScore: audit.complianceScore ? Number(audit.complianceScore) : 0,
        performanceScore: audit.performanceScore ? Number(audit.performanceScore) : 0,
      }));
      
      console.log('✅ Audits response:', {
        creativeId,
        auditCount: audits.length,
        firstAuditScores: audits[0] ? {
          compliance: audits[0].complianceScore,
          performance: audits[0].performanceScore,
          status: audits[0].status
        } : null
      });
      
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

  app.delete('/api/audits/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const auditId = req.params.id;
      const userId = req.user!.id;
      
      // Verify ownership by checking if the audit belongs to the user
      const audit = await storage.getAuditById(auditId);
      if (!audit || audit.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const success = await storage.deleteAudit(auditId);
      if (!success) {
        return res.status(404).json({ message: "Audit not found" });
      }
      
      res.json({ message: "Audit deleted successfully" });
    } catch (error) {
      console.error("Error deleting audit:", error);
      res.status(500).json({ message: "Failed to delete audit" });
    }
  });

  // Audit Action routes
  app.get('/api/audit-actions', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const actions = await storage.getAuditActionsByUser(userId);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching audit actions:", error);
      res.status(500).json({ message: "Failed to fetch audit actions" });
    }
  });

  app.post('/api/audit-actions', authenticateToken, async (req: AuthRequest, res: Response) => {
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
      
      // CRITICAL: Force no-cache to prevent serving stale demo data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Vary', 'Authorization');
      
      console.log(`🔍 Dashboard metrics request - UserID: ${userId}`);
      
      const metrics = await storage.getDashboardMetrics(userId);
      
      console.log(`📊 Metrics result - Campaigns: ${metrics.activeCampaigns}, Analyzed: ${metrics.creativesAnalyzed}`);
      
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

  app.get('/api/dashboard/recent-audits', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      // Ensure JSON response
      res.setHeader('Content-Type', 'application/json');
      
      const recentAudits = await storage.getRecentAudits(userId, limit);
      res.json(recentAudits);
    } catch (error) {
      console.error("Error fetching recent audits:", error);
      res.status(500).json({ message: "Failed to fetch recent audits" });
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
  app.post('/api/sync-single-tab-now', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }
      
      const userId = req.user.id;
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

  // Simple sync trigger for admin (no auth needed for this operation)
  app.post('/api/admin/simple-sync', async (req: Request, res: Response) => {
    try {
      console.log(`🔄 Simple sync trigger requested`);
      
      // Import the sync function
      const { syncSingleTabWithLogging } = await import('./services/sheetsSingleTabSync');
      
      // Execute sync
      const result = await syncSingleTabWithLogging();

      res.json({
        success: result.success,
        message: "Sync completed",
        stats: {
          downloaded: result.totalDownloaded,
          processed: result.totalProcessed,
          inserted: result.totalInserted,
          completion: result.completionPercentage,
          errors: result.errors.length
        },
        syncBatch: result.syncBatch
      });

    } catch (error) {
      console.error("Error during simple sync:", error);
      res.status(500).json({
        success: false,
        message: "Sync failed",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Clean all Google Sheets data endpoint (admin only)
  app.post('/api/admin/clean-sheets-data', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user is admin
      if (req.user.role !== 'administrador') {
        return res.status(403).json({ message: "Admin access required" });
      }

      console.log(`🧹 Admin ${req.user.email} initiating complete Google Sheets data cleanup`);

      // Get current count before deletion
      const beforeStats = await storage.getCampaignMetricsDebug();
      const recordsToDelete = beforeStats.totalRecords;

      // Delete all Google Sheets data
      await db.delete(campaignMetrics).where(eq(campaignMetrics.source, 'google_sheets'));

      // Verify deletion
      const afterStats = await storage.getCampaignMetricsDebug();
      const remainingRecords = afterStats.totalRecords;

      console.log(`✅ Google Sheets data cleanup completed:`);
      console.log(`   Records deleted: ${recordsToDelete}`);
      console.log(`   Remaining records: ${remainingRecords}`);

      res.json({
        success: true,
        message: "Google Sheets data cleaned successfully",
        recordsDeleted: recordsToDelete,
        remainingRecords: remainingRecords,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("Error cleaning Google Sheets data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to clean Google Sheets data",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Force full re-sync endpoint (admin only)
  app.post('/api/admin/force-full-resync', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user is admin
      if (req.user.role !== 'administrador') {
        return res.status(403).json({ message: "Admin access required" });
      }

      console.log(`🔄 Admin ${req.user.email} initiating forced full re-sync`);

      // Import the sync function
      const { syncSingleTabWithLogging } = await import('./services/sheetsSingleTabSync');
      
      // Execute full sync
      const result = await syncSingleTabWithLogging(req.user.id);

      console.log(`✅ Forced full re-sync completed:`);
      console.log(`   Success: ${result.success}`);
      console.log(`   Downloaded: ${result.totalDownloaded}`);
      console.log(`   Processed: ${result.totalProcessed}`);
      console.log(`   Inserted: ${result.totalInserted}`);
      console.log(`   Completion: ${result.completionPercentage}%`);

      res.json({
        success: result.success,
        message: "Full re-sync completed",
        stats: {
          downloaded: result.totalDownloaded,
          processed: result.totalProcessed,
          inserted: result.totalInserted,
          completion: result.completionPercentage,
          errors: result.errors.length
        },
        syncBatch: result.syncBatch,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("Error during forced full re-sync:", error);
      res.status(500).json({
        success: false,
        message: "Failed to execute full re-sync",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Debug reconciliation endpoint (admin only)
  app.get('/api/debug/reconciliation', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user is admin
      if (req.user.role !== 'administrador') {
        return res.status(403).json({ message: "Admin access required" });
      }

      console.log(`🔍 Admin ${req.user.email} requesting reconciliation debug data`);

      // Get campaign counts from both sources
      const [campaignsTableResult] = await db
        .select({ 
          total: sql<number>`COUNT(*)`,
          active: sql<number>`COUNT(CASE WHEN status = 'active' THEN 1 END)`
        })
        .from(campaigns);

      const [campaignMetricsResult] = await db
        .select({ 
          distinctCampaigns: sql<number>`COUNT(DISTINCT campanha)`,
          totalRecords: sql<number>`COUNT(*)`
        })
        .from(campaignMetrics)
        .where(eq(campaignMetrics.source, 'google_sheets'));

      // Get sample records with image mapping
      const sampleRecords = await db
        .select({
          campanha: campaignMetrics.campanha,
          nomeAconta: campaignMetrics.nomeAconta,
          adUrl: campaignMetrics.adUrl,
          anuncios: campaignMetrics.anuncios,
          data: campaignMetrics.data,
          impressoes: campaignMetrics.impressoes,
          cliques: campaignMetrics.cliques,
          syncBatch: campaignMetrics.syncBatch
        })
        .from(campaignMetrics)
        .where(eq(campaignMetrics.source, 'google_sheets'))
        .orderBy(desc(campaignMetrics.data))
        .limit(5);

      // Get latest sync information
      const [latestSyncResult] = await db
        .select({
          syncBatch: campaignMetrics.syncBatch,
          recordCount: sql<number>`COUNT(*)`,
          latestDate: sql<Date>`MAX(created_at)`
        })
        .from(campaignMetrics)
        .where(eq(campaignMetrics.source, 'google_sheets'))
        .groupBy(campaignMetrics.syncBatch)
        .orderBy(sql`MAX(created_at) DESC`)
        .limit(1);

      // Check for unique campaigns vs account combinations
      const campaignAccountCombos = await db
        .select({
          campanha: campaignMetrics.campanha,
          nomeAconta: campaignMetrics.nomeAconta,
          recordCount: sql<number>`COUNT(*)`
        })
        .from(campaignMetrics)
        .where(eq(campaignMetrics.source, 'google_sheets'))
        .groupBy(campaignMetrics.campanha, campaignMetrics.nomeAconta)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(10);

      const reconciliationData = {
        timestamp: new Date().toISOString(),
        campaignCounts: {
          campaignsTable: {
            total: campaignsTableResult.total,
            active: campaignsTableResult.active,
            source: "Meta/Google integrations"
          },
          campaignMetricsTable: {
            distinctCampaigns: campaignMetricsResult.distinctCampaigns,
            totalRecords: campaignMetricsResult.totalRecords,
            source: "Google Sheets sync"
          }
        },
        latestSync: latestSyncResult ? {
          syncBatch: latestSyncResult.syncBatch,
          recordCount: latestSyncResult.recordCount,
          syncDate: latestSyncResult.latestDate
        } : null,
        sampleRecords: sampleRecords.map(record => ({
          ...record,
          hasAdUrl: !!record.adUrl,
          adUrlPreview: record.adUrl ? record.adUrl.substring(0, 50) + '...' : null
        })),
        campaignAccountCombinations: campaignAccountCombos,
        diagnostics: {
          discrepancy: campaignMetricsResult.distinctCampaigns - campaignsTableResult.active,
          expectedDashboardCount: campaignsTableResult.active,
          actualSheetsCount: campaignMetricsResult.distinctCampaigns,
          imageMapping: {
            planilhaField: "ad_url",
            bancoField: "adUrl", 
            frontendExpected: "imageUrl",
            problem: "ad_url é URL do anúncio, não da imagem"
          }
        }
      };

      res.json({
        success: true,
        data: reconciliationData
      });

    } catch (error) {
      console.error("Error in reconciliation debug:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate reconciliation debug data",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });


  // Image proxy endpoint for Facebook URLs
  app.get('/api/image-proxy', async (req: Request, res: Response) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter is required' });
      }

      // Parse and validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      // Security: Only allow HTTPS and validate Facebook/CDN domains
      if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({ error: 'Only HTTPS URLs are allowed' });
      }

      // Strict allowlist of trusted Facebook/CDN domains
      const allowedHosts = [
        'scontent.xx.fbcdn.net',
        'scontent.fgru1-1.fna.fbcdn.net',
        'scontent.fsdu1-1.fna.fbcdn.net',
        'external.xx.fbcdn.net',
        'fbcdn.net'
      ];

      const isAllowedHost = allowedHosts.some(allowedHost => 
        parsedUrl.hostname === allowedHost || 
        parsedUrl.hostname.endsWith('.' + allowedHost)
      );

      if (!isAllowedHost) {
        return res.status(400).json({ error: 'URL not from allowed domains' });
      }

      // Prevent internal network access
      if (parsedUrl.hostname === 'localhost' || 
          parsedUrl.hostname.startsWith('127.') ||
          parsedUrl.hostname.startsWith('10.') ||
          parsedUrl.hostname.startsWith('192.168.') ||
          parsedUrl.hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)) {
        return res.status(400).json({ error: 'Access to internal networks not allowed' });
      }

      console.log(`🖼️ Proxying image request: ${url}`);
      
      // Fetch the image with proper headers
      const imageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.facebook.com/'
        }
      });

      if (!imageResponse.ok) {
        console.log(`❌ Image fetch failed: ${imageResponse.status} ${imageResponse.statusText}`);
        return res.status(imageResponse.status).json({ 
          error: `Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}` 
        });
      }

      // Get content type and size
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const contentLength = imageResponse.headers.get('content-length');
      
      // Set response headers
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*'
      });
      
      if (contentLength) {
        res.set('Content-Length', contentLength);
      }
      
      // Simple pipe for now
      if (imageResponse.body) {
        imageResponse.body.pipe(res);
        console.log(`✅ Image proxy successful: ${contentType}`);
      } else {
        res.status(500).json({ error: 'No image data received' });
      }
      
    } catch (error) {
      console.error('❌ Image proxy error:', error);
      
      if (!res.headersSent) {
        if ((error as Error).name === 'AbortError') {
          res.status(408).json({ error: 'Request timeout' });
        } else if ((error as any).code === 'ENOTFOUND' || (error as any).code === 'ECONNREFUSED') {
          res.status(502).json({ error: 'Failed to connect to image server' });
        } else {
          res.status(500).json({ 
            error: 'Failed to proxy image',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}