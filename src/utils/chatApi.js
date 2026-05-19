import { getRelevantChunks, getPdfWarningsForClass, getMaterialSummaries } from './storage'

const MAX_HISTORY_CHATS = 5
const MAX_MATERIALS_CHARS_SENT = 6500

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase()
}

function trimText(value) {
  return String(value || '').trim()
}

function buildAuthHeaders(token, headers = {}) {
  const nextHeaders = { ...headers }
  if (token) nextHeaders.Authorization = `Bearer ${token}`
  return nextHeaders
}

function getErrorMessage(payload, fallback) {
  if (typeof payload === 'string' && payload.trim()) return payload.trim()
  if (payload && typeof payload === 'object') {
    const detail = trimText(payload.detail)
    const error = trimText(payload.error)
    return detail || error || fallback
  }
  return fallback
}

async function requestJson(url, { token, ...options } = {}) {
  const response = await fetch(url, {
    ...options,
    headers: buildAuthHeaders(token, options.headers),
  })

  const rawText = await response.text().catch(() => '')
  let payload = null

  try {
    payload = rawText ? JSON.parse(rawText) : null
  } catch {
    payload = rawText
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Request failed with status ${response.status}`))
  }

  return payload
}

function buildFilteredMaterials(userMessage, classCode) {
  const relevantChunks = getRelevantChunks(userMessage, classCode)
  const fallbackChunks = relevantChunks.length === 0 ? getMaterialSummaries(classCode) : []
  const contextSource = relevantChunks.length > 0 ? relevantChunks : fallbackChunks

  if (contextSource.length === 0) return ''

  const context = contextSource
    .map((chunk) => {
      const source = trimText(chunk.materialName) || 'Course Notes'
      const pageInfo = chunk.pageNumber ? `, Page ${chunk.pageNumber}` : ''
      return `[Snippet from: ${source}${pageInfo}]\n${trimText(chunk.text)}`
    })
    .filter(Boolean)
    .join('\n\n')

  if (context.length <= MAX_MATERIALS_CHARS_SENT) return context
  return `${context.slice(0, MAX_MATERIALS_CHARS_SENT)}\n[...truncated for token limit]`
}

export function buildChatContext(userMessage, classCode) {
  const normalizedCode = normalizeCode(classCode)
  let filteredMaterials = buildFilteredMaterials(userMessage, normalizedCode)

  const pdfWarnings = getPdfWarningsForClass(normalizedCode)
  if (pdfWarnings.length > 0) {
    const warningText = pdfWarnings
      .map((warning) => {
        const source = trimText(warning.materialName) || 'PDF'
        return `[Snippet from: ${source}]\n${trimText(warning.text)}`
      })
      .filter(Boolean)
      .join('\n\n')

    filteredMaterials = warningText + (filteredMaterials ? `\n\n${filteredMaterials}` : '')
  }

  return filteredMaterials
}

function normalizePreview(preview) {
  if (!preview || typeof preview !== 'object') return null

  const id = trimText(preview.id)
  if (!id) return null

  return {
    id,
    title: trimText(preview.title || preview.autoTitle) || 'New chat',
    preview: trimText(preview.preview) || 'Start a new conversation',
    updatedAt: Number(preview.updatedAt) || Date.now(),
    createdAt: Number(preview.createdAt) || Date.now(),
    messageCount: Math.max(0, Number(preview.messageCount) || 0),
    archivedMessageCount: Math.max(0, Number(preview.archivedMessageCount) || 0),
    hasSummary: Boolean(preview.hasSummary),
    classCode: normalizeCode(preview.classCode),
  }
}

function normalizeAttachment(attachment) {
  if (!attachment) return null

  const name = trimText(attachment.name || attachment.n)
  if (!name) return null

  return {
    name,
    type: trimText(attachment.type || attachment.t) || 'application/octet-stream',
    size: Math.max(0, Number(attachment.size ?? attachment.s) || 0),
  }
}

function normalizeMessage(message) {
  if (!message || typeof message !== 'object') return null

  const role = message.role === 'assistant' ? 'assistant' : 'user'
  const content = trimText(message.content)
  const attachments = Array.isArray(message.attachments)
    ? message.attachments.map(normalizeAttachment).filter(Boolean)
    : []

  if (!content && attachments.length === 0) return null

  return {
    id: trimText(message.id) || `msg_${Date.now().toString(36)}`,
    role,
    kind: trimText(message.kind),
    content: content || (attachments.length === 1 ? `Attachment uploaded: ${attachments[0].name}` : 'Attachments uploaded'),
    ts: Number(message.ts) || Date.now(),
    attachments,
  }
}

function normalizeConversation(conversation) {
  const preview = normalizePreview(conversation)
  if (!preview) return null

  const messages = Array.isArray(conversation?.messages)
    ? conversation.messages.map(normalizeMessage).filter(Boolean)
    : []

  return {
    ...preview,
    summary: trimText(conversation?.summary),
    messages,
  }
}

export function toChatAttachmentPayload(file) {
  if (!file) return null

  const name = trimText(file.name)
  if (!name) return null

  return {
    name,
    type: trimText(file.type) || 'application/octet-stream',
    size: Math.max(0, Number(file.size) || 0),
  }
}

export async function fetchChatHistory({ token, classCode, limit = MAX_HISTORY_CHATS }) {
  const normalizedCode = normalizeCode(classCode)
  const safeLimit = Math.min(MAX_HISTORY_CHATS, Math.max(1, Number(limit) || MAX_HISTORY_CHATS))
  const query = new URLSearchParams({
    classCode: normalizedCode,
    limit: String(safeLimit),
  })

  const payload = await requestJson(`/api/chat-history?${query.toString()}`, {
    method: 'GET',
    token,
  })

  return Array.isArray(payload?.conversations)
    ? payload.conversations.map(normalizePreview).filter(Boolean).slice(0, safeLimit)
    : []
}

export async function fetchConversation({ token, classCode, conversationId }) {
  const normalizedCode = normalizeCode(classCode)
  const query = new URLSearchParams({
    classCode: normalizedCode,
    chatId: trimText(conversationId),
  })

  const payload = await requestJson(`/api/chat-history?${query.toString()}`, {
    method: 'GET',
    token,
  })

  const conversation = normalizeConversation(payload?.conversation)
  if (!conversation) {
    throw new Error('Conversation not found')
  }

  return conversation
}

export async function sendChatMessage({
  token,
  userMessage,
  classCode,
  conversationId,
  attachments = [],
}) {
  const normalizedCode = normalizeCode(classCode)
  const normalizedAttachments = attachments.map(normalizeAttachment).filter(Boolean)

  const payload = await requestJson('/api/chat', {
    method: 'POST',
    token,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userMessage: trimText(userMessage),
      context: buildChatContext(userMessage, normalizedCode),
      classCode: normalizedCode,
      conversationId: trimText(conversationId),
      attachments: normalizedAttachments,
    }),
  })

  return {
    text: trimText(payload?.choices?.[0]?.message?.content),
    conversation: normalizePreview(payload?.conversation),
  }
}
