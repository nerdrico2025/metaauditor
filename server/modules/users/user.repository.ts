
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '@shared/schema';
import type { User, UpsertUser } from '@shared/schema';
import type { IUserRepository } from './user.repository.interface';
import { NotFoundError } from '../../core/errors/AppError';

export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || null;
  }

  async create(data: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    return updated || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async updateLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async findAll(): Promise<User[]> {
    return await db.select().from(users);
  }
}
