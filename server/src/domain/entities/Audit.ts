
export class Audit {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly creativeId: string,
    public readonly policyId: string | null,
    public readonly status: string,
    public readonly complianceScore: string,
    public readonly performanceScore: string,
    public readonly issues: any,
    public readonly recommendations: any,
    public readonly aiAnalysis: any,
    public readonly createdAt: Date,
  ) {}

  isCompliant(): boolean {
    return this.status === 'compliant';
  }

  hasIssues(): boolean {
    return Array.isArray(this.issues) && this.issues.length > 0;
  }

  getOverallScore(): number {
    const compliance = parseFloat(this.complianceScore) || 0;
    const performance = parseFloat(this.performanceScore) || 0;
    return (compliance + performance) / 2;
  }
}
