
import { Request, Response, NextFunction } from 'express';
import { AppException } from '../../shared/errors/AppException.js';

export const errorHandler = (
  err: Error | AppException,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('🔥 Error:', err);

  if (err instanceof AppException) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      statusCode: err.statusCode,
    });
  }

  // Generic server error
  return res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    statusCode: 500,
  });
};
