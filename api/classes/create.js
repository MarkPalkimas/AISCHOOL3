import { redis } from '../_db.js';
import { verifyAuth } from '../_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { code, className, subject } = req.body;

        if (!code || !className) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const normalizedCode = code.toUpperCase().trim();

        // Check if code exists
        const existing = await redis.exists(`class:${normalizedCode}`);
        if (existing) {
            return res.status(409).json({ error: 'Class code collision, try again' });
        }

        const newClass = {
            code: normalizedCode,
            name: className.trim(),
            subject: (subject || '').trim(),
            teacherId: userId,
            createdAt: new Date().toISOString(),
            materials: []
        };

        // Store class data
        await redis.set(`class:${normalizedCode}`, newClass);

        // Add to teacher's list
        await redis.sadd(`teacher:${userId}:classes`, normalizedCode);

        return res.status(200).json(newClass);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
