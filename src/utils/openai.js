import { sendChatMessage } from './chatApi'

export { buildChatContext as buildMaterialsContext } from './chatApi'

export async function sendMessageToAI(userMessage, classCode, conversationHistory = [], options = {}) {
  try {
    void conversationHistory
    const result = await sendChatMessage({
      token: options.token,
      userMessage,
      classCode,
      conversationId: options.conversationId,
      attachments: Array.isArray(options.attachments) ? options.attachments : [],
    })

    return result.text
  } catch (error) {
    console.error('Error calling AI chat API:', error)
    throw error
  }
}
