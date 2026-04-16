import { verifyAuth } from './_auth.js'
import {
  CHAT_HISTORY_LIMIT,
  getConversationDetail,
  listConversationPreviews,
  normalizeClassCode,
} from './_chatStore.js'

export const config = {
  runtime: 'nodejs',
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

export default async function handler(req, res) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const userId = await verifyAuth(req)
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const classCode = normalizeClassCode(req.query?.classCode)
    const chatId = String(req.query?.chatId || '').trim()
    const limit = Math.min(CHAT_HISTORY_LIMIT, Math.max(1, Number(req.query?.limit || CHAT_HISTORY_LIMIT)))

    if (!classCode) {
      res.status(400).json({ error: 'classCode is required' })
      return
    }

    if (chatId) {
      const conversation = await getConversationDetail({ userId, classCode, conversationId: chatId })
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' })
        return
      }

      res.status(200).json({ conversation })
      return
    }

    const conversations = await listConversationPreviews({ userId, classCode, limit })
    res.status(200).json({ conversations })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load chat history', detail: String(error) })
  }
}
