import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../../repositories/IUserRepository.js';
import { ICompanyRepository } from '../../repositories/ICompanyRepository.js';
import { Email } from '../../../domain/value-objects/Email.js';
import { BadRequestException } from '../../../shared/errors/AppException.js';

export interface RegisterDTO {
  fullName: string;
  email: string;
  password: string;
  company: string;
  phone: string;
  plan: string;
}

export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    companyId: string;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    trialEndsAt: Date;
  };
  token: string;
}

export class RegisterUseCase {
  constructor(
    private userRepository: IUserRepository,
    private companyRepository: ICompanyRepository
  ) {}

  async execute(data: RegisterDTO): Promise<RegisterResponse> {
    const email = new Email(data.email);

    const existingUser = await this.userRepository.findByEmail(email.toString());
    if (existingUser) {
      throw new BadRequestException('Email já cadastrado');
    }

    const nameParts = data.fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const companySlug = data.company
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const existingCompany = await this.companyRepository.findBySlug(companySlug);
    if (existingCompany) {
      throw new BadRequestException('Já existe uma empresa com este nome');
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 3);

    const planLimits = this.getPlanLimits(data.plan);

    const company = await this.companyRepository.create({
      name: data.company,
      slug: companySlug,
      contactEmail: data.email,
      contactPhone: data.phone,
      subscriptionPlan: 'free',
      status: 'trial',
      trialEndsAt,
      ...planLimits,
    });

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await this.userRepository.create({
      email: email.toString(),
      password: hashedPassword,
      firstName,
      lastName,
      role: 'company_admin',
      companyId: company.id,
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role,
        companyId: user.companyId || '',
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        trialEndsAt: company.trialEndsAt || trialEndsAt,
      },
      token,
    };
  }

  private getPlanLimits(plan: string): { maxUsers: number; maxCampaigns: number; maxAuditsPerMonth: number } {
    const planMap: Record<string, { maxUsers: number; maxCampaigns: number; maxAuditsPerMonth: number }> = {
      bronze: { maxUsers: 3, maxCampaigns: 5, maxAuditsPerMonth: 100 },
      prata: { maxUsers: 10, maxCampaigns: 15, maxAuditsPerMonth: 300 },
      ouro: { maxUsers: 20, maxCampaigns: 25, maxAuditsPerMonth: 500 },
      diamante: { maxUsers: 50, maxCampaigns: 50, maxAuditsPerMonth: 1000 },
      customizado: { maxUsers: 100, maxCampaigns: 100, maxAuditsPerMonth: 5000 },
    };

    return planMap[plan.toLowerCase()] || planMap.bronze;
  }
}
