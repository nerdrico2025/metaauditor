
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';
import { z } from 'zod';

const router = Router();

// Schema for platform settings
const platformSettingsSchema = z.object({
  platform: z.enum(['meta', 'google']),
  appId: z.string().min(1, 'App ID é obrigatório'),
  appSecret: z.string().min(1, 'App Secret é obrigatório'),
  redirectUri: z.string().url('Redirect URI deve ser uma URL válida').optional(),
  isConfigured: z.boolean().default(true),
});

// Middleware to check if user is super_admin
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

// Get platform settings by platform (super_admin only)
router.get('/:platform', authenticateToken, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform } = req.params;
    
    if (platform !== 'meta' && platform !== 'google') {
      return res.status(400).json({ error: 'Platform must be "meta" or "google"' });
    }

    const settings = await storage.getPlatformSettingsByPlatform(platform);
    
    if (!settings) {
      return res.json({
        platform,
        appId: null,
        appSecret: null,
        redirectUri: null,
        isConfigured: false,
      });
    }

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

// Upsert platform settings (super_admin only)
router.post('/', authenticateToken, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = platformSettingsSchema.parse(req.body);
    const settings = await storage.upsertPlatformSettings(validatedData);
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

// Delete platform settings (super_admin only)
router.delete('/:platform', authenticateToken, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform } = req.params;
    
    if (platform !== 'meta' && platform !== 'google') {
      return res.status(400).json({ error: 'Platform must be "meta" or "google"' });
    }

    const deleted = await storage.deletePlatformSettings(platform);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Platform settings not found' });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
