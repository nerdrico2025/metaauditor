// main.ts
import express from 'express';
import { setupServer } from './app';
import { logger } from './shared/config/logger';
import { prisma } from './shared/config/prisma';

const PORT = process.env.PORT || 3000;
const app = express();

setupServer(app);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { router } from './routes';
import { errorHandler } from './shared/errors/errorHandler';

export function setupServer(app: express.Express) {
  app.use(cors());
  app.use(helmet());
  app.use(express.json());
  app.use(morgan('dev'));

  app.use('/api', router);

  app.use(errorHandler);
}

// routes.ts
import { Router } from 'express';
import { helloController } from './controllers/hello.controller'; // Example controller

const router = Router();

router.get('/', helloController.sayHello);

export { router };

// controllers/hello.controller.ts
import { Request, Response, NextFunction } from 'express';

class HelloController {
  sayHello(req: Request, res: Response, next: NextFunction) {
    res.send('Hello World!');
  }
}

export const helloController = new HelloController();

// shared/config/env.ts
import dotenv from 'dotenv';

dotenv.config();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret',
};

// shared/config/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

export { logger };

// shared/config/prisma.ts
import { PrismaClient } from '@prisma/client';
import { env } from './env';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
});

// shared/services/auth.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

// shared/services/storage.service.ts
import { put, get, del } from '@vercel/blob';

export async function uploadFile(file: File, path: string): Promise<string> {
  const { url } = await put(path, file, { access: 'public' });
  return url;
}

export async function getFileUrl(path: string): Promise<string | null> {
  try {
    const url = await get(path, { unsigned: true });
    return url?.url || null;
  } catch (error) {
    return null;
  }
}

export async function deleteFile(path: string): Promise<void> {
  await del(path);
}

// shared/services/acl.service.ts
import { prisma } from '../config/prisma';

interface UserPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export async function getUserPermissions(userId: string, resource: string): Promise<UserPermissions> {
  // This is a placeholder. In a real application, you would fetch permissions from the database.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return { canRead: false, canWrite: false, canDelete: false };
  }

  switch (user.role) {
    case 'admin':
      return { canRead: true, canWrite: true, canDelete: true };
    case 'editor':
      if (resource === 'posts') {
        return { canRead: true, canWrite: true, canDelete: false };
      }
      return { canRead: true, canWrite: false, canDelete: false };
    case 'viewer':
    default:
      return { canRead: true, canWrite: false, canDelete: false };
  }
}

// shared/services/replit-auth.service.ts
// Placeholder for Replit-specific authentication logic if needed.
// For now, it can be empty or contain basic related utilities.

// shared/utils/crypto.ts
import crypto from 'crypto';

export function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString('hex');
}

export function encryptData(text: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptData(text: string, key: string): string {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// shared/utils/date.ts
export function formatDate(date: Date): string {
  return date.toISOString();
}

export function addDays(date: Date, days: number): Date {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

// shared/utils/string.ts
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '...';
}

// shared/errors/AppError.ts
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// shared/errors/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';
import { logger } from '../config/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(err.stack);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Generic server error
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
  });
};

// scripts/seedData.ts
import { db } from '../server/src/shared/config/database'; // Assuming 'database' is the export name for db
import { users } from '@shared/schema'; // Assuming @shared/schema is correctly aliased
import { eq } from 'drizzle-orm';
import { hashPassword } from '../server/src/shared/services/auth.service'; // Updated import

async function seedData() {
  console.log('Seeding data...');

  const hashedPassword = await hashPassword('password123');

  await db.insert(users).values([
    {
      id: 'user-1',
      email: 'test@example.com',
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Data seeded successfully!');
}

seedData().catch((e) => {
  console.error('Error seeding data:', e);
  process.exit(1);
});

// scripts/createSuperAdmin.ts
import { db } from '../server/src/shared/config/database';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../server/src/shared/services/auth.service';

async function createSuperAdmin() {
  console.log('Creating super admin...');

  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, 'superadmin@example.com'),
  });

  if (existingAdmin) {
    console.log('Super admin already exists.');
    return;
  }

  const hashedPassword = await hashPassword('supersecret');

  await db.insert(users).values([
    {
      id: 'superadmin-1',
      email: 'superadmin@example.com',
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Super admin created successfully!');
}

createSuperAdmin().catch((e) => {
  console.error('Error creating super admin:', e);
  process.exit(1);
});

// scripts/resetUserPassword.ts
import { db } from '../server/src/shared/config/database';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../server/src/shared/services/auth.service';

async function resetUserPassword(email: string, newPasswordPlain: string) {
  console.log(`Resetting password for user: ${email}`);

  const hashedPassword = await hashPassword(newPasswordPlain);

  const result = await db
    .update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.email, email));

  if (result.count === 0) {
    console.log(`User with email ${email} not found.`);
    return;
  }

  console.log(`Password for user ${email} reset successfully.`);
}

// Example usage:
// resetUserPassword('test@example.com', 'newPassword123');

resetUserPassword('test@example.com', 'newPassword123').catch((e) => {
  console.error('Error resetting password:', e);
  process.exit(1);
});