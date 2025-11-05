
import type { Creative, InsertCreative } from '@shared/schema';

export interface ICreativeRepository {
  findById(id: string): Promise<Creative | null>;
  findByUser(userId: string): Promise<Creative[]>;
  findByCampaign(campaignId: string): Promise<Creative[]>;
  create(data: InsertCreative): Promise<Creative>;
  update(id: string, data: Partial<Creative>): Promise<Creative | null>;
  delete(id: string): Promise<boolean>;
}
