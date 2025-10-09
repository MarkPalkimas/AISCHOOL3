import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton, SignInButton, useUser } from '@clerk/clerk-react'
import { useClass } from '../context/ClassContext'

function Student() {
  const { user } = useUser()
  const { joinClass } = useClass()
  const [teacherCode, setTeacherCode] = useState('')
  const [isCodeSubmitted, setIsCodeSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [joinedClassName, setJoinedClassName] = useState('')

  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    if (!teacherCode.trim() || !user) return

    setIsLoading(true)
    setError('')

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    const result = await joinClass(user.id, teacherCode)

    setIsLoading(false)

    if (result.success) {
      setJoinedClassName(result.className)
      setIsCodeSubmitted(true)
    } else {
      setError(result.error)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* Navigation */}
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <img 
              src="/Logo.jpg" 
              alt="ClassAI Logo" 
              style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
            />
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>ClassAI</span>
          </Link>
          <div>
            <SignedOut>
              <SignInButton mode="modal">
                <button style={{
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  fontSize: '14px',
                  fontWeight: '500',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.color = '#111827'}
                onMouseOut={(e) => e.target.style.color = '#6B7280'}>
                  Log in
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ padding: '80px 24px', maxWidth: '800px', margin: '0 auto' }}>
        <SignedOut>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h1 className="hero-title" style={{ marginBottom: '16px' }}>
              Student <span style={{ color: '#3B82F6' }}>Access</span>
            </h1>
            <p className="hero-subtitle">
              Sign in to access your class AI assistant
            </p>
          </div>
          <div className="feature-card" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg style={{ width: '32px', height: '32px', color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
              Sign in to continue
            </h2>
            <p style={{ color: '#6B7280', marginBottom: '32px', lineHeight: '1.6' }}>
              Please sign in to access your teacher's AI assistant.
            </p>
            <SignInButton mode="modal">
              <button className="btn-primary" style={{ width: '100%' }}>
                Sign In
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!isCodeSubmitted ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <h1 className="hero-title" style={{ marginBottom: '16px' }}>
                  Enter Teacher <span style={{ color: '#3B82F6' }}>Code</span>
                </h1>
                <p className="hero-subtitle">
                  Ask your teacher for the class code to access the AI assistant
                </p>
              </div>
              <div className="feature-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <form onSubmit={handleCodeSubmit}>
                  <div style={{ marginBottom: '24px' }}>
                    <label htmlFor="teacherCode" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Teacher Code
                    </label>
                    <input
                      type="text"
                      id="teacherCode"
                      value={teacherCode}
                      onChange={(e) => {
                        setTeacherCode(e.target.value.toUpperCase())
                        setError('')
                      }}
                      placeholder="Enter your teacher's code (e.g., ABC123)"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: error ? '1px solid #DC2626' : '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                      onFocus={(e) => {
                        if (!error) {
                          e.target.style.borderColor = '#3B82F6'
                          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                        }
                      }}
                      onBlur={(e) => {
                        if (!error) {
                          e.target.style.borderColor = '#D1D5DB'
                          e.target.style.boxShadow = 'none'
                        }
                      }}
                      disabled={isLoading}
                    />
                    {error && <p style={{ color: '#DC2626', fontSize: '14px', marginTop: '8px' }}>{error}</p>}
                  </div>
                  <button
                    type="submit"
                    disabled={!teacherCode.trim() || isLoading}
                    className="btn-primary"
                    style={{ width: '100%', opacity: (!teacherCode.trim() || isLoading) ? '0.5' : '1', cursor: (!teacherCode.trim() || isLoading) ? 'not-allowed' : 'pointer' }}
                  >
                    {isLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', marginRight: '8px' }}></div>
                        Connecting...
                      </div>
                    ) : (
                      'Access AI Assistant'
                    )}
                  </button>
                </form>
                <div style={{ marginTop: '24px', padding: '16px', background: '#F9FAFB', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flexShrink: 0 }}>
                      <svg style={{ width: '20px', height: '20px', color: '#9CA3AF' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>Need help?</h3>
                      <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.5' }}>
                        Ask your teacher for the class code. Each class has a unique code that gives you access to the AI assistant trained on your course materials.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <div style={{ width: '64px', height: '64px', background: '#DEF7EC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <svg style={{ width: '32px', height: '32px', color: '#059669' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="hero-title" style={{ marginBottom: '16px' }}>
                  Welcome to <span style={{ color: '#3B82F6' }}>ClassAI!</span>
                </h1>
                <p className="hero-subtitle">
                  You're now connected to <span style={{ fontWeight: '700', color: '#111827' }}>{joinedClassName}</span> (Code: <span style={{ fontWeight: '700', color: '#111827' }}>{teacherCode}</span>)
                </p>
              </div>
              <div className="feature-card" style={{ maxWidth: '700px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>AI Chat Coming Soon</h2>
                  <p style={{ color: '#6B7280', lineHeight: '1.6' }}>
                    The chat interface is being developed. Soon you'll be able to ask questions about your course materials and get instant, accurate answers.
                  </p>
                </div>
                <div style={{ padding: '24px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderLeft: '4px solid #3B82F6', borderRadius: '8px', marginBottom: '24px' }}>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#1E40AF', marginBottom: '12px' }}>What you'll be able to do:</p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    <li style={{ fontSize: '14px', color: '#1E40AF', marginBottom: '8px' }}>• Ask questions about lectures and readings</li>
                    <li style={{ fontSize: '14px', color: '#1E40AF', marginBottom: '8px' }}>• Get help with assignments and homework</li>
                    <li style={{ fontSize: '14px', color: '#1E40AF', marginBottom: '8px' }}>• Clarify confusing concepts</li>
                    <li style={{ fontSize: '14px', color: '#1E40AF' }}>• Review for exams</li>
                  </ul>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => {
                      setIsCodeSubmitted(false)
                      setTeacherCode('')
                      setError('')
                    }}
                    className="btn-secondary"
                  >
                    Try Different Code
                  </button>
                </div>
              </div>
            </>
          )}
        </SignedIn>
      </div>
    </div>
  )
}

export default Student
