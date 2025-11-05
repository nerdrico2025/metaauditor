
import { UserRole } from '../../../shared/schema';

export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly firstName: string | null,
    public readonly lastName: string | null,
    public readonly role: UserRole,
    public readonly companyId: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date | null,
    public readonly lastLoginAt: Date | null,
  ) {}

  get fullName(): string {
    if (!this.firstName && !this.lastName) return this.email;
    return `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }

  isSuperAdmin(): boolean {
    return this.role === 'super_admin';
  }

  isCompanyAdmin(): boolean {
    return this.role === 'company_admin';
  }

  canAccessCompany(companyId: string): boolean {
    if (this.isSuperAdmin()) return true;
    return this.companyId === companyId;
  }
}
