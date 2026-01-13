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

export async function sendMessageToAI(userMessage, courseMaterials, conversationHistory = []) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Please add VITE_OPENAI_API_KEY to your .env file.')
  }

  try {
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
        content: `${SYSTEM_PROMPT}\n\n--- COURSE MATERIALS ---\n${courseMaterials}\n--- END COURSE MATERIALS ---`
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

    return data.choices[0].message.content

  } catch (error) {
    console.error('Error calling OpenAI API:', error)
    
    if (error.message.includes('API key')) {
      throw new Error('OpenAI API configuration error. Please contact your teacher.')
    }
    
    throw error
  }
}
