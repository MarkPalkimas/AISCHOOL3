import { verifyToken } from '@clerk/clerk-sdk-node'
import { getClerkAuthorizedParties, getClerkServerConfig } from './_clerk.js'

function getHeader(req, name) {
  if (!req) return null

  if (req.headers && typeof req.headers.get === 'function') {
    return req.headers.get(name)
  }

  const headers = req.headers || {}
  const value =
    headers[name] ??
    headers[name.toLowerCase()] ??
    headers[name.toUpperCase()]

  if (Array.isArray(value)) return value[0] || null
  return typeof value === 'string' ? value : null
}

function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)

  if (typeof atob === 'function') return atob(padded)
  if (typeof Buffer !== 'undefined') return Buffer.from(padded, 'base64').toString('utf8')
  return ''
}

function getBearerToken(req) {
  const authHeader = getHeader(req, 'authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return ''
  return authHeader.slice('Bearer '.length).trim()
}

function decodeTokenSubject(token) {
  const parts = String(token || '').split('.')
  if (parts.length < 2) return null

  const decodedJson = decodeBase64Url(parts[1])
  const decoded = JSON.parse(decodedJson)
  return typeof decoded?.sub === 'string' && decoded.sub.trim() ? decoded.sub.trim() : null
}

function shouldUseStrictVerification() {
  const vercelEnv = String(process.env.VERCEL_ENV || '').trim().toLowerCase()
  if (vercelEnv) {
    return vercelEnv === 'production' || vercelEnv === 'preview'
  }

  return process.env.NODE_ENV === 'production'
}

export async function verifyAuth(req) {
  try {
    const token = getBearerToken(req)
    if (!token) return null

    const strictVerification = shouldUseStrictVerification()
    const { secretKey, jwtKey } = getClerkServerConfig()

    if (!strictVerification && !jwtKey) {
      return decodeTokenSubject(token)
    }

    if (secretKey || jwtKey) {
      try {
        const authorizedParties = getClerkAuthorizedParties(req)
        const verified = await verifyToken(token, {
          ...(secretKey ? { secretKey } : {}),
          ...(jwtKey ? { jwtKey } : {}),
          ...(authorizedParties.length > 0 ? { authorizedParties } : {}),
        })

        if (typeof verified?.sub === 'string' && verified.sub.trim()) {
          return verified.sub.trim()
        }
      } catch (error) {
        if (strictVerification) {
          console.error('Strict auth verification failed:', error)
          return null
        }
      }
    }

    return decodeTokenSubject(token)
  } catch (error) {
    console.error('Auth verification failed:', error)
    return null
  }
}
