import { clerkClient } from '@clerk/clerk-sdk-node'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch {}
    }

    const { userId, role } = body || {}

    if (!userId) {
      res.status(400).json({ error: 'Missing userId' })
      return
    }

    if (!['student', 'teacher', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' })
      return
    }

    await clerkClient.users.updateUser(userId, {
      publicMetadata: { role },
    })

    res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to set role' })
  }
}
