
export class Integration {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly platform: string,
    public readonly accessToken: string | null,
    public readonly refreshToken: string | null,
    public readonly accountId: string | null,
    public readonly status: string,
    public readonly lastSync: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date | null,
  ) {}

  isActive(): boolean {
    return this.status === 'active';
  }

  needsSync(): boolean {
    if (!this.lastSync) return true;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.lastSync < oneDayAgo;
  }
}
