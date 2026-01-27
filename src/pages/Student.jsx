import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import UserMenu from '../components/UserMenu'
import { getStudentClasses, joinClass, getClassByCode } from '../utils/storage'
import { ROLES } from '../utils/roles'

function Student() {
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [teacherCode, setTeacherCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [displayLimit, setDisplayLimit] = useState(6)

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role || null

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      navigate('/sign-in', { replace: true })
      return
    }
    //students can only be student (teachers/admin can still view student if you want)
    if (role !== ROLES.STUDENT && role !== ROLES.TEACHER && role !== ROLES.ADMIN) {
      navigate('/select-role', { replace: true, state: { from: '/student' } })
      return
    }
  }, [isLoaded, user, role, navigate])

  useEffect(() => {
    if (user) {
      const studentClasses = getStudentClasses(user.id)
      setClasses(studentClasses)
    }
  }, [user])

  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    if (!teacherCode.trim() || !user) return

    setIsLoading(true)
    setError('')

    await new Promise(resolve => setTimeout(resolve, 500))

    const classData = getClassByCode(teacherCode.toUpperCase())

    if (!classData) {
      setError('Invalid class code. Please check the code and try again.')
      setIsLoading(false)
      return
    }

    if (!classData.materials) {
      setError('This class is not yet active. Ask your teacher to upload materials first.')
      setIsLoading(false)
      return
    }

    const success = joinClass(user.id, teacherCode.toUpperCase())

    if (success) {
      const updatedClasses = getStudentClasses(user.id)
      setClasses(updatedClasses)
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
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <img src="/Logo.jpg" alt="ClassAI Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>ClassAI</span>
          </Link>
          <UserMenu />
        </div>
      </nav>

      <div style={{ padding: '40px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>My Classes</h1>
          <p style={{ color: '#6B7280' }}>Access your AI tutors for each class</p>
        </div>

        <div className="feature-card" style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>Join a New Class</h2>
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
                disabled={isLoading}
              />
              {error && <p style={{ color: '#EF4444', fontSize: '14px', marginTop: '8px' }}>{error}</p>}
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

        {classes.length === 0 ? (
          <div className="feature-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>No classes yet</h3>
            <p style={{ color: '#6B7280' }}>Enter a class code above to join your first class</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {classes.slice(0, displayLimit).map((classItem) => (
              <div key={classItem.code} className="feature-card hover-card" onClick={() => handleClassClick(classItem.code)} style={{ cursor: 'pointer' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>{classItem.name}</h3>
                {classItem.subject && <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px' }}>{classItem.subject}</p>}
                <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Class Code</p>
                  <span style={{ fontSize: '16px', fontWeight: '600', color: '#111827', fontFamily: 'monospace' }}>{classItem.code}</span>
                </div>
                <div style={{ padding: '12px', background: '#EFF6FF', borderRadius: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#1E40AF', fontWeight: '500' }}>Click to chat with AI tutor</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {classes.length > displayLimit && (
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <button
              onClick={() => setDisplayLimit(prev => prev + 6)}
              className="btn-secondary"
            >
              Show More Classes
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Student
