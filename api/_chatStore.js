import { getRedis } from './_db.js'

const LEGACY_MEMORY_KEY = (userId, classCode) => `chat:mem:${userId}:${classCode}`
const USER_INDEX_KEY = (userId) => `chat:index:${userId}`
const CLASS_INDEX_KEY = (userId, classCode) => `chat:index:${userId}:${classCode}`
const META_KEY = (conversationId) => `chat:meta:${conversationId}`
const BODY_KEY = (conversationId) => `chat:body:${conversationId}`
const MIGRATION_KEY = (userId, classCode) => `chat:migrated:${userId}:${classCode}`

const CHAT_TTL_SECONDS = 60 * 60 * 24 * 180
export const CHAT_HISTORY_LIMIT = 5
export const CHAT_MESSAGE_LIMIT = 50
const MAX_TITLE_CHARS = 80
const MAX_PREVIEW_CHARS = 160
const MAX_MESSAGE_CHARS = 12000
const MAX_PROMPT_MESSAGES = 18
const MAX_PROMPT_CHARS = 14000
const MAX_PROMPT_MESSAGE_CHARS = 2000
const BASE64_RE = /data:[^;]+;base64,[A-Za-z0-9+/=]+/g
const PRUNE_BATCH_SIZE = 25
const CLASS_REPAIR_SCAN_LIMIT = CHAT_HISTORY_LIMIT + PRUNE_BATCH_SIZE
const PURGE_SCAN_LIMIT = 200

export function normalizeClassCode(value) {
  return String(value || '').trim().toUpperCase()
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function takeChars(value, maxChars) {
  const text = String(value || '')
  const chars = Array.from(text)
  if (chars.length <= maxChars) return text
  return chars.slice(0, maxChars).join('') + '…'
}

function compactWhitespace(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim()
}

function sanitizeMessageContent(value, maxChars = MAX_MESSAGE_CHARS) {
  const cleaned = compactWhitespace(String(value || '').replace(BASE64_RE, '[File attachment]'))
  if (!cleaned) return ''
  return takeChars(cleaned, maxChars)
}

function toPlainText(value, maxChars = MAX_MESSAGE_CHARS) {
  const stripped = String(value || '')
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return takeChars(stripped, maxChars)
}

function randomIdPart() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  }

  const random = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
    ? Array.from(crypto.getRandomValues(new Uint8Array(6))).map((value) => value.toString(16).padStart(2, '0')).join('')
    : Math.random().toString(36).slice(2, 14)

  return random
}

function createConversationId() {
  return `chat_${Date.now().toString(36)}_${randomIdPart()}`
}

function createMessageId() {
  return `msg_${Date.now().toString(36)}_${randomIdPart()}`
}

function normalizeAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') return null

  const name = takeChars(compactWhitespace(attachment.name || attachment.n || 'Attachment'), 120)
  const type = takeChars(compactWhitespace(attachment.type || attachment.t || 'application/octet-stream'), 80)
  const size = Math.max(0, toNumber(attachment.size ?? attachment.s, 0))

  return { name, type, size }
}

function normalizeAttachments(list) {
  if (!Array.isArray(list)) return []
  return list.map(normalizeAttachment).filter(Boolean)
}

function getAttachmentFallback(attachments) {
  const normalized = normalizeAttachments(attachments)
  if (normalized.length === 0) return ''
  if (normalized.length === 1) return `Attachment uploaded: ${normalized[0].name}`
  return `Attachments uploaded: ${normalized.slice(0, 3).map((item) => item.name).join(', ')}`
}

function normalizeRole(value) {
  return value === 'assistant' || value === 'a' ? 'assistant' : 'user'
}

function compactMessage(message) {
  if (!message || typeof message !== 'object') return null

  const role = normalizeRole(message.role || message.r)
  const attachments = normalizeAttachments(message.attachments || message.files || message.a)
  const content = sanitizeMessageContent(message.content ?? message.c, MAX_MESSAGE_CHARS) || getAttachmentFallback(attachments)

  if (!content) return null

  return {
    id: takeChars(compactWhitespace(message.id || createMessageId()), 64),
    r: role === 'assistant' ? 'a' : 'u',
    c: content,
    t: toNumber(message.ts ?? message.t, Date.now()),
    a: attachments.length > 0
      ? attachments.map((item) => ({ n: item.name, t: item.type, s: item.size }))
      : undefined,
  }
}

function expandStoredMessage(message) {
  const attachments = normalizeAttachments(message?.a)
  return {
    id: takeChars(compactWhitespace(message?.id || createMessageId()), 64),
    role: normalizeRole(message?.r),
    content: sanitizeMessageContent(message?.c, MAX_MESSAGE_CHARS) || getAttachmentFallback(attachments),
    ts: toNumber(message?.t, Date.now()),
    attachments,
  }
}

function trimConversationBody(body) {
  const messages = Array.isArray(body?.messages)
    ? body.messages.map(compactMessage).filter(Boolean).slice(-CHAT_MESSAGE_LIMIT)
    : []

  return {
    version: 3,
    messages,
  }
}

function buildAutoTitle(messages) {
  const firstMeaningful = messages.find((message) => {
    const candidate = toPlainText(message.content || getAttachmentFallback(message.attachments), MAX_TITLE_CHARS)
    return Boolean(candidate)
  })

  if (!firstMeaningful) return 'New chat'

  const source = toPlainText(
    firstMeaningful.content || getAttachmentFallback(firstMeaningful.attachments),
    MAX_TITLE_CHARS * 2
  )

  const cleaned = source
    .split(/\n+/)[0]
    .split(/(?<=[.?!])\s+/)[0]
    .replace(/^(please|can you|could you|would you|help me|i need help with|explain|tell me about)\s+/i, '')
    .replace(/[.?!,:;]+$/g, '')
    .trim()

  if (!cleaned) return 'New chat'
  return takeChars(cleaned, MAX_TITLE_CHARS)
}

function buildPreview(messages) {
  const latestMessage = [...messages].reverse().find((message) => {
    const candidate = toPlainText(message.content || getAttachmentFallback(message.attachments), MAX_PREVIEW_CHARS)
    return Boolean(candidate)
  })

  if (!latestMessage) return 'Start a new conversation'

  const preview = toPlainText(
    latestMessage.content || getAttachmentFallback(latestMessage.attachments),
    MAX_PREVIEW_CHARS
  )

  return preview || 'Start a new conversation'
}

function buildConversationMeta({ conversationId, userId, classCode, body, existingMeta, createdAt, updatedAt }) {
  const expandedMessages = body.messages.map(expandStoredMessage)
  const manualTitle = sanitizeMessageContent(existingMeta?.title, MAX_TITLE_CHARS) || null

  return {
    id: conversationId,
    userId,
    classCode,
    title: manualTitle,
    autoTitle: buildAutoTitle(expandedMessages),
    preview: buildPreview(expandedMessages),
    createdAt: toNumber(existingMeta?.createdAt, createdAt),
    updatedAt: toNumber(updatedAt, createdAt),
    messageCount: expandedMessages.length,
    archivedMessageCount: 0,
    hasSummary: false,
  }
}

function normalizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return null

  const id = takeChars(compactWhitespace(meta.id), 96)
  const userId = takeChars(compactWhitespace(meta.userId), 128)
  const classCode = normalizeClassCode(meta.classCode)
  if (!id || !userId || !classCode) return null

  return {
    id,
    userId,
    classCode,
    title: sanitizeMessageContent(meta.title, MAX_TITLE_CHARS) || null,
    autoTitle: sanitizeMessageContent(meta.autoTitle, MAX_TITLE_CHARS) || 'New chat',
    preview: sanitizeMessageContent(meta.preview, MAX_PREVIEW_CHARS) || 'Start a new conversation',
    createdAt: toNumber(meta.createdAt, Date.now()),
    updatedAt: toNumber(meta.updatedAt, Date.now()),
    messageCount: Math.max(0, toNumber(meta.messageCount, 0)),
    archivedMessageCount: Math.max(0, toNumber(meta.archivedMessageCount, 0)),
    hasSummary: Boolean(meta.hasSummary),
  }
}

function hydratePreview(meta) {
  return {
    ...meta,
    title: meta.title || meta.autoTitle || 'New chat',
  }
}

function hydrateConversation(meta, body) {
  return {
    ...hydratePreview(meta),
    summary: '',
    archivedMessageCount: 0,
    hasSummary: false,
    messages: body.messages.map(expandStoredMessage),
  }
}

function buildPromptHistory(body) {
  const recent = body.messages.map(expandStoredMessage)
  const selected = []
  let totalChars = 0

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index]
    const content = sanitizeMessageContent(
      message.content || getAttachmentFallback(message.attachments),
      MAX_PROMPT_MESSAGE_CHARS
    )

    if (!content) continue

    const projectedChars = totalChars + content.length
    if (selected.length >= MAX_PROMPT_MESSAGES || projectedChars > MAX_PROMPT_CHARS) {
      break
    }

    selected.unshift({ role: message.role, content })
    totalChars = projectedChars
  }

  return selected
}

async function loadConversationRecord(db, conversationId) {
  const [rawMeta, rawBody] = await db.mget([META_KEY(conversationId), BODY_KEY(conversationId)])
  const storedMeta = normalizeMeta(rawMeta)
  if (!storedMeta) return null

  const rawMessages = Array.isArray(rawBody?.messages) ? rawBody.messages : []

  return {
    storedMeta,
    body: trimConversationBody(rawBody),
    needsBodyRepair:
      toNumber(rawBody?.version, 0) !== 3 ||
      Boolean(rawBody?.summary) ||
      toNumber(rawBody?.archivedMessageCount, 0) > 0 ||
      rawMessages.length > CHAT_MESSAGE_LIMIT,
  }
}

function canonicalizeRecord(record) {
  if (!record?.storedMeta) return null

  return {
    meta: buildConversationMeta({
      conversationId: record.storedMeta.id,
      userId: record.storedMeta.userId,
      classCode: record.storedMeta.classCode,
      body: record.body,
      existingMeta: record.storedMeta,
      createdAt: record.storedMeta.createdAt,
      updatedAt: record.storedMeta.updatedAt,
    }),
    body: record.body,
  }
}

function needsMetaRepair(storedMeta, nextMeta) {
  if (!storedMeta || !nextMeta) return false

  return (
    storedMeta.title !== nextMeta.title ||
    storedMeta.autoTitle !== nextMeta.autoTitle ||
    storedMeta.preview !== nextMeta.preview ||
    toNumber(storedMeta.messageCount, -1) !== nextMeta.messageCount ||
    Math.max(0, toNumber(storedMeta.archivedMessageCount, 0)) !== 0 ||
    Boolean(storedMeta.hasSummary)
  )
}

function ownsConversation(record, userId, classCode) {
  return Boolean(
    record?.meta &&
    record.meta.userId === userId &&
    record.meta.classCode === normalizeClassCode(classCode)
  )
}

async function ensureConversationIndexed(db, meta) {
  await Promise.all([
    db.zadd(USER_INDEX_KEY(meta.userId), meta.updatedAt, meta.id),
    db.zadd(CLASS_INDEX_KEY(meta.userId, meta.classCode), meta.updatedAt, meta.id),
    db.expire(USER_INDEX_KEY(meta.userId), CHAT_TTL_SECONDS),
    db.expire(CLASS_INDEX_KEY(meta.userId, meta.classCode), CHAT_TTL_SECONDS),
  ])
}

async function persistConversation(db, meta, body) {
  await Promise.all([
    db.setex(META_KEY(meta.id), CHAT_TTL_SECONDS, JSON.stringify(meta)),
    db.setex(BODY_KEY(meta.id), CHAT_TTL_SECONDS, JSON.stringify(body)),
    ensureConversationIndexed(db, meta),
  ])
}

async function removeConversationRecords(db, userId, ids, metaEntries = []) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))]
  if (uniqueIds.length === 0) return

  const removals = [
    db.zrem(USER_INDEX_KEY(userId), ...uniqueIds),
    db.del(...uniqueIds.flatMap((id) => [META_KEY(id), BODY_KEY(id)])),
  ]

  const classMembers = new Map()
  for (const meta of metaEntries.map(normalizeMeta).filter(Boolean)) {
    if (meta.userId !== userId) continue
    const key = CLASS_INDEX_KEY(userId, meta.classCode)
    const members = classMembers.get(key) || []
    members.push(meta.id)
    classMembers.set(key, members)
  }

  for (const [key, members] of classMembers.entries()) {
    removals.push(db.zrem(key, ...members))
  }

  await Promise.all(removals)
}

async function pruneUserConversationIndex(db, userId) {
  let shouldContinue = true

  while (shouldContinue) {
    const staleIds = await db.zrevrange(
      USER_INDEX_KEY(userId),
      CHAT_HISTORY_LIMIT,
      CHAT_HISTORY_LIMIT + PRUNE_BATCH_SIZE - 1
    )

    if (!Array.isArray(staleIds) || staleIds.length === 0) {
      shouldContinue = false
      continue
    }

    const uniqueIds = [...new Set(staleIds.filter(Boolean))]
    if (uniqueIds.length === 0) {
      shouldContinue = false
      continue
    }

    const metaEntries = await db.mget(uniqueIds.map(META_KEY))
    await removeConversationRecords(db, userId, uniqueIds, metaEntries)

    if (uniqueIds.length < PRUNE_BATCH_SIZE) {
      shouldContinue = false
    }
  }
}

async function reconcileClassIndex(db, userId, classCode) {
  const indexKey = CLASS_INDEX_KEY(userId, classCode)
  const candidateIds = await db.zrevrange(indexKey, 0, CLASS_REPAIR_SCAN_LIMIT - 1)
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) return

  const staleIds = []

  for (const conversationId of candidateIds) {
    const record = await loadConversationRecord(db, conversationId)
    if (!record) {
      staleIds.push(conversationId)
      continue
    }

    const canonicalRecord = canonicalizeRecord(record)
    if (!ownsConversation(canonicalRecord, userId, classCode)) {
      staleIds.push(conversationId)
      continue
    }

    if (record.needsBodyRepair || needsMetaRepair(record.storedMeta, canonicalRecord.meta)) {
      await persistConversation(db, canonicalRecord.meta, canonicalRecord.body)
      continue
    }

    await ensureConversationIndexed(db, canonicalRecord.meta)
  }

  if (staleIds.length > 0) {
    await Promise.all([
      db.zrem(indexKey, ...staleIds),
      db.zrem(USER_INDEX_KEY(userId), ...staleIds),
    ])
  }
}

async function ensureLegacyConversationMigrated(userId, classCode) {
  const normalizedClassCode = normalizeClassCode(classCode)
  if (!userId || !normalizedClassCode) return

  const db = await getRedis()
  const markerKey = MIGRATION_KEY(userId, normalizedClassCode)
  const marker = await db.get(markerKey)
  if (marker) return

  const existingIds = await db.zrevrange(CLASS_INDEX_KEY(userId, normalizedClassCode), 0, 0)
  if (Array.isArray(existingIds) && existingIds.length > 0) {
    await db.setex(markerKey, CHAT_TTL_SECONDS, '1')
    return
  }

  const rawLegacyMessages = await db.get(LEGACY_MEMORY_KEY(userId, normalizedClassCode))
  const legacyMessages = Array.isArray(rawLegacyMessages)
    ? rawLegacyMessages.map(compactMessage).filter(Boolean)
    : []

  if (legacyMessages.length > 0) {
    const body = trimConversationBody({
      version: 3,
      messages: legacyMessages,
    })

    const createdAt = toNumber(legacyMessages[0]?.t, Date.now())
    const updatedAt = toNumber(legacyMessages[legacyMessages.length - 1]?.t, createdAt)
    const meta = buildConversationMeta({
      conversationId: createConversationId(),
      userId,
      classCode: normalizedClassCode,
      body,
      existingMeta: null,
      createdAt,
      updatedAt,
    })

    await persistConversation(db, meta, body)
    await pruneUserConversationIndex(db, userId)
  }

  await db.setex(markerKey, CHAT_TTL_SECONDS, '1')
}

export async function listConversationPreviews({ userId, classCode, limit = CHAT_HISTORY_LIMIT }) {
  const normalizedClassCode = normalizeClassCode(classCode)
  if (!userId || !normalizedClassCode) return []

  await ensureLegacyConversationMigrated(userId, normalizedClassCode)

  const safeLimit = Math.min(CHAT_HISTORY_LIMIT, Math.max(1, Number(limit) || CHAT_HISTORY_LIMIT))
  const db = await getRedis()

  await reconcileClassIndex(db, userId, normalizedClassCode)
  await pruneUserConversationIndex(db, userId)

  const ids = await db.zrevrange(CLASS_INDEX_KEY(userId, normalizedClassCode), 0, safeLimit - 1)
  if (!Array.isArray(ids) || ids.length === 0) return []

  const previews = []
  const staleIds = []

  for (const conversationId of ids) {
    const record = await loadConversationRecord(db, conversationId)
    if (!record) {
      staleIds.push(conversationId)
      continue
    }

    const canonicalRecord = canonicalizeRecord(record)
    if (!ownsConversation(canonicalRecord, userId, normalizedClassCode)) {
      staleIds.push(conversationId)
      continue
    }

    previews.push(hydratePreview(canonicalRecord.meta))
  }

  if (staleIds.length > 0) {
    await Promise.all([
      db.zrem(CLASS_INDEX_KEY(userId, normalizedClassCode), ...staleIds),
      db.zrem(USER_INDEX_KEY(userId), ...staleIds),
    ])
  }

  return previews
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, safeLimit)
}

export async function getConversationDetail({ userId, classCode, conversationId }) {
  const normalizedClassCode = normalizeClassCode(classCode)
  if (!userId || !normalizedClassCode || !conversationId) return null

  await ensureLegacyConversationMigrated(userId, normalizedClassCode)

  const db = await getRedis()
  const record = await loadConversationRecord(db, conversationId)
  const canonicalRecord = canonicalizeRecord(record)
  if (!ownsConversation(canonicalRecord, userId, normalizedClassCode)) return null

  if (record.needsBodyRepair || needsMetaRepair(record.storedMeta, canonicalRecord.meta)) {
    await persistConversation(db, canonicalRecord.meta, canonicalRecord.body)
  } else {
    await ensureConversationIndexed(db, canonicalRecord.meta)
  }

  await pruneUserConversationIndex(db, userId)

  return hydrateConversation(canonicalRecord.meta, canonicalRecord.body)
}

export async function getPromptHistory({ userId, classCode, conversationId }) {
  const normalizedClassCode = normalizeClassCode(classCode)
  if (!userId || !normalizedClassCode || !conversationId) return []

  await ensureLegacyConversationMigrated(userId, normalizedClassCode)

  const db = await getRedis()
  const record = await loadConversationRecord(db, conversationId)
  const canonicalRecord = canonicalizeRecord(record)
  if (!ownsConversation(canonicalRecord, userId, normalizedClassCode)) return []

  if (record.needsBodyRepair || needsMetaRepair(record.storedMeta, canonicalRecord.meta)) {
    await persistConversation(db, canonicalRecord.meta, canonicalRecord.body)
  } else {
    await ensureConversationIndexed(db, canonicalRecord.meta)
  }

  await pruneUserConversationIndex(db, userId)

  return buildPromptHistory(canonicalRecord.body)
}

export async function appendConversationTurn({
  userId,
  classCode,
  conversationId,
  userMessage,
  assistantMessage,
  attachments = [],
}) {
  const normalizedClassCode = normalizeClassCode(classCode)
  if (!userId || !normalizedClassCode) return null

  await ensureLegacyConversationMigrated(userId, normalizedClassCode)

  const db = await getRedis()
  let record = null
  let nextConversationId = takeChars(compactWhitespace(conversationId), 96) || createConversationId()

  if (nextConversationId) {
    const existingRecord = await loadConversationRecord(db, nextConversationId)
    const canonicalRecord = canonicalizeRecord(existingRecord)

    if (ownsConversation(canonicalRecord, userId, normalizedClassCode)) {
      record = canonicalRecord
    } else if (conversationId) {
      nextConversationId = createConversationId()
    }
  }

  const currentTime = Date.now()
  const existingBody = record?.body || {
    version: 3,
    messages: [],
  }

  const nextBody = trimConversationBody({
    version: 3,
    messages: [
      ...existingBody.messages,
      {
        role: 'user',
        content: userMessage,
        attachments,
        ts: currentTime,
      },
      {
        role: 'assistant',
        content: assistantMessage,
        ts: currentTime + 1,
      },
    ],
  })

  const createdAt = record?.meta?.createdAt || currentTime
  const updatedAt = currentTime + 1
  const nextMeta = buildConversationMeta({
    conversationId: nextConversationId,
    userId,
    classCode: normalizedClassCode,
    body: nextBody,
    existingMeta: record?.meta || null,
    createdAt,
    updatedAt,
  })

  await persistConversation(db, nextMeta, nextBody)
  await pruneUserConversationIndex(db, userId)

  return {
    preview: hydratePreview(nextMeta),
    conversationId: nextMeta.id,
  }
}

export async function purgeUserClassConversations({ userId, classCode }) {
  const normalizedClassCode = normalizeClassCode(classCode)
  if (!userId || !normalizedClassCode) return 0

  const db = await getRedis()
  const classIndexKey = CLASS_INDEX_KEY(userId, normalizedClassCode)
  const ids = await db.zrevrange(classIndexKey, 0, PURGE_SCAN_LIMIT - 1)
  const uniqueIds = [...new Set((ids || []).filter(Boolean))]

  const keysToDelete = [
    classIndexKey,
    ...uniqueIds.flatMap((id) => [META_KEY(id), BODY_KEY(id)]),
  ]

  const removals = [db.del(...keysToDelete)]
  if (uniqueIds.length > 0) {
    removals.push(db.zrem(USER_INDEX_KEY(userId), ...uniqueIds))
  }

  await Promise.all(removals)
  return uniqueIds.length
}
