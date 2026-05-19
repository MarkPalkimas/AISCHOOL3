function getHeader(req, name) {
  if (!req) return null

  if (req.headers && typeof req.headers.get === 'function') {
    return req.headers.get(name)
  }

  const headers = req.headers || {}
  const direct =
    headers[name] ??
    headers[name.toLowerCase()] ??
    headers[name.toUpperCase()]

  if (Array.isArray(direct)) return direct[0] || null
  return typeof direct === 'string' ? direct : null
}

function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)

  if (typeof atob === 'function') return atob(padded)
  if (typeof Buffer !== 'undefined') return Buffer.from(padded, 'base64').toString('utf8')
  return ''
}

function extractUserIdFromAuthHeader(req) {
  const authHeader = getHeader(req, 'authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const token = authHeader.slice('Bearer '.length).trim()
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const decoded = JSON.parse(decodeBase64Url(parts[1]))
    if (typeof decoded?.sub === 'string' && decoded.sub.trim()) {
      return decoded.sub.trim()
    }
  } catch {
    return null
  }

  return null
}

function getRequestIp(req) {
  const forwardedFor = getHeader(req, 'x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0].trim()
    if (first) return first
  }

  const realIp = getHeader(req, 'x-real-ip')
  if (realIp) return realIp

  const cfIp = getHeader(req, 'cf-connecting-ip')
  if (cfIp) return cfIp

  const vercelForwarded = getHeader(req, 'x-vercel-forwarded-for')
  if (vercelForwarded) return vercelForwarded.split(',')[0].trim()

  if (typeof req?.ip === 'string' && req.ip.trim()) return req.ip.trim()
  return 'unknown'
}

export function getUserKey(req, userId) {
  const explicitUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : null
  const tokenUserId = explicitUserId || extractUserIdFromAuthHeader(req)

  if (tokenUserId) return `user:${tokenUserId}`
  return `ip:${getRequestIp(req)}`
}
