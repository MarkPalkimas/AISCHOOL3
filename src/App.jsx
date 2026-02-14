import React from 'react'
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton, useUser } from '@clerk/clerk-react'
import Teacher from './pages/Teacher'
import Student from './pages/Student'
import ClassChat from './pages/ClassChat'
import Admin from './pages/Admin'
import RoleSelector from './components/RoleSelector'
import UserMenu from './components/UserMenu'
import SignInPage from './pages/SignIn'
import SignUpPage from './pages/SignUp'
import { getUserRole, canAccessTeacherArea, canAccessStudentArea, canAccessAdminArea } from './utils/roles'

function HomePage() {
  const navigate = useNavigate()
  const { user, isLoaded } = useUser()

  const handleTeacherClick = () => {
    if (user) {
      const role = getUserRole(user)
      if (!role) {
        // Will show role selector
        navigate('/teacher')
      } else if (canAccessTeacherArea(user)) {
        navigate('/teacher')
      } else {
        navigate('/access-denied')
      }
    } else {
      navigate('/teacher')
    }
  }

  const handleStudentClick = () => {
    if (user) {
      const role = getUserRole(user)
      if (!role) {
        navigate('/student')
      } else if (canAccessStudentArea(user)) {
        navigate('/student')
      } else {
        navigate('/access-denied')
      }
    } else {
      navigate('/student')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <img
              src="/Logo.jpg"
              alt="StudyGuide AI Logo"
              style={{ width: '64px', height: '64px', objectFit: 'contain' }}
            />
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>StudyGuide AI</span>
          </Link>

          <div>
            <SignedIn>
              <UserMenu />
            </SignedIn>
          </div>
        </div>
      </nav>

      <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 className="hero-title" style={{ marginBottom: '24px' }}>
          AI-Powered Learning<br />
          <span style={{ color: '#3B82F6' }}>For Every Classroom</span>
        </h1>

        <p className="hero-subtitle" style={{ marginBottom: '40px' }}>
          Empower teachers to create personalized AI assistants loaded with their class materials.
          Students get instant, accurate answers to their questions, 24/7.
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleTeacherClick} className="btn-primary">
            For Teachers
          </button>
          <button onClick={handleStudentClick} className="btn-secondary">
            For Students
          </button>
        </div>
      </div>

      <div style={{ padding: '80px 24px', background: '#F9FAFB' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" fill="none" stroke="#3B82F6" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
                </svg>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
                Smart Upload
              </h3>
              <p style={{ color: '#6B7280', lineHeight: '1.6' }}>
                Upload your course materials and our AI instantly processes them to create a personalized learning assistant.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" fill="none" stroke="#3B82F6" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
                Instant Answers
              </h3>
              <p style={{ color: '#6B7280', lineHeight: '1.6' }}>
                Students get immediate, accurate responses based on your specific course content. No waiting for office hours.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" fill="none" stroke="#3B82F6" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
                Track Progress
              </h3>
              <p style={{ color: '#6B7280', lineHeight: '1.6' }}>
                Monitor student engagement and see what concepts need clarification to improve your teaching.
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer style={{ borderTop: '1px solid #E5E7EB', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <img
              src="/Logo.jpg"
              alt="StudyGuide AI Logo"
              style={{ width: '24px', height: '24px', objectFit: 'contain' }}
            />
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>StudyGuide AI</span>
          </div>
          <p style={{ color: '#6B7280', fontSize: '14px' }}>
            © 2024 StudyGuide AI. Empowering education through AI.
          </p>
        </div>
      </footer>
    </div>
  )
}

function SyncUser() {
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (isLoaded && user) {
      const role = getUserRole(user)
      if (role === 'teacher' || role === 'admin') {
        navigate('/teacher', { replace: true })
      } else if (role === 'student') {
        navigate('/student', { replace: true })
      } else {
        // No role yet, let the RoleSelector handle it on a protected route
        navigate('/', { replace: true })
      }
    } else if (isLoaded && !user) {
      navigate('/', { replace: true })
    }
  }, [isLoaded, user, navigate])

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
        <p style={{ color: '#6B7280' }}>Syncing user data...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children, requireRole }) {
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (isLoaded && !user) {
      return
    }

    if (isLoaded && user) {
      const role = getUserRole(user)

      if (!role) {
        return
      }

      if (requireRole === 'teacher' && !canAccessTeacherArea(user)) {
        navigate('/access-denied')
        return
      }

      if (requireRole === 'student' && !canAccessStudentArea(user)) {
        navigate('/access-denied')
        return
      }

      if (requireRole === 'admin' && !canAccessAdminArea(user)) {
        navigate('/access-denied')
        return
      }
    }
  }, [isLoaded, user, requireRole, navigate])

  if (!isLoaded) {
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
          <p style={{ color: '#6B7280' }}>Verifying access...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  const role = getUserRole(user)
  if (!role) {
    return <RoleSelector />
  }

  // Double check roles explicitly if we have them
  if (requireRole === 'teacher' && !canAccessTeacherArea(user)) {
    return <Navigate to="/access-denied" replace />
  }
  if (requireRole === 'student' && !canAccessStudentArea(user)) {
    return <Navigate to="/access-denied" replace />
  }
  if (requireRole === 'admin' && !canAccessAdminArea(user)) {
    return <Navigate to="/access-denied" replace />
  }

  return children
}

function AccessDenied() {
  const navigate = useNavigate()
  const { user } = useUser()
  const role = getUserRole(user)

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <img
              src="/Logo.jpg"
              alt="StudyGuide AI Logo"
              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            />
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>StudyGuide AI</span>
          </Link>
          <SignedIn>
            <UserMenu />
          </SignedIn>
        </div>
      </nav>

      <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: '#FEE2E2',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <svg style={{ width: '40px', height: '40px', color: '#EF4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>
          Access Denied
        </h1>

        <p style={{ fontSize: '18px', color: '#6B7280', marginBottom: '32px', lineHeight: '1.6' }}>
          {role === 'student'
            ? "This area is only accessible to teachers. Students can access the student portal to join classes and chat with AI tutors."
            : "You don't have permission to access this area."}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/')} className="btn-primary">
            Go Home
          </button>
          {role === 'student' && (
            <button onClick={() => navigate('/student')} className="btn-secondary">
              Go to Student Portal
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/sync-user" element={<SyncUser />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/teacher" element={
        <ProtectedRoute requireRole="teacher">
          <Teacher />
        </ProtectedRoute>
      } />
      <Route path="/student" element={
        <ProtectedRoute requireRole="student">
          <Student />
        </ProtectedRoute>
      } />
      <Route path="/class/:classCode" element={
        <ProtectedRoute requireRole="student">
          <ClassChat />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute requireRole="admin">
          <Admin />
        </ProtectedRoute>
      } />
      <Route path="/access-denied" element={<AccessDenied />} />
    </Routes>
  )
}

export default App
