import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import UserMenu from '../components/UserMenu'
import { getStudentClasses, joinClass, getClassByCode, getClassMaterials, syncClassMaterials } from '../utils/storage'

function Student() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [teacherCode, setTeacherCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!user) return
      const token = await getToken()
      const studentClasses = await getStudentClasses(token)
      setClasses(studentClasses || [])
    }
    load()
  }, [user])

  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    if (!teacherCode.trim() || !user) return
    
    setIsLoading(true)
    setError('')
    
    await new Promise(resolve => setTimeout(resolve, 500))

    const token = await getToken()
    const normalizedCode = teacherCode.toUpperCase()
    const classData = await getClassByCode(token, normalizedCode)
    
    if (!classData) {
      setError('Invalid class code. Please check the code and try again.')
      setIsLoading(false)
      return
    }

    const materials = await syncClassMaterials(token, normalizedCode)
    if (!materials || materials.length === 0) {
      setError('This class is not yet active. Ask your teacher to upload materials first.')
      setIsLoading(false)
      return
    }

    const success = await joinClass(token, normalizedCode)
    
    if (success) {
      const updatedClasses = await getStudentClasses(token)
      setClasses(updatedClasses || [])
      setTeacherCode('')
    } else {
      setError('You are already enrolled in this class.')
    }
    
    setIsLoading(false)
  }

  const handleClassClick = (classCode) => {
    navigate(`/class/${classCode}`)
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
              style={{ 
                width: '32px', 
                height: '32px', 
                objectFit: 'contain'
              }} 
            />
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>ClassAI</span>
          </Link>
          
          <UserMenu />
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ padding: '40px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            My Classes
          </h1>
          <p style={{ color: '#6B7280' }}>
            Access your AI tutors for each class
          </p>
        </div>

        {/* Join Class Form */}
        <div className="feature-card" style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>
            Join a New Class
          </h2>
          <form onSubmit={handleCodeSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                value={teacherCode}
                onChange={(e) => {
                  setTeacherCode(e.target.value.toUpperCase())
                  setError('')
                }}
                placeholder="Enter class code (e.g., ABC123)"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: error ? '1px solid #EF4444' : '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase'
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
              {error && (
                <p style={{ color: '#EF4444', fontSize: '14px', marginTop: '8px' }}>
                  {error}
                </p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={!teacherCode.trim() || isLoading}
              className="btn-primary"
              style={{ 
                opacity: (!teacherCode.trim() || isLoading) ? '0.5' : '1',
                cursor: (!teacherCode.trim() || isLoading) ? 'not-allowed' : 'pointer',
                minWidth: '120px'
              }}
            >
              {isLoading ? 'Joining...' : 'Join Class'}
            </button>
          </form>
        </div>

        {/* Classes Grid */}
        {classes.length === 0 ? (
          <div className="feature-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              background: '#F3F4F6', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <svg style={{ width: '32px', height: '32px', color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
              No classes yet
            </h3>
            <p style={{ color: '#6B7280' }}>
              Enter a class code above to join your first class
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {classes.map((classItem) => (
              <div 
                key={classItem.code} 
                className="feature-card hover-card"
                onClick={() => handleClassClick(classItem.code)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', 
                  borderRadius: '12px',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
                  {classItem.name}
                </h3>
                {classItem.subject && (
                  <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px' }}>
                    {classItem.subject}
                  </p>
                )}
                
                <div style={{ 
                  padding: '12px', 
                  background: '#F9FAFB', 
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                    Class Code
                  </p>
                  <span style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#111827',
                    fontFamily: 'monospace'
                  }}>
                    {classItem.code}
                  </span>
                </div>

                <div style={{ 
                  padding: '12px', 
                  background: '#EFF6FF', 
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg style={{ width: '16px', height: '16px', color: '#3B82F6', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span style={{ fontSize: '14px', color: '#1E40AF', fontWeight: '500' }}>
                    Click to chat with AI tutor
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Student
