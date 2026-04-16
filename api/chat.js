import { getUserKey, guardAiRequest } from '../lib/aiGuard.js'
import { verifyAuth } from './_auth.js'
import { getProvider } from './_aiProvider.js'
import { appendConversationTurn, getPromptHistory, normalizeClassCode } from './_chatStore.js'

export const config = {
  runtime: 'nodejs',
}

function buildPromptUserMessage(userMessage, attachments) {
  const text = String(userMessage || '').trim()
  const normalizedAttachments = Array.isArray(attachments) ? attachments : []

  if (normalizedAttachments.length === 0) {
    return text
  }

  const attachmentSummary = normalizedAttachments
    .map((attachment) => {
      const name = String(attachment?.name || 'Attachment').trim()
      const type = String(attachment?.type || 'application/octet-stream').trim()
      return `${name} (${type})`
    })
    .join(', ')

  const attachmentContext = `[User attached: ${attachmentSummary}]`
  return text ? `${text}\n\n${attachmentContext}` : attachmentContext
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

function parseBody(req) {
  if (!req?.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

export default async function handler(req, res) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const startedAt = Date.now()
  const route = '/api/chat'
  const aiProvider = String(process.env.AI_PROVIDER || 'openai').trim().toLowerCase()
  let status = 500
  let success = false
  let userKey = getUserKey(req)
  let releaseLock = async () => {}

  try {
    if (aiProvider === 'openai') {
      const key = process.env.OPENAI_API_KEY
      if (!key) {
        status = 500
        res.status(500).json({ error: 'OPENAI_API_KEY missing on server' })
        return
      }
    }

    const body = parseBody(req)
    const {
      userMessage,
      context,
      classCode,
      conversationId,
      attachments = [],
    } = body || {}

    const guard = await guardAiRequest({ req, body, userKey, routeName: route })
    userKey = guard.userKey
    releaseLock = guard.release

    if (!guard.ok) {
      status = guard.status
      res.status(guard.status).setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.send(guard.message)
      return
    }

    const userId = await verifyAuth(req)
    if (!userId) {
      status = 401
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const normalizedClassCode = normalizeClassCode(classCode)
    if (!normalizedClassCode) {
      status = 400
      res.status(400).json({ error: 'classCode is required' })
      return
    }

    const safeContext = guard.clampContext(context ?? '')
    const promptUserMessage = buildPromptUserMessage(userMessage, attachments)
    if (!String(promptUserMessage || '').trim()) {
      status = 400
      res.status(400).json({ error: 'userMessage is required' })
      return
    }

    const historyForPrompt = await getPromptHistory({
      userId,
      classCode: normalizedClassCode,
      conversationId,
    })

    const provider = await getProvider()
    const text = await provider.complete({
      systemPrompt: undefined,
      context: safeContext,
      history: historyForPrompt,
      userMessage: promptUserMessage,
      options: { userKey },
    })

    const persisted = await appendConversationTurn({
      userId,
      classCode: normalizedClassCode,
      conversationId,
      userMessage,
      assistantMessage: text,
      attachments,
    })
    const conversation = persisted?.preview || null

    status = 200
    success = true

    res.status(200).json({
      choices: [{ message: { content: text } }],
      conversation,
    })
  } catch (error) {
    status = 500
    success = false
    res.status(500).json({ error: 'Chat request failed', detail: String(error) })
  } finally {
    await releaseLock()
    const durationMs = Date.now() - startedAt
    console.info(JSON.stringify({
      event: 'ai_chat_request',
      provider: process.env.AI_PROVIDER || 'openai',
      route,
      userKey,
      durationMs,
      success,
      status,
    }))
  }
}
