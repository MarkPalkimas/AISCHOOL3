import { verifyAuth } from './_auth.js'
import { getClerkClient } from './_clerk.js'

const ALLOWED_ROLES = new Set(['student', 'teacher', 'admin'])

function trim(value) {
  return String(value || '').trim()
}

function normalizeRequestedRole(value) {
  const role = trim(value).toLowerCase()
  if (!role || role === 'none' || role === 'null') return null
  return ALLOWED_ROLES.has(role) ? role : undefined
}

function mergeRoleMetadata(metadata, role) {
  const next = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  if (role) {
    next.role = role
  } else {
    delete next.role
  }
  return next
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const authUserId = await verifyAuth(req)
    if (!authUserId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    let body = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        body = null
      }
    }

    const requestedUserId = trim(body?.userId)
    const requestedRole = normalizeRequestedRole(body?.role)
    const userId = requestedUserId || authUserId

    if (!userId) {
      res.status(400).json({ error: 'Missing userId' })
      return
    }

    if (requestedRole === undefined) {
      res.status(400).json({ error: 'Invalid role' })
      return
    }

    const clerkClient = getClerkClient()
    if (!clerkClient) {
      res.status(500).json({ error: 'Missing Clerk server key' })
      return
    }

    const authUser = requestedUserId && requestedUserId !== authUserId
      ? await clerkClient.users.getUser(authUserId)
      : null

    const authUserRole = trim(authUser?.publicMetadata?.role || authUser?.unsafeMetadata?.role).toLowerCase()
    if (requestedUserId && requestedUserId !== authUserId && authUserRole !== 'admin') {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const targetUser = await clerkClient.users.getUser(userId)
    const publicMetadata = mergeRoleMetadata(targetUser.publicMetadata, requestedRole)
    const unsafeMetadata = mergeRoleMetadata(targetUser.unsafeMetadata, requestedRole)

    await clerkClient.users.updateUser(userId, {
      publicMetadata,
      unsafeMetadata,
    })

    res.status(200).json({
      ok: true,
      userId,
      role: requestedRole,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to set role' })
  }
}
