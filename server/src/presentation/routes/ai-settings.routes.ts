import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';
import { z } from 'zod';

const router = Router();

const aiSettingsSchema = z.object({
  model: z.string().min(1, 'Modelo é obrigatório'),
  maxTokens: z.number().int().min(100).max(8000),
  temperature: z.string().optional(),
  complianceSystemPrompt: z.string().optional(),
  complianceUserPromptTemplate: z.string().optional(),
  performanceSystemPrompt: z.string().optional(),
  performanceUserPromptTemplate: z.string().optional(),
});

const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user || user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Apenas super administradores podem acessar esta funcionalidade'
    });
  }
  next();
};

router.get('/', authenticateToken, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await storage.getAiSettings();
    
    if (!settings) {
      return res.json({
        model: 'gpt-4o',
        maxTokens: 1500,
        temperature: '0.7',
        complianceSystemPrompt: null,
        complianceUserPromptTemplate: null,
        performanceSystemPrompt: null,
        performanceUserPromptTemplate: null,
      });
    }

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticateToken, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = aiSettingsSchema.parse(req.body);
    const settings = await storage.upsertAiSettings(validatedData);
    res.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    next(error);
  }
});

export default router;
