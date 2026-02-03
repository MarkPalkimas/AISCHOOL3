import { getRedis } from '../_db.js';
import { verifyAuth } from '../_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const redis = getRedis();
        const userId = await verifyAuth(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get list of class codes for student
        const joinedCodes = await redis.smembers(`user:${userId}:classes`);

        if (!joinedCodes || joinedCodes.length === 0) {
            return res.status(200).json([]);
        }

        const validClasses = [];
        await Promise.all(joinedCodes.map(async (code) => {
            const data = await redis.get(`class:${code}`);
            if (data) validClasses.push(data);
        }));

        return res.status(200).json(validClasses);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
