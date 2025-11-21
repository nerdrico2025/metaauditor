import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { companies } from '../../../../drizzle/schema.js';
import { ICompanyRepository, CreateCompanyData, Company } from '../../../application/repositories/ICompanyRepository.js';

export class CompanyRepository implements ICompanyRepository {
  async create(data: CreateCompanyData): Promise<Company> {
    const result = await db.insert(companies).values(data).returning();
    return this.toDomain(result[0]);
  }

  async findById(id: string): Promise<Company | null> {
    const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return result.length > 0 ? this.toDomain(result[0]) : null;
  }

  async findBySlug(slug: string): Promise<Company | null> {
    const result = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
    return result.length > 0 ? this.toDomain(result[0]) : null;
  }

  private toDomain(data: any): Company {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      status: data.status,
      subscriptionPlan: data.subscriptionPlan,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      trialEndsAt: data.trialEndsAt,
      maxUsers: data.maxUsers,
      maxCampaigns: data.maxCampaigns,
      maxAuditsPerMonth: data.maxAuditsPerMonth,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}
