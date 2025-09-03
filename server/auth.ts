import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import type { User as SchemaUser } from '@shared/schema';

// Extended User interface that matches our database schema
export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  role: 'administrador' | 'operador';
  profileImageUrl: string | null;
  isActive: boolean | null;
  lastLoginAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '7d';

// Extend Express Request type to include our user
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      password: string;
      firstName: string | null;
      lastName: string | null;
      role: 'administrador' | 'operador';
      profileImageUrl: string | null;
      isActive: boolean | null;
      lastLoginAt: Date | null;
      createdAt: Date | null;
      updatedAt: Date | null;
    }
    interface Request {
      user?: User;
    }
  }
}

export interface AuthRequest extends Request {
  user?: User;
}

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): { userId: string } => {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
};

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const { userId } = verifyToken(token);

    // Get storage instance from app locals
    const storage = req.app.locals.storage;
    const user = await storage.getUserById(userId);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const { userId } = verifyToken(token);
      const storage = req.app.locals.storage;
      const user = await storage.getUserById(userId);
      req.user = user || undefined;
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// AuthService class for compatibility
export class AuthService {
  static async register(data: { email: string; password: string; firstName: string; lastName: string; role?: 'administrador' | 'operador' }) {
    const { storage } = await import('./storage');
    
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(data.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await storage.createUser({
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || 'operador',
    });

    // Generate token
    const token = generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    };
  }

  static async login(data: { email: string; password: string }) {
    const { storage } = await import('./storage');
    
    // Get user by email
    const user = await storage.getUserByEmail(data.email);
    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isValid = await comparePassword(data.password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login time
    await storage.updateUser(user.id, { lastLoginAt: new Date() });

    // Generate token
    const token = generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    };
  }
}