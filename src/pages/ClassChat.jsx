import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { SignedIn, UserButton, useAuth, useUser } from '@clerk/clerk-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

import { getClassByCode, getStudentClasses, isStudentEnrolled, syncClassMaterials } from '../utils/storage'
import {
  fetchChatHistory,
  fetchConversation,
  sendChatMessage,
  toChatAttachmentPayload,
} from '../utils/chatApi'

const HISTORY_LIMIT = 5

function createLocalMessageId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function formatChatTimestamp(timestamp) {
  const value = Number(timestamp)
  if (!Number.isFinite(value)) return ''

  const date = new Date(value)
  const now = new Date()
  const isSameDay = date.toDateString() === now.toDateString()
  const isSameYear = date.getFullYear() === now.getFullYear()

  if (isSameDay) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(isSameYear ? {} : { year: 'numeric' }),
  }).format(date)
}

function formatFileSize(size) {
  const value = Number(size)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`
  return `${Math.round(value / 104857.6) / 10} MB`
}

function readHeadingText(children) {
  return React.Children.toArray(children)
    .map((child) => (typeof child === 'string' ? child : ''))
    .join('')
}

const markdownComponents = {
  h3: ({ children, ...props }) => {
    const heading = readHeadingText(children).toLowerCase()
    let className = 'chat-section-chip'

    if (heading.includes('materials')) className += ' is-materials'
    else if (heading.includes('code')) className += ' is-code'
    else if (heading.includes('tutor')) className += ' is-tutor'
    else if (heading.includes('check')) className += ' is-check'

    return (
      <div className={className}>
        <h3 {...props}>{children}</h3>
      </div>
    )
  },
  a: ({ ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
  code: ({ inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code className="chat-inline-code" {...props}>
          {children}
        </code>
      )
    }

    return (
      <pre className="chat-code-block">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    )
  },
}

function HistorySkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={`history-skeleton-${index}`} className="chat-history-item is-skeleton">
          <div className="loading-pulse loading-line short" />
          <div className="loading-pulse loading-line" />
          <div className="loading-pulse loading-line tiny" />
        </div>
      ))}
    </>
  )
}

function ConversationSkeleton() {
  return (
    <div className="chat-thread">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`conversation-skeleton-${index}`}
          className={`chat-message-row ${index % 2 === 0 ? 'is-assistant' : 'is-user'}`}
        >
          <div className="chat-bubble is-skeleton">
            <div className="loading-pulse loading-line" />
            <div className="loading-pulse loading-line short" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyConversation({ classData }) {
  return (
    <div className="chat-empty-state">
      <div className="chat-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M7 16h10a3 3 0 003-3V7a3 3 0 00-3-3H7a3 3 0 00-3 3v6a3 3 0 003 3zm0 0l-3 3v-3" />
        </svg>
      </div>
      <h2>{classData?.name || 'Class chat'}</h2>
      <p>Start a new conversation or reopen a recent thread from the sidebar. Uploaded class materials are still used for retrieval.</p>
      <div className="chat-empty-tips">
        <span>Review a lecture concept</span>
        <span>Check a homework step</span>
        <span>Ask for grounded source context</span>
      </div>
    </div>
  )
}

function ClassChat() {
  const { classCode } = useParams()
  const { user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedChatId = (searchParams.get('chat') || '').trim()

  const [classData, setClassData] = useState(null)
  const [classList, setClassList] = useState([])
  const [pageError, setPageError] = useState('')
  const [isPageLoading, setIsPageLoading] = useState(true)

  const [history, setHistory] = useState([])
  const [historyError, setHistoryError] = useState('')
  const [historyReady, setHistoryReady] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  const [activeChatId, setActiveChatId] = useState('')
  const [messages, setMessages] = useState([])
  const [conversationError, setConversationError] = useState('')
  const [isConversationLoading, setIsConversationLoading] = useState(false)

  const [input, setInput] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [composerError, setComposerError] = useState('')
  const [isSending, setIsSending] = useState(false)

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const inputElement = inputRef.current
    if (!inputElement) return

    inputElement.style.height = '0px'
    const nextHeight = Math.min(Math.max(inputElement.scrollHeight, 44), 160)
    inputElement.style.height = `${nextHeight}px`
    inputElement.style.overflowY = inputElement.scrollHeight > nextHeight ? 'auto' : 'hidden'
  }, [input])

  useEffect(() => {
    let cancelled = false

    async function loadClass() {
      if (!user) {
        navigate('/student', { replace: true })
        return
      }

      setIsPageLoading(true)
      setPageError('')

      try {
        const token = await getToken()
        const [data, enrolled] = await Promise.all([
          getClassByCode(token, classCode),
          isStudentEnrolled(token, classCode),
        ])

        if (!data || !enrolled) {
          if (!cancelled) navigate('/student', { replace: true })
          return
        }

        await syncClassMaterials(token, classCode)
        const studentClasses = await getStudentClasses(token).catch(() => [])

        if (cancelled) return
        setClassData(data)
        setClassList(studentClasses || [])
      } catch (error) {
        if (cancelled) return
        setPageError(error?.message || 'Failed to load this class.')
      } finally {
        if (!cancelled) setIsPageLoading(false)
      }
    }

    loadClass()
    return () => {
      cancelled = true
    }
  }, [classCode, getToken, navigate, user])

  useEffect(() => {
    if (!classData || !user) return
    let cancelled = false

    async function loadHistory() {
      setIsHistoryLoading(true)
      setHistoryReady(false)
      setHistoryError('')

      try {
        const token = await getToken()
        const previews = await fetchChatHistory({
          token,
          classCode,
          limit: HISTORY_LIMIT,
        })

        if (cancelled) return
        setHistory(previews)
      } catch (error) {
        if (cancelled) return
        setHistory([])
        setHistoryError(error?.message || 'Failed to load previous chats.')
      } finally {
        if (!cancelled) {
          setHistoryReady(true)
          setIsHistoryLoading(false)
        }
      }
    }

    loadHistory()
    return () => {
      cancelled = true
    }
  }, [classCode, classData, getToken, user])

  useEffect(() => {
    if (!classData || !historyReady) return

    if (!requestedChatId) {
      setActiveChatId('')
      setMessages([])
      setConversationError('')
      setIsConversationLoading(false)
      return
    }

    if (!history.some((item) => item.id === requestedChatId)) {
      setSearchParams({}, { replace: true })
      return
    }

    let cancelled = false

    async function loadConversation() {
      setIsConversationLoading(true)
      setConversationError('')

      try {
        const token = await getToken()
        const conversation = await fetchConversation({
          token,
          classCode,
          conversationId: requestedChatId,
        })

        if (cancelled) return
        setActiveChatId(conversation.id)
        setMessages(conversation.messages)
      } catch (error) {
        if (cancelled) return
        setMessages([])
        setConversationError(error?.message || 'Failed to load that conversation.')
      } finally {
        if (!cancelled) setIsConversationLoading(false)
      }
    }

    loadConversation()
    return () => {
      cancelled = true
    }
  }, [classCode, classData, getToken, history, historyReady, requestedChatId, setSearchParams])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: isSending ? 'smooth' : 'auto',
      block: 'end',
    })
  }, [activeChatId, isSending, messages])

  const isComposerDisabled = isSending || isConversationLoading
  const isSendDisabled = (!input.trim() && selectedFiles.length === 0) || isComposerDisabled

  function updateHistoryList(preview) {
    if (!preview?.id) return

    setHistory((current) => {
      const next = [preview, ...current.filter((item) => item.id !== preview.id)]
      next.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
      return next.slice(0, HISTORY_LIMIT)
    })
  }

  function handleNewChat() {
    if (isSending) return

    setSearchParams({}, { replace: true })
    setActiveChatId('')
    setMessages([])
    setConversationError('')
    setComposerError('')
    setInput('')
    setSelectedFiles([])
    inputRef.current?.focus()
  }

  function handleOpenConversation(conversationId) {
    if (!conversationId || isSending || conversationId === activeChatId) return
    setSearchParams({ chat: conversationId })
  }

  function handleFileSelect(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    setSelectedFiles((current) => [...current, ...files].slice(0, 6))
    event.target.value = ''
  }

  function removeSelectedFile(index) {
    setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
  }

  function handleComposerKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (isSendDisabled) return
    event.currentTarget.form?.requestSubmit()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSendDisabled) return

    const trimmedInput = input.trim()
    const pendingFiles = [...selectedFiles]
    const attachments = pendingFiles.map(toChatAttachmentPayload).filter(Boolean)
    const previousMessages = messages
    const optimisticUserMessage = {
      id: createLocalMessageId('user'),
      role: 'user',
      content: trimmedInput || (attachments.length === 1 ? `Attachment uploaded: ${attachments[0].name}` : 'Attachments uploaded'),
      ts: Date.now(),
      attachments,
    }

    setComposerError('')
    setInput('')
    setSelectedFiles([])
    setIsSending(true)
    setMessages([...previousMessages, optimisticUserMessage])

    try {
      const token = await getToken()
      const response = await sendChatMessage({
        token,
        userMessage: trimmedInput,
        classCode,
        conversationId: activeChatId || undefined,
        attachments,
      })

      const assistantMessage = {
        id: createLocalMessageId('assistant'),
        role: 'assistant',
        content: response.text || 'I could not generate a response for that request.',
        ts: Date.now() + 1,
        attachments: [],
      }

      setMessages([...previousMessages, optimisticUserMessage, assistantMessage])

      if (response.conversation?.id) {
        setActiveChatId(response.conversation.id)
        updateHistoryList(response.conversation)
        setSearchParams({ chat: response.conversation.id }, { replace: Boolean(activeChatId) })
      }
    } catch (error) {
      setMessages(previousMessages)
      setInput(trimmedInput)
      setSelectedFiles(pendingFiles)
      setComposerError(error?.message || 'Unable to send that message right now.')
    } finally {
      setIsSending(false)
    }
  }

  if (isPageLoading) {
    return (
      <div className="app-loading-screen">
        <div className="app-spinner" />
        <p>Loading class workspace…</p>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="app-loading-screen">
        <div className="surface-card status-banner is-error">
          <strong>Unable to load this class</strong>
          <span>{pageError}</span>
        </div>
        <Link to="/student" className="btn-secondary">Back to classes</Link>
      </div>
    )
  }

  return (
    <div className="chat-shell chat-shell--workspace">
      <div className="chat-grid chat-grid--workspace">
        <aside className="chat-sidebar chat-sidebar--workspace">
          <div className="chat-sidebar__brand">
            <Link to="/student" className="workspace-brand__link">
              <img src="/Logo.jpg" alt="StudyGuide AI Logo" className="workspace-brand__logo" />
              <div>
                <span className="workspace-brand__title">StudyGuide AI</span>
                <span className="workspace-brand__subtitle">Class Tutor</span>
              </div>
            </Link>
          </div>

          <button
            type="button"
            className="chat-sidebar-button chat-sidebar-button--wide"
            onClick={handleNewChat}
            disabled={isSending}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New chat
          </button>

          <div className="chat-sidebar__section">
            <div className="chat-sidebar__section-header">
              <div>
                <p className="chat-sidebar__eyebrow">Classes</p>
                <h2>Your courses</h2>
              </div>
              <span className="chat-sidebar__count">{classList.length}</span>
            </div>

            <div className="chat-class-list">
              {classList.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className={`chat-class-item ${item.code === classCode ? 'is-active' : ''}`}
                  onClick={() => navigate(`/class/${item.code}`)}
                >
                  <div className="chat-class-item__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="chat-class-item__body">
                    <span className="chat-class-item__title">{item.name}</span>
                    <span className="chat-class-item__meta">{item.subject || item.code}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="chat-sidebar__section chat-sidebar__section--grow">
            <div className="chat-sidebar__section-header">
              <div>
                <p className="chat-sidebar__eyebrow">Conversations</p>
                <h2>Previous chats</h2>
              </div>
              <span className="chat-sidebar__count">{history.length}</span>
            </div>

            {historyError && (
              <div className="status-banner is-warning">
                <strong>History unavailable</strong>
                <span>{historyError}</span>
              </div>
            )}

            <div className="chat-history-list">
              {isHistoryLoading && <HistorySkeleton />}

              {!isHistoryLoading && history.length === 0 && (
                <div className="chat-history-empty">
                  <p>No saved chats yet.</p>
                  <span>Up to five recent conversations for this class will appear here.</span>
                </div>
              )}

              {!isHistoryLoading && history.map((item) => {
                const isActive = item.id === activeChatId || item.id === requestedChatId

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`chat-history-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => handleOpenConversation(item.id)}
                    disabled={isSending}
                  >
                    <div className="chat-history-meta">
                      <span className="chat-history-title">{item.title}</span>
                      <span>{formatChatTimestamp(item.updatedAt)}</span>
                    </div>
                    <p className="chat-history-preview">{item.preview}</p>
                    <div className="chat-history-footer">
                      <span>{item.messageCount} {item.messageCount === 1 ? 'message' : 'messages'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="chat-sidebar__footer">
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </aside>

        <section className="chat-panel chat-panel--workspace">
          <div className="chat-panel__header">
            <div className="chat-panel__header-copy">
              <div className="chat-panel__header-top">
                <Link to="/student" className="chat-back-button" aria-label="Back to classes">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div>
                  <p className="chat-panel__eyebrow">{classData?.subject || classCode}</p>
                  <h1>{classData?.name}</h1>
                </div>
              </div>
              <div className="chat-panel__meta-row">
                <span className="chat-panel__meta-pill is-accent">Grounded in uploaded materials</span>
              </div>
            </div>
          </div>

          {(conversationError || composerError) && (
            <div className="chat-panel__status">
              {conversationError && (
                <div className="status-banner is-error">
                  <strong>Conversation load failed</strong>
                  <span>{conversationError}</span>
                </div>
              )}
              {composerError && (
                <div className="status-banner is-error">
                  <strong>Message not sent</strong>
                  <span>{composerError}</span>
                </div>
              )}
            </div>
          )}

          {isConversationLoading ? (
            <ConversationSkeleton />
          ) : (
            <div className="chat-thread">
              {messages.length === 0 ? (
                <EmptyConversation classData={classData} />
              ) : (
                messages.map((message) => {
                  const isAssistant = message.role === 'assistant'
                  const isSummary = message.kind === 'summary'

                  return (
                    <div
                      key={message.id}
                      className={`chat-message-row ${isAssistant ? 'is-assistant' : 'is-user'}`}
                    >
                      <div className={`chat-message-shell ${isAssistant ? 'is-assistant' : 'is-user'}`}>
                        {isAssistant && (
                          <div className="chat-message-avatar">
                            <img src="/Logo.jpg" alt="" />
                          </div>
                        )}

                        <div className="chat-message-content">
                          <div
                            className={`chat-bubble ${isAssistant ? 'is-assistant' : 'is-user'} ${isSummary ? 'is-summary' : ''}`}
                          >
                            {isSummary && <p className="chat-summary-label">Earlier conversation summary</p>}

                            {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                              <div className="chat-attachments">
                                {message.attachments.map((attachment, index) => (
                                  <div key={`${message.id}-attachment-${index}`} className="chat-attachment-chip">
                                    <div>
                                      <span>{attachment.name}</span>
                                      <small>{[attachment.type, formatFileSize(attachment.size)].filter(Boolean).join(' • ')}</small>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="prose-chat">
                              {isAssistant ? (
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath, remarkGfm]}
                                  rehypePlugins={[rehypeKatex]}
                                  components={markdownComponents}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              ) : (
                                <div className="chat-user-copy">{message.content}</div>
                              )}
                            </div>

                            <div className="chat-message-time">{formatChatTimestamp(message.ts)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {isSending && (
                <div className="chat-message-row is-assistant">
                  <div className="chat-message-shell is-assistant">
                    <div className="chat-message-avatar">
                      <img src="/Logo.jpg" alt="" />
                    </div>
                    <div className="chat-message-content">
                      <div className="chat-bubble is-assistant is-typing">
                        <div className="typing-indicator">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          <div className="chat-composer">
            <form onSubmit={handleSubmit} className="chat-composer-shell">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
              />

              {selectedFiles.length > 0 && (
                <div className="chat-selected-files">
                  {selectedFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="chat-attachment-chip">
                      <div>
                        <span>{file.name}</span>
                        <small>{[file.type || 'file', formatFileSize(file.size)].filter(Boolean).join(' • ')}</small>
                      </div>
                      <button type="button" onClick={() => removeSelectedFile(index)} aria-label={`Remove ${file.name}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="chat-composer-row">
                <button
                  type="button"
                  className="chat-attach-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isComposerDisabled}
                  aria-label="Attach files"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                <textarea
                  ref={inputRef}
                  className="chat-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Message StudyGuide AI..."
                  disabled={isComposerDisabled}
                  rows={1}
                />

                <button
                  type="submit"
                  className="chat-send-button"
                  disabled={isSendDisabled}
                  aria-label={isSending ? 'Sending message' : 'Send message'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 5v14M5 12l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}

export default ClassChat
