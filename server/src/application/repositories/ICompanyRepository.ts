export interface ICompanyRepository {
  create(data: CreateCompanyData): Promise<Company>;
  findById(id: string): Promise<Company | null>;
  findBySlug(slug: string): Promise<Company | null>;
}

export interface CreateCompanyData {
  name: string;
  slug: string;
  contactEmail?: string;
  contactPhone?: string;
  subscriptionPlan?: 'free' | 'starter' | 'professional' | 'enterprise';
  status?: 'active' | 'suspended' | 'trial' | 'cancelled';
  trialEndsAt?: Date;
  maxUsers?: number;
  maxCampaigns?: number;
  maxAuditsPerMonth?: number;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionPlan: string;
  contactEmail: string | null;
  contactPhone: string | null;
  trialEndsAt: Date | null;
  maxUsers: number;
  maxCampaigns: number;
  maxAuditsPerMonth: number;
  createdAt: Date;
  updatedAt: Date;
}
