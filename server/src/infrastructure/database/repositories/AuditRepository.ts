
import { eq, desc } from 'drizzle-orm';
import { db } from '../../../../db';
import { audits } from '../../../../../shared/schema';
import type { Audit as AuditEntity } from '../../../domain/entities/Audit';
import type { InsertAudit, Audit } from '../../../../../shared/schema';

export interface IAuditRepository {
  findById(id: string): Promise<AuditEntity | null>;
  findByUser(userId: string): Promise<AuditEntity[]>;
  findByCreative(creativeId: string): Promise<AuditEntity[]>;
  getRecent(userId: string, limit?: number): Promise<AuditEntity[]>;
  create(data: InsertAudit): Promise<AuditEntity>;
  delete(id: string): Promise<boolean>;
}

export class AuditRepository implements IAuditRepository {
  private toDomain(data: any): AuditEntity {
    return new (require('../../../domain/entities/Audit').Audit)(
      data.id,
      data.userId,
      data.creativeId,
      data.policyId,
      data.status,
      data.complianceScore,
      data.performanceScore,
      data.issues,
      data.recommendations,
      data.aiAnalysis,
      data.createdAt,
    );
  }

  async findById(id: string): Promise<AuditEntity | null> {
    const [result] = await db.select().from(audits).where(eq(audits.id, id));
    return result ? this.toDomain(result) : null;
  }

  async findByUser(userId: string): Promise<AuditEntity[]> {
    const results = await db.select().from(audits)
      .where(eq(audits.userId, userId))
      .orderBy(desc(audits.createdAt));
    return results.map(r => this.toDomain(r));
  }

  async findByCreative(creativeId: string): Promise<AuditEntity[]> {
    const results = await db.select().from(audits)
      .where(eq(audits.creativeId, creativeId))
      .orderBy(desc(audits.createdAt));
    return results.map(r => this.toDomain(r));
  }

  async getRecent(userId: string, limit: number = 10): Promise<AuditEntity[]> {
    const results = await db.select().from(audits)
      .where(eq(audits.userId, userId))
      .orderBy(desc(audits.createdAt))
      .limit(limit);
    return results.map(r => this.toDomain(r));
  }

  async create(data: InsertAudit): Promise<AuditEntity> {
    const [result] = await db.insert(audits).values(data).returning();
    return this.toDomain(result);
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(audits).where(eq(audits.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
