import { getRedis } from '../_db.js';
import { verifyAuth } from '../_auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const redis = await getRedis();
        const userId = await verifyAuth(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Missing class code' });
        }

        const normalizedCode = code.toUpperCase().trim();

        // Check if class exists
        const classExists = await redis.exists(`class:${normalizedCode}`);
        if (!classExists) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // Add student to class
        await redis.sadd(`class:${normalizedCode}:students`, userId);

        // Add class to student's list
        await redis.sadd(`user:${userId}:classes`, normalizedCode);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
