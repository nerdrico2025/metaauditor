
import type { Request, Response, NextFunction } from 'express';

export class AppException extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppException';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedException extends AppException {
  constructor(message: string = 'Não autorizado') {
    super(message, 401);
    this.name = 'UnauthorizedException';
  }
}

export class NotFoundException extends AppException {
  constructor(message: string = 'Recurso não encontrado') {
    super(message, 404);
    this.name = 'NotFoundException';
  }
}

export class BadRequestException extends AppException {
  constructor(message: string = 'Requisição inválida') {
    super(message, 400);
    this.name = 'BadRequestException';
  }
}

export class ValidationException extends AppException {
  constructor(message: string = 'Dados inválidos') {
    super(message, 422);
    this.name = 'ValidationException';
  }
}

export class ForbiddenException extends AppException {
  constructor(message: string = 'Acesso negado') {
    super(message, 403);
    this.name = 'ForbiddenException';
  }
}

// Re-export errorHandler for convenience
export { errorHandler } from '@presentation/middlewares/errorHandler';
