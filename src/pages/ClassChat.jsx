import React, { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { SignedIn, UserButton, useUser } from '@clerk/clerk-react'
import { getClassByCode, isStudentEnrolled } from '../utils/storage'
import { sendMessageToAI } from '../utils/openai'

function ClassChat() {
  const { classCode } = useParams()
  const { user } = useUser()
  const navigate = useNavigate()
  const [classData, setClassData] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  )))
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!user) {
      navigate('/student')
      return
    }

    const data = getClassByCode(classCode)
    if (!data) {
      navigate('/student')
      return
    }

    if (!isStudentEnrolled(user.id, classCode)) {
      navigate('/student')
      return
    }

    setClassData(data)
    
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: `Hello! I'm your AI tutor for ${data.name}. I'm here to help you understand the course material and guide you through concepts. Please note that I won't provide direct answers to assignments, but I'll help you learn and understand the material better. What would you like to explore today?`
    }])
  }, [user, classCode, navigate])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    
    // Add user message
    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      // Send to OpenAI
      const response = await sendMessageToAI(userMessage, classData.materials, newMessages)
      setMessages([...newMessages, { role: 'assistant', content: response }])
    } catch (error) {
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: 'I apologize, but I encountered an error. Please try again.' 
      }])
    }
    
    setIsLoading(false)
  }

  if (!classData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            border: '4px solid #E5E7EB',
            borderTopColor: '#3B82F6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#6B7280' }}>Loading class...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'white' }}>
      {/* Header */}
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0', flexShrink: 0 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link 
              to="/student"
              style={{
                padding: '8px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6B7280',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#F3F4F6'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                {classData.name}
              </h1>
              {classData.subject && (
                <p style={{ fontSize: '14px', color: '#6B7280' }}>
                  {classData.subject}
                </p>
              )}
            </div>
          </div>
          
          <SignedIn>
            <UserButton afterSignOutUrl="/AISCHOOL3/" />
          </SignedIn>
        </div>
      </nav>

      {/* Messages Area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '24px',
        background: '#F9FAFB'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {messages.map((message, index) => (
            <div 
              key={index}
              style={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '16px'
              }}
            >
              <div style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '12px',
                background: message.role === 'user' ? '#3B82F6' : 'white',
                color: message.role === 'user' ? 'white' : '#111827',
                boxShadow: message.role === 'assistant' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}>
                {message.content}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'white',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  background: '#9CA3AF',
                  borderRadius: '50%',
                  animation: 'pulse 1.4s ease-in-out 0s infinite'
                }}></div>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  background: '#9CA3AF',
                  borderRadius: '50%',
                  animation: 'pulse 1.4s ease-in-out 0.2s infinite'
                }}></div>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  background: '#9CA3AF',
                  borderRadius: '50%',
                  animation: 'pulse 1.4s ease-in-out 0.4s infinite'
                }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div style={{ 
        borderTop: '1px solid #E5E7EB', 
        padding: '16px 24px',
        background: 'white',
        flexShrink: 0
      }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ 
            display: 'flex', 
            gap: '12px',
            padding: '12px',
            border: '2px solid #E5E7EB',
            borderRadius: '12px',
            background: 'white',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#3B82F6'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the course material..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '16px',
                background: 'transparent',
                color: '#111827'
              }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              style={{
                padding: '10px 20px',
                background: (!input.trim() || isLoading) ? '#E5E7EB' : '#3B82F6',
                color: (!input.trim() || isLoading) ? '#9CA3AF' : 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isLoading ? (
                <>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid #9CA3AF',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite'
                  }}></div>
                  Thinking...
                </>
              ) : (
                <>
                  Send
                  <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
          <p style={{ 
            fontSize: '12px', 
            color: '#6B7280', 
            marginTop: '12px',
            textAlign: 'center'
          }}>
            This AI tutor is here to help you learn. It won't provide direct answers to assignments.
          </p>
        </form>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default ClassChat
