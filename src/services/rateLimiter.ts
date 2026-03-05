export class RateLimiter {
  private readonly maxPerMinute: number;
  private readonly buckets = new Map<string, number[]>();

  constructor(maxPerMinute: number) {
    this.maxPerMinute = maxPerMinute;
  }

  allow(key: string, nowMs = Date.now()): boolean {
    const minuteAgo = nowMs - 60_000;
    const existing = this.buckets.get(key) ?? [];
    const recent = existing.filter((ts) => ts >= minuteAgo);

    if (recent.length >= this.maxPerMinute) {
      this.buckets.set(key, recent);
      return false;
    }

    recent.push(nowMs);
    this.buckets.set(key, recent);
    return true;
  }
}
