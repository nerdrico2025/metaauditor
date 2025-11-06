import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';
import { z } from 'zod';

const router = Router();

const updateCompanySchema = z.object({
  name: z.string().min(1),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
});

// Get company data
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await storage.getUserById((req as any).user?.userId);
    
    if (!user || !user.companyId) {
      return res.status(404).json({ message: 'Empresa não encontrada' });
    }

    const company = await storage.getCompanyById(user.companyId);
    
    if (!company) {
      return res.status(404).json({ message: 'Empresa não encontrada' });
    }

    res.json(company);
  } catch (error) {
    next(error);
  }
});

// Update company data
router.put('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await storage.getUserById((req as any).user?.userId);
    
    if (!user || !user.companyId) {
      return res.status(404).json({ message: 'Empresa não encontrada' });
    }

    const validatedData = updateCompanySchema.parse(req.body);
    
    const updatedCompany = await storage.updateCompany(user.companyId, validatedData);
    
    if (!updatedCompany) {
      return res.status(404).json({ message: 'Erro ao atualizar empresa' });
    }

    res.json(updatedCompany);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    next(error);
  }
});

export default router;
