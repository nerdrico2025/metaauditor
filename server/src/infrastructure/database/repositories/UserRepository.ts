import { eq } from 'drizzle-orm';
import { db } from '@infrastructure/database/connection';
import { users } from '@drizzle/schema';
import { IUserRepository, CreateUserData, UpdateUserData } from '@application/repositories/IUserRepository';
import { User } from '@domain/entities/User';

export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result.length > 0 ? this.toDomain(result[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result.length > 0 ? this.toDomain(result[0]) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const result = await db.insert(users).values(data).returning();
    return this.toDomain(result[0]);
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const result = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return this.toDomain(result[0]);
  }

  async delete(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async updateLastLogin(id: string): Promise<void> {
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async findByCompanyId(companyId: string): Promise<User[]> {
    const result = await db.select().from(users).where(eq(users.companyId, companyId));
    return result.map(u => this.toDomain(u));
  }

  private toDomain(data: any): User {
    return new User(
      data.id,
      data.email,
      data.firstName,
      data.lastName,
      data.role,
      data.companyId,
      data.isActive,
      data.createdAt,
      data.updatedAt,
      data.lastLoginAt,
    );
  }
}