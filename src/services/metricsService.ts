type MetricsSnapshot = {
  requestCount: number;
  healthCount: number;
  shortenCount: number;
  redirectCount: number;
  analyticsCount: number;
  uptimeSeconds: number;
  startedAt: string;
};

class MetricsService {
  private readonly _startedAt = new Date();
  private requestCount = 0;
  private healthCount = 0;
  private shortenCount = 0;
  private redirectCount = 0;
  private analyticsCount = 0;

  public incrementRequest(): void {
    this.requestCount += 1;
  }

  public incrementHealth(): void {
    this.healthCount += 1;
  }

  public incrementShorten(): void {
    this.shortenCount += 1;
  }

  public incrementRedirect(): void {
    this.redirectCount += 1;
  }

  public incrementAnalytics(): void {
    this.analyticsCount += 1;
  }

  public startedAt(): string {
    return this._startedAt.toISOString();
  }

  public snapshot(): MetricsSnapshot {
    return {
      requestCount: this.requestCount,
      healthCount: this.healthCount,
      shortenCount: this.shortenCount,
      redirectCount: this.redirectCount,
      analyticsCount: this.analyticsCount,
      uptimeSeconds: Math.floor(process.uptime()),
      startedAt: this._startedAt.toISOString(),
    };
  }
}

export const metricsService = new MetricsService();
