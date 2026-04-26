import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

let ratelimit: Ratelimit | null = null;

try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    ratelimit = new Ratelimit({
      redis: kv as any,  // ← 加了个 as any，绕过类型冲突
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
    });
    console.log('✅ Rate limiter enabled');
  }
} catch {
  console.warn('⚠️ KV not configured, rate limiting disabled (safe for dev)');
}

export async function rateLimit(identifier: string) {
  if (!ratelimit) {
    return { success: true, limit: 999, remaining: 999, reset: 0 };
  }
  return ratelimit.limit(identifier);
}