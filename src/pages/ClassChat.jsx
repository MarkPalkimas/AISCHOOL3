// src/pages/ClassChat.jsx
import React, { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { SignedIn, useUser, useClerk } from '@clerk/clerk-react'
import { getClassByCode } from '../utils/storage'
import { sendMessageToAI } from '../utils/openai'
import UserMenu from '../components/UserMenu'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const BASE = import.meta.env.BASE_URL
const abs = (path = '') => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/')
  const rel = String(path).replace(/^\/+/, '')
  return `${window.location.origin}${base}${rel}`
}

function MessageBubble({ role, content }) {
  return (
    <div className={`msg ${role === 'user' ? 'user' : 'ai'}`}>
      <div
        style={{
          width: 32, height: 32, borderRadius: 8, overflow: 'hidden',
          border: '1px solid #e5e7eb', background: '#fff', display: 'grid', placeItems: 'center',
          flexShrink: 0
        }}
      >
        {role === 'user' ? (
          <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 600 }}>U</span>
        ) : (
          <img src={`${BASE}Logo.jpg`} alt="AI" style={{ width: 24, height: 24 }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="who" style={{ marginBottom: 4, fontSize: 13, color: '#6B7280', fontWeight: 500 }}>
          {role === 'user' ? 'You' : 'StudyGuideAI'}
        </div>
        <div className="bubble prose">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code({ node, inline, className, children, ...props }) {
                return !inline ? (
                  <pre className={className} style={{ background: '#1f2937', color: '#e5e7eb', padding: '12px', borderRadius: '8px', overflowX: 'auto' }}>
                    <code {...props} style={{ fontFamily: 'monospace' }}>{children}</code>
                  </pre>
                ) : (
                  <code className={className} {...props} style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9em' }}>
                    {children}
                  </code>
                )
              }
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        <div className="tools" style={{ marginTop: 6, opacity: 0.6 }}>
          <button
            className="pill"
            onClick={() => navigator.clipboard?.writeText(content)}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer' }}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ClassChat() {
  const { classCode } = useParams()
  const { user, isLoaded, isSignedIn } = useUser()
  const { redirectToSignIn } = useClerk()
  const navigate = useNavigate()

  const [classData, setClassData] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    setClassData(getClassByCode(classCode))
  }, [classCode])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (!classData) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Class Not Found</h2>
          <button className="btn-primary" onClick={() => navigate('/student')}>Go to Student</button>
        </div>
      </div>
    )
  }

  if (!isLoaded) return null

  const onSubmit = async (e) => {
    e.preventDefault()

    if (!isSignedIn) {
      redirectToSignIn({
        redirectUrl: abs(`class/${classCode}`),
        signUpUrl: abs(`class/${classCode}`)
      })
      return
    }

    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    const pending = [...messages, { role: 'user', content: userMessage }]
    setMessages(pending)
    setIsLoading(true)

    try {
      const reply = await sendMessageToAI(userMessage, classData.materials, pending)
      setMessages([...pending, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err?.message || 'Error.')
      setMessages([
        ...pending,
        { role: 'assistant', content: 'Sorry — I hit an error. Try again.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ borderBottom: '1px solid #E5E7EB', padding: '12px 0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" className="nav-brand">
            <img src={`${BASE}Logo.jpg`} alt="StudyGuideAI Logo" style={{ width: 32, height: 32 }} />
            <span style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>StudyGuideAI</span>
          </Link>
          <SignedIn>
            <UserMenu />
          </SignedIn>
        </div>
      </nav>

      <div className="container" style={{ padding: '18px 0 6px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{classData.name}</h1>
        <div style={{ color: '#6B7280', fontSize: 13 }}>Class code: <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>{classData.code}</code></div>
      </div>

      <div className="container" style={{ flex: 1, padding: '8px 0 18px', display: 'flex', flexDirection: 'column' }}>
        <div className="feature-card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '65vh' }}>
          <div className="chat-wrap" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 'auto', marginBottom: 'auto' }}>
                <p>Ask a question to get started.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role === 'user' ? 'user' : 'assistant'} content={m.content} />
            ))}

            {isLoading && (
              <div className="msg ai">
                <div style={{
                  width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
                  background: '#fff', display: 'grid', placeItems: 'center'
                }}>
                  <img src={`${BASE}Logo.jpg`} alt="AI" style={{ width: 24 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="who" style={{ marginBottom: 4, fontSize: 13, color: '#6B7280', fontWeight: 500 }}>StudyGuideAI</div>
                  <div className="bubble prose" style={{ color: '#6B7280', fontStyle: 'italic' }}>Thinking…</div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={onSubmit} className="chat-input" style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmit(e)
              }
            }}
            placeholder="Ask anything… (Shift+Enter for new line)"
            rows={1}
            style={{
              flex: 1, padding: '14px 16px', borderRadius: 12,
              border: '1px solid #D1D5DB', minHeight: 50, maxHeight: 120,
              resize: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              fontSize: 15
            }}
            disabled={isLoading}
          />
          <button
            className="btn-primary"
            disabled={isLoading || !input.trim()}
            style={{ padding: '0 24px', borderRadius: 12, height: 50, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {isLoading ? 'Sending…' : (
              <>
                <span>Send</span>
                <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </>
            )}
          </button>
        </form>

        {error && <p style={{ color: '#EF4444', marginTop: 8, fontSize: 14 }}>{error}</p>}
      </div>
    </div>
  )
}

