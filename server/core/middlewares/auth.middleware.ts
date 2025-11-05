
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../auth';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import type { AuthRequest } from '../../auth';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Token de autenticação necessário');
    }

    const { userId } = verifyToken(token);
    const storage = req.app.locals.storage;
    const user = await storage.getUserById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Usuário não encontrado ou inativo');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error instanceof UnauthorizedError ? error : new UnauthorizedError('Token inválido'));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Você não tem permissão para acessar este recurso'));
    }

    next();
  };
};
