
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { creatives } from '@shared/schema';
import type { Creative, InsertCreative } from '@shared/schema';
import type { ICreativeRepository } from './creative.repository.interface';

export class CreativeRepository implements ICreativeRepository {
  async findById(id: string): Promise<Creative | null> {
    const [creative] = await db.select().from(creatives).where(eq(creatives.id, id));
    return creative || null;
  }

  async findByUser(userId: string): Promise<Creative[]> {
    return await db.select().from(creatives).where(eq(creatives.userId, userId));
  }

  async findByCampaign(campaignId: string): Promise<Creative[]> {
    return await db.select().from(creatives).where(eq(creatives.campaignId, campaignId));
  }

  async create(data: InsertCreative): Promise<Creative> {
    const [creative] = await db.insert(creatives).values(data).returning();
    return creative;
  }

  async update(id: string, data: Partial<Creative>): Promise<Creative | null> {
    const [updated] = await db
      .update(creatives)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(creatives.id, id))
      .returning();
    
    return updated || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(creatives).where(eq(creatives.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
