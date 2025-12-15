// src/App.jsx
import React from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { useUser, useClerk, SignedIn } from '@clerk/clerk-react'
import Teacher from './pages/Teacher'
import Student from './pages/Student'
import ClassChat from './pages/ClassChat'
import RoleSelector from './components/RoleSelector'
import UserMenu from './components/UserMenu'

const BASE = import.meta.env.BASE_URL

// Build an absolute URL under the GH Pages base (e.g., /AISCHOOL3/)
const abs = (path = '') => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/')
  const rel = String(path).replace(/^\/+/, '')
  return `${window.location.origin}${base}${rel}`
}

function HomePage() {
  const navigate = useNavigate()
  const { isSignedIn, user } = useUser()
  const { redirectToSignIn } = useClerk()

  const goTeacher = () => {
    if (isSignedIn) {
      const role = user?.publicMetadata?.role
      if (role && role !== 'teacher' && role !== 'admin') {
        alert('This account is registered as a student. Please use the student portal.')
        navigate('/student')
        return
      }
      navigate('/teacher')
    } else {
      redirectToSignIn({ redirectUrl: abs('teacher'), signUpUrl: abs('teacher') })
    }
  }

  const goStudent = () => {
    if (isSignedIn) {
      navigate('/student')
    } else {
      redirectToSignIn({ redirectUrl: abs('student'), signUpUrl: abs('student') })
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav — brand text only */}
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div
          className="container"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Link to="/" className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={`${BASE}Logo.jpg`} alt="StudyGuideAI Logo" style={{ width: 32, height: 32 }} />
            <span style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: -0.2 }}>
              StudyGuideAI
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SignedIn>
              <UserMenu />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ padding: '96px 0 64px' }}>
        <div className="container" style={{ textAlign: 'center' }}>

          <h1
            className="hero-title"
            style={{
              marginBottom: 14,
              backgroundImage: 'linear-gradient(90deg, #111827, #3b82f6)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            An AI study companion for every class
          </h1>

          <p className="hero-subtitle" style={{ margin: '0 auto 28px', maxWidth: 640 }}>
            Teachers upload materials. Students get instant, guided help — explanations, steps, and math —
            without giving away the answers.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={goTeacher}>For Teachers</button>
            <button className="btn-secondary" onClick={goStudent}>For Students</button>
          </div>

          {/* Soft divider */}
          <div style={{ height: 48 }} />

          <div className="container" style={{ maxWidth: 900, margin: '0 auto' }}>
            <div className="feature-card" style={{ padding: 18, borderRadius: 20 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                }}
              >
                <div className="hover-card" style={{ padding: 16, borderRadius: 14 }}>
                  <div className="pill">Fast answers</div>
                  <div style={{ marginTop: 8, color: '#6B7280', fontSize: 14 }}>
                    Ask questions about your class notes, syllabus, or topics.
                  </div>
                </div>

                <div className="hover-card" style={{ padding: 16, borderRadius: 14 }}>
                  <div className="pill">Math & steps</div>
                  <div style={{ marginTop: 8, color: '#6B7280', fontSize: 14 }}>
                    Typeset math with LaTeX and get step-by-step explanations.
                  </div>
                </div>

                <div className="hover-card" style={{ padding: 16, borderRadius: 14 }}>
                  <div className="pill">No spoilers</div>
                  <div style={{ marginTop: 8, color: '#6B7280', fontSize: 14 }}>
                    Guidance without dumping full solutions.
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <footer style={{ marginTop: 'auto', borderTop: '1px solid #E5E7EB', padding: '20px 0' }}>
        <div
          className="container"
          style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}
        >
          <img
            src={`${BASE}Logo.jpg`}
            alt="StudyGuideAI Logo"
            style={{ width: 20, height: 20, objectFit: 'contain', opacity: 0.85 }}
          />
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            © {new Date().getFullYear()} StudyGuideAI
          </div>
        </div>
      </footer>

    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/teacher" element={<Teacher />} />
      <Route path="/student" element={<Student />} />
      <Route path="/class/:classCode" element={<ClassChat />} />
      <Route path="/role-selection" element={<RoleSelector />} />
    </Routes>
  )
}
