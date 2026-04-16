let client = null;

function getEnv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('Missing KV_REST_API_URL or KV_REST_API_TOKEN');
  }
  return { url, token };
}

async function exec(command, ...args) {
  const { url, token } = getEnv();
  const path = [command, ...args].map(a => encodeURIComponent(String(a))).join('/');
  const res = await fetch(`${url}/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `KV ${command} failed`);
  }

  const data = await res.json().catch(() => ({}));
  return data?.result;
}

function maybeParse(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function getRedis() {
  if (client) return client;
  client = {
    async get(key) {
      const res = await exec('get', key);
      return maybeParse(res);
    },
    async mget(keys) {
      if (!Array.isArray(keys) || keys.length === 0) return [];
      const res = await exec('mget', ...keys);
      return Array.isArray(res) ? res.map(maybeParse) : [];
    },
    async set(key, value) {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      return exec('set', key, payload);
    },
    async setex(key, ttlSeconds, value) {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      return exec('set', key, payload, 'EX', String(ttlSeconds));
    },
    async del(...keys) {
      if (keys.length === 0) return 0;
      return exec('del', ...keys);
    },
    async expire(key, ttlSeconds) {
      return exec('expire', key, String(ttlSeconds));
    },
    async exists(key) {
      return exec('exists', key);
    },
    async sadd(key, value) {
      return exec('sadd', key, value);
    },
    async srem(key, ...values) {
      if (values.length === 0) return 0;
      return exec('srem', key, ...values);
    },
    async smembers(key) {
      return exec('smembers', key);
    },
    async scard(key) {
      return exec('scard', key);
    },
    async sismember(key, value) {
      return exec('sismember', key, value);
    },
    async zadd(key, score, member) {
      return exec('zadd', key, String(score), member);
    },
    async zrem(key, ...members) {
      if (members.length === 0) return 0;
      return exec('zrem', key, ...members);
    },
    async zrevrange(key, start, stop) {
      const res = await exec('zrevrange', key, String(start), String(stop));
      return Array.isArray(res) ? res : [];
    }
  };
  return client;
}
