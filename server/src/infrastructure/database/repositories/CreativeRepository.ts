
import { eq } from 'drizzle-orm';
import { db } from '../connection';
import { creatives } from '../schema';
import type { Creative as CreativeEntity } from '../../../domain/entities/Creative';
import type { InsertCreative, Creative } from '../schema';

export interface ICreativeRepository {
  findById(id: string): Promise<CreativeEntity | null>;
  findByUser(userId: string): Promise<CreativeEntity[]>;
  findByCampaign(campaignId: string): Promise<CreativeEntity[]>;
  create(data: InsertCreative): Promise<CreativeEntity>;
  update(id: string, data: Partial<Creative>): Promise<CreativeEntity | null>;
  delete(id: string): Promise<boolean>;
}

export class CreativeRepository implements ICreativeRepository {
  private toDomain(data: any): CreativeEntity {
    return new (require('../../../domain/entities/Creative').Creative)(
      data.id,
      data.userId,
      data.campaignId,
      data.externalId,
      data.name,
      data.type,
      data.imageUrl,
      data.videoUrl,
      data.text,
      data.headline,
      data.description,
      data.callToAction,
      data.status,
      data.impressions,
      data.clicks,
      data.conversions,
      data.ctr,
      data.cpc,
      data.createdAt,
      data.updatedAt,
    );
  }

  async findById(id: string): Promise<CreativeEntity | null> {
    const [result] = await db.select().from(creatives).where(eq(creatives.id, id));
    return result ? this.toDomain(result) : null;
  }

  async findByUser(userId: string): Promise<CreativeEntity[]> {
    const results = await db.select().from(creatives).where(eq(creatives.userId, userId));
    return results.map(r => this.toDomain(r));
  }

  async findByCampaign(campaignId: string): Promise<CreativeEntity[]> {
    const results = await db.select().from(creatives).where(eq(creatives.campaignId, campaignId));
    return results.map(r => this.toDomain(r));
  }

  async create(data: InsertCreative): Promise<CreativeEntity> {
    const [result] = await db.insert(creatives).values(data).returning();
    return this.toDomain(result);
  }

  async update(id: string, data: Partial<Creative>): Promise<CreativeEntity | null> {
    const [result] = await db
      .update(creatives)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(creatives.id, id))
      .returning();
    return result ? this.toDomain(result) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(creatives).where(eq(creatives.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
