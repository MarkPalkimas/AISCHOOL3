// src/pages/Student.jsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SignedIn, SignedOut, useUser, useClerk } from '@clerk/clerk-react'
import { getStudentClasses, joinClass, getClassByCode } from '../utils/storage'
import UserMenu from '../components/UserMenu'

const BASE = import.meta.env.BASE_URL
const abs = (path = '') => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/')
  const rel = String(path).replace(/^\/+/, '')
  return `${window.location.origin}${base}${rel}`
}

export default function Student() {
  const { user, isLoaded, isSignedIn } = useUser()
  const { redirectToSignIn } = useClerk()
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [teacherCode, setTeacherCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-assign role if missing
  useEffect(() => {
    if (isLoaded && user && !user.publicMetadata.role) {
      user.update({ publicMetadata: { role: 'student' } })
        .then(() => window.location.reload())
        .catch(err => console.error('Failed to set role', err))
    }
  }, [isLoaded, user])

  useEffect(() => {
    if (!isLoaded || !user) return
    setClasses(getStudentClasses(user.id))
  }, [isLoaded, user])

  const handleJoin = async (e) => {
    e.preventDefault()

    if (!isSignedIn) {
      redirectToSignIn({ redirectUrl: abs('student'), signUpUrl: abs('student') })
      return
    }

    if (!teacherCode.trim()) return

    setError('')
    setIsLoading(true)

    const code = teacherCode.trim().toUpperCase()
    const classData = getClassByCode(code)

    if (!classData) {
      setError('No class found with that code.')
      setIsLoading(false)
      return
    }

    const ok = joinClass(user.id, code)
    if (ok) {
      setClasses(getStudentClasses(user.id))
      setTeacherCode('')
    } else {
      setError('You are already enrolled in this class.')
    }

    setIsLoading(false)
  }

  const goToClass = (code) => navigate(`/class/${code}`)

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '12px 0' }}>
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src={`${BASE}Logo.jpg`} alt="StudyGuideAI Logo" style={{ width: 48, height: 48 }} />
          </Link>
          <SignedIn>
            <UserMenu />
          </SignedIn>
        </div>
      </nav>

      <div style={{ padding: '40px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <SignedOut>
          <div className="feature-card" style={{ padding: 24, textAlign: 'center' }}>
            <h1 className="hero-title">Student Access</h1>
            <button
              className="btn-primary"
              onClick={() => redirectToSignIn({ redirectUrl: abs('student'), signUpUrl: abs('student') })}
              style={{ width: '100%', marginTop: 16 }}
            >
              Sign In
            </button>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="feature-card" style={{ padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Join a Class</h2>
            <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8 }}>
              <input
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
                placeholder="Enter class code"
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 8,
                  border: '1px solid #D1D5DB', fontFamily: 'monospace',
                }}
                disabled={isLoading}
              />
              <button className="btn-primary" disabled={isLoading}>
                {isLoading ? 'Joining…' : 'Join'}
              </button>
            </form>
            {error && <p style={{ color: '#EF4444', marginTop: 8 }}>{error}</p>}
          </div>

          {classes.length === 0 ? (
            <div className="feature-card" style={{ padding: 24, textAlign: 'center' }}>
              <h3>No classes yet</h3>
              <p>Enter a class code above to get started.</p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {classes.map((c) => (
                <div
                  key={c.code}
                  className="feature-card hover-card"
                  onClick={() => goToClass(c.code)}
                  style={{ cursor: 'pointer', padding: 16 }}
                >
                  <h4 style={{ fontWeight: 700 }}>{c.name}</h4>
                  {c.subject && <p style={{ color: '#6B7280' }}>{c.subject}</p>}
                  <p style={{ color: '#6B7280' }}><small>Code: {c.code}</small></p>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>
                    Click to chat with your AI tutor
                  </div>
                </div>
              ))}
            </div>
          )}
        </SignedIn>
      </div>
    </div>
  )
}
