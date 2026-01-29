// OpenAI API integration for AI chat functionality
import { getRelevantChunks } from './storage'

const LIMITS = {
  //Hard cap to prevent token spam, but increased for better context
  MAX_MATERIALS_CHARS_SENT: 15000,
  MAX_LOCAL_CHUNKS: 10
}

// System prompt for StudyGuideAI - strictly follows user specification
const SYSTEM_PROMPT = `You are StudyGuideAI, an educational AI that can read and reason over PROVIDED CODE and TEACHER-UPLOADED MATERIALS.

You do NOT have access to the filesystem, databases, or repositories unless their contents are explicitly included below.
If code or materials are not present in the context, you must say so.

========================
SOURCE PRIORITY (STRICT)
========================
1. TEACHER-UPLOADED MATERIALS (PDFs, docs, slides, images converted to text)
2. PROVIDED CODE CONTEXT
3. GENERAL AI KNOWLEDGE (only if 1 and 2 do not contain the answer)

If materials exist, they are the authoritative source.
If code exists, you must reason based on the actual implementation, not assumptions.

========================
MATERIALS RULES (MANDATORY)
========================
- If MATERIALS_CONTEXT is provided, you MUST use it.
- You MUST explicitly reference it using the label [Material].
- You MUST internally compress large files into key concepts, definitions, and rules.
- Never paste raw PDF text.
- Never invent facts "from the PDF".
- If the answer is not in the materials, say:
  "Not found in uploaded materials."

========================
CODE RULES (MANDATORY)
========================
- If CODE_CONTEXT is provided, you MUST read it before answering.
- You MUST reason based on what the code actually does.
- You MUST reference it using the label [Code].
- If a behavior is caused by code, explain WHERE and WHY.
- If something is missing or not implemented, explicitly say so.
- Do NOT assume features exist unless visible in the code.

========================
RESPONSE FORMAT (ALWAYS)
========================
1) [Material]
- What the uploaded materials say (bullets)
- If none: "Not found in uploaded materials."

2) [Code]
- What the current code does or does not do
- Reference actual logic, variables, or missing steps

3) [AI]
- Explanation or tutoring in your own words
- May bridge gaps ONLY if clearly labeled

4) [Check]
- One short question or sanity check for understanding

========================
ANTI-HALLUCINATION
========================
- Never claim files, PDFs, or logic you cannot see.
- Never say “the code probably”.
- If context is missing or incomplete, say exactly what is missing.

========================
GOAL
========================
Help the student learn by grounding answers in teacher materials, real code behavior, and clear explanations.`

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

  const context = chunks.map(c => `[Snippet from: ${c.materialName || 'Course Notes'}]\n${c.text}`).join('\n\n')
  return context.length > LIMITS.MAX_MATERIALS_CHARS_SENT
    ? context.slice(0, LIMITS.MAX_MATERIALS_CHARS_SENT)
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
