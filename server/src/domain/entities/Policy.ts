
export class Policy {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly rules: any,
    public readonly performanceThresholds: any,
    public readonly status: string,
    public readonly isDefault: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date | null,
  ) {}

  isActive(): boolean {
    return this.status === 'active';
  }

  shouldAutoApprove(): boolean {
    return this.rules?.autoApproval === true;
  }
}
