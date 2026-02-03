import { Redis } from '@upstash/redis';

let redisInstance = null;

export function getRedis() {
  if (redisInstance) return redisInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error('Missing Redis env vars (UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)');
  }

  redisInstance = new Redis({ url, token });
  return redisInstance;
}
