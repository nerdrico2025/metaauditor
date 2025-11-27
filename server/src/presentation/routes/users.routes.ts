import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { storage } from '../../shared/services/storage.service.js';
import bcrypt from 'bcryptjs';

const router = Router();

// Get all users for company
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const users = await storage.getUserByCompany(user.companyId);
    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Create user (company_admin only)
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'company_admin') {
      res.status(403).json({ message: 'Only company admins can create users' });
      return;
    }

    const { email, firstName, lastName, password, role } = req.body;

    if (!email || !password || !role) {
      res.status(400).json({ message: 'Email, password, and role are required' });
      return;
    }

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await storage.createUser({
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      password: hashedPassword,
      role,
      companyId: user.companyId,
      isActive: true,
    });

    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role,
      isActive: newUser.isActive,
      lastLoginAt: newUser.lastLoginAt,
      createdAt: newUser.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Update user (company_admin only)
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'company_admin') {
      res.status(403).json({ message: 'Only company admins can update users' });
      return;
    }

    const { id } = req.params;
    const { firstName, lastName, role } = req.body;

    const targetUser = await storage.getUserById(id);
    if (!targetUser || targetUser.companyId !== user.companyId) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const updatedUser = await storage.updateUser(id, {
      firstName: firstName !== undefined ? firstName : targetUser.firstName,
      lastName: lastName !== undefined ? lastName : targetUser.lastName,
      role: role !== undefined ? role : targetUser.role,
    });

    if (!updatedUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      lastLoginAt: updatedUser.lastLoginAt,
      createdAt: updatedUser.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Delete user (company_admin only)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'company_admin') {
      res.status(403).json({ message: 'Only company admins can delete users' });
      return;
    }

    const { id } = req.params;

    const targetUser = await storage.getUserById(id);
    if (!targetUser || targetUser.companyId !== user.companyId) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    await storage.deleteUser(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user' });
  }
});

export default router;
