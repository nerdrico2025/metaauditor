
export class Campaign {
  constructor(
    public readonly id: string,
    public readonly companyId: string | null,
    public readonly userId: string,
    public readonly integrationId: string,
    public readonly externalId: string,
    public readonly name: string,
    public readonly platform: string,
    public readonly status: string,
    public readonly budget: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date | null,
  ) {}

  isActive(): boolean {
    return this.status === 'active';
  }

  isPaused(): boolean {
    return this.status === 'paused';
  }

  belongsToCompany(companyId: string): boolean {
    return this.companyId === companyId;
  }
}
