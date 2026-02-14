import { getUserKey } from './requestKey.js'

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000
const RATE_WINDOW_SECONDS = 60
const LOCK_TTL_SECONDS = 30
const LOCK_TTL_MS = LOCK_TTL_SECONDS * 1000
const MAX_USER_MESSAGE_CHARS = 4000
const MAX_TOP_K = 8
const MAX_CONTEXT_CHARS = 20_000
const OPENAI_MAX_ATTEMPTS = 5
const OPENAI_BASE_BACKOFF_MS = 250

const memoryRateWindows = new Map()
const memoryLocks = new Map()
let warnedMemoryFallback = false

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

async function runRedisPipeline(commands) {
  const cfg = getRedisConfig()
  if (!cfg) return null

  const response = await fetch(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.token}`,
    },
    body: JSON.stringify(commands),
  })

  if (!response.ok) {
    throw new Error(`Upstash pipeline failed: ${response.status}`)
  }

  const data = await response.json()
  if (!Array.isArray(data)) {
    throw new Error('Invalid Upstash pipeline response')
  }
  return data
}

function getPipelineResult(pipelineResponse, index) {
  const item = pipelineResponse?.[index]
  if (!item || typeof item !== 'object') return null
  if (Object.prototype.hasOwnProperty.call(item, 'error') && item.error) {
    throw new Error(String(item.error))
  }
  return item.result
}

function logFallback(routeName, reason) {
  if (warnedMemoryFallback) return
  warnedMemoryFallback = true
  // WARNING: In-memory fallback is process-local and should only be used when Redis is unavailable.
  console.warn(JSON.stringify({
    event: 'ai_guard_fallback',
    route: routeName,
    mode: 'memory',
    reason,
  }))
}

function toSafeText(value) {
  return typeof value === 'string' ? value : String(value || '')
}

function safeTruncate(text, maxChars) {
  const chars = Array.from(toSafeText(text))
  if (chars.length <= maxChars) return toSafeText(text)
  return chars.slice(0, maxChars).join('')
}

function clampStructuredContext(text) {
  const raw = toSafeText(text)
  const startLabel = 'MATERIALS_CONTEXT:'
  const endLabel = 'END_MATERIALS_CONTEXT'

  const startIndex = raw.indexOf(startLabel)
  if (startIndex === -1) return safeTruncate(raw, MAX_CONTEXT_CHARS)

  const contextStart = startIndex + startLabel.length
  const endIndex = raw.indexOf(endLabel, contextStart)
  if (endIndex === -1) return safeTruncate(raw, MAX_CONTEXT_CHARS)

  const prefix = raw.slice(0, contextStart)
  const context = raw.slice(contextStart, endIndex)
  const suffix = raw.slice(endIndex)

  return `${prefix}${safeTruncate(context, MAX_CONTEXT_CHARS)}${suffix}`
}

function clampTopKValue(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return MAX_TOP_K
  if (n <= 0) return 1
  return Math.min(MAX_TOP_K, Math.floor(n))
}

function getTextLength(value) {
  return Array.from(toSafeText(value)).length
}

function extractStudentQuestion(content) {
  const raw = toSafeText(content)
  const marker = 'STUDENT_QUESTION:'
  const markerIndex = raw.lastIndexOf(marker)
  if (markerIndex === -1) return raw
  return raw.slice(markerIndex + marker.length).trim()
}

function getUserContentText(content) {
  if (typeof content === 'string') {
    return [extractStudentQuestion(content)]
  }

  if (Array.isArray(content)) {
    const out = []
    for (const item of content) {
      if (typeof item?.text === 'string') out.push(extractStudentQuestion(item.text))
      else if (typeof item?.content === 'string') out.push(extractStudentQuestion(item.content))
    }
    return out
  }

  if (content && typeof content === 'object' && typeof content.text === 'string') {
    return [extractStudentQuestion(content.text)]
  }

  return []
}

function isUserMessageTooLong(body) {
  if (!body || typeof body !== 'object') return false

  const candidates = []
  if (typeof body.message === 'string') candidates.push(body.message)

  if (Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (!msg || msg.role !== 'user') continue
      candidates.push(...getUserContentText(msg.content))
    }
  }

  for (const text of candidates) {
    if (getTextLength(text) > MAX_USER_MESSAGE_CHARS) return true
  }

  return false
}

function hasProcessingSignal(body) {
  if (!body || typeof body !== 'object') return false

  const booleanFlags = [
    'materialsProcessing',
    'isProcessing',
    'processingMaterials',
    'pendingEmbeddings',
    'pendingChunks',
    'pendingExtraction',
    'pdfExtractionInProgress',
    'chunkingInProgress',
    'embeddingInProgress',
  ]

  for (const flag of booleanFlags) {
    if (body[flag] === true) return true
  }

  const statusLike = [
    body.materialStatus,
    body.processingStatus,
    body.status,
  ]

  for (const value of statusLike) {
    if (typeof value === 'string' && /processing|extracting|chunking|embedding/i.test(value)) {
      return true
    }
  }

  return false
}

function createLockToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function acquireRedisLock(userKey, lockToken) {
  const lockKey = `ai:lock:${userKey}`
  const setRes = await runRedisPipeline([
    ['SET', lockKey, lockToken, 'NX', 'EX', String(LOCK_TTL_SECONDS)],
  ])
  const acquired = getPipelineResult(setRes, 0) === 'OK'

  if (!acquired) {
    return { ok: false, release: async () => {} }
  }

  return {
    ok: true,
    release: async () => {
      try {
        const getRes = await runRedisPipeline([['GET', lockKey]])
        const existing = getPipelineResult(getRes, 0)
        if (existing !== lockToken) return
        await runRedisPipeline([['DEL', lockKey]])
      } catch (error) {
        console.warn(JSON.stringify({
          event: 'ai_lock_release_error',
          userKey,
          error: String(error),
        }))
      }
    },
  }
}

async function checkRedisRateLimit(userKey) {
  const rateKey = `ai:rl:${userKey}`
  const now = Date.now()
  const cutoff = now - RATE_WINDOW_MS

  const countRes = await runRedisPipeline([
    ['ZREMRANGEBYSCORE', rateKey, '-inf', String(cutoff)],
    ['ZCARD', rateKey],
    ['EXPIRE', rateKey, String(RATE_WINDOW_SECONDS + 5)],
  ])

  const count = Number(getPipelineResult(countRes, 1) || 0)
  if (count >= RATE_LIMIT) {
    return { ok: false }
  }

  await runRedisPipeline([
    ['ZADD', rateKey, String(now), `${now}-${Math.random().toString(36).slice(2, 10)}`],
    ['EXPIRE', rateKey, String(RATE_WINDOW_SECONDS + 5)],
  ])

  return { ok: true }
}

function acquireMemoryLock(userKey, lockToken) {
  const now = Date.now()
  const current = memoryLocks.get(userKey)
  if (current && current.expiresAt > now) {
    return { ok: false, release: async () => {} }
  }

  memoryLocks.set(userKey, {
    token: lockToken,
    expiresAt: now + LOCK_TTL_MS,
  })

  return {
    ok: true,
    release: async () => {
      const active = memoryLocks.get(userKey)
      if (active?.token === lockToken) {
        memoryLocks.delete(userKey)
      }
    },
  }
}

function checkMemoryRateLimit(userKey) {
  const now = Date.now()
  const cutoff = now - RATE_WINDOW_MS
  const existing = memoryRateWindows.get(userKey) || []
  const recent = existing.filter((ts) => ts > cutoff)

  if (recent.length >= RATE_LIMIT) {
    memoryRateWindows.set(userKey, recent)
    return { ok: false }
  }

  recent.push(now)
  memoryRateWindows.set(userKey, recent)
  return { ok: true }
}

async function acquireUserLock(userKey, routeName, lockToken) {
  if (getRedisConfig()) {
    try {
      return await acquireRedisLock(userKey, lockToken)
    } catch (error) {
      logFallback(routeName, `redis_lock_error:${String(error)}`)
    }
  } else {
    logFallback(routeName, 'redis_not_configured')
  }

  return acquireMemoryLock(userKey, lockToken)
}

async function checkUserRateLimit(userKey, routeName) {
  if (getRedisConfig()) {
    try {
      return await checkRedisRateLimit(userKey)
    } catch (error) {
      logFallback(routeName, `redis_rate_limit_error:${String(error)}`)
    }
  } else {
    logFallback(routeName, 'redis_not_configured')
  }

  return checkMemoryRateLimit(userKey)
}

export async function guardAiRequest(options = {}) {
  const req = options.req
  const body = options.body || {}
  const routeName = options.routeName || '/api/chat'
  const resolvedUserKey = options.userKey || getUserKey(req)
  const noopRelease = async () => {}

  if (isUserMessageTooLong(body)) {
    return {
      ok: false,
      status: 400,
      message: 'Message too long.',
      userKey: resolvedUserKey,
      release: noopRelease,
      clampTopK: clampTopKValue,
      clampContext: clampStructuredContext,
    }
  }

  if (hasProcessingSignal(body)) {
    return {
      ok: false,
      status: 409,
      message: 'Materials still processing.',
      userKey: resolvedUserKey,
      release: noopRelease,
      clampTopK: clampTopKValue,
      clampContext: clampStructuredContext,
    }
  }

  const lockToken = createLockToken()
  const lock = await acquireUserLock(resolvedUserKey, routeName, lockToken)
  if (!lock.ok) {
    return {
      ok: false,
      status: 429,
      message: 'Another AI request is in progress.',
      userKey: resolvedUserKey,
      release: noopRelease,
      clampTopK: clampTopKValue,
      clampContext: clampStructuredContext,
    }
  }

  const rateLimit = await checkUserRateLimit(resolvedUserKey, routeName)
  if (!rateLimit.ok) {
    await lock.release()
    return {
      ok: false,
      status: 429,
      message: 'Rate limit exceeded.',
      userKey: resolvedUserKey,
      release: noopRelease,
      clampTopK: clampTopKValue,
      clampContext: clampStructuredContext,
    }
  }

  return {
    ok: true,
    status: 200,
    message: 'OK',
    userKey: resolvedUserKey,
    release: lock.release,
    clampTopK: clampTopKValue,
    clampContext: clampStructuredContext,
  }
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function callWithOpenAIRetry(operation, options = {}) {
  const maxAttempts = options.maxAttempts || OPENAI_MAX_ATTEMPTS
  const routeName = options.routeName || '/api/chat'
  const userKey = options.userKey || 'unknown'
  let retryAttempts = 0

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await operation(attempt)
      if (attempt < maxAttempts && isRetryableStatus(response?.status)) {
        retryAttempts += 1
        const delayMs =
          OPENAI_BASE_BACKOFF_MS * (2 ** (attempt - 1)) + Math.floor(Math.random() * 125)

        console.warn(JSON.stringify({
          event: 'openai_retry',
          route: routeName,
          userKey,
          attempt,
          status: response.status,
          delayMs,
        }))

        await sleep(delayMs)
        continue
      }

      return { response, retryAttempts }
    } catch (error) {
      const status = Number(error?.status || error?.response?.status || 0)
      if (attempt < maxAttempts && isRetryableStatus(status)) {
        retryAttempts += 1
        const delayMs =
          OPENAI_BASE_BACKOFF_MS * (2 ** (attempt - 1)) + Math.floor(Math.random() * 125)

        console.warn(JSON.stringify({
          event: 'openai_retry',
          route: routeName,
          userKey,
          attempt,
          status,
          delayMs,
        }))

        await sleep(delayMs)
        continue
      }

      throw error
    }
  }

  throw new Error('OpenAI retry loop exhausted')
}

export { getUserKey }
