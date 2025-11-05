
import type { Campaign, InsertCampaign } from '@shared/schema';

export interface ICampaignRepository {
  findById(id: string): Promise<Campaign | null>;
  findByUser(userId: string): Promise<Campaign[]>;
  create(data: InsertCampaign): Promise<Campaign>;
  update(id: string, data: Partial<Campaign>): Promise<Campaign | null>;
  delete(id: string): Promise<boolean>;
}
