import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';
import type { IStorage } from '../../shared/interfaces/storage.interface';

export function createUsersRoutes(storage: IStorage) {
  const router = Router();

  // Get all users for company
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const users = await storage.users.getByCompany(user.companyId);
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching users' });
    }
  });

  // Create user (company_admin only)
  router.post('/', authenticateToken, authorizeRoles(['company_admin']), async (req: Request, res: Response) => {
    try {
      const { email, firstName, lastName, password, role } = req.body;
      const user = (req as any).user;

      if (!email || !password || !role) {
        res.status(400).json({ message: 'Email, password, and role are required' });
        return;
      }

      const existingUser = await storage.users.getByEmail(email);
      if (existingUser) {
        res.status(409).json({ message: 'Email already in use' });
        return;
      }

      const newUser = await storage.users.create({
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        password,
        role,
        companyId: user.companyId,
        isActive: true,
      });

      res.status(201).json(newUser);
    } catch (error) {
      res.status(500).json({ message: 'Error creating user' });
    }
  });

  // Update user (company_admin only)
  router.patch('/:id', authenticateToken, authorizeRoles(['company_admin']), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, role } = req.body;
      const user = (req as any).user;

      const targetUser = await storage.users.getById(id);
      if (!targetUser || targetUser.companyId !== user.companyId) {
        res.status(403).json({ message: 'Access denied' });
        return;
      }

      const updatedUser = await storage.users.update(id, {
        firstName: firstName !== undefined ? firstName : targetUser.firstName,
        lastName: lastName !== undefined ? lastName : targetUser.lastName,
        role: role !== undefined ? role : targetUser.role,
      });

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: 'Error updating user' });
    }
  });

  // Delete user (company_admin only)
  router.delete('/:id', authenticateToken, authorizeRoles(['company_admin']), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const targetUser = await storage.users.getById(id);
      if (!targetUser || targetUser.companyId !== user.companyId) {
        res.status(403).json({ message: 'Access denied' });
        return;
      }

      await storage.users.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Error deleting user' });
    }
  });

  return router;
}
