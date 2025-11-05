
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import { campaigns } from '@shared/schema';
import type { Campaign, InsertCampaign } from '@shared/schema';
import type { ICampaignRepository } from './campaign.repository.interface';

export class CampaignRepository implements ICampaignRepository {
  async findById(id: string): Promise<Campaign | null> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || null;
  }

  async findByUser(userId: string): Promise<Campaign[]> {
    return await db.select().from(campaigns).where(eq(campaigns.userId, userId));
  }

  async create(data: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db.insert(campaigns).values(data).returning();
    return campaign;
  }

  async update(id: string, data: Partial<Campaign>): Promise<Campaign | null> {
    const [updated] = await db
      .update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    
    return updated || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(campaigns).where(eq(campaigns.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
