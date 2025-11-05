
import { NotFoundError } from '../../core/errors/AppError';
import type { ICreativeRepository } from './creative.repository.interface';
import type { InsertCreative } from '@shared/schema';

export class CreativeService {
  constructor(private creativeRepository: ICreativeRepository) {}

  async getCreativesByUser(userId: string) {
    return await this.creativeRepository.findByUser(userId);
  }

  async getCreativeById(id: string) {
    const creative = await this.creativeRepository.findById(id);
    if (!creative) {
      throw new NotFoundError('Criativo não encontrado');
    }
    return creative;
  }

  async getCreativesByCampaign(campaignId: string) {
    return await this.creativeRepository.findByCampaign(campaignId);
  }

  async createCreative(data: InsertCreative) {
    return await this.creativeRepository.create(data);
  }

  async updateCreative(id: string, data: Partial<InsertCreative>) {
    const updated = await this.creativeRepository.update(id, data);
    if (!updated) {
      throw new NotFoundError('Criativo não encontrado');
    }
    return updated;
  }

  async deleteCreative(id: string) {
    const deleted = await this.creativeRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('Criativo não encontrado');
    }
  }
}
