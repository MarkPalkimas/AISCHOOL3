import { kv } from '@vercel/kv';

export function getRedis() {
  // @vercel/kv reads KV_REST_API_URL / KV_REST_API_TOKEN automatically
  return kv;
}
