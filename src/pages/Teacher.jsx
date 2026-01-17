import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import UserMenu from '../components/UserMenu'
import { createClass, getTeacherClasses, updateClassMaterials, deleteClass } from '../utils/storage'
import { ROLES } from '../utils/roles'

function Teacher() {
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()

  const createModalRef = useRef(null)
  const uploadModalRef = useRef(null)

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role || null

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      navigate('/sign-in', { replace: true })
      return
    }
    if (role !== ROLES.TEACHER && role !== ROLES.ADMIN) {
      if (!role) navigate('/select-role', { replace: true, state: { from: '/teacher' } })
      else navigate('/access-denied', { replace: true })
      return
    }
  }, [isLoaded, user, role, navigate])

  const [classes, setClasses] = useState([])

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassSubject, setNewClassSubject] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [materials, setMaterials] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [classToDelete, setClassToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (user) {
      const teacherClasses = getTeacherClasses(user.id)
      setClasses(teacherClasses)
    }
  }, [user])

  // ESC closes modals
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return

      if (showDeleteModal) {
        setShowDeleteModal(false)
        setClassToDelete(null)
        return
      }

      if (showUploadModal) {
        setShowUploadModal(false)
        setMaterials('')
        setSelectedClass(null)
        return
      }

      if (showCreateModal) {
        setShowCreateModal(false)
        setNewClassName('')
        setNewClassSubject('')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showCreateModal, showUploadModal, showDeleteModal])

  // Autofocus create input
  useEffect(() => {
    if (showCreateModal) setTimeout(() => createModalRef.current?.focus(), 0)
  }, [showCreateModal])

  // Autofocus upload textarea
  useEffect(() => {
    if (showUploadModal) setTimeout(() => uploadModalRef.current?.focus(), 0)
  }, [showUploadModal])

  const refreshClasses = () => {
    if (!user) return
    setClasses(getTeacherClasses(user.id))
  }

  const handleCreateClass = async (e) => {
    e.preventDefault()
    if (!newClassName.trim() || !user) return

    setIsCreating(true)
    await new Promise((resolve) => setTimeout(resolve, 400))

    const newClass = createClass(user.id, newClassName.trim(), newClassSubject.trim())
    refreshClasses()

    setNewClassName('')
    setNewClassSubject('')
    setShowCreateModal(false)
    setIsCreating(false)

    if (newClass) openUploadModal(newClass)
  }

  const openUploadModal = (classItem) => {
    setSelectedClass(classItem)
    setMaterials(classItem.materials || '')
    setShowUploadModal(true)
  }

  const handleUploadMaterials = async (e) => {
    e.preventDefault()
    if (!materials.trim() || !selectedClass || !user) return

    setIsUploading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // FIX: storage signature is (classCode, materials)
    updateClassMaterials(selectedClass.code, materials.trim())
    refreshClasses()

    setShowUploadModal(false)
    setMaterials('')
    setSelectedClass(null)
    setIsUploading(false)
  }

  const openDeleteModal = (classItem) => {
    setClassToDelete(classItem)
    setShowDeleteModal(true)
  }

  const handleDeleteClass = async () => {
    if (!user || !classToDelete) return

    setIsDeleting(true)
    await new Promise((resolve) => setTimeout(resolve, 450))

    deleteClass(user.id, classToDelete.code)
    refreshClasses()

    setIsDeleting(false)
    setShowDeleteModal(false)
    setClassToDelete(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <img src="/Logo.jpg" alt="ClassAI Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>ClassAI</span>
          </Link>
          <UserMenu />
        </div>
      </nav>

      <div style={{ padding: '40px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '32px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>Teacher Dashboard</h1>
            <p style={{ color: '#6B7280' }}>Create classes and upload materials for your AI tutors</p>
          </div>

          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            Create New Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="feature-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '24px' }}>No classes yet</h3>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              Create Your First Class
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {classes.map((classItem) => (
              <div key={classItem.code} className="feature-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        background: classItem.materials ? '#DEF7EC' : '#FEF3C7',
                        color: classItem.materials ? '#059669' : '#D97706',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                    >
                      {classItem.materials ? 'Active' : 'Setup Needed'}
                    </span>

                    <button
                      type="button"
                      onClick={() => openDeleteModal(classItem)}
                      style={{
                        padding: '6px 10px',
                        background: 'white',
                        border: '1px solid #FCA5A5',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#B91C1C',
                        lineHeight: 1,
                      }}
                      title="Delete class"
                    >
                      Delete
                    </button>
                  </div>

                  <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>{classItem.name}</h3>
                  {classItem.subject && <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px' }}>{classItem.subject}</p>}

                  <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '8px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>Class Code</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: '#111827', fontFamily: 'monospace' }}>
                        {classItem.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(classItem.code)}
                        style={{
                          padding: '6px 10px',
                          background: 'white',
                          border: '1px solid #D1D5DB',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          color: '#6B7280',
                          whiteSpace: 'nowrap',
                          fontWeight: '700'
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                <button onClick={() => openUploadModal(classItem)} className="btn-secondary" style={{ width: '100%' }}>
                  {classItem.materials ? 'Update Materials' : 'Upload Materials'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Class Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return
            setShowCreateModal(false)
            setNewClassName('')
            setNewClassSubject('')
          }}
          style={{ backdropFilter: 'blur(2px)' }}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-md w-full"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              borderRadius: '14px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
              animation: 'modalIn 140ms ease-out'
            }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Class</h2>
            <form onSubmit={handleCreateClass}>
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="className"
                  style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}
                >
                  Class Name *
                </label>
                <input
                  type="text"
                  id="className"
                  ref={createModalRef}
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g., Biology 101"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'box-shadow 0.15s, border-color 0.15s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3B82F6'
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label
                  htmlFor="classSubject"
                  style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}
                >
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  id="classSubject"
                  value={newClassSubject}
                  onChange={(e) => setNewClassSubject(e.target.value)}
                  placeholder="e.g., Life Sciences"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'box-shadow 0.15s, border-color 0.15s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3B82F6'
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewClassName('')
                    setNewClassSubject('')
                  }}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newClassName.trim() || isCreating}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    opacity: !newClassName.trim() || isCreating ? '0.5' : '1',
                    cursor: !newClassName.trim() || isCreating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isCreating ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Materials Modal */}
      {showUploadModal && selectedClass && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          style={{ overflowY: 'auto', backdropFilter: 'blur(2px)' }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return
            setShowUploadModal(false)
            setMaterials('')
            setSelectedClass(null)
          }}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-2xl w-full"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              margin: '20px',
              borderRadius: '14px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
              animation: 'modalIn 140ms ease-out'
            }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Class Materials</h2>
            <p style={{ color: '#6B7280', marginBottom: '24px' }}>
              {selectedClass.name} - Code: <strong>{selectedClass.code}</strong>
            </p>

            <form onSubmit={handleUploadMaterials}>
              <div style={{ marginBottom: '16px' }}>
                <label
                  htmlFor="materials"
                  style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}
                >
                  Course Materials and Information
                </label>
                <textarea
                  id="materials"
                  ref={uploadModalRef}
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="Enter your syllabus, course description, key topics, lecture notes, or any information you want the AI to reference..."
                  rows="12"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'box-shadow 0.15s, border-color 0.15s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3B82F6'
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  required
                />
                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px' }}>
                  The AI will use this information to help students understand your course material
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false)
                    setMaterials('')
                    setSelectedClass(null)
                  }}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!materials.trim() || isUploading}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    opacity: !materials.trim() || isUploading ? '0.5' : '1',
                    cursor: !materials.trim() || isUploading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isUploading ? 'Saving...' : 'Save Materials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteModal && classToDelete && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return
            setShowDeleteModal(false)
            setClassToDelete(null)
          }}
          style={{ backdropFilter: 'blur(2px)' }}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-md w-full"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              borderRadius: '14px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
              animation: 'modalIn 140ms ease-out'
            }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Delete Class?</h2>
            <p style={{ color: '#6B7280', marginBottom: '18px', lineHeight: 1.6 }}>
              This will permanently delete <strong>{classToDelete.name}</strong> and remove it from all students’ dashboards.
            </p>

            <div style={{ padding: '12px', background: '#FEF2F2', borderRadius: '12px', border: '1px solid #FECACA', marginBottom: '22px' }}>
              <div style={{ fontSize: '12px', color: '#991B1B', fontWeight: '800', marginBottom: '4px' }}>
                This action cannot be undone.
              </div>
              <div style={{ fontSize: '12px', color: '#991B1B' }}>
                Class code: <span style={{ fontFamily: 'monospace', fontWeight: '800' }}>{classToDelete.code}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false)
                  setClassToDelete(null)
                }}
                className="btn-secondary"
                style={{ flex: 1 }}
                disabled={isDeleting}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteClass}
                className="btn-primary"
                style={{
                  flex: 1,
                  background: isDeleting ? '#FCA5A5' : '#EF4444',
                  opacity: isDeleting ? '0.75' : '1',
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(8px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

export default Teacher
