// src/server/src/scripts/seedData.ts
import { db } from '../shared/config/database';
import { users } from '@shared/schema';
import { hashPassword } from '../shared/services/auth.service';
import { eq } from 'drizzle-orm';

async function seedDatabase() {
  try {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, 'admin@example.com'),
    });

    if (existingUser) {
      console.log('Admin user already exists. Skipping seed.');
      return;
    }

    const hashedPassword = await hashPassword('adminpassword'); // Use a strong password in production

    await db.insert(users).values({
      email: 'admin@example.com',
      name: 'Administrator',
      password: hashedPassword,
      role: 'ADMIN',
    });

    console.log('Database seeded successfully with admin user.');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    // Assuming 'db' has a close method if necessary, otherwise, this block can be removed.
    // For Prisma, the client is typically reused and not explicitly closed here.
    // If using a different ORM or connection method, adjust accordingly.
    // Example: await db.$disconnect();
  }
}

seedDatabase();

// src/server/src/scripts/createSuperAdmin.ts
import { db } from '../shared/config/database';
import { users } from '@shared/schema';
import { hashPassword } from '../shared/services/auth.service';
import { eq } from 'drizzle-orm';

async function createSuperAdmin() {
  try {
    const superAdminEmail = 'superadmin@example.com';
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, superAdminEmail),
    });

    if (existingUser) {
      console.log(`Super admin user with email ${superAdminEmail} already exists.`);
      return;
    }

    const hashedPassword = await hashPassword('superadminpassword'); // Use a strong password in production

    await db.insert(users).values({
      email: superAdminEmail,
      name: 'Super Administrator',
      password: hashedPassword,
      role: 'SUPER_ADMIN', // Assuming SUPER_ADMIN role exists
    });

    console.log(`Super admin user created with email: ${superAdminEmail}`);
  } catch (error) {
    console.error('Error creating super admin:', error);
  } finally {
    // For Prisma, the client is typically reused and not explicitly closed here.
    // If using a different ORM or connection method, adjust accordingly.
    // Example: await db.$disconnect();
  }
}

createSuperAdmin();

// src/server/src/scripts/resetUserPassword.ts
import { db } from '../shared/config/database';
import { users } from '@shared/schema';
import { hashPassword } from '../shared/services/auth.service';
import { eq } from 'drizzle-orm';

async function resetPassword(email: string, newPasswordPlain: string) {
  if (!email || !newPasswordPlain) {
    console.error('Email and new password are required.');
    return;
  }

  try {
    const hashedPassword = await hashPassword(newPasswordPlain);
    const result = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email))
      .returning();

    if (result.length > 0) {
      console.log(`Password for user ${email} has been reset successfully.`);
    } else {
      console.log(`User with email ${email} not found.`);
    }
  } catch (error) {
    console.error(`Error resetting password for user ${email}:`, error);
  } finally {
    // For Prisma, the client is typically reused and not explicitly closed here.
    // If using a different ORM or connection method, adjust accordingly.
    // Example: await db.$disconnect();
  }
}

// Example usage (replace with actual logic to get email and new password, e.g., from command line arguments)
const userEmailToReset = process.argv[2]; // Get email from command line argument
const newPasswordForUser = process.argv[3]; // Get new password from command line argument

if (userEmailToReset && newPasswordForUser) {
  resetPassword(userEmailToReset, newPasswordForUser);
} else {
  console.log('Usage: ts-node resetUserPassword.ts <email> <newPassword>');
}

// src/server/src/shared/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../errors/AppError';

const SALT_ROUNDS = 10;
const JWT_SECRET = env.JWT_SECRET;

export const hashPassword = async (password: string): Promise<string> => {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    logger.error('Error hashing password:', error);
    throw new AppError('Failed to hash password', 500);
  }
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error('Error comparing password:', error);
    throw new AppError('Failed to compare password', 500);
  }
};

export const generateToken = (payload: object): string => {
  try {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
  } catch (error) {
    logger.error('Error generating token:', error);
    throw new AppError('Failed to generate token', 500);
  }
};

export const verifyToken = (token: string): object | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as object;
  } catch (error) {
    logger.warn('Invalid token:', error.message);
    return null;
  }
};

// src/server/src/shared/services/storage.service.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { logger } from '../config/logger';

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = env.AWS_S3_BUCKET_NAME;

export const uploadFileToS3 = async (file: Buffer, fileName: string, contentType: string): Promise<string> => {
  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file,
    ContentType: contentType,
  };

  try {
    await s3Client.send(new PutObjectCommand(uploadParams));
    const fileUrl = `https://${BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${fileName}`;
    logger.info(`File ${fileName} uploaded successfully to S3.`);
    return fileUrl;
  } catch (error) {
    logger.error(`Error uploading file ${fileName} to S3:`, error);
    throw error;
  }
};

export const getFileFromS3 = async (fileName: string): Promise<Buffer | null> => {
  const getObjectParams = {
    Bucket: BUCKET_NAME,
    Key: fileName,
  };

  try {
    const command = new GetObjectCommand(getObjectParams);
    const { Body } = await s3Client.send(command);
    if (!Body) {
      logger.warn(`File ${fileName} not found in S3.`);
      return null;
    }
    const fileContent = await Body.transformToString('binary'); // Read as binary
    return Buffer.from(fileContent, 'binary');
  } catch (error) {
    logger.error(`Error getting file ${fileName} from S3:`, error);
    throw error;
  }
};

// src/server/src/shared/services/acl.service.ts
// This service would handle Access Control List logic.
// For example, checking user permissions based on roles or specific resource access.

interface User {
  id: string;
  role: string;
  // other user properties
}

interface Resource {
  id: string;
  ownerId: string;
  // other resource properties
}

export const canAccessResource = (user: User, resource: Resource, action: string): boolean => {
  // Basic example: owner can always access, admin can access anything
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.id === resource.ownerId) return true;

  // Add more complex ACL logic here based on roles, groups, specific permissions, etc.
  switch (action) {
    case 'read':
      // e.g., Allow users with 'VIEWER' role to read certain resources
      return user.role === 'VIEWER';
    case 'write':
      // e.g., Only owners or 'EDITOR' role can write
      return user.role === 'EDITOR';
    case 'delete':
      // e.g., Only owners or 'ADMIN' role can delete
      return user.role === 'ADMIN';
    default:
      return false;
  }
};

// src/server/src/shared/services/replit-auth.service.ts
// This service would handle authentication specifically for Replit environments if needed.
// For a general application, you might not need this separate service.
// It could potentially wrap or extend the auth.service.ts functionality.

import { generateToken, verifyToken } from './auth.service';

export const signInWithReplit = async (replitUserId: string, username: string) => {
  // In a real Replit app, you'd likely use Replit's auth mechanisms.
  // For this example, we'll simulate it by generating a JWT.
  const userPayload = { userId: replitUserId, username };
  const token = generateToken(userPayload);
  return { token };
};

export const authenticateReplitRequest = (token: string) => {
  // Verify the token generated by signInWithReplit
  return verifyToken(token);
};

// src/server/src/shared/config/env.ts
import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  AWS_REGION: process.env.AWS_REGION!,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME!,
};

// src/server/src/shared/config/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // Add a file transport for production if needed
    // process.env.NODE_ENV === 'production' && new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // process.env.NODE_ENV === 'production' && new winston.transports.File({ filename: 'combined.log' }),
  ].filter(Boolean), // Remove undefined entries if files are not added in non-production
});

export { logger };

// src/server/src/shared/config/database.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from './env';

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// Initialize Drizzle ORM
const db = drizzle(pool);

export { db, pool };

// src/server/src/shared/errors/AppError.ts
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    // Ensure the name of the error is the same as the class name
    this.name = this.constructor.name;
    // Capture stack trace, excluding constructor call from it
    Error.prototype.captureStackTrace(this, this.constructor);
  }
}

// src/server/src/shared/errors/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';
import { logger } from '../config/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error for debugging purposes
  logger.error(`Unhandled error: ${err.message}`, err);

  // Check if it's an AppError instance
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      statusCode: err.statusCode,
      message: err.message,
    });
  }

  // Handle generic errors
  res.status(500).json({
    status: 'error',
    statusCode: 500,
    message: 'An unexpected error occurred on the server.',
  });
};

// src/server/src/app.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { env } from './shared/config/env';
import { logger } from './shared/config/logger';
import { errorHandler } from './shared/errors/errorHandler';
import { AppError } from './shared/errors/AppError';
import { authRoutes } from './routes/auth.routes'; // Assuming auth routes exist
import { userRoutes } from './routes/user.routes'; // Assuming user routes exist

export const createApp = (): Express => {
  const app: Express = express();

  // Middleware
  app.use(cors()); // Enable CORS for all origins
  app.use(helmet()); // Basic security headers
  app.use(express.json()); // Parse JSON request bodies
  app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
  app.use(compression()); // Compress response bodies

  // Logging middleware (use 'dev' format in development, 'combined' in production)
  const morganFormat = env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(morganFormat, { stream: { write: (message) => logger.info(message.trim()) } }));

  // Routes
  app.get('/', (req: Request, res: Response) => {
    res.send('Welcome to the API!');
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);

  // Catch 404 errors and forward to error handler
  app.all('*', (req: Request, res: Response, next: NextFunction) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};

// src/server/src/routes/auth.routes.ts
import { Router } from 'express';
import { loginController, registerController } from '../controllers/auth.controller'; // Assuming controllers exist

const router = Router();

router.post('/register', registerController);
router.post('/login', loginController);

export { router as authRoutes };

// src/server/src/routes/user.routes.ts
import { Router } from 'express';
import { getUserController, updateUserController } from '../controllers/user.controller'; // Assuming controllers exist
import { authenticateToken } from '../middleware/auth.middleware'; // Assuming auth middleware exists

const router = Router();

// Protected routes
router.get('/:id', authenticateToken, getUserController);
router.put('/:id', authenticateToken, updateUserController);

export { router as userRoutes };

// src/server/src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError';
import { hashPassword, comparePassword, generateToken } from '../shared/services/auth.service';
import { db } from '../shared/config/database';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export const registerController = async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return next(new AppError('All fields are required', 400));
  }

  try {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return next(new AppError('User already exists', 409));
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      role: 'USER', // Default role
    }).returning();

    const user = newUser[0];
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    next(new AppError('Registration failed', 500));
  }
};

export const loginController = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Email and password are required', 400));
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    const isPasswordMatch = await comparePassword(password, user.password);

    if (!isPasswordMatch) {
      return next(new AppError('Invalid credentials', 401));
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    next(new AppError('Login failed', 500));
  }
};

// src/server/src/controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError';
import { db } from '../shared/config/database';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../shared/services/auth.service'; // Import if password update is allowed

export const getUserController = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!id) {
    return next(new AppError('User ID is required', 400));
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Avoid sending sensitive information like password hash
    const { password, ...userData } = user;

    res.status(200).json(userData);
  } catch (error) {
    next(new AppError('Failed to fetch user', 500));
  }
};

export const updateUserController = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body; // Include role if updatable

  if (!id) {
    return next(new AppError('User ID is required', 400));
  }

  try {
    let hashedPassword;
    if (password) {
      hashedPassword = await hashPassword(password);
    }

    const updatedUser = await db
      .update(users)
      .set({
        name: name || undefined,
        email: email || undefined,
        password: hashedPassword,
        role: role || undefined, // Update role if provided
      })
      .where(eq(users.id, id))
      .returning();

    if (updatedUser.length === 0) {
      return next(new AppError('User not found', 404));
    }

    const { password: userPassword, ...userData } = updatedUser[0];

    res.status(200).json({ message: 'User updated successfully', user: userData });
  } catch (error) {
    next(new AppError('Failed to update user', 500));
  }
};

// src/server/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../shared/services/auth.service';
import { AppError } from '../shared/errors/AppError';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return next(new AppError('Unauthorized: No token provided', 401));
  }

  const user = verifyToken(token);

  if (user === null) {
    return next(new AppError('Unauthorized: Invalid token', 401));
  }

  // Attach user info to the request object for use in controllers
  req.user = user as any; // Using 'as any' for simplicity; in a real app, define a Request type extension

  next();
};

// src/server/src/main.ts
import { createApp } from './app';
import { env } from './shared/config/env';
import { logger } from './shared/config/logger';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Server is running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
});

// src/index.ts
// This file serves as the entry point for the application.
// It might be used for other tasks like running migrations, seeding, or starting the server.
// For this setup, we'll keep it minimal and rely on src/server/src/main.ts for server startup.

// Example: If you wanted to run the server directly from here:
// import './server/src/main';

// Or if you needed to export something from the app:
// export * from './server/src/app';

// For now, we can leave it empty or add a simple message.
console.log('Application entry point. Use `npm run start` to run the server.');

// If you need to run scripts like seedData.ts directly, you would typically do that
// via npm scripts in package.json, e.g., "seed": "ts-node src/scripts/seedData.ts"
// and not directly from this index.ts file.

// src/shared/schema/index.ts
// This file should contain your Drizzle schema definitions.
// Example:
// import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
// import { relations } from 'drizzle-orm';

// export const users = pgTable('users', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   name: text('name').notNull(),
//   email: text('email').notNull().unique(),
//   password: text('password').notNull(),
//   role: text('role').default('USER'),
//   createdAt: timestamp('created_at').defaultNow(),
//   updatedAt: timestamp('updated_at').defaultNow(),
// });

// export const usersRelations = relations(users, ({ many }) => ({
//   // Define relations here, e.g.:
//   // posts: many(posts),
// }));

// export const posts = pgTable('posts', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   title: text('title').notNull(),
//   content: text('content').notNull(),
//   authorId: uuid('author_id').references(() => users.id),
//   createdAt: timestamp('created_at').defaultNow(),
//   updatedAt: timestamp('updated_at').defaultNow(),
// });

// export const postsRelations = relations(posts, ({ one }) => ({
//   author: one(users, {
//     fields: [posts.authorId],
//     references: [users.id],
//   }),
// }));

// Ensure you export your tables and relations
// export * from './users'; // Assuming you might split schema into files
// export * from './posts';

// Placeholder export if no schema is defined yet
export const schema = {};