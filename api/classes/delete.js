import { getRedis } from '../_db.js';
import { verifyAuth } from '../_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const redis = getRedis();
        const userId = await verifyAuth(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const normalizedCode = code.toUpperCase().trim();

        // Check ownership
        const classData = await redis.get(`class:${normalizedCode}`);
        if (!classData) {
            return res.status(404).json({ error: 'Class not found' });
        }
        if (classData.teacherId !== userId) {
            return res.status(403).json({ error: 'Unauthorized (Not your class)' });
        }

        // Delete class data
        await redis.del(`class:${normalizedCode}`);

        // Remove from teacher's list
        await redis.srem(`teacher:${userId}:classes`, normalizedCode);

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
