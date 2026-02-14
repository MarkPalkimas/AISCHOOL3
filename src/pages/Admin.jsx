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

    loadUsers()
  }, [user, navigate])

  const loadUsers = () => {
    setIsLoading(true)
    const mockUsers = []
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
          publicMetadata: { role: newRole }
        })
        loadUsers()
      } else {
        setError('Can only update your own role in this demo.')
      }
    } catch (err) {
      setError('Failed to update role.')
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
          <div style={{ width: '48px', height: '48px', border: '4px solid #E5E7EB', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6B7280' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <img src="/Logo.jpg" alt="StudyGuide AI Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>StudyGuide AI</span>
          </Link>
          <UserMenu />
        </div>
      </nav>

      <div style={{ padding: '40px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>Admin Dashboard</h1>
          <p style={{ color: '#6B7280' }}>Manage user roles and permissions</p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '8px', marginBottom: '24px' }}>
            <p style={{ color: '#991B1B', fontSize: '14px' }}>{error}</p>
          </div>
        )}

        <div style={{ padding: '16px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px', marginBottom: '32px' }}>
          <p style={{ fontSize: '14px', color: '#4F46E5' }}>Demo Mode: This only shows your account. In production, this would manage all users via a backend API.</p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search users..." style={{ width: '100%', maxWidth: '400px', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px' }} />
        </div>

        <div className="feature-card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>User</th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Email</th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Role</th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{u.firstName} {u.lastName}</div>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: '#6B7280' }}>{u.email}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ padding: '4px 12px', background: '#DBEAFE', color: '#1E40AF', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>{u.role || 'None'}</span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <select value={u.role || 'none'} onChange={(e) => updateUserRole(u.id, e.target.value)} style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', background: 'white' }}>
                      <option value="none">No Role</option>
                      <option value={ROLES.STUDENT}>Student</option>
                      <option value={ROLES.TEACHER}>Teacher</option>
                      <option value={ROLES.ADMIN}>Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default Admin
