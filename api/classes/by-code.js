import { getRedis } from '../_db.js';
import { verifyAuth } from '../_auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.query; // Node.js req.query

    if (!code) {
        return res.status(400).json({ error: 'Missing code' });
    }

    const normalizedCode = code.toUpperCase().trim();

    // Validate auth
    const userId = await verifyAuth(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const redis = getRedis();
        const classData = await redis.get(`class:${normalizedCode}`);
        if (classData) {
            return res.status(200).json(classData);
        } else {
            return res.status(404).json({ error: 'Class not found' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
