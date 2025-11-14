import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import UserMenu from '../components/UserMenu'
import { canAccessAdminArea, ROLES } from '../utils/roles'

function Admin() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    if (!canAccessAdminArea(user)) {
      navigate('/')
      return
    }

    // Load users from localStorage (in a real app, this would be a backend API)
    loadUsers()
  }, [user, navigate])

  const loadUsers = () => {
    setIsLoading(true)
    
    // Get all user data from localStorage
    // In production, this would be a secure backend API call
    const mockUsers = []
    
    // For demo purposes, we'll just show the current user
    // In production, you'd fetch all users from your backend
    if (user) {
      mockUsers.push({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.publicMetadata?.role || 'none',
        createdAt: user.createdAt
      })
    }

    setUsers(mockUsers)
    setIsLoading(false)
  }

  const updateUserRole = async (userId, newRole) => {
    try {
      if (userId === user.id) {
        await user.update({
          publicMetadata: {
            role: newRole
          }
        })
        loadUsers()
      } else {
        // In production, this would be a backend API call to update another user's role
        setError('Can only update your own role in this demo. In production, this would update any user.')
      }
    } catch (err) {
      console.error('Error updating role:', err)
      setError('Failed to update role. Please try again.')
    }
  }

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #E5E7EB',
            borderTopColor: '#8B5CF6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#6B7280' }}>Loading admin panel...</p>
        </div>
      </div>
    )
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
              style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: '#8B5CF6',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827' }}>
              Admin Dashboard
            </h1>
          </div>
          <p style={{ color: '#6B7280' }}>
            Manage user roles and permissions
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: '#FEE2E2',
            border: '1px solid #EF4444',
            borderRadius: '8px',
            marginBottom: '24px'
          }}>
            <p style={{ color: '#991B1B', fontSize: '14px' }}>{error}</p>
          </div>
        )}

        {/* Info Box */}
        <div style={{
          padding: '16px',
          background: '#EEF2FF',
          border: '1px solid #C7D2FE',
          borderRadius: '8px',
          marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <svg style={{ width: '20px', height: '20px', color: '#4F46E5', flexShrink: 0, marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p style={{ fontSize: '14px', color: '#3730A3', fontWeight: '600', marginBottom: '4px' }}>
                Demo Mode
              </p>
              <p style={{ fontSize: '14px', color: '#4F46E5', lineHeight: '1.5' }}>
                This admin panel currently only shows your account. In production, this would connect to a secure backend API to manage all users. Role changes for other users would require proper authentication and authorization.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users..."
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '12px 16px',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        {/* Users Table */}
        <div className="feature-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '48px 24px', textAlign: 'center', color: '#6B7280' }}>
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: u.role === ROLES.TEACHER ? '#10B981' : u.role === ROLES.STUDENT ? '#3B82F6' : u.role === ROLES.ADMIN ? '#8B5CF6' : '#9CA3AF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                            {u.firstName?.charAt(0) || u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                              {u.firstName} {u.lastName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: '14px', color: '#6B7280' }}>
                        {u.email}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          background: u.role === ROLES.TEACHER ? '#D1FAE5' : u.role === ROLES.STUDENT ? '#DBEAFE' : u.role === ROLES.ADMIN ? '#EDE9FE' : '#F3F4F6',
                          color: u.role === ROLES.TEACHER ? '#065F46' : u.role === ROLES.STUDENT ? '#1E40AF' : u.role === ROLES.ADMIN ? '#5B21B6' : '#374151',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'capitalize'
                        }}>
                          {u.role || 'None'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <select
                          value={u.role || 'none'}
                          onChange={(e) => updateUserRole(u.id, e.target.value)}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '6px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            background: 'white'
                          }}
                        >
                          <option value="none">No Role</option>
                          <option value={ROLES.STUDENT}>Student</option>
                          <option value={ROLES.TEACHER}>Teacher</option>
                          <option value={ROLES.ADMIN}>Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default AdminAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    User
                  </th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Email
                  </th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Current Role
                  </th>
                  <th style={{ padding: '12px 24px', text
