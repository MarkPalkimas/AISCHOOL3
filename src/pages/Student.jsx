import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import AppModal from '../components/AppModal'
import UserMenu from '../components/UserMenu'
import { getStudentClasses, joinClass, getClassByCode, leaveClass, syncClassMaterials } from '../utils/storage'

function Student() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [teacherCode, setTeacherCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingLeaveClass, setPendingLeaveClass] = useState(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!user) return
      const token = await getToken()
      const studentClasses = await getStudentClasses(token)
      setClasses(studentClasses || [])
    }
    load()
  }, [getToken, user])

  const handleCodeSubmit = async (event) => {
    event.preventDefault()
    if (!teacherCode.trim() || !user) return

    setIsLoading(true)
    setError('')

    try {
      const token = await getToken()
      const normalizedCode = teacherCode.trim().toUpperCase()
      const classData = await getClassByCode(token, normalizedCode)

      if (!classData) {
        setError('Invalid class code. Please check the code and try again.')
        return
      }

      const hasMaterials = Array.isArray(classData?.materials) && classData.materials.length > 0
      if (!hasMaterials) {
        setError('This class is not yet active. Ask your teacher to upload materials first.')
        return
      }

      const success = await joinClass(token, normalizedCode)
      if (!success) {
        setError('You are already enrolled in this class or the join failed.')
        return
      }

      const updatedClasses = await getStudentClasses(token)
      setClasses(updatedClasses || [])
      setTeacherCode('')
      await syncClassMaterials(token, normalizedCode)
    } catch (joinError) {
      setError(joinError?.message || 'Unable to join this class right now.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClassClick = (classCode) => {
    navigate(`/class/${classCode}`)
  }

  const handleLeaveClass = async () => {
    if (!pendingLeaveClass) return

    setIsLeaving(true)
    setLeaveError('')

    try {
      const token = await getToken()
      await leaveClass(token, pendingLeaveClass.code)
      setClasses((current) => current.filter((classItem) => classItem.code !== pendingLeaveClass.code))
      setPendingLeaveClass(null)
    } catch (leaveClassError) {
      setLeaveError(leaveClassError?.message || 'Unable to leave this class right now.')
    } finally {
      setIsLeaving(false)
    }
  }

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <Link to="/" className="workspace-brand__link">
            <img src="/Logo.jpg" alt="StudyGuide AI Logo" className="workspace-brand__logo" />
            <div>
              <span className="workspace-brand__title">StudyGuide AI</span>
              <span className="workspace-brand__subtitle">Student Workspace</span>
            </div>
          </Link>
          <UserMenu />
        </div>

        <div className="workspace-sidebar__section">
          <p className="workspace-sidebar__eyebrow">Join a class</p>
          <form onSubmit={handleCodeSubmit} className="workspace-form-card">
            <label htmlFor="teacherCode" className="workspace-label">Class code</label>
            <input
              id="teacherCode"
              type="text"
              value={teacherCode}
              onChange={(event) => {
                setTeacherCode(event.target.value.toUpperCase())
                setError('')
              }}
              placeholder="ABC123"
              className="workspace-input workspace-input--mono"
              disabled={isLoading}
            />
            {error && (
              <div className="status-banner is-error">
                <strong>Unable to join</strong>
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={!teacherCode.trim() || isLoading}
              className="btn-primary workspace-button-full"
            >
              {isLoading ? 'Joining...' : 'Join Class'}
            </button>
          </form>
        </div>

        <div className="workspace-sidebar__section workspace-sidebar__section--grow">
          <div className="workspace-sidebar__section-header">
            <div>
              <p className="workspace-sidebar__eyebrow">Classes</p>
              <h2>My study spaces</h2>
            </div>
            <span className="workspace-sidebar__count">{classes.length}</span>
          </div>

          <div className="workspace-nav-list">
            {classes.length === 0 ? (
              <div className="workspace-nav-empty">
                Your joined classes will appear here.
              </div>
            ) : (
              classes.map((classItem) => (
                <button
                  key={classItem.code}
                  type="button"
                  className="workspace-nav-item"
                  onClick={() => handleClassClick(classItem.code)}
                >
                  <div className="workspace-nav-item__icon is-accent">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="workspace-nav-item__body">
                    <span className="workspace-nav-item__title">{classItem.name}</span>
                    <span className="workspace-nav-item__meta">{classItem.subject || classItem.code}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-main__header workspace-main__header--compact">
          <h1>Classes</h1>
        </header>

        <section className="workspace-main__body">
          {classes.length === 0 ? (
            <div className="workspace-empty-state">
              <div className="workspace-empty-state__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2>No classes yet</h2>
              <p>Enter a teacher code in the sidebar to unlock your first AI tutor workspace.</p>
            </div>
          ) : (
            <div className="workspace-card-grid">
              {classes.map((classItem) => (
                <div key={classItem.code} className="workspace-card">
                  <div className="workspace-card__header">
                    <div className="workspace-card__icon is-accent">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  </div>

                  <div className="workspace-card__content">
                    <h3>{classItem.name}</h3>
                    <p>{classItem.subject || 'Course workspace'}</p>
                  </div>

                  <div className="workspace-meta-block">
                    <span className="workspace-meta-block__label">Class Code</span>
                    <span className="workspace-meta-block__value">{classItem.code}</span>
                  </div>

                  <div className="workspace-card__footer workspace-card__footer--actions">
                    <button
                      type="button"
                      className="workspace-icon-button workspace-icon-button--primary"
                      onClick={() => handleClassClick(classItem.code)}
                      aria-label={`Open AI tutor for ${classItem.name}`}
                      title="Open AI tutor"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="workspace-icon-button workspace-icon-button--danger"
                      onClick={() => {
                        setLeaveError('')
                        setPendingLeaveClass(classItem)
                      }}
                      aria-label={`Leave ${classItem.name}`}
                      title="Leave class"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h11.25" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {pendingLeaveClass && (
        <AppModal
          title="Leave Class"
          description={`You will lose access to ${pendingLeaveClass.name}. This only removes it from your account.`}
          size="small"
          onClose={() => {
            if (isLeaving) return
            setPendingLeaveClass(null)
            setLeaveError('')
          }}
          disableClose={isLeaving}
        >
          <div className="modal-form">
            {leaveError && (
              <div className="status-banner is-error">
                <strong>Unable to leave class</strong>
                <span>{leaveError}</span>
              </div>
            )}

            <p className="modal-helper">
              Your previous access to this class will be removed, but the class itself will remain available to the teacher and other students.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setPendingLeaveClass(null)
                  setLeaveError('')
                }}
                disabled={isLeaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-ghost-danger"
                onClick={handleLeaveClass}
                disabled={isLeaving}
              >
                {isLeaving ? 'Leaving...' : 'Leave Class'}
              </button>
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}

export default Student
