
import { NotFoundError } from '../../core/errors/AppError';
import type { ICampaignRepository } from './campaign.repository.interface';
import type { InsertCampaign } from '@shared/schema';

export class CampaignService {
  constructor(private campaignRepository: ICampaignRepository) {}

  async getCampaignsByUser(userId: string) {
    return await this.campaignRepository.findByUser(userId);
  }

  async getCampaignById(id: string) {
    const campaign = await this.campaignRepository.findById(id);
    if (!campaign) {
      throw new NotFoundError('Campanha não encontrada');
    }
    return campaign;
  }

  async createCampaign(data: InsertCampaign) {
    return await this.campaignRepository.create(data);
  }

  async updateCampaign(id: string, data: Partial<InsertCampaign>) {
    const updated = await this.campaignRepository.update(id, data);
    if (!updated) {
      throw new NotFoundError('Campanha não encontrada');
    }
    return updated;
  }

  async deleteCampaign(id: string) {
    const deleted = await this.campaignRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('Campanha não encontrada');
    }
  }
}
