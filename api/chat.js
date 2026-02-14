//api/chat.js
import { callWithOpenAIRetry, getUserKey, guardAiRequest } from '../lib/aiGuard.ts'

export const config = {
  runtime: 'edge',
}

function cloneBody(value) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value)
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

function clampTopKFields(body, clampTopK) {
  if (!body || typeof body !== 'object') return body

  if (Object.prototype.hasOwnProperty.call(body, 'topK')) {
    body.topK = clampTopK(body.topK)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'top_k')) {
    body.top_k = clampTopK(body.top_k)
  }
  if (body.retrieval && typeof body.retrieval === 'object') {
    if (Object.prototype.hasOwnProperty.call(body.retrieval, 'topK')) {
      body.retrieval.topK = clampTopK(body.retrieval.topK)
    }
    if (Object.prototype.hasOwnProperty.call(body.retrieval, 'top_k')) {
      body.retrieval.top_k = clampTopK(body.retrieval.top_k)
    }
  }

  return body
}

function clampMessageContent(content, clampContext) {
  if (typeof content === 'string') return clampContext(content)

  if (Array.isArray(content)) {
    return content.map((item) => {
      if (!item || typeof item !== 'object') return item
      if (typeof item.text === 'string') {
        return { ...item, text: clampContext(item.text) }
      }
      if (typeof item.content === 'string') {
        return { ...item, content: clampContext(item.content) }
      }
      return item
    })
  }

  if (content && typeof content === 'object' && typeof content.text === 'string') {
    return { ...content, text: clampContext(content.text) }
  }

  return content
}

function clampContextFields(body, clampContext) {
  if (!body || typeof body !== 'object') return body

  if (typeof body.context === 'string') body.context = clampContext(body.context)
  if (typeof body.appendedContext === 'string') body.appendedContext = clampContext(body.appendedContext)

  if (Array.isArray(body.messages)) {
    body.messages = body.messages.map((msg) => {
      if (!msg || typeof msg !== 'object') return msg
      if (typeof msg.content === 'undefined') return msg
      return { ...msg, content: clampMessageContent(msg.content, clampContext) }
    })
  }

  if (typeof body.input === 'string') body.input = clampContext(body.input)
  if (Array.isArray(body.input)) {
    body.input = body.input.map((item) => {
      if (!item || typeof item !== 'object') return item
      if (typeof item.content === 'string') {
        return { ...item, content: clampContext(item.content) }
      }
      return item
    })
  }

  return body
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  const startedAt = Date.now()
  const route = '/api/chat'
  let status = 500
  let success = false
  let retryAttempts = 0
  let userKey = getUserKey(req)
  let releaseLock = async () => {}

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const key = process.env.OPENAI_API_KEY
    if (!key) {
      status = 500
      success = false
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY missing on server' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const guard = await guardAiRequest({
      req,
      body,
      userKey,
      routeName: route,
    })

    userKey = guard.userKey
    releaseLock = guard.release

    if (!guard.ok) {
      status = guard.status
      return new Response(guard.message, {
        status: guard.status,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    const safeBody = clampContextFields(clampTopKFields(cloneBody(body), guard.clampTopK), guard.clampContext)

    const retryResult = await callWithOpenAIRetry(
      () =>
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(safeBody),
        }),
      {
        routeName: route,
        userKey,
      }
    )

    const upstream = retryResult.response
    retryAttempts = retryResult.retryAttempts

    const data = await upstream.json().catch(() => ({}))
    status = upstream.status
    success = upstream.ok

    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (e) {
    status = 500
    success = false
    return new Response(JSON.stringify({ error: 'Proxy failed', detail: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  } finally {
    await releaseLock()
    const durationMs = Date.now() - startedAt
    console.info(JSON.stringify({
      event: 'ai_chat_request',
      route,
      userKey,
      durationMs,
      success,
      status,
      retryAttempts,
    }))
  }
}
