import React, { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { SignedIn, UserButton, useUser } from '@clerk/clerk-react'
import { getClassByCode, isStudentEnrolled } from '../utils/storage'
import { sendMessageToAI } from '../utils/openai'
import ReactMarkdown from 'react-markdown'

import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

function ClassChat() {
  const { classCode } = useParams()
  const { user } = useUser()
  const navigate = useNavigate()

  const [classData, setClassData] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user) {
      navigate('/student')
      return
    }

    const data = getClassByCode(classCode)
    if (!data || !isStudentEnrolled(user.id, classCode)) {
      navigate('/student')
      return
    }

    setClassData(data)

    setMessages([{
      role: 'assistant',
      content: `Hello! I'm your AI tutor for ${data.name}.

Ask questions using **math like this**:

Inline: $\\frac{1}{2}$  
Block:
$$
\\int_0^1 x^2 \\, dx
$$`
    }])
  }, [user, classCode, navigate])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleFileSelect = (e) => {
    setSelectedFiles(Array.from(e.target.files))
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if ((!input.trim() && selectedFiles.length === 0) || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    const newMessage = {
      role: 'user',
      content: userMessage || '(File attached)'
    }

    const newMessages = [...messages, newMessage]
    setMessages(newMessages)

    try {
      const response = await sendMessageToAI(userMessage, classCode, newMessages)
      setMessages([...newMessages, { role: 'assistant', content: response }])
    } catch {
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'I ran into an error. Please try again.'
      }])
    }

    setIsLoading(false)
  }

  if (!classData) return null

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ padding: 16, borderBottom: '1px solid #E5E7EB' }}>
        <Link to="/student">← Back</Link>
        <SignedIn><UserButton /></SignedIn>
      </nav>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#F9FAFB' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 24 }}>
            <div style={{
              background: m.role === 'user' ? '#3B82F6' : 'white',
              color: m.role === 'user' ? 'white' : '#0F172A',
              padding: 16,
              borderRadius: 12,
              maxWidth: '80%'
            }}>
              {m.role === 'assistant' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {m.content}
                </ReactMarkdown>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={{ padding: 16, borderTop: '1px solid #E5E7EB' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question…"
          style={{ width: '80%', padding: 12 }}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </div>
  )
}

export default ClassChat
