/**
 * Simple rate limiter
 * In production, use Cloudflare Rate Limiting or Durable Objects
 */
export class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  check(identifier) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        reset: validRequests[0] + this.windowMs,
      };
    }

    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    return {
      allowed: true,
      remaining: this.maxRequests - validRequests.length,
      reset: now + this.windowMs,
    };
  }

  reset(identifier) {
    this.requests.delete(identifier);
  }
}
