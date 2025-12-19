
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedException } from '../../shared/errors/AppException.js';
import { storage } from '../../shared/services/storage.service.js';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  // Also check query string for SSE endpoints (EventSource can't send headers)
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

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

// Special authentication for SSE endpoints that can't send custom headers
// Uses cookie-based authentication instead of Authorization header
export const authenticateSSE = (req: Request, res: Response, next: NextFunction) => {
  // Check if user is already authenticated via Replit Auth session
  const replitUserId = req.headers['x-replit-user-id'] as string;
  
  if (replitUserId) {
    // User authenticated via Replit Auth
    (req as any).user = { userId: replitUserId };
    next();
    return;
  }

  // Fallback: check for token in Authorization header (for development)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      (req as any).user = decoded;
      next();
      return;
    } catch (error) {
      // Token invalid, continue to error
    }
  }

  throw new UnauthorizedException('Não autenticado');
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
