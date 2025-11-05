
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 'error',
      message: 'Dados inválidos',
      errors: err.errors,
    });
  }

  console.error('Erro não tratado:', err);

  return res.status(500).json({
    status: 'error',
    message: 'Erro interno do servidor',
  });
};
