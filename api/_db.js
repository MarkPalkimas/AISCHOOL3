let client = null;

function getEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Missing KV_REST_API_URL/KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL/TOKEN)');
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
    async set(key, value) {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      return exec('set', key, payload);
    },
    async exists(key) {
      return exec('exists', key);
    },
    async sadd(key, value) {
      return exec('sadd', key, value);
    },
    async smembers(key) {
      return exec('smembers', key);
    },
    async scard(key) {
      return exec('scard', key);
    },
    async sismember(key, value) {
      return exec('sismember', key, value);
    }
  };
  return client;
}
