
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedException } from '../../shared/errors/AppException.js';
import { storage } from '../../shared/services/storage.service.js';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new UnauthorizedException('Token não fornecido');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    (req as any).user = decoded;
    next();
  } catch (error) {
    throw new UnauthorizedException('Token inválido');
  }
};

export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      throw new UnauthorizedException('Usuário não autenticado');
    }

    const user = await storage.getUserById(userId);
    
    if (!user || user.role !== 'super_admin') {
      throw new UnauthorizedException('Acesso negado. Apenas super administradores têm permissão.');
    }

    next();
  } catch (error) {
    next(error);
  }
};
