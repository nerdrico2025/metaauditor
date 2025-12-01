import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { storage } from '../../shared/services/storage.service.js';
import bcrypt from 'bcrypt';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const router = Router();

const updateProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

// Get current user profile
router.get('/profile', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const user = await storage.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      companyId: user.companyId,
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const validatedData = updateProfileSchema.parse(req.body);
    
    const updatedUser = await storage.updateUser(userId, {
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email,
    });
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'Erro ao atualizar perfil' });
    }

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    next(error);
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const validatedData = changePasswordSchema.parse(req.body);
    
    const user = await storage.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(validatedData.currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Senha atual incorreta' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10);
    
    // Update password
    await storage.updateUser(userId, { password: hashedPassword });

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    next(error);
  }
});

export default router;
