import { Context, Next } from 'hono';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  keyGenerator?: (c: Context) => string;  // Function to generate rate limit key
  handler?: (c: Context) => Response;     // Custom handler when rate limit exceeded
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// Note: This is per-worker instance. For distributed rate limiting, use Cloudflare KV or Durable Objects
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];

  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => rateLimitStore.delete(key));
}, 60000); // Cleanup every minute

/**
 * Rate limiting middleware using sliding window algorithm
 *
 * @param config - Rate limit configuration
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * app.use('/api/*', rateLimit({
 *   windowMs: 60000,      // 1 minute
 *   maxRequests: 100      // 100 requests per minute
 * }));
 * ```
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    handler = defaultHandler
  } = config;

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired entry
      entry = {
        count: 0,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, entry);
    }

    // Increment request count
    entry.count++;

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetTimeSeconds = Math.ceil(entry.resetTime / 1000);

    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', resetTimeSeconds.toString());

    // Check if rate limit exceeded
    if (entry.count > maxRequests) {
      console.warn(`Rate limit exceeded for key: ${key}, count: ${entry.count}`);
      return handler(c);
    }

    await next();
  };
}

/**
 * Default key generator - uses Worker-API-Key header
 * Falls back to IP address if header not present
 */
function defaultKeyGenerator(c: Context): string {
  // Use Worker-API-Key header as identifier (for authenticated requests)
  const apiKey = c.req.header('Worker-API-Key');
  if (apiKey) {
    return `apikey:${apiKey}`;
  }

  // Fall back to IP address
  const ip = c.req.header('CF-Connecting-IP') ||
              c.req.header('X-Forwarded-For') ||
              'unknown';
  return `ip:${ip}`;
}

/**
 * Default handler when rate limit is exceeded
 */
function defaultHandler(c: Context): Response {
  return c.json({
    Success: false,
    Message: 'Rate limit exceeded. Please try again later.',
    Code: 'RATE_LIMIT_EXCEEDED'
  }, 429);
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  // Strict rate limit for media uploads (10 uploads per minute)
  mediaUpload: rateLimit({
    windowMs: 60000,      // 1 minute
    maxRequests: 10
  }),

  // Moderate rate limit for API calls (60 requests per minute)
  api: rateLimit({
    windowMs: 60000,      // 1 minute
    maxRequests: 60
  }),

  // Lenient rate limit for reads (120 requests per minute)
  read: rateLimit({
    windowMs: 60000,      // 1 minute
    maxRequests: 120
  }),

  // Very strict for batch operations (5 batches per minute)
  batch: rateLimit({
    windowMs: 60000,      // 1 minute
    maxRequests: 5
  })
};
