import { getRedis } from '../_db.js';

export const config = { runtime: 'nodejs' };

// Public endpoint? Or auth protected? 
// storage.js implementation of `getEnrolledCount` does NOT pass token.
// So this one remains public or we need to fix storage.js to pass token.
// But wait, `getEnrolledCount` is mostly used by Teacher who IS authed.
// Let's check storage.js:
// `export async function getEnrolledCount(classCode) { ... fetch ... }`
// It does NOT use authedFetch in my previous edit.
// I should update it to use authedFetch OR allow public access here.
// Safest is to allow public access for now as it just returns a number.

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    try {
        const redis = await getRedis();
        const count = await redis.scard(`class:${code.toUpperCase().trim()}:students`);
        return res.status(200).json({ count: count || 0 });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
