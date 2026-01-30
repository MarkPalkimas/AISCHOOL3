import React, { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { SignedIn, UserButton, useUser } from '@clerk/clerk-react'
import { getClassByCode, isStudentEnrolled } from '../utils/storage'
import { sendMessageToAI } from '../utils/openai'
import ReactMarkdown from 'react-markdown'

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

  // Simplistic parsing for the new multi-section format
  const parseAIResponse = (content) => {
    // The new spec uses [Material], [Code], [AI], [Check]
    // For now we just return the content as-is to let the AI's internal formatting shine
    return { content }
  }

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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      setSelectedFiles(files)
    }
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if ((!input.trim() && selectedFiles.length === 0) || isLoading) return

    const userMessage = input.trim()
    setInput('')

    // Process files to base64
    const fileData = await Promise.all(
      selectedFiles.map(async (file) => {
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            resolve({
              name: file.name,
              type: file.type,
              size: file.size,
              data: reader.result
            })
          }
          reader.readAsDataURL(file)
        })
      })
    )

    // Add user message with files
    const newMessage = {
      role: 'user',
      content: userMessage || '(File attached)',
      files: fileData.length > 0 ? fileData : undefined
    }
    const newMessages = [...messages, newMessage]
    setMessages(newMessages)
    setSelectedFiles([])
    setIsLoading(true)

    try {
      // Create context about files for AI
      let messageWithFileContext = userMessage
      if (fileData.length > 0) {
        const fileDescriptions = fileData.map(f => `${f.name} (${f.type})`).join(', ')
        messageWithFileContext = `${userMessage}\n\n[User has attached files: ${fileDescriptions}]`
      }

      // Send to OpenAI
      const response = await sendMessageToAI(messageWithFileContext, classCode, newMessages)
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
            <UserButton afterSignOutUrl="/" />
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
          {messages.map((message, index) => {
            // Parse AI responses to extract source information
            const isAssistant = message.role === 'assistant'

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '32px'
                }}
              >
                <div style={{
                  maxWidth: '90%',
                  borderRadius: isAssistant ? '12px 24px 24px 24px' : '24px 24px 4px 24px',
                  background: message.role === 'user' ? '#3B82F6' : 'white',
                  color: message.role === 'user' ? 'white' : '#1E293B',
                  boxShadow: isAssistant ? '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)' : 'none',
                  border: isAssistant ? '1px solid #F1F5F9' : 'none',
                  overflow: 'hidden'
                }}>
                  {/* The response format will now include [Phase] headers which we render via ReactMarkdown */}

                  {message.files && message.files.length > 0 && (
                    <div style={{ padding: '12px 16px', borderBottom: message.role === 'user' ? '1px solid rgba(255,255,255,0.2)' : '1px solid #E5E7EB' }}>
                      {message.files.map((file, fileIndex) => (
                        <div key={fileIndex} style={{ marginBottom: fileIndex < message.files.length - 1 ? '8px' : '0' }}>
                          {file.type.startsWith('image/') ? (
                            <img
                              src={file.data}
                              alt={file.name}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '200px',
                                borderRadius: '8px',
                                display: 'block'
                              }}
                            />
                          ) : (
                            <a
                              href={file.data}
                              download={file.name}
                              style={{
                                color: message.role === 'user' ? 'white' : '#3B82F6',
                                textDecoration: 'underline',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {file.name}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div
                    className="prose-chat"
                    style={{
                      padding: '20px 24px',
                      lineHeight: '1.7',
                      fontSize: '15.5px'
                    }}
                  >
                    {isAssistant ? (
                      <ReactMarkdown
                        components={{
                          h3: ({ node, ...props }) => {
                            // Determine style based on header text content
                            const text = props.children?.[0] || ''
                            let bg = '#F1F5F9'
                            let color = '#475569'
                            let icon = ''

                            if (text.includes('Materials')) { bg = '#ECFDF5'; color = '#047857'; icon = '📚' }
                            else if (text.includes('Code')) { bg = '#EFF6FF'; color = '#1D4ED8'; icon = '💻' }
                            else if (text.includes('AI Tutor')) { bg = '#FAF5FF'; color = '#7E22CE'; icon = '🎓' }
                            else if (text.includes('Check')) { bg = '#FFF7ED'; color = '#C2410C'; icon = '✅' }

                            return (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: bg,
                                color: color,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                marginTop: '20px',
                                marginBottom: '12px',
                                border: `1px solid ${bg === '#F1F5F9' ? '#E2E8F0' : 'transparent'}`
                              }}>
                                <span style={{ fontSize: '16px' }}>{icon}</span>
                                <h3 style={{
                                  fontSize: '13px',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  margin: 0
                                }} {...props} />
                              </div>
                            )
                          },
                          p: ({ node, ...props }) => <p style={{ marginBottom: '16px' }} {...props} />,
                          ul: ({ node, ...props }) => <ul style={{ marginBottom: '16px', paddingLeft: '20px', listStyleType: 'disc' }} {...props} />,
                          li: ({ node, ...props }) => <li style={{ marginBottom: '8px' }} {...props} />,
                          strong: ({ node, ...props }) => <strong style={{ color: '#0F172A', fontWeight: 800 }} {...props} />
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

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
          {/* File Preview */}
          {selectedFiles.length > 0 && (
            <div style={{
              marginBottom: '12px',
              padding: '12px',
              background: '#F3F4F6',
              borderRadius: '8px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {selectedFiles.map((file, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  background: 'white',
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB'
                }}>
                  <svg style={{ width: '16px', height: '16px', color: '#6B7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span style={{ fontSize: '14px', color: '#374151' }}>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    style={{
                      padding: '2px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9CA3AF',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

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
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => !isLoading && (e.currentTarget.style.color = '#3B82F6')}
              onMouseOut={(e) => e.currentTarget.style.color = '#6B7280'}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
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
              disabled={(!input.trim() && selectedFiles.length === 0) || isLoading}
              style={{
                padding: '10px 20px',
                background: ((!input.trim() && selectedFiles.length === 0) || isLoading) ? '#E5E7EB' : '#3B82F6',
                color: ((!input.trim() && selectedFiles.length === 0) || isLoading) ? '#9CA3AF' : 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: ((!input.trim() && selectedFiles.length === 0) || isLoading) ? 'not-allowed' : 'pointer',
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
      `}</style>
    </div>
  )
}

export default ClassChat
