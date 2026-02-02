import { redis } from '../_db.js';
import { verifyAuth } from '../_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
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
        // Use pipeline for efficiency? Or basic Promise.all
        const pipeline = redis.pipeline();
        classCodes.forEach(code => {
            pipeline.get(`class:${code}`);
            pipeline.scard(`class:${code}:students`);
        });

        const results = await pipeline.exec();

        const classes = [];
        // Results come in pairs: [error, result] for each command in pipeline? 
        // Upstash pipeline exec returns array of results directly if no errors thrown, 
        // or sometimes [err, res] depending on client. Upstash/redis usually returns result array.
        // Let's verify standard @upstash/redis behavior: returns plain array of results.

        // Actually, simple Promise.all is safer if we aren't 100% on pipeline return format in this context
        // but pure Redis pipeline is better. Let's stick to Promise.all for certainty in this critical fix.

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
        return res.status(500).json({ error: error.message });
    }
}
