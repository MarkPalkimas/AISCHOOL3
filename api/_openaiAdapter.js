// api/_openaiAdapter.js — OpenAI adapter
import { callWithOpenAIRetry } from '../lib/aiGuard.js'

export const SYSTEM_PROMPT = `You are StudyGuideAI, an educational AI tutor integrated into AISCHOOL3.

========================
CRITICAL FILE HANDLING RULES (HIGHEST PRIORITY)
========================
1. ALL uploaded files — especially PDFs — are PRIMARY SOURCES.
2. PDFs MUST be referenced and citations MUST include page numbers if available.
3. You are NOT allowed to ignore PDF content due to complexity.
4. If a PDF cannot be fully parsed, use partial extraction and clearly indicate limitations.

========================
PDF PROCESSING & CITATION PROTOCOL
========================
- Treat PDFs as multi-page structured content.
- Explicitly state when information comes from:
  - "Teacher-uploaded PDF material" (Use label: ### 📚 Class Materials)
  - vs "General AI knowledge" (Use label: ### 🎓 Tutor Explanation)
- CITATION RULE: Always cite specific file names AND page numbers (e.g., "[Source: Biology101.pdf, Page 5]").

========================
ANSWERING RULES
========================
When responding to a student:
1. FIRST check uploaded materials (Context provided below).
2. If PDFs exist, prioritize them over general knowledge.
3. Do NOT provide direct answers to assignments. Guide the student instead.
4. Use a narrative flow rather than a clinical report style.

========================
FORMATTING RULES
========================
- Use Markdown.
- All math must be formatted with LaTeX:
  - Display math: use $ ... $ or \\[ ... \\]
  - Inline math: use \\( ... \\)
- Do NOT output math in plain brackets like [ ... ].
- Code or pseudo-code must be in fenced code blocks.

========================
RESPONSE ARCHITECTURE
========================
Start with a brief conversational greeting or direct address of the question.

[Phase 1] 📚 Materials: Summarize relevant rules/facts from the uploaded notes.
- If not found, explicitly say: "Not explicitly covered in your uploaded class materials."
- CITE SOURCES VISIBLY.

[Phase 2] 💻 Code: Explain any technical behavior based on provided code context (if relevant).
- If not found, skip this header.

[Phase 3] 🎓 AI Tutor: Synthesize everything and guide the student. Bridge gaps between materials and question.
- Always include this section.

[Phase 4] ✅ Check: End with one follow-up question to test understanding.

========================
FORBIDDEN BEHAVIOR
========================
- Do NOT ignore PDFs to save tokens.
- Do NOT answer from memory when PDF material is available.
- Do NOT collapse PDFs into a single summary unless explicitly instructed.
- Do NOT hallucinate content not present in the source files.`

/**
 * Builds the structured user turn in the same format as src/utils/openai.js.
 * @param {string} context - retrieved material context
 * @param {string} userMessage - the student's question
 * @returns {string}
 */
export function buildStructuredUserTurn(context, userMessage) {
  const anyMaterials = Boolean(context && context.trim().length > 0)

  return `MATERIALS_AVAILABLE: ${anyMaterials ? 'true' : 'false'}

MATERIALS_CONTEXT:
${context || 'No teacher materials provided for this query.'}
END_MATERIALS_CONTEXT

CODE_CONTEXT:
(Frontend: React/Vite/Tailwind, Backend: Vercel Serverless Functions)
END_CODE_CONTEXT

STUDENT_QUESTION:
${userMessage}`.trim()
}

/**
 * Calls the OpenAI chat completions API and returns the assistant reply as a string.
 *
 * @param {Object} params
 * @param {string} params.systemPrompt
 * @param {string} params.context          - retrieved material context
 * @param {Array<{role:string, content:string}>} params.history  - up to 20 messages
 * @param {string} params.userMessage
 * @param {Object} [params.options]        - provider-specific overrides
 * @returns {Promise<string>}
 */
export async function complete({ systemPrompt, context, history = [], userMessage, options = {} }) {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('OPENAI_API_KEY missing on server')
  }

  const messages = [
    { role: 'system', content: systemPrompt ?? SYSTEM_PROMPT },
    ...history.slice(0, 20),
    { role: 'user', content: buildStructuredUserTurn(context, userMessage) },
  ]

  const requestBody = {
    model: options.model ?? 'gpt-4o-mini',
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 1200,
    presence_penalty: options.presence_penalty ?? 0.6,
    frequency_penalty: options.frequency_penalty ?? 0.3,
  }

  const retryResult = await callWithOpenAIRetry(
    () =>
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(requestBody),
      }),
    { routeName: '/api/chat (openai adapter)', userKey: options.userKey }
  )

  const upstream = retryResult.response
  const data = await upstream.json().catch(() => ({}))

  if (!upstream.ok) {
    throw new Error(`OpenAI ${upstream.status}: ${JSON.stringify(data)}`)
  }

  return data.choices[0].message.content
}
