import { getRedis } from '../_db.js';
import { verifyAuth } from '../_auth.js';
import { purgeUserClassConversations } from '../_chatStore.js';

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

        const { code } = req.body || {};
        if (!code) {
            return res.status(400).json({ error: 'Missing class code' });
        }

        const normalizedCode = code.toUpperCase().trim();
        const classData = await redis.get(`class:${normalizedCode}`);

        if (classData?.teacherId === userId) {
            return res.status(403).json({ error: 'Teachers must use Delete Class for classes they created' });
        }

        await Promise.all([
            redis.srem(`user:${userId}:classes`, normalizedCode),
            redis.srem(`class:${normalizedCode}:students`, userId),
            purgeUserClassConversations({ userId, classCode: normalizedCode }),
        ]);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message || 'Server error' });
    }
}
