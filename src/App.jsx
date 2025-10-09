import React, { useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/clerk-react'
import Teacher from './pages/Teacher'
import Student from './pages/Student'

function RoleSelector({ onSelectRole, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to ClassAI</h2>
          <p className="text-gray-600">Are you a teacher or student?</p>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={() => onSelectRole('teacher')}
            className="w-full btn-primary"
          >
            I'm a Teacher
          </button>
          <button
            onClick={() => onSelectRole('student')}
            className="w-full btn-secondary"
          >
            I'm a Student
          </button>
        </div>
        
        <button
          onClick={onClose}
          className="mt-4 w-full text-gray-500 hover:text-gray-700 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function HomePage() {
  const navigate = useNavigate()
  const [showRoleSelector, setShowRoleSelector] = useState(false)
  
  const handleRoleSelection = (role) => {
    setShowRoleSelector(false)
    navigate(`/${role}`)
  }
  
  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* Navigation */}
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            {/* Top-left logo */}
            <img 
              src="/Logo.jpg" 
              alt="ClassAI Logo" 
              style={{ 
                width: '32px', 
                height: '32px', 
                objectFit: 'contain'
              }} 
            />
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>ClassAI</span>
          </Link>
          
          <div>
            <SignedOut>
              <button 
                onClick={() => setShowRoleSelector(true)}
                style={{
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
                onMouseOut={(e) => e.target.style.color = '#6B7280'}
              >
                Log in
              </button>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
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
          <button 
            onClick={() => navigate('/teacher')}
            className="btn-primary"
          >
            For Teachers
          </button>
          <button 
            onClick={() => navigate('/student')}
            className="btn-secondary"
          >
            For Students
          </button>
        </div>
      </div>

      {/* Features Section */}
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

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #E5E7EB', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <img 
              src="/Logo.jpg" 
              alt="ClassAI Logo" 
              style={{ width: '24px', height: '24px', objectFit: 'contain' }} 
            />
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>ClassAI</span>
          </div>
          <p style={{ color: '#6B7280', fontSize: '14px' }}>
            © 2024 ClassAI. Empowering education through AI.
          </p>
        </div>
      </footer>

      {/* Role Selector Modal */}
      {showRoleSelector && (
        <RoleSelector 
          onSelectRole={handleRoleSelection}
          onClose={() => setShowRoleSelector(false)}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/teacher" element={<Teacher />} />
      <Route path="/student" element={<Student />} />
    </Routes>
  )
}

export default App
