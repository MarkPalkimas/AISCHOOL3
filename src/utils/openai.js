// OpenAI API integration for AI chat functionality

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY

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

RESPONSE FORMAT EXAMPLES:
✓ CORRECT: "[FROM CLASS MATERIALS] According to your class notes on photosynthesis, the process involves..."
✓ CORRECT: "[AI GENERAL KNOWLEDGE] 📚 Note: This topic isn't covered in your teacher's course materials, so I'm using my general knowledge to help you. Let me explain quantum mechanics..."
✗ INCORRECT: "Based on the materials..." (missing source tag)
✗ INCORRECT: Starting response without [FROM CLASS MATERIALS] or [AI GENERAL KNOWLEDGE]

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
    'the','a','an','and','or','but','if','then','else','when','where','what','why','how','who',
    'is','are','was','were','be','been','being','do','does','did',
    'i','me','my','mine','you','your','yours','we','our','they','their',
    'to','of','in','on','at','for','with','about','as','by','from','into','over','under',
    'this','that','these','those','it','its','can','could','should','would','will','just',
    'please','give','answer','solve','help','explain'
  ])

  const words = normalizeText(userMessage).split(' ')
  const keywords = []
  for (const w of words) {
    if (!w) continue
    if (w.length < 3) continue
    if (stop.has(w)) continue
    keywords.push(w)
  }

  //keep top unique (preserve order)
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
  //split by blank lines first, then fallback to line splitting
  const raw = (courseMaterials || '').trim()
  if (!raw) return []

  const paras = raw.split(/\n\s*\n+/g).map(s => s.trim()).filter(Boolean)
  if (paras.length >= 4) return paras

  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean)
  return lines
}

function findRelevantMaterialSnippets(userMessage, courseMaterials) {
  const keywords = getQueryKeywords(userMessage)
  if (!keywords.length) return { snippets: [], score: 0 }

  const chunks = splitIntoChunks(courseMaterials)
  if (!chunks.length) return { snippets: [], score: 0 }

  const scored = chunks.map((chunk) => {
    const n = normalizeText(chunk)
    let hits = 0
    for (const k of keywords) {
      if (n.includes(k)) hits += 1
    }

    //light boost if chunk looks like a heading/definition/explanation
    const bonus =
      /definition|example|formula|theorem|rule|step|procedure|concept|overview|lecture|chapter/i.test(chunk)
        ? 0.5
        : 0

    return { chunk, hits, score: hits + bonus }
  }).filter(x => x.hits > 0)

  scored.sort((a, b) => b.score - a.score)

  const top = scored.slice(0, 4).map(x => x.chunk)
  const totalScore = scored.slice(0, 4).reduce((acc, x) => acc + x.score, 0)

  return { snippets: top, score: totalScore }
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

function buildMaterialsFirstResponse(userMessage, snippets, isDirectAnswer) {
  //Never dump full materials; just cite small relevant pieces and teach
  const excerpt = snippets
    .slice(0, 3)
    .map((s, i) => `• Excerpt ${i + 1}: ${s}`)
    .join('\n')

  if (isDirectAnswer) {
    return `[FROM CLASS MATERIALS] I can’t give you a direct answer, but I *can* help you get it using your class notes.\n\nHere are the most relevant parts of your teacher’s materials:\n${excerpt}\n\nLet’s work through it:\n1) Which excerpt seems most directly related to your question?\n2) What key term or rule is the excerpt emphasizing?\n3) Try writing 1–2 sentences in your own words summarizing that idea, and I’ll help you refine it.`
  }

  return `[FROM CLASS MATERIALS] Here’s what your teacher’s materials say that connects to your question:\n${excerpt}\n\nNow let’s make sure you understand it:\n- In your own words, what is the main idea in the most relevant excerpt?\n- What part is confusing (a term, a step, or the “why” behind it)?\n- Want a quick practice check: how would you apply that idea to a simple example?`
}

export async function sendMessageToAI(userMessage, courseMaterials, conversationHistory = []) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Please add VITE_OPENAI_API_KEY to your .env file.')
  }

  try {
    const isDirectAnswer = looksLikeDirectAnswerRequest(userMessage)

    //MATERIALS-FIRST: try to answer from course materials locally before calling OpenAI
    const hasMaterials = !!(courseMaterials && courseMaterials.trim().length > 0)
    if (hasMaterials) {
      const { snippets, score } = findRelevantMaterialSnippets(userMessage, courseMaterials)

      //threshold: if we found meaningful overlap, respond using materials without OpenAI call
      if (snippets.length > 0 && score >= 2) {
        const localResponse = buildMaterialsFirstResponse(userMessage, snippets, isDirectAnswer)
        return ensureSourceTag(localResponse, 'class')
      }
    }

    //If not covered by materials, use OpenAI (but enforce the tag + disclaimer via system prompt)
    const messages = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\n--- COURSE MATERIALS ---\n${courseMaterials || ''}\n--- END COURSE MATERIALS ---`
      }
    ]

    //Add conversation history (limit to last 10 messages to manage token usage)
    const recentHistory = conversationHistory.slice(-10)
    messages.push(...recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })))

    //Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    })

    //If clearly asking for direct answer, add an extra system message
    if (isDirectAnswer) {
      messages.push({
        role: 'system',
        content: 'The student appears to be asking for a direct answer. Politely decline and offer to help them understand the concept instead.'
      })
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.6,
        frequency_penalty: 0.3
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('OpenAI API Error:', errorData)

      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your configuration.')
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.')
      } else {
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`)
      }
    }

    const data = await response.json()
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from AI')
    }

    const aiText = data.choices[0].message.content || ''

    //Hard guarantee the tag exists so your UI badge always works
    //If we're here, it means materials were not confidently matched -> AI GENERAL KNOWLEDGE
    const finalText = ensureSourceTag(aiText, 'ai')
    return finalText

  } catch (error) {
    console.error('Error calling OpenAI API:', error)

    if (error.message.includes('API key')) {
      throw new Error('OpenAI API configuration error. Please contact your teacher.')
    }

    throw error
  }
}
