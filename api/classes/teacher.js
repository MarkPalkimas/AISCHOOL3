import { getRedis } from '../_db.js';
import { verifyAuth } from '../_auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const redis = await getRedis();
        const userId = await verifyAuth(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get list of class codes for teacher
        const classCodes = await redis.smembers(`teacher:${userId}:classes`);

        if (!classCodes || classCodes.length === 0) {
            return res.status(200).json([]);
        }

        // Fetch details for each class and enrollment count
        const validClasses = [];
        await Promise.all(classCodes.map(async (code) => {
            const data = await redis.get(`class:${code}`);
            if (data) {
                const count = await redis.scard(`class:${code}:students`);
                validClasses.push({ ...data, enrolledCount: count || 0 });
            }
        }));

        return res.status(200).json(validClasses);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message || 'Server error' });
    }
}
