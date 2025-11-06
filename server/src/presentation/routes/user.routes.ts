
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import type { Request, Response } from 'express';

const router = Router();

// Placeholder - to be implemented with controllers
router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  res.json({ message: 'User routes - to be implemented' });
});

export default router;
