
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../../shared/services/storage.service.js';

const router = Router();

// Get all audits for user
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const audits = await storage.getAuditsByUser(userId);
    res.json(audits);
  } catch (error) {
    next(error);
  }
});

// Get audits by creative
router.get('/creative/:creativeId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const audits = await storage.getAuditsByCreative(req.params.creativeId);
    res.json(audits);
  } catch (error) {
    next(error);
  }
});

// Get audit by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const audit = await storage.getAuditById(req.params.id);
    if (!audit) {
      return res.status(404).json({ message: 'Auditoria não encontrada' });
    }
    res.json(audit);
  } catch (error) {
    next(error);
  }
});

// Create audit
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    let companyId = (req as any).user?.companyId;
    
    // If companyId is not in token, fetch from user record
    if (!companyId && userId) {
      const user = await storage.getUserById(userId);
      companyId = user?.companyId || null;
    }
    
    const audit = await storage.createAudit({
      ...req.body,
      userId,
      companyId,
    });
    res.status(201).json(audit);
  } catch (error) {
    next(error);
  }
});

// Delete audit
router.delete('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await storage.deleteAudit(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Auditoria não encontrada' });
    }
    res.json({ message: 'Auditoria excluída com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;
