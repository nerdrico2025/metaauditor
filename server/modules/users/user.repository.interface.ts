
import type { User, UpsertUser } from '@shared/schema';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: UpsertUser): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  updateLastLogin(id: string): Promise<void>;
  findAll(): Promise<User[]>;
}
