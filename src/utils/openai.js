// OpenAI API integration for AI chat functionality

const LIMITS = {
  //Hard cap to prevent token spam, but increased for better context
  MAX_MATERIALS_CHARS_SENT: 15000,
  MAX_LOCAL_CHUNK_CHARS: 1500,
  MAX_LOCAL_CHUNKS: 10
}

// System prompt that prevents direct answer-giving and prioritizes teacher materials
const SYSTEM_PROMPT = `You are an educational AI tutor assistant. Your role is to help students LEARN and UNDERSTAND concepts, not to provide direct answers to their assignments or homework.

CRITICAL KNOWLEDGE SOURCE PROTOCOL:
You MUST follow this exact process for EVERY response:

STEP 1: ANALYZE THE COURSE MATERIALS
- Carefully review the course materials provided below
- Determine if the student's question is covered in these materials
- Check for relevant topics, concepts, examples, or explanations

STEP 2: FORMAT YOUR RESPONSE WITH SOURCE INDICATOR
You MUST start your response with ONE of these exact tags:

A) If answering from course materials:
   Start with: [FROM CLASS MATERIALS]
   Then provide your response based on the teacher's materials

B) If the topic is NOT in the course materials:
   Start with: [AI GENERAL KNOWLEDGE]
   Then include this disclaimer: "📚 Note: This topic isn't covered in your teacher's course materials, so I'm using my general knowledge to help you."
   Then provide your helpful response

EDUCATIONAL GUIDELINES:
1. NEVER provide direct answers to homework problems, assignments, or test questions
2. Guide students through the problem-solving process with questions
3. Ask leading questions that help students think critically
4. Break down complex concepts into simpler parts
5. Provide examples and analogies to aid understanding
6. Encourage students to explain their thinking
7. If a student asks for a direct answer, politely refuse and offer to help them understand instead
8. Always be encouraging and supportive
9. Use Socratic questioning to develop critical thinking

REMEMBER: Every response MUST start with either [FROM CLASS MATERIALS] or [AI GENERAL KNOWLEDGE]. This is non-negotiable.

You have access to the following course materials that you should reference when helping students:`

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

function buildFilteredMaterials(userMessage, courseMaterials) {
  const raw = (courseMaterials || '').trim()
  if (!raw) return ''

  const scored = scoreChunks(userMessage, raw)
  if (scored.length === 0) {
    //Fallback: first part only (prevents sending entire notes)
    return raw.slice(0, LIMITS.MAX_MATERIALS_CHARS_SENT)
  }

  const picked = scored
    .slice(0, LIMITS.MAX_LOCAL_CHUNKS)
    .map(x => trimChunk(x.chunk, LIMITS.MAX_LOCAL_CHUNK_CHARS))

  let filtered = picked.join('\n\n')
  if (filtered.length > LIMITS.MAX_MATERIALS_CHARS_SENT) {
    filtered = filtered.slice(0, LIMITS.MAX_MATERIALS_CHARS_SENT)
  }
  return filtered
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

export async function sendMessageToAI(userMessage, courseMaterials, conversationHistory = []) {
  try {
    const hasMaterials = !!(courseMaterials && courseMaterials.trim().length > 0)
    const filteredMaterials = hasMaterials ? buildFilteredMaterials(userMessage, courseMaterials) : ''

    const messages = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\n--- COURSE MATERIALS (FILTERED) ---\n${filteredMaterials}\n--- END COURSE MATERIALS ---`
      }
    ]

    const recentHistory = conversationHistory.slice(-10)
    messages.push(...recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })))

    messages.push({ role: 'user', content: userMessage })

    const isDirectAnswer = looksLikeDirectAnswerRequest(userMessage)
    if (isDirectAnswer) {
      messages.push({
        role: 'system',
        content: 'The student appears to be asking for a direct answer. Politely decline and offer to help them understand the concept instead.'
      })
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Prefer 4o-mini for better reasoning/speed
        messages,
        temperature: 0.7,
        max_tokens: 1000, // increased for longer explanations
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

    // Determine if the AI actually used the notes based on its response or matched keywords
    const scored = hasMaterials ? scoreChunks(userMessage, courseMaterials) : []
    const hasNoteCoverage = scored.length > 0 && scored[0].hits >= 2

    // Default to 'ai' tag unless we are confident it's from class or AI tagged it itself
    let finalSourceTag = 'ai'
    if (hasNoteCoverage || /^\[FROM CLASS MATERIALS\]/i.test(aiText)) {
      finalSourceTag = 'class'
    }

    const finalText = ensureSourceTag(aiText, finalSourceTag)
    return finalText

  } catch (error) {
    console.error('Error calling OpenAI API:', error)

    if (error.message.includes('API key')) {
      throw new Error('OpenAI API configuration error. Please contact your teacher.')
    }

    throw error
  }
}
