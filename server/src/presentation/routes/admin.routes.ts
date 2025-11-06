import { Router } from 'express';
import { authenticateToken, requireSuperAdmin } from '../middlewares/auth.middleware.js';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';
import { z } from 'zod';
import { insertSubscriptionPlanSchema } from '../../../drizzle/schema.js';

const router = Router();

// Apply authentication and super admin middleware to all routes
router.use(authenticateToken);
router.use(requireSuperAdmin);

// Validation schemas
const createSubscriptionPlanSchema = insertSubscriptionPlanSchema.extend({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório'),
  price: z.union([z.string(), z.number()]).transform(val => String(val)),
  maxUsers: z.number().int().positive(),
  maxCampaigns: z.number().int().positive(),
  maxAuditsPerMonth: z.number().int().positive(),
});

const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial();

const createCompanySchema = z.object({
  name: z.string().min(1, 'Nome da empresa é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  contactEmail: z.string().email('Email de contato inválido').optional(),
  subscriptionPlan: z.enum(['free', 'starter', 'professional', 'enterprise']).default('free'),
  maxUsers: z.number().int().positive().default(5),
  maxCampaigns: z.number().int().positive().default(10),
  maxAuditsPerMonth: z.number().int().positive().default(100),
});

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
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

const createAdminUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  firstName: z.string().min(1, 'Nome é obrigatório'),
  lastName: z.string().min(1, 'Sobrenome é obrigatório'),
  role: z.enum(['super_admin', 'company_admin']),
  companyId: z.string().uuid().optional(),
});

const updateAdminUserSchema = z.object({
  email: z.string().email('Email inválido').optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(['super_admin', 'company_admin', 'operador']).optional(),
  companyId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============= SUBSCRIPTION PLANS ROUTES =============

// GET /api/admin/plans - List all subscription plans
router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await storage.getAllSubscriptionPlans();
    res.json(plans);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/plans/:id - Get subscription plan by ID
router.get('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const plan = await storage.getSubscriptionPlanById(id);
    
    if (!plan) {
      return res.status(404).json({ message: 'Plano de assinatura não encontrado' });
    }
    
    res.json(plan);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/plans - Create new subscription plan
router.post('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createSubscriptionPlanSchema.parse(req.body);
    const newPlan = await storage.createSubscriptionPlan(validatedData);
    res.status(201).json(newPlan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    next(error);
  }
});

// PUT /api/admin/plans/:id - Update subscription plan
router.put('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validatedData = updateSubscriptionPlanSchema.parse(req.body);
    
    const updatedPlan = await storage.updateSubscriptionPlan(id, validatedData);
    
    if (!updatedPlan) {
      return res.status(404).json({ message: 'Plano de assinatura não encontrado' });
    }
    
    res.json(updatedPlan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    next(error);
  }
});

// DELETE /api/admin/plans/:id - Delete subscription plan
router.delete('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteSubscriptionPlan(id);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Plano de assinatura não encontrado' });
    }
    
    res.json({ message: 'Plano de assinatura deletado com sucesso' });
  } catch (error) {
    next(error);
  }
});

// ============= COMPANIES ROUTES =============

// GET /api/admin/companies - List all companies with pagination
router.get('/companies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const allCompanies = await storage.getAllCompanies();
    const total = allCompanies.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const companies = allCompanies.slice(startIndex, endIndex);
    
    res.json({
      data: companies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/companies/:id - Get company by ID
router.get('/companies/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const company = await storage.getCompanyById(id);
    
    if (!company) {
      return res.status(404).json({ message: 'Empresa não encontrada' });
    }
    
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/companies - Create new company
router.post('/companies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createCompanySchema.parse(req.body);
    const newCompany = await storage.createCompany(validatedData);
    res.status(201).json(newCompany);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    next(error);
  }
});

// PUT /api/admin/companies/:id - Update company
router.put('/companies/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validatedData = updateCompanySchema.parse(req.body);
    
    const updatedCompany = await storage.updateCompany(id, validatedData);
    
    if (!updatedCompany) {
      return res.status(404).json({ message: 'Empresa não encontrada' });
    }
    
    res.json(updatedCompany);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    next(error);
  }
});

// DELETE /api/admin/companies/:id - Delete company
router.delete('/companies/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteCompany(id);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Empresa não encontrada' });
    }
    
    res.json({ message: 'Empresa deletada com sucesso' });
  } catch (error) {
    next(error);
  }
});

// ============= ADMIN USERS ROUTES =============

// GET /api/admin/admin-users - List administrative users (super_admin and company_admin)
router.get('/admin-users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const allUsers = await storage.getAllUsers();
    const adminUsers = allUsers.filter(user => 
      user.role === 'super_admin' || user.role === 'company_admin'
    );
    
    const total = adminUsers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const users = adminUsers.slice(startIndex, endIndex);
    
    // Remove password from response
    const sanitizedUsers = users.map(({ password, ...user }) => user);
    
    res.json({
      data: sanitizedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/admin-users/:id - Get user by ID
router.get('/admin-users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = await storage.getUserById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    
    // Remove password from response
    const { password, ...sanitizedUser } = user;
    res.json(sanitizedUser);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/admin-users - Create new admin user
router.post('/admin-users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createAdminUserSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(validatedData.email);
    if (existingUser) {
      return res.status(409).json({ message: 'Email já está em uso' });
    }
    
    // Hash password before storing
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    
    const newUser = await storage.createUser({
      ...validatedData,
      password: hashedPassword,
    });
    
    // Remove password from response
    const { password, ...sanitizedUser } = newUser;
    res.status(201).json(sanitizedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    next(error);
  }
});

// PUT /api/admin/admin-users/:id - Update user
router.put('/admin-users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validatedData = updateAdminUserSchema.parse(req.body);
    
    const updatedUser = await storage.updateUser(id, validatedData);
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    
    // Remove password from response
    const { password, ...sanitizedUser } = updatedUser;
    res.json(sanitizedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    next(error);
  }
});

// DELETE /api/admin/admin-users/:id - Delete user
router.delete('/admin-users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteUser(id);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    
    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;
