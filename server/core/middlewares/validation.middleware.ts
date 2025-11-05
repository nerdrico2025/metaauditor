
import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../errors/AppError';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      if (error.errors) {
        const messages = error.errors.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        );
        next(new ValidationError(messages.join(', ')));
      } else {
        next(new ValidationError('Dados inválidos'));
      }
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error: any) {
      if (error.errors) {
        const messages = error.errors.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        );
        next(new ValidationError(messages.join(', ')));
      } else {
        next(new ValidationError('Query params inválidos'));
      }
    }
  };
};
