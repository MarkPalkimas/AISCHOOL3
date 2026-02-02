import { redis } from '../_db.js';
import { verifyAuth } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await verifyAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const code = (req.method === 'GET' ? req.query?.code : req.body?.code) || '';
    if (!code) return res.status(400).json({ error: 'Missing class code' });

    const normalizedCode = code.toUpperCase().trim();
    const classKey = `class:${normalizedCode}`;

    const classData = await redis.get(classKey);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const isTeacher = classData.teacherId === userId;
    const isStudent = await redis.sismember(`class:${normalizedCode}:students`, userId);

    if (!isTeacher && !isStudent) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({ materials: classData.materials || [] });
    }

    // POST: teacher updates materials
    if (!isTeacher) {
      return res.status(403).json({ error: 'Only teachers can update materials' });
    }

    const materials = Array.isArray(req.body?.materials) ? req.body.materials : [];

    const updated = {
      ...classData,
      materials
    };

    await redis.set(classKey, updated);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
