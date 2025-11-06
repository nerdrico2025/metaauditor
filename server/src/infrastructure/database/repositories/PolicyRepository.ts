
import { eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { policies } from '../../../../../shared/schema';
import type { Policy as PolicyEntity } from '../../../domain/entities/Policy';
import type { InsertPolicy, Policy } from '../../../../../shared/schema';

export interface IPolicyRepository {
  findById(id: string): Promise<PolicyEntity | null>;
  findByUser(userId: string): Promise<PolicyEntity[]>;
  create(data: InsertPolicy): Promise<PolicyEntity>;
  update(id: string, data: Partial<Policy>): Promise<PolicyEntity | null>;
  delete(id: string): Promise<boolean>;
}

export class PolicyRepository implements IPolicyRepository {
  private toDomain(data: any): PolicyEntity {
    return new (require('../../../domain/entities/Policy').Policy)(
      data.id,
      data.userId,
      data.name,
      data.description,
      data.rules,
      data.performanceThresholds,
      data.status,
      data.isDefault,
      data.createdAt,
      data.updatedAt,
    );
  }

  async findById(id: string): Promise<PolicyEntity | null> {
    const [result] = await db.select().from(policies).where(eq(policies.id, id));
    return result ? this.toDomain(result) : null;
  }

  async findByUser(userId: string): Promise<PolicyEntity[]> {
    const results = await db.select().from(policies).where(eq(policies.userId, userId));
    return results.map(r => this.toDomain(r));
  }

  async create(data: InsertPolicy): Promise<PolicyEntity> {
    const [result] = await db.insert(policies).values(data).returning();
    return this.toDomain(result);
  }

  async update(id: string, data: Partial<Policy>): Promise<PolicyEntity | null> {
    const [result] = await db
      .update(policies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(policies.id, id))
      .returning();
    return result ? this.toDomain(result) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(policies).where(eq(policies.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
