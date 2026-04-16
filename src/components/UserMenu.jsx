import React, { useEffect, useRef, useState } from 'react'
import { useUser, useClerk } from '@clerk/clerk-react'
import { getUserRole, ROLES } from '../utils/roles'

function UserMenu() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  if (!user) return null

  const role = getUserRole(user)
  const roleLabel = role === ROLES.TEACHER ? 'Teacher' : role === ROLES.STUDENT ? 'Student' : role === ROLES.ADMIN ? 'Admin' : 'User'
  const roleColor = role === ROLES.TEACHER ? '#10B981' : role === ROLES.STUDENT ? '#3B82F6' : role === ROLES.ADMIN ? '#8B5CF6' : '#6B7280'
  const initial = user.firstName?.charAt(0) || user.emailAddresses[0]?.emailAddress.charAt(0).toUpperCase()
  const displayName = user.firstName || user.emailAddresses[0]?.emailAddress.split('@')[0]
  const email = user.emailAddresses[0]?.emailAddress

  return (
    <div ref={containerRef} className="user-menu">
      <button type="button" onClick={() => setIsOpen((current) => !current)} className="user-menu__trigger">
        <div className="user-menu__avatar" style={{ background: roleColor }}>
          {initial}
        </div>
        <div className="user-menu__copy">
          <span className="user-menu__name">{displayName}</span>
          <span className="user-menu__role">{roleLabel}</span>
        </div>
        <svg className={`user-menu__chevron ${isOpen ? 'is-open' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="user-menu__panel">
          <div className="user-menu__panel-header">
            <div className="user-menu__panel-avatar" style={{ background: roleColor }}>
              {initial}
            </div>
            <div className="user-menu__panel-copy">
              <div className="user-menu__panel-name">{displayName}</div>
              <div className="user-menu__panel-email">{email}</div>
            </div>
          </div>
          <div className="user-menu__panel-role" style={{ background: roleColor }}>
            {roleLabel}
          </div>
          <button type="button" onClick={() => signOut()} className="user-menu__signout">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

export default UserMenu
