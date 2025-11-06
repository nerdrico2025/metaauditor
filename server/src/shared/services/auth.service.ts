
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';

export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  role: 'administrador' | 'operador' | 'super_admin' | 'company_admin';
  profileImageUrl: string | null;
  isActive: boolean | null;
  lastLoginAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  companyId: string | null;
}

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('🚨 CRITICAL: JWT_SECRET environment variable is required!');
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Production startup failed: Missing JWT_SECRET');
      process.exit(1);
    }
    console.warn('⚠️ Development: Using fallback JWT secret (INSECURE!)');
    return 'development-only-fallback-insecure';
  }
  return secret;
})();

const JWT_EXPIRES_IN = '7d';

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

export interface AuthRequest extends Request {
  user?: User;
}

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

export class AuthService {
  static async register(data: { 
    email: string; 
    password: string; 
    firstName: string; 
    lastName: string; 
    role?: 'administrador' | 'operador' | 'super_admin' | 'company_admin';
    companyId?: string | null;
  }) {
    const { storage } = await import('../storage.service');
    
    const existingUser = await storage.getUserByEmail(data.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await storage.createUser({
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || 'operador',
      companyId: data.companyId || null,
    });

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
    const { storage } = await import('../storage.service');
    
    const user = await storage.getUserByEmail(data.email);
    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    const isValid = await comparePassword(data.password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    await storage.updateUser(user.id, { lastLoginAt: new Date() });

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
