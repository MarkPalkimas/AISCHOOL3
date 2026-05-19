import { createClerkClient } from '@clerk/clerk-sdk-node'

let cachedClient = null
let cachedClientKey = ''

function normalize(value) {
  return String(value || '').trim()
}

function pickFirst(...values) {
  for (const value of values) {
    const normalized = normalize(value)
    if (normalized) return normalized
  }

  return ''
}

function getHeader(req, name) {
  if (!req) return ''

  if (req.headers && typeof req.headers.get === 'function') {
    return normalize(req.headers.get(name))
  }

  const headers = req.headers || {}
  const value =
    headers[name] ??
    headers[name.toLowerCase()] ??
    headers[name.toUpperCase()]

  if (Array.isArray(value)) return normalize(value[0])
  return normalize(value)
}

function isLocalHost(host) {
  const normalizedHost = normalize(host).toLowerCase()
  return normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost.startsWith('localhost:') ||
    normalizedHost.startsWith('127.0.0.1:')
}

export function getClerkServerConfig() {
  return {
    secretKey: pickFirst(process.env.CLERK_SECRET_KEY),
    jwtKey: pickFirst(process.env.CLERK_JWT_KEY),
    proxyUrl: pickFirst(process.env.CLERK_PROXY_URL),
    domain: pickFirst(process.env.CLERK_DOMAIN),
  }
}

export function getRequestOrigin(req) {
  const explicitOrigin = getHeader(req, 'origin')
  if (explicitOrigin) return explicitOrigin

  const referer = getHeader(req, 'referer')
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      // ignore malformed referer headers
    }
  }

  const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host')
  if (!host) return ''

  const proto = getHeader(req, 'x-forwarded-proto') || (isLocalHost(host) ? 'http' : 'https')
  return `${proto}://${host}`
}

export function getClerkAuthorizedParties(req) {
  const requestOrigin = getRequestOrigin(req)
  const candidates = [
    process.env.CLERK_AUTHORIZED_PARTIES,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    requestOrigin,
  ]

  const values = candidates
    .flatMap((candidate) => normalize(candidate).split(','))
    .map((value) => normalize(value))
    .filter(Boolean)

  return [...new Set(values)]
}

export function getClerkClient() {
  const { secretKey, proxyUrl, domain } = getClerkServerConfig()

  if (!secretKey) return null

  const cacheKey = JSON.stringify({ secretKey, proxyUrl, domain })
  if (cachedClient && cachedClientKey === cacheKey) {
    return cachedClient
  }

  cachedClientKey = cacheKey
  cachedClient = createClerkClient({
    secretKey,
    ...(proxyUrl ? { proxyUrl } : {}),
    ...(domain ? { domain } : {}),
  })

  return cachedClient
}
