
import type { Response } from 'express';
import type { AuthRequest } from '../../auth';
import { asyncHandler } from '../../core/errors/errorHandler';
import { AuthService } from './auth.service';
import type { LoginData, RegisterData } from '@shared/schema';

export class AuthController {
  constructor(private authService: AuthService) {}

  register = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data: RegisterData = req.body;
    const result = await this.authService.register(data);
    
    res.status(201).json({
      status: 'success',
      data: result
    });
  });

  login = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data: LoginData = req.body;
    const result = await this.authService.login(data);
    
    res.json({
      status: 'success',
      data: result
    });
  });

  logout = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({
      status: 'success',
      message: 'Logout realizado com sucesso'
    });
  });

  getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ 
        status: 'error',
        message: 'Não autenticado' 
      });
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Vary', 'Authorization');

    res.json({
      status: 'success',
      data: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        isActive: req.user.isActive,
        lastLoginAt: req.user.lastLoginAt,
        profileImageUrl: req.user.profileImageUrl,
      }
    });
  });
}
