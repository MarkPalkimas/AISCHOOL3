// OpenAI API integration for AI chat functionality
import { getRelevantChunks } from './storage'

const LIMITS = {
  //Hard cap to prevent token spam - enforcing 6500 char limit as requested
  MAX_MATERIALS_CHARS_SENT: 6500,
  MAX_LOCAL_CHUNKS: 10
}

// System prompt for StudyGuideAI - Refined for "Differentiated but Integrated" style
const SYSTEM_PROMPT = `You are StudyGuideAI, an educational AI that helps students learn using PROVIDED MATERIALS and CODE logic.

========================
CONVERSATIONAL STYLE
========================
- Be encouraging, clear, and professional.
- Do NOT provide direct answers to assignments. Guide the student instead.
- Use a narrative flow rather than a clinical report style.
- IF context is missing, be helpful but honest about what you don't know.

========================
SOURCE PRIORITY & LABELING
========================
1. TEACHER MATERIALS: Treat these as the "Textbook". Label sections with: ### 📚 Class Materials
2. CODE CONTEXT: Treat this as the "System Logic". Label sections with: ### 💻 Platform Logic
3. AI KNOWLEDGE: Use for helpful explanations. Label sections with: ### 🎓 Tutor Explanation

========================
RESPONSE ARCHITECTURE
========================
Start with a brief conversational greeting or direct address of the question.

[Phase 1] 📚 Materials: Summarize relevant facts/rules from the uploaded notes.
- If not found, say: "Not explicitly covered in your class materials."
- IMPORTANT: When citing PDF materials, ALWAYS include page numbers if available (e.g., "According to Biology101.pdf, Page 5...")

[Phase 2] 💻 Code: Explain any technical behavior based on provided code context.
- If not found, skip this header entirely.

[Phase 3] 🎓 AI Tutor: Synthesize everything and guide the student. Bridge the gaps between materials and the question.
- Always include a section here to help understanding.

[Phase 4] ✅ Check: End with one follow-up question to test understanding.

========================
ANTI-HALLUCINATION
========================
- Never claim files or logic you cannot see.
- Cite specific file names AND page numbers when available (e.g., "[From: Syllabus.pdf, Page 3]").
- Page numbers help students find the exact source in their materials.`

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getQueryKeywords(userMessage) {
  const stop = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'what', 'why', 'how', 'who',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
    'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'we', 'our', 'they', 'their',
    'to', 'of', 'in', 'on', 'at', 'for', 'with', 'about', 'as', 'by', 'from', 'into', 'over', 'under',
    'this', 'that', 'these', 'those', 'it', 'its', 'can', 'could', 'should', 'would', 'will', 'just',
    'please', 'give', 'answer', 'solve', 'help', 'explain'
  ])

  const words = normalizeText(userMessage).split(' ')
  const keywords = []
  for (const w of words) {
    if (!w) continue
    if (w.length < 3) continue
    if (stop.has(w)) continue
    keywords.push(w)
  }

  const seen = new Set()
  const uniq = []
  for (const k of keywords) {
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(k)
  }
  return uniq.slice(0, 12)
}

function splitIntoChunks(courseMaterials) {
  const raw = (courseMaterials || '').trim()
  if (!raw) return []

  const paras = raw.split(/\n\s*\n+/g).map(s => s.trim()).filter(Boolean)
  if (paras.length >= 4) return paras

  return raw.split('\n').map(s => s.trim()).filter(Boolean)
}

function scoreChunks(userMessage, courseMaterials) {
  const keywords = getQueryKeywords(userMessage)
  const chunks = splitIntoChunks(courseMaterials)
  if (!keywords.length || !chunks.length) return []

  const scored = chunks.map((chunk) => {
    const n = normalizeText(chunk)
    let hits = 0
    for (const k of keywords) {
      if (n.includes(k)) hits += 1
    }

    const bonus =
      /definition|example|formula|theorem|rule|step|procedure|concept|overview|lecture|chapter/i.test(chunk)
        ? 0.5
        : 0

    return { chunk, hits, score: hits + bonus }
  }).filter(x => x.hits > 0)

  scored.sort((a, b) => b.score - a.score)
  return scored
}

function trimChunk(s, maxChars) {
  const t = (s || '').replace(/\r/g, '').trim()
  if (t.length <= maxChars) return t
  return t.slice(0, maxChars) + '…'
}

function buildFilteredMaterials(userMessage, classCode) {
  const chunks = getRelevantChunks(userMessage, classCode)
  if (chunks.length === 0) return ''

  // Build context with page citations when available
  const context = chunks.map(c => {
    const source = c.materialName || 'Course Notes'
    const pageInfo = c.pageNumber ? `, Page ${c.pageNumber}` : ''
    return `[Snippet from: ${source}${pageInfo}]\n${c.text}`
  }).join('\n\n')

  // Hard limit enforced at 6500 chars (getRelevantChunks already does this, but double-check)
  return context.length > LIMITS.MAX_MATERIALS_CHARS_SENT
    ? context.slice(0, LIMITS.MAX_MATERIALS_CHARS_SENT) + '\n[...truncated for token limit]'
    : context
}

function looksLikeDirectAnswerRequest(userMessage) {
  const directAnswerKeywords = [
    'what is the answer',
    'give me the answer',
    'solve this for me',
    'do my homework',
    'complete this assignment',
    'what should i write',
    'just tell me',
    'answer this',
    'final answer'
  ]
  const msg = (userMessage || '').toLowerCase()
  return directAnswerKeywords.some(k => msg.includes(k))
}

function ensureSourceTag(text, sourceTag) {
  const content = (text || '').trim()
  if (!content) return sourceTag === 'class' ? '[FROM CLASS MATERIALS] ' : '[AI GENERAL KNOWLEDGE] '

  const hasTag =
    /^\[FROM CLASS MATERIALS\]/i.test(content) ||
    /^\[AI GENERAL KNOWLEDGE\]/i.test(content)

  if (hasTag) return content
  return (sourceTag === 'class' ? '[FROM CLASS MATERIALS] ' : '[AI GENERAL KNOWLEDGE] ') + content
}

//Clean materials-first response (no giant excerpts)
function buildMaterialsFirstResponse(userMessage, hasCoverage, isDirectAnswer) {
  if (!hasCoverage) return null

  if (isDirectAnswer) {
    return `[FROM CLASS MATERIALS] I can’t give a direct answer, but your class materials *do* cover the concept behind this.\n\nLet’s solve it together:\n1) What topic/section is this from in your notes?\n2) What rule/definition does the question rely on?\n3) Try your first step, and I’ll guide you from there.`
  }

  return `[FROM CLASS MATERIALS] Your teacher’s materials cover this topic. I’ll help you understand it and apply it correctly.\n\nQuick check:\n- What part is confusing (definition, steps, or why it works)?\n- What does your material say is the key rule/idea here?\n\nIf you paste the specific line or section you’re looking at, I’ll walk you through it step-by-step.`
}

export async function sendMessageToAI(userMessage, classCode, conversationHistory = []) {
  try {
    const filteredMaterials = buildFilteredMaterials(userMessage, classCode)

    // Construct the standard INPUT FORMAT specified by the user
    const structuredInput = `
MATERIALS_AVAILABLE: ${filteredMaterials ? 'true' : 'false'}

MATERIALS_CONTEXT:
${filteredMaterials || 'No teacher materials provided for this query.'}
END_MATERIALS_CONTEXT

CODE_CONTEXT:
(Frontend: React/Vite/Tailwind, Backend: Vercel Serverless Functions)
END_CODE_CONTEXT

STUDENT_QUESTION:
${userMessage}
`.trim()

    const messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      }
    ]

    const recentHistory = conversationHistory.slice(-10)
    messages.push(...recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })))

    messages.push({ role: 'user', content: structuredInput })

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1200,
        presence_penalty: 0.6,
        frequency_penalty: 0.3
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Proxy/OpenAI Error:', errorData)
      if (response.status === 401) throw new Error('Invalid OpenAI API key configuration.')
      if (response.status === 429) throw new Error('Rate limit exceeded. Please try again in a moment.')
      throw new Error(errorData.error || 'Failed to get response from AI')
    }

    const data = await response.json()
    const aiText = data?.choices?.[0]?.message?.content || ''

    return aiText

  } catch (error) {
    console.error('Error calling OpenAI API:', error)
    if (error.message.includes('API key')) {
      throw new Error('OpenAI API configuration error. Please contact your teacher.')
    }
    throw error
  }
}
