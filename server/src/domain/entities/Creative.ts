
export class Creative {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly campaignId: string | null,
    public readonly externalId: string | null,
    public readonly name: string,
    public readonly type: string,
    public readonly imageUrl: string | null,
    public readonly videoUrl: string | null,
    public readonly text: string | null,
    public readonly headline: string | null,
    public readonly description: string | null,
    public readonly callToAction: string | null,
    public readonly status: string,
    public readonly impressions: number,
    public readonly clicks: number,
    public readonly conversions: number,
    public readonly ctr: string,
    public readonly cpc: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date | null,
  ) {}

  isActive(): boolean {
    return this.status === 'active';
  }

  calculateCTR(): number {
    if (this.impressions === 0) return 0;
    return (this.clicks / this.impressions) * 100;
  }

  needsReview(): boolean {
    const ctr = parseFloat(this.ctr);
    return ctr < 1.0 || this.conversions < 5;
  }
}
