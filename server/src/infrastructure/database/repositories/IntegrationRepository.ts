
import { eq } from 'drizzle-orm';
import { db } from '../connection';
import { integrations } from '../schema';
import type { Integration as IntegrationEntity } from '../../../domain/entities/Integration';
import type { InsertIntegration, Integration } from '../schema';

export interface IIntegrationRepository {
  findById(id: string): Promise<IntegrationEntity | null>;
  findByUser(userId: string): Promise<IntegrationEntity[]>;
  create(data: InsertIntegration): Promise<IntegrationEntity>;
  update(id: string, data: Partial<Integration>): Promise<IntegrationEntity | null>;
  delete(id: string): Promise<boolean>;
}

export class IntegrationRepository implements IIntegrationRepository {
  private toDomain(data: any): IntegrationEntity {
    return new (require('../../../domain/entities/Integration').Integration)(
      data.id,
      data.userId,
      data.platform,
      data.accessToken,
      data.refreshToken,
      data.accountId,
      data.status,
      data.lastSync,
      data.createdAt,
      data.updatedAt,
    );
  }

  async findById(id: string): Promise<IntegrationEntity | null> {
    const [result] = await db.select().from(integrations).where(eq(integrations.id, id));
    return result ? this.toDomain(result) : null;
  }

  async findByUser(userId: string): Promise<IntegrationEntity[]> {
    const results = await db.select().from(integrations).where(eq(integrations.userId, userId));
    return results.map(r => this.toDomain(r));
  }

  async create(data: InsertIntegration): Promise<IntegrationEntity> {
    const [result] = await db.insert(integrations).values(data).returning();
    return this.toDomain(result);
  }

  async update(id: string, data: Partial<Integration>): Promise<IntegrationEntity | null> {
    const [result] = await db
      .update(integrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(integrations.id, id))
      .returning();
    return result ? this.toDomain(result) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(integrations).where(eq(integrations.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
