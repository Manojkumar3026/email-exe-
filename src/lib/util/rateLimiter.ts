/** Simple token-bucket limiter, one instance per account+provider to respect per-user quotas. */
export class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    this.tokens = capacity;
    this.lastRefillAt = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillAt) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefillAt = now;
  }

  async take(cost = 1): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= cost) {
        this.tokens -= cost;
        return;
      }
      const deficit = cost - this.tokens;
      const waitMs = Math.ceil((deficit / this.refillPerSecond) * 1000);
      await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 20)));
    }
  }
}

const buckets = new Map<string, TokenBucket>();

export function getBucket(key: string, capacity: number, refillPerSecond: number): TokenBucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = new TokenBucket(capacity, refillPerSecond);
    buckets.set(key, bucket);
  }
  return bucket;
}
