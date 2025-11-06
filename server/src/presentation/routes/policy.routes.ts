
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

// Get all policies for user
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const policies = await storage.getPoliciesByUser(userId);
    res.json(policies);
  } catch (error) {
    next(error);
  }
});

// Get policy settings (same as getting all policies)
router.get('/settings', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const policies = await storage.getPoliciesByUser(userId);
    res.json(policies);
  } catch (error) {
    next(error);
  }
});

// Get policy by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await storage.getPolicyById(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: 'Política não encontrada' });
    }
    res.json(policy);
  } catch (error) {
    next(error);
  }
});

// Create policy
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const policy = await storage.createPolicy({
      ...req.body,
      userId,
    });
    res.status(201).json(policy);
  } catch (error) {
    next(error);
  }
});

// Update policy
router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await storage.updatePolicy(req.params.id, req.body);
    if (!policy) {
      return res.status(404).json({ message: 'Política não encontrada' });
    }
    res.json(policy);
  } catch (error) {
    next(error);
  }
});

// Delete policy
router.delete('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await storage.deletePolicy(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Política não encontrada' });
    }
    res.json({ message: 'Política excluída com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;
