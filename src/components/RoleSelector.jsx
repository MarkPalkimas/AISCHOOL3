import React, { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROLES } from '../utils/roles'

function RoleSelector() {
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const getRole = () => {
    const pub = user?.publicMetadata?.role
    const uns = user?.unsafeMetadata?.role
    return pub || uns || null
  }

  const goAfterRole = (role) => {
    if (location.state?.from) {
      const from = location.state.from
      if (from.startsWith('/teacher')) {
        if (role === ROLES.TEACHER || role === ROLES.ADMIN) {
          navigate('/teacher', { replace: true })
        } else {
          navigate('/access-denied', { replace: true })
        }
        return
      }
      if (from.startsWith('/student')) {
        navigate('/student', { replace: true })
        return
      }
    }

    if (location.pathname.includes('/teacher')) {
      if (role === ROLES.TEACHER || role === ROLES.ADMIN) {
        navigate('/teacher', { replace: true })
      } else {
        navigate('/access-denied', { replace: true })
      }
      return
    }

    if (location.pathname.includes('/student')) {
      navigate('/student', { replace: true })
      return
    }

    if (role === ROLES.TEACHER || role === ROLES.ADMIN) {
      navigate('/teacher', { replace: true })
    } else {
      navigate('/student', { replace: true })
    }
  }

  useEffect(() => {
    if (!isLoaded || !user) return
    const role = getRole()
    if (role) {
      goAfterRole(role)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user])

  const setRoleOnServer = async (userId, role) => {
    const res = await fetch('/api/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`set-role failed (${res.status}): ${txt}`)
    }
  }

  const handleRoleSelect = async (role) => {
    setError('')
    setIsSubmitting(true)

    try {
      if (!isLoaded || !user) {
        throw new Error('Clerk not loaded or user missing')
      }

      //1)Client-safe: store the role here first
      await user.update({ unsafeMetadata: { role } })

      //2)Server-only: copy role into publicMetadata (this is what you enforce with)
      await setRoleOnServer(user.id, role)

      //3)Reload so publicMetadata is available immediately
      await user.reload()

      goAfterRole(role)
    } catch (err) {
      console.error(err)
      setError('Failed to set role. Make sure /api/set-role is deployed and CLERK_SECRET_KEY is set. Then try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '48px', maxWidth: '600px', width: '100%', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', border: '1px solid #E5E7EB' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>Welcome to ClassAI</h1>
          <p style={{ fontSize: '16px', color: '#6B7280' }}>Please select your account type to continue</p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '8px', marginBottom: '24px' }}>
            <p style={{ color: '#991B1B', fontSize: '14px' }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button
            onClick={() => handleRoleSelect(ROLES.STUDENT)}
            disabled={isSubmitting || !isLoaded}
            style={{
              padding: '24px',
              background: 'white',
              border: '2px solid #E5E7EB',
              borderRadius: '12px',
              cursor: (isSubmitting || !isLoaded) ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              opacity: (isSubmitting || !isLoaded) ? 0.6 : 1
            }}
          >
            <div style={{ display: 'flex', alignItems: 'start', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#3B82F6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>I'm a Student</h3>
                <p style={{ fontSize: '14px', color: '#6B7280' }}>Join classes and get help from AI tutors</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleRoleSelect(ROLES.TEACHER)}
            disabled={isSubmitting || !isLoaded}
            style={{
              padding: '24px',
              background: 'white',
              border: '2px solid #E5E7EB',
              borderRadius: '12px',
              cursor: (isSubmitting || !isLoaded) ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              opacity: (isSubmitting || !isLoaded) ? 0.6 : 1
            }}
          >
            <div style={{ display: 'flex', alignItems: 'start', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#10B981', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>I'm a Teacher</h3>
                <p style={{ fontSize: '14px', color: '#6B7280' }}>Create classes and manage AI assistants</p>
              </div>
            </div>
          </button>
        </div>

        {isSubmitting && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>Setting up your account...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RoleSelector
