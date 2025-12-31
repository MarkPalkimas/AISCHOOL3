// OpenAI API integration for AI chat functionality

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY

// System prompt that prevents direct answer-giving and prioritizes class materials
const SYSTEM_PROMPT = `You are an educational AI tutor assistant for a specific class. Your role is to help students LEARN and UNDERSTAND concepts based on their class curriculum, not to provide direct answers to their assignments or homework.

CRITICAL RULES - FOLLOW THESE FIRST:
1. ALWAYS base your responses on the COURSE MATERIALS provided below
2. If a question is NOT covered in the course materials, respond EXACTLY with:
   "This is not covered in your curriculum but I can tell you more if you're interested."
3. When asked for practice problems, ONLY generate questions based on topics found in the course materials
4. NEVER ask the student what subject they want - the course materials define the subject
5. The course materials are your PRIMARY and PREFERRED source of information

IMPORTANT GUIDELINES:
1. NEVER provide direct answers to homework problems, assignments, or test questions
2. Instead of giving answers, guide students through the problem-solving process
3. Ask leading questions that help students think critically
4. Break down complex concepts into simpler parts
5. Provide examples and analogies to aid understanding
6. Encourage students to explain their thinking
7. If a student asks for a direct answer, politely refuse and offer to help them understand instead

FORMATTING GUIDELINES:
- Use proper LaTeX formatting for ALL mathematical expressions
- For inline math, use single dollar signs: $x^2 + y^2 = r^2$
- For display math (centered equations), use double dollar signs on separate lines:
$$
\\frac{d}{dt}x(t) = v(t)
$$
- NEVER use parentheses like (x) or \\( \\) for math - always use dollar signs
- Format code blocks with triple backticks and language identifier
- Use markdown formatting for better readability

When a student asks a question:
- First, check if the topic is covered in the course materials below
- If not covered, use the exact off-topic response specified above
- If covered, assess if they're asking for understanding or a direct answer
- If seeking understanding, provide helpful explanations and guidance based on course materials
- If seeking a direct answer to an assignment, redirect them to learning the concept
- Always be encouraging and supportive
- Use Socratic questioning to develop critical thinking
- Format all math expressions properly with LaTeX using $ and $$

You have access to the following course materials that you should reference when helping students:`


// Truncate course materials if they're too large to prevent token limit issues
function truncateCourseMaterials(materials, maxChars = 8000) {
  if (!materials || materials.length <= maxChars) {
    return materials
  }

  const truncated = materials.substring(0, maxChars)
  return `${truncated}\n\n[Note: Course materials truncated due to size. Showing first ${maxChars} characters.]`
}

export async function sendMessageToAI(userMessage, courseMaterials, conversationHistory = []) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Please add VITE_OPENAI_API_KEY to your .env file.')
  }

  try {
    // Truncate course materials if too large
    const processedMaterials = truncateCourseMaterials(courseMaterials)

    // Detect if the message is asking for direct answers
    const directAnswerKeywords = [
      'what is the answer',
      'give me the answer',
      'solve this for me',
      'do my homework',
      'complete this assignment',
      'what should i write'
    ]

    const isAskingForDirectAnswer = directAnswerKeywords.some(keyword =>
      userMessage.toLowerCase().includes(keyword)
    )

    // Build messages array for OpenAI
    const messages = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\n--- COURSE MATERIALS ---\n${processedMaterials}\n--- END COURSE MATERIALS ---`
      }
    ]

    // Add conversation history (limit to last 10 messages to manage token usage)
    const recentHistory = conversationHistory.slice(-10)
    messages.push(...recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })))

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    })

    // If clearly asking for direct answer, add an extra system message
    if (isAskingForDirectAnswer) {
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
        messages: messages,
        temperature: 0.7,
        max_tokens: 800,
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
        throw new Error('Rate limit exceeded. Check your OpenAI billing/credits.')
      } else {
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`)
      }
    }

    const data = await response.json()

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from AI')
    }

    return data.choices[0].message.content

  } catch (error) {
    console.error('Error calling OpenAI API:', error)

    if (error.message.includes('API key')) {
      throw new Error('OpenAI API configuration error. Please contact your teacher.')
    }

    throw error
  }
}
