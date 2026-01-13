import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import UserMenu from '../components/UserMenu'
import { getTeacherClasses, createClass, updateClassMaterials } from '../utils/storage'

function Teacher() {
  const { user } = useUser()
  const [classes, setClasses] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [newClassName, setNewClassName] = useState('')
  const [newClassSubject, setNewClassSubject] = useState('')
  const [materials, setMaterials] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (user) {
      const teacherClasses = getTeacherClasses(user.id)
      setClasses(teacherClasses)
    }
  }, [user])

  const handleCreateClass = async (e) => {
    e.preventDefault()
    if (!newClassName.trim() || !user) return
    setIsCreating(true)
    await new Promise(r => setTimeout(r, 500))
    const newClass = createClass(user.id, newClassName, newClassSubject)
    setClasses([...classes, newClass])
    setNewClassName('')
    setNewClassSubject('')
    setShowCreateModal(false)
    setIsCreating(false)
  }

  const handleUploadMaterials = async (e) => {
    e.preventDefault()
    if (!materials.trim() || !selectedClass) return
    setIsUploading(true)
    await new Promise(r => setTimeout(r, 500))
    updateClassMaterials(selectedClass.code, materials)
    const updatedClasses = getTeacherClasses(user.id)
    setClasses(updatedClasses)
    setMaterials('')
    setShowUploadModal(false)
    setSelectedClass(null)
    setIsUploading(false)
  }

  const openUploadModal = (classItem) => {
    setSelectedClass(classItem)
    setMaterials(classItem.materials || '')
    setShowUploadModal(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* Navigation */}
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <img src="/Logo.jpg" alt="ClassAI Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>ClassAI</span>
          </Link>
          <UserMenu />
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>My Classes</h1>
            <p style={{ color: '#6B7280' }}>Manage your classes and AI assistants</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="feature-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
            <div style={{ width: '64px', height: '64px', background: '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg style={{ width: '32px', height: '32px', color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '24px' }}>No classes yet</h3>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">Create Your First Class</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {classes.map((classItem) => (
              <div key={classItem.code} className="feature-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <span style={{ padding: '4px 12px', background: classItem.materials ? '#DEF7EC' : '#FEF3C7', color: classItem.materials ? '#059669' : '#D97706', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                      {classItem.materials ? 'Active' : 'Setup Needed'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>{classItem.name}</h3>
                  {classItem.subject && <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px' }}>{classItem.subject}</p>}

                  <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '8px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>Class Code</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: '#111827', fontFamily: 'monospace' }}>{classItem.code}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(classItem.code) }}
                        style={{ padding: '4px 8px', background: 'white', border: '1px solid #D1D5DB', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#6B7280' }}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Class</h2>
            <form onSubmit={handleCreateClass}>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="className" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Class Name *
                </label>
                <input
                  type="text"
                  id="className"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g., Biology 101"
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label htmlFor="classSubject" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  id="classSubject"
                  value={newClassSubject}
                  onChange={(e) => setNewClassSubject(e.target.value)}
                  placeholder="e.g., Life Sciences"
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box' }}
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
                    opacity: (!newClassName.trim() || isCreating) ? '0.5' : '1',
                    cursor: (!newClassName.trim() || isCreating) ? 'not-allowed' : 'pointer'
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ overflowY: 'auto' }}>
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full" style={{ margin: '20px' }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Upload Class Materials
            </h2>
            <p style={{ color: '#6B7280', marginBottom: '24px' }}>
              {selectedClass.name} - Code: <strong>{selectedClass.code}</strong>
            </p>
            
            <form onSubmit={handleUploadMaterials}>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="materials" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Course Materials and Information
                </label>
                <textarea
                  id="materials"
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="Enter your syllabus, course description, key topics, lecture notes, or any information you want the AI to reference when helping students..."
                  rows="12"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
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
                    opacity: (!materials.trim() || isUploading) ? '0.5' : '1',
                    cursor: (!materials.trim() || isUploading) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isUploading ? 'Saving...' : 'Save Materials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Teacher
