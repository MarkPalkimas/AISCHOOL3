import React, { useState, useRef, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/clerk-react'
import { ROLES } from '../utils/roles'

function UserMenu() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) return null

  // specific logic to get role from metadata
  const role = user.publicMetadata?.role
  const roleLabel = role === 'teacher' ? 'Teacher' : role === 'student' ? 'Student' : role === 'admin' ? 'Admin' : 'User'
  const roleColor = role === 'teacher' ? '#10B981' : role === 'student' ? '#3B82F6' : role === 'admin' ? '#8B5CF6' : '#6B7280'

  const initial = user.firstName?.charAt(0) || user.emailAddresses[0]?.emailAddress.charAt(0).toUpperCase()

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '6px 12px',
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '999px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isOpen ? '0 0 0 2px rgba(59, 130, 246, 0.1)' : 'none'
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
          {initial}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginRight: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            {user.firstName || 'User'}
          </span>
        </div>
        <svg style={{ width: '16px', height: '16px', color: '#9CA3AF', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          minWidth: '220px',
          zIndex: 50,
          overflow: 'hidden',
          animation: 'fadeIn 0.1s ease-out'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #F3F4F6', background: '#F9FAFB' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
              {user.fullName || user.emailAddresses[0]?.emailAddress}
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.emailAddresses[0]?.emailAddress}
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              background: `${roleColor}15`,
              color: roleColor,
              border: `1px solid ${roleColor}30`,
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.025em'
            }}>
              {roleLabel}
            </div>
          </div>

          <div style={{ padding: '4px' }}>
            <button
              onClick={() => signOut()}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#EF4444',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                borderRadius: '8px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#FEF2F2'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserMenu

