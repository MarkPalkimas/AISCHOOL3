import React, { useState, useRef, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/clerk-react'
import { getUserRole, ROLES } from '../utils/roles'

function UserMenu() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  if (!user) return null

  const role = getUserRole(user)
  const roleLabel = role === ROLES.TEACHER ? 'Teacher' : role === ROLES.STUDENT ? 'Student' : role === ROLES.ADMIN ? 'Admin' : 'User'
  const roleColor = role === ROLES.TEACHER ? '#10B981' : role === ROLES.STUDENT ? '#3B82F6' : role === ROLES.ADMIN ? '#8B5CF6' : '#6B7280'

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 12px',
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = '#F9FAFB'
          e.currentTarget.style.borderColor = '#D1D5DB'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'white'
          e.currentTarget.style.borderColor = '#E5E7EB'
        }}
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: roleColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '600',
          fontSize: '14px'
        }}>
          {user.firstName?.charAt(0) || user.emailAddresses[0]?.emailAddress.charAt(0).toUpperCase()}
        </div>
        <div style={{ textAlign: 'left', display: 'none' }} className="user-menu-text">
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
            {user.firstName || user.emailAddresses[0]?.emailAddress.split('@')[0]}
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280' }}>
            {roleLabel}
          </div>
        </div>
        <svg 
          style={{ 
            width: '16px', 
            height: '16px', 
            color: '#6B7280',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: '0',
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          minWidth: '200px',
          zIndex: 50,
          overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
              {user.firstName || user.emailAddresses[0]?.emailAddress.split('@')[0]}
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
              {user.emailAddresses[0]?.emailAddress}
            </div>
            <div style={{
              display: 'inline-block',
              padding: '4px 8px',
              background: roleColor,
              color: 'white',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {roleLabel}
            </div>
          </div>

          <button
            onClick={() => signOut()}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#EF4444',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#FEE2E2'}
            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      )}

      <style>{`
        @media (min-width: 640px) {
          .user-menu-text {
            display: block !important;
          }
        }
      `}</style>
    </div>
  )
}

export default UserMenu
